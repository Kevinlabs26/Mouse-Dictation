import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createInputTools } from '../src/input-tools.js';

const source = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const between = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));

function fixture() {
  const nodes = new Map();
  const get = id => {
    if (!nodes.has(id)) nodes.set(id, {
      value: '', checked: false, hidden: false, disabled: false, dataset: {}, handlers: {}, textContent: '', innerHTML: '',
      classList: {add() {}, remove() {}, toggle() {}}, style: {setProperty() {}},
      addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); },
      setAttribute() {}, focus() {}, scrollIntoView() {},
      async fire(type, event = {}) { for (const fn of this.handlers[type] || []) await fn({stopPropagation() {}, ...event}); }
    });
    return nodes.get(id);
  };
  const root = {querySelector: selector => get(selector.slice(1)), querySelectorAll: () => []};
  const calls = [];
  const saves = [];
  const states = [];
  const handlers = new Map();
  const stored = new Map();
  const invoke = async (name, payload) => {
    calls.push([name, payload]);
    if (name === 'save_settings') saves.push(payload.settings);
    return name === 'get_recent_results' ? [] : '';
  };
  let context;
  const tools = createInputTools({root, invoke, locale: () => 'zh', save: () => vm.runInContext('saveSettings()', context), status() {}});
  const noop = () => {};
  context = vm.createContext({
    $: get, document: {...root, documentElement: {dataset: {}}},
    localStorage: {setItem: (key, value) => stored.set(key, value)},
    invoke, inputTools: tools, listen: (event, handler) => handlers.set(event, handler),
    setEngine: value => { context.engine = value; },
    renderAudioDevices: value => { get('input-device').value = value; }, refreshAudioStatus: async () => {},
    setManualModelMode: noop, setModelOptions: noop, updateProviderUi: noop,
    updateHotkeyUi: noop, updateEngineHotkeyUi: noop, updateTranslateHotkeyUi: noop,
    updateLanguageOptions: noop, setManualTranslationModelMode: noop, setTranslationModelOptions: noop,
    updateTranslateUi: noop, updateOutputModeUi: noop, refreshProfiles: async () => {}, applyAccent: noop,
    matchProvider: () => '', matchTranslateChannel: () => '', modelValue: () => '', translationModelValue: () => '',
    setTimeout: noop, setStatus: (...args) => states.push(args), t: value => value,
    PROVIDERS: {openai: {url: ''}}, DEFAULT_RECORDING_HOTKEY: 'disabled',
    engine: 'online', theme: 'dark', accentColor: '#8b7cff', pendingText: ''
  });
  vm.runInContext([
    between('function applyTheme(', 'const initialTheme ='),
    between('function updateHoldDisplay()', 'function hotkeyLabel('),
    between('function updateAccentUi()', 'function setAccent('),
    between('async function saveSettings()', 'async function testApi()'),
    between('function setPendingResult(', 'async function init()'),
    between('  $("copy-pending-result").addEventListener', '  document.querySelectorAll(".tab")'),
    between('  await listen("settings-changed"', '  await listen("dictation-partial"').replace('await listen(', 'listen('),
    between('  await listen("dictation-state"', '  await listen("settings-changed"').replaceAll('await listen(', 'listen(')
  ].join('\n'), context);
  return {get, tools, calls, saves, states, stored,
    settings: payload => handlers.get('settings-changed')({payload}),
    state: payload => handlers.get('dictation-state')({payload}),
    recover: text => handlers.get('dictation-recovery')({payload: {text}}),
    error: payload => handlers.get('dictation-error')({payload}),
    save: () => vm.runInContext('saveSettings()', context)};
}

test('profile events apply hold time and appearance before the next autosave', async () => {
  const {get, settings, save, saves, stored} = fixture();
  get('hold-ms').value = '2000';
  settings({engine: 'online', hold_ms: 500, theme: 'light', accent: '#00ff00'});
  assert.equal(get('hold-val').textContent, '500 ms');
  assert.equal(get('accent-custom').value, '#00ff00');
  assert.equal(stored.get('md-theme'), 'light');
  assert.equal(stored.get('md-accent'), '#00ff00');
  await save();
  assert.equal(saves[0].hold_ms, 500);
  assert.equal(saves[0].theme, 'light');
  assert.equal(saves[0].accent, '#00ff00');
});

test('unrelated settings events preserve dictionary drafts; changed saved rules replace them', async () => {
  const {get, tools, settings, calls, saves} = fixture();
  const saved = 'old => old replacement';
  tools.load({text_rules: saved});
  await get('dictionary-rows').fire('input', {target: {dataset: {ruleField: 'source'}, value: 'unsaved new source', closest: () => ({dataset: {ruleIndex: '0'}})}});
  settings({text_rules: saved, translate_on: true, hold_ms: 1000});
  await get('preview-dictionary').fire('click');
  assert.equal(JSON.parse(calls.at(-1)[1].textRules)[0].source, 'unsaved new source');
  assert.equal(tools.values().text_rules, saved);
  assert.equal(saves.length, 0);
  settings({text_rules: 'other => profile replacement', hold_ms: 1000});
  await get('preview-dictionary').fire('click');
  assert.equal(JSON.parse(calls.at(-1)[1].textRules)[0].source, 'other');
});

test('startup and cancellation events describe pending dictation honestly', () => {
  const {get, state, states} = fixture();
  state('starting');
  assert.equal(get('live-preview').hidden, true);
  assert.deepEqual(states.at(-1), ['正在准备录音', '正在启动麦克风，Esc 可取消', 'processing']);
  state('cancelled');
  assert.deepEqual(states.at(-1), ['听写已取消', '未输入的结果已丢弃', 'idle']);
});

test('failed insertion exposes the latest text with history off and copies only on click', async () => {
  const {get, recover, error, calls, stored} = fixture();
  get('remember-results').checked = false;
  recover('older text');
  const text = '<img src=x onerror="attack()">\nprivate result';
  recover(text);
  error('input target changed');
  assert.equal(get('pending-result').hidden, false);
  assert.equal(get('pending-result-text').textContent, text);
  assert.equal(get('pending-result-text').innerHTML, '');
  assert.equal(calls.length, 0);
  assert.equal(stored.size, 0);
  await get('copy-pending-result').fire('click');
  assert.equal(calls[0][0], 'copy_pending_result');
  assert.equal(calls[0][1].text, text);
  assert.equal(get('copy-pending-result').disabled, false);
  await get('discard-pending-result').fire('click');
  assert.equal(get('pending-result').hidden, true);
  assert.equal(get('pending-result-text').textContent, '');
});

test('new recording and cancellation clear pending text without copying it', async () => {
  const {get, recover, state, calls} = fixture();
  for (const stage of ['starting', 'recording', 'cancelled']) {
    recover('private pending text');
    state(stage);
    assert.equal(get('pending-result').hidden, true);
    assert.equal(get('pending-result-text').textContent, '');
    await get('copy-pending-result').fire('click');
  }
  assert.equal(calls.length, 0);
});
