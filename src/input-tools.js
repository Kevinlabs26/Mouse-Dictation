import { escapeHtml } from './html.js';
import { dictionaryMarkup, createDictionary } from './dictionary.js';

const EN = {
  '输入助手': 'Input tools', '个人词典': 'Personal dictionary',
  '适用于在线 API 和本地非流式模型。实时模型暂不支持这些功能，即使选择说完输出。': 'For online API and local non-streaming models. Streaming models do not support these helpers, even in final-output mode.',
  '保存词典': 'Save dictionary', '词典已保存': 'Dictionary saved', '保存失败': 'Save failed',
  '显式排版标记': 'Explicit formatting markers',
  '将识别文本中的【换行】或 [newline] 转成换行，【分段】或 [paragraph] 转成空行。不是普通口述命令；仅说完输出生效，不执行发送或删除。': 'Convert literal 【换行】 / [newline] markers to line breaks and 【分段】 / [paragraph] to paragraphs. Not ordinary spoken commands. Final output only; never sends or deletes.',
  '最近结果': 'Recent results', '在内存中保留最近结果': 'Keep recent results in memory',
  '默认关闭；最多 10 条，不写入磁盘，退出或关闭开关即清空。仅说完输出；不保留录音。': 'Off by default. Up to 10 results, memory only; cleared on exit or when disabled. Final output only; audio is not retained.',
  '刷新': 'Refresh', '清空': 'Clear', '暂无结果': 'No results yet',
  '保留已关闭': 'Result retention is off', '复制结果': 'Copy result', '复制原文': 'Copy original',
  '原始识别文本': 'Original transcription', '已复制，请切换到目标窗口粘贴': 'Copied. Switch to the target window and paste.',
  '读取失败': 'Unable to load results', '操作失败': 'Action failed', '添加纠错': 'Add correction',
  '结果已保留，可复制后粘贴到目标窗口。': 'Result retained. Copy and paste into the target window.'
};

export function inputToolsMarkup() {
  return `<section class="pane" id="pane-input-tools">
    <p class="hint" data-tools-label="适用于在线 API 和本地非流式模型。实时模型暂不支持这些功能，即使选择说完输出。"></p>
    ${dictionaryMarkup()}
    <div class="group">
      <div class="switch-row"><b data-tools-label="显式排版标记"></b><label class="switch"><input id="voice-formatting" type="checkbox" aria-label="Explicit formatting markers"><span class="track"></span></label></div>
      <p class="hint" data-tools-label="将识别文本中的【换行】或 [newline] 转成换行，【分段】或 [paragraph] 转成空行。不是普通口述命令；仅说完输出生效，不执行发送或删除。"></p>
    </div>
    <div class="group">
      <h3 class="group-title" data-tools-label="最近结果"></h3>
      <div class="switch-row"><b data-tools-label="在内存中保留最近结果"></b><label class="switch"><input id="remember-results" type="checkbox" aria-label="Keep recent results in memory"><span class="track"></span></label></div>
      <p class="hint" data-tools-label="默认关闭；最多 10 条，不写入磁盘，退出或关闭开关即清空。仅说完输出；不保留录音。"></p>
      <div class="tools-actions"><button id="refresh-results" class="ghost" type="button" data-tools-label="刷新"></button><button id="clear-results" class="ghost danger" type="button" data-tools-label="清空"></button></div>
      <div id="recent-results" aria-live="polite" data-user-content></div>
    </div>
  </section>`;
}

