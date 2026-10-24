import test from 'node:test';
import assert from 'node:assert/strict';
import { createInputTools, inputToolsMarkup } from '../src/input-tools.js';

function fixture(invoke = async () => []) {
  const nodes = new Map();
  const get = id => {
    if (!nodes.has(id)) nodes.set(id, {
      value: '', checked: false, disabled: false, dataset: {}, handlers: {}, innerHTML: '', textContent: '',
      addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); },
      setAttribute() {}, focus() {}, scrollIntoView() {},
      async fire(type, event = {}) { for (const fn of this.handlers[type] || []) await fn({stopPropagation() {}, ...event}); }
    });
    return nodes.get(id);
  };
  let tools;
  let failSave = false;
  const saves = [];
  const errors = [];
  tools = createInputTools({
    invoke, locale: () => 'zh', root: {querySelector: selector => get(selector.slice(1)), querySelectorAll: () => []},
    save: async () => { saves.push(tools.values()); if (failSave) throw Error('no save'); },
    status: (...args) => errors.push(args)
  });
  return {tools, get, saves, errors, fail: () => { failSave = true; }};
}

test('input tools default to disabled and do not fetch private history', async () => {
  let calls = 0;
  const {tools, get} = fixture(async () => { ++calls; return []; });
  tools.load({});
  await tools.refresh();
  assert.equal(calls, 0);
  assert.deepEqual(tools.values(), {text_rules: '', voice_formatting: false, remember_results: false});
  assert.match(get('recent-results').innerHTML, /保留已关闭/);
});

test('dictionary drafts are not autosaved by unrelated controls; explicit save commits', async () => {
  const {tools, get, saves, fail} = fixture();
  tools.load({text_rules: '旧 => 新'});
  const changeSource = value => get('dictionary-rows').fire('input', {target: {dataset: {ruleField: 'source'}, value, closest: () => ({dataset: {ruleIndex: '0'}})}});
  await changeSource('欧盆');
  assert.equal(tools.values().text_rules, '旧 => 新');
  await get('save-text-rules').fire('click');
  assert.equal(JSON.parse(saves[0].text_rules)[0].source, '欧盆');
  await changeSource('changed');
  fail();
  await get('save-text-rules').fire('click');
  assert.equal(JSON.parse(tools.values().text_rules)[0].source, '欧盆');
  assert.match(get('tools-feedback').textContent, /保存失败/);
});

test('history output escapes transcript, original, error and ID', async () => {
  const hostile = '<img src=x onerror="attack()">';
  const {tools, get} = fixture(async () => [{id: '" onclick="attack()', text: hostile, original: '<script>attack()</script>', error: hostile, created_at: 100}]);
  tools.load({remember_results: true});
  await tools.refresh();
  const html = get('recent-results').innerHTML;
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('<script>'));
  assert.match(html, /&lt;img/);
  assert.match(html, /data-result-id="&quot;/);
});

test('turning off history rejects stale in-flight refreshes', async () => {
  const pending = [];
  const {tools, get} = fixture(() => new Promise(resolve => pending.push(resolve)));
  tools.load({remember_results: true});
  tools.load({remember_results: false});
  pending[0]([{id: 1, text: 'secret', original: 'secret', error: null, created_at: 100}]);
  await Promise.resolve();
  await Promise.resolve();
  assert.ok(!get('recent-results').innerHTML.includes('secret'));
});

test('copy action explicitly requests clipboard copy and never simulated input', async () => {
  const calls = [];
  const {get} = fixture(async (...args) => { calls.push(args); return []; });
  const button = {dataset: {resultId: '42', original: 'true'}};
  await get('recent-results').fire('click', {target: {closest: () => button}});
  assert.deepEqual(calls, [['copy_recent_result', {id: 42, original: true}]]);
  assert.equal(button.disabled, false);
});

test('history add correction uses raw ASR, never translated output or automatic save', async () => {
  const {tools, get, saves} = fixture(async () => [{id: 7, text: 'translated', original: 'raw ASR', created_at: 100}]);
  tools.load({remember_results: true});
  await tools.refresh();
  await get('recent-results').fire('click', {target: {closest: selector => selector === '[data-add-correction]' ? {dataset: {addCorrection: '7'}} : null}});
  assert.equal(get('dictionary-test-text').value, 'raw ASR');
  assert.deepEqual(saves, []);
  assert.match(get('dictionary-rows').innerHTML, /data-rule-index="0"/);
});

test('retention changes save immediately and failed saves roll back checkbox', async () => {
  const {tools, get, saves, fail, errors} = fixture();
  tools.load({});
  get('remember-results').checked = true;
  await get('remember-results').fire('change');
  assert.equal(saves[0].remember_results, true);
  fail();
  get('remember-results').checked = false;
  await get('remember-results').fire('change');
  assert.equal(get('remember-results').checked, true);
  assert.equal(get('remember-results').disabled, false);
  assert.equal(errors[0][0], '保存失败');
});

test('tools markup uses explicit opt-in controls without checked defaults', () => {
  const html = inputToolsMarkup();
  assert.ok(!/\bchecked\b/.test(html));
  assert.match(html, /maxlength="32768"/);
  assert.match(html, /data-user-content/);
});
