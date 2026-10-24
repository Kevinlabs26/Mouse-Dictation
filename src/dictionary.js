import { escapeHtml } from './html.js';

export const DICTIONARY_LANGUAGES = ['*', 'en', 'zh', 'fr', 'ja', 'ko', 'de', 'es', 'ru', 'pt', 'it', 'nl', 'pl', 'tr', 'ar', 'hi', 'id', 'ms', 'th', 'vi', 'uk', 'fa', 'he', 'el', 'sv', 'da', 'fi', 'hu', 'ro', 'cs', 'bg', 'ca', 'bn', 'ta', 'no'];
const EN = {
  '识别文字': 'Recognized text', '正确文字': 'Correct text', '适用语言': 'Language', '匹配方式': 'Match mode',
  '所有语言': 'All languages', '自动识别（仅通用规则）': 'Auto (common rules only)', '忽略大小写': 'Ignore case',
  '精确短语': 'Exact phrase', '整词': 'Whole word', '兼容旧规则': 'Legacy matching', '删除': 'Delete',
  '添加规则': 'Add rule', '保存词典': 'Save dictionary', '词典已保存': 'Dictionary saved', '保存失败': 'Save failed',
  '尚无规则，点击添加规则开始。': 'No rules yet. Add a rule to start.',
  '按语言配置文字纠错；空的正确文字表示删除。整词适合英文、法文等，中文、日文建议精确短语。最长匹配优先，不连锁替换。': 'Scope corrections by language. Empty replacement deletes text. Whole-word matching suits English/French; use exact phrases for Chinese/Japanese. Longest match wins; no cascading.',
  '测试纠错': 'Test corrections', '测试文本': 'Test text', '测试语言': 'Test language', '纠错结果': 'Corrected result',
  '使用未保存的规则预览；不调用 API，不发送到其他窗口，不写入最近结果。自动识别只应用通用规则。': 'Preview unsaved rules locally: no API, insertion or history writes. Auto applies common rules only.',
  '测试失败': 'Preview failed', '规则已修改，保存后生效。': 'Rules changed. Save to apply.',
  '旧规则已载入并保留原匹配方式；保存后转换为新版格式。': 'Legacy rules loaded with matching preserved. Saving converts them to the new format.',
  '词典读取失败，原数据未修改。': 'Unable to read dictionary. Original data is unchanged.',
  '最多 256 条规则。': 'Maximum 256 rules.', '请填写识别文字。': 'Enter recognized text.',
  '大小写采用 Unicode 小写比较，不做语言专属折叠或重音归一化。': 'Case-insensitive matching uses Unicode lowercase, not locale-specific folding or accent normalization.',
  '已带入原文，请在规则中填写需要纠正的片段和正确文字，然后保存。': 'Original loaded for testing. Enter the incorrect fragment and its correction in the rule, then save.'
};