export function createInputTools({ invoke, locale, save, status, root = document }) {
  const $ = id => root.querySelector(`#${id}`);
  const tr = text => locale() === 'zh' ? text : EN[text] || text;
  let results = [];
  let revision = 0;
  let enabled = false;
  const dictionary = createDictionary({ root, invoke, locale, save });
  function render() {
    dictionary.render();
    root.querySelectorAll('[data-tools-label]').forEach(node => { node.textContent = tr(node.dataset.toolsLabel); });
    $('voice-formatting').setAttribute('aria-label', tr('显式排版标记'));
    $('remember-results').setAttribute('aria-label', tr('在内存中保留最近结果'));
    $('clear-results').title = tr('清空');
    $('recent-results').innerHTML = !enabled || !results.length
      ? `<p class="hint">${tr(enabled ? '暂无结果' : '保留已关闭')}</p>`
      : results.map(entry => `<article class="recent-result">
        <time>${escapeHtml(new Date(entry.created_at * 1000).toLocaleString())}</time>
        ${entry.error ? `<p class="result-error">${escapeHtml(entry.error)}</p>` : ''}
        <pre>${escapeHtml(entry.text)}</pre>
        ${entry.original !== entry.text ? `<details><summary>${tr('原始识别文本')}</summary><pre>${escapeHtml(entry.original)}</pre></details>` : ''}
        <div class="tools-actions"><button class="ghost" type="button" data-result-id="${escapeHtml(entry.id)}" data-original="false">${tr('复制结果')}</button>${entry.original !== entry.text ? `<button class="ghost" type="button" data-result-id="${escapeHtml(entry.id)}" data-original="true">${tr('复制原文')}</button>` : ''}<button class="ghost" type="button" data-add-correction="${escapeHtml(entry.id)}">${tr('添加纠错')}</button></div>
      </article>`).join('');
    $('clear-results').disabled = !enabled || !results.length;
  }
  async function refresh() {
    const current = ++revision;
    if (!enabled) { results = []; render(); return; }
    try {
      const next = await invoke('get_recent_results');
      if (current !== revision || !enabled) return;
      results = next;
      render();
    } catch (error) { if (current === revision) status(tr('读取失败'), String(error), 'error'); }
  }
  function load(settings) {
    const textRules = settings.text_rules || '';
    if (textRules !== dictionary.value()) dictionary.load(textRules);
    $('voice-formatting').checked = !!settings.voice_formatting;
    enabled = !!settings.remember_results;
    $('remember-results').checked = enabled;
    if (!enabled) { ++revision; results = []; }
    render();
    void refresh();
  }
  function values() {
    return { text_rules: dictionary.value(), voice_formatting: $('voice-formatting').checked, remember_results: $('remember-results').checked };
  }
  // These controls have explicit save behavior rather than the application's debounced autosave.
  for (const id of ['voice-formatting', 'remember-results']) {
    for (const event of ['input', 'change']) $(id).addEventListener(event, e => e.stopPropagation());
  }
  for (const id of ['voice-formatting', 'remember-results']) $(id).addEventListener('change', async () => {
    const control = $(id);
    const wanted = control.checked;
    control.disabled = true;
    if (id === 'remember-results' && !wanted) { enabled = false; ++revision; results = []; render(); }
    try { await save(); enabled = $('remember-results').checked; await refresh(); }
    catch (error) { control.checked = !wanted; enabled = $('remember-results').checked; status(tr('保存失败'), String(error), 'error'); await refresh(); }
    finally { control.disabled = false; }
  });
  $('refresh-results').addEventListener('click', refresh);
  $('clear-results').addEventListener('click', async () => {
    try { await invoke('clear_recent_results'); ++revision; results = []; render(); }
    catch (error) { status(tr('操作失败'), String(error), 'error'); }
  });
  $('recent-results').addEventListener('click', async event => {
    const add = event.target.closest('[data-add-correction]');
    if (add?.dataset.addCorrection !== undefined) {
      const entry = results.find(item => String(item.id) === add.dataset.addCorrection);
      if (entry) dictionary.addFromResult(entry.original);
      return;
    }
    const button = event.target.closest('[data-result-id]');
    if (!button) return;
    button.disabled = true;
    try {
      await invoke('copy_recent_result', { id: Number(button.dataset.resultId), original: button.dataset.original === 'true' });
      status(tr('已复制，请切换到目标窗口粘贴'), '', 'done');
    } catch (error) { status(tr('操作失败'), String(error), 'error'); }
    finally { button.disabled = false; }
  });
  return { load, values, refresh, render };
}