export function decodeRules(raw) {
  if (!raw.trim()) return [];
  const trimmed = raw.trimStart();
  const legacyHead = trimmed.split(/\r?\n/, 1)[0];
  const legacy = legacyHead.includes('=>') && !/^\[\s*(?:\{|"|\])|^\{\s*(?:"|\})/.test(trimmed);
  if (/^[\[{]/.test(trimmed) && !legacy) {
    const data = JSON.parse(raw);
    if (!Array.isArray(data) || data.length > 256) throw Error('Invalid dictionary');
    return data.map(rule => {
      if (!rule || Object.keys(rule).some(key => !['source', 'replacement', 'language', 'match_mode', 'ignore_case'].includes(key)) || typeof rule.source !== 'string' || typeof rule.replacement !== 'string' || !DICTIONARY_LANGUAGES.includes(rule.language) || !['legacy', 'exact', 'word'].includes(rule.match_mode) || typeof rule.ignore_case !== 'boolean') throw Error('Invalid rule');
      return { ...rule };
    });
  }
  return raw.split(/\r?\n/).filter(line => line.trim()).map(line => {
    const split = line.indexOf('=>');
    if (split < 0 || !line.slice(0, split).trim()) throw Error('Invalid legacy rule');
    return { source: line.slice(0, split).trim(), replacement: line.slice(split + 2).trim(), language: '*', match_mode: 'legacy', ignore_case: false };
  });
}

export function dictionaryMarkup() {
  return `<div class="group" id="dictionary-editor">
    <h3 class="group-title" data-tools-label="个人词典"></h3>
    <p class="hint" data-dict-label="按语言配置文字纠错；空的正确文字表示删除。整词适合英文、法文等，中文、日文建议精确短语。最长匹配优先，不连锁替换。"></p>
    <div id="dictionary-rows" data-user-content></div>
    <div class="tools-actions"><button id="add-dictionary-rule" class="ghost" type="button" data-dict-label="添加规则"></button><button id="save-text-rules" class="ghost" type="button" data-dict-label="保存词典"></button></div>
    <p id="tools-feedback" class="hint" role="status" data-user-content></p>
    <p class="hint" data-dict-label="大小写采用 Unicode 小写比较，不做语言专属折叠或重音归一化。"></p>
    <details class="dictionary-preview"><summary data-dict-label="测试纠错"></summary>
      <p class="hint" data-dict-label="使用未保存的规则预览；不调用 API，不发送到其他窗口，不写入最近结果。自动识别只应用通用规则。"></p>
      <label for="dictionary-test-language" data-dict-label="测试语言"></label><select id="dictionary-test-language"></select>
      <label for="dictionary-test-text" data-dict-label="测试文本"></label><textarea id="dictionary-test-text" rows="3" maxlength="32768" spellcheck="false"></textarea>
      <button id="preview-dictionary" class="ghost" type="button" data-dict-label="测试纠错"></button>
      <label for="dictionary-test-result" data-dict-label="纠错结果"></label><pre id="dictionary-test-result" data-user-content role="status"></pre>
    </details>
  </div>`;
}

export function createDictionary({ root, invoke, locale, save }) {
  const $ = id => root.querySelector(`#${id}`);
  const tr = text => locale() === 'zh' ? text : EN[text] || text;
  let saved = '';
  let rules = [];
  let loadError = false;
  let saving = false;
  let previewRevision = 0;
  let renderedLocale;
  const labelLanguage = code => {
    if (code === '*') return tr('所有语言');
    try { return new Intl.DisplayNames([locale()], {type: 'language'}).of(code) || code.toUpperCase(); }
    catch { return code.toUpperCase(); }
  };
  const options = (list, selected, label) => list.map(value => `<option value="${value}"${value === selected ? ' selected' : ''}>${escapeHtml(label(value))}</option>`).join('');
  function feedback(text) { $('tools-feedback').textContent = tr(text); }
  function invalidate() { ++previewRevision; $('dictionary-test-result').textContent = ''; feedback('规则已修改，保存后生效。'); }
  function renderRows() {
    $('dictionary-rows').innerHTML = rules.length ? rules.map((rule, index) => `<fieldset class="dictionary-rule" data-rule-index="${index}"${saving ? ' disabled' : ''}><legend>${index + 1}</legend>
      <label>${tr('识别文字')}<input data-rule-field="source" value="${escapeHtml(rule.source)}" maxlength="32768" spellcheck="false"></label>
      <label>${tr('正确文字')}<input data-rule-field="replacement" value="${escapeHtml(rule.replacement)}" maxlength="32768" spellcheck="false"></label>
      <label>${tr('适用语言')}<select data-rule-field="language">${options(DICTIONARY_LANGUAGES, rule.language, labelLanguage)}</select></label>
      <label>${tr('匹配方式')}<select data-rule-field="match_mode">${options(['exact', 'word', 'legacy'], rule.match_mode, mode => tr({exact: '精确短语', word: '整词', legacy: '兼容旧规则'}[mode]))}</select></label>
      <label class="dictionary-case"><input type="checkbox" data-rule-field="ignore_case"${rule.ignore_case ? ' checked' : ''}>${tr('忽略大小写')}</label>
      <button class="ghost danger" type="button" data-delete-rule="${index}" aria-label="${tr('删除')} ${index + 1}">${tr('删除')}</button>
    </fieldset>`).join('') : `<p class="hint">${tr('尚无规则，点击添加规则开始。')}</p>`;
  }
  function render() {
    if (renderedLocale === locale()) return;
    renderedLocale = locale();
    root.querySelectorAll('[data-dict-label]').forEach(node => { node.textContent = tr(node.dataset.dictLabel); });
    const language = $('dictionary-test-language').value || 'auto';
    $('dictionary-test-language').innerHTML = options(['auto', ...DICTIONARY_LANGUAGES.filter(code => code !== '*')], language, code => code === 'auto' ? tr('自动识别（仅通用规则）') : labelLanguage(code));
    renderRows();
  }
  function load(raw = '') {
    saved = raw;
    ++previewRevision;
    $('dictionary-test-result').textContent = '';
    try { rules = decodeRules(raw); loadError = false; feedback(raw.trim() && !raw.trimStart().startsWith('[') ? '旧规则已载入并保留原匹配方式；保存后转换为新版格式。' : ''); }
    catch { rules = []; loadError = true; feedback('词典读取失败，原数据未修改。'); }
    $('save-text-rules').disabled = loadError;
    $('add-dictionary-rule').disabled = loadError;
    renderedLocale = undefined;
    render();
  }
  function serialize() {
    if (loadError) throw Error(tr('词典读取失败，原数据未修改。'));
    if (rules.some(rule => !rule.source.trim())) throw Error(tr('请填写识别文字。'));
    return JSON.stringify(rules);
  }
  function addFromResult(text) {
    if (loadError || saving) return;
    if (rules.length >= 256) { feedback('最多 256 条规则。'); return; }
    rules.push({source: '', replacement: '', language: '*', match_mode: 'exact', ignore_case: false});
    invalidate(); renderRows();
    $('dictionary-test-text').value = text;
    $('dictionary-test-language').value = 'auto';
    const details = root.querySelector('.dictionary-preview');
    if (details) details.open = true;
    feedback('已带入原文，请在规则中填写需要纠正的片段和正确文字，然后保存。');
    root.querySelector('[data-rule-index]:last-child input')?.focus();
    $('dictionary-editor').scrollIntoView?.({block: 'start'});
  }
  $('add-dictionary-rule').addEventListener('click', () => addFromResult($('dictionary-test-text').value));
  const update = event => {
    if (saving) return;
    const field = event.target.dataset.ruleField;
    const row = event.target.closest('[data-rule-index]');
    if (!field || !row) return;
    const index = Number(row.dataset.ruleIndex);
    if (!rules[index]) return;
    rules[index][field] = field === 'ignore_case' ? event.target.checked : event.target.value;
    invalidate();
  };
  $('dictionary-rows').addEventListener('input', update);
  $('dictionary-rows').addEventListener('change', update);
  $('dictionary-rows').addEventListener('click', event => {
    const button = event.target.closest('[data-delete-rule]');
    if (!button || saving) return;
    rules.splice(Number(button.dataset.deleteRule), 1); invalidate(); renderRows();
  });
  $('save-text-rules').addEventListener('click', async () => {
    const before = saved;
    try {
      saved = serialize(); saving = true;
      $('save-text-rules').disabled = true;
      $('add-dictionary-rule').disabled = true;
      renderRows();
      await save(); feedback('词典已保存');
    } catch (error) { saved = before; $('tools-feedback').textContent = `${tr('保存失败')}: ${String(error)}`; }
    finally { saving = false; $('save-text-rules').disabled = loadError; $('add-dictionary-rule').disabled = loadError; renderRows(); }
  });
  $('preview-dictionary').addEventListener('click', async () => {
    const ticket = ++previewRevision;
    try {
      const output = await invoke('preview_text_rules', {textRules: serialize(), text: $('dictionary-test-text').value, language: $('dictionary-test-language').value || 'auto'});
      if (ticket === previewRevision) $('dictionary-test-result').textContent = output;
    } catch (error) { if (ticket === previewRevision) $('dictionary-test-result').textContent = `${tr('测试失败')}: ${String(error)}`; }
  });
  for (const id of ['dictionary-test-text', 'dictionary-test-language']) {
    $(id).addEventListener('input', () => { ++previewRevision; $('dictionary-test-result').textContent = ''; });
    $(id).addEventListener('change', () => { ++previewRevision; $('dictionary-test-result').textContent = ''; });
  }
  for (const event of ['input', 'change']) $('dictionary-editor').addEventListener(event, e => e.stopPropagation());
  return { load, render, value: () => saved, addFromResult };
}
