import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeRules, createDictionary } from '../src/dictionary.js';

const rule = {source: 'open ai', replacement: 'OpenAI', language: 'en', match_mode: 'word', ignore_case: true};
function fixture(invoke = async () => 'preview') {
  const nodes = new Map();
  const get = id => {
    if (!nodes.has(id)) nodes.set(id, {value: '', textContent: '', innerHTML: '', disabled: false, handlers: {},
      addEventListener(type, fn) {(this.handlers[type] ||= []).push(fn);},
      async fire(type, event = {}) { for (const fn of this.handlers[type] || []) await fn({stopPropagation() {}, ...event}); },
      focus() {}, scrollIntoView() {}
    });
    return nodes.get(id);
  };
  let dictionary;
  let rejectSave = false;
  const saves = [];
  dictionary = createDictionary({root: {querySelector: selector => get(selector.slice(1)), querySelectorAll: () => []}, invoke, locale: () => 'en', save: async () => {saves.push(dictionary.value()); if (rejectSave) throw Error('fail');}});
  const change = async (field, value, index = 0) => get('dictionary-rows').fire('input', {target: {dataset: {ruleField: field}, value, checked: value, closest: () => ({dataset: {ruleIndex: String(index)}})}});
  return {dictionary, get, change, saves, fail: () => {rejectSave = true;}};
}

test('legacy migration preserves match semantics including bracket sources', () => {
  assert.deepEqual(decodeRules('cat => dog\n猫 => 狗'), [
    {source: 'cat', replacement: 'dog', language: '*', match_mode: 'legacy', ignore_case: false},
    {source: '猫', replacement: '狗', language: '*', match_mode: 'legacy', ignore_case: false}
  ]);
  assert.equal(decodeRules('[newline] => text')[0].source, '[newline]');
  assert.deepEqual(decodeRules(JSON.stringify([rule])), [rule]);
  assert.throws(() => decodeRules('[{"source": invalid => JSON}]'));
  assert.throws(() => decodeRules('[{}]'));
});

test('structured rules render multilingual options and escape hostile values', () => {
  const {dictionary, get} = fixture();
  dictionary.load(JSON.stringify([{...rule, source: '<img onerror="attack()">', replacement: '" autofocus'}]));
  const html = get('dictionary-rows').innerHTML;
  assert.ok(!html.includes('<img'));
  assert.match(html, /&lt;img/);
  assert.match(html, /value="fr"/);
  assert.match(html, /value="ja"/);
  assert.match(html, /value="word" selected/);
  assert.match(html, /type="checkbox" data-rule-field="ignore_case" checked/);
});

test('preview uses unsaved rules via backend and makes no save call', async () => {
  const calls = [];
  const {dictionary, get, change, saves} = fixture(async (...args) => {calls.push(args); return '<safe result>';});
  dictionary.load(JSON.stringify([rule]));
  await change('replacement', 'Open AI');
  get('dictionary-test-text').value = 'OPEN AI';
  get('dictionary-test-language').value = 'en';
  await get('preview-dictionary').fire('click');
  assert.equal(calls[0][0], 'preview_text_rules');
  assert.equal(JSON.parse(calls[0][1].textRules)[0].replacement, 'Open AI');
  assert.equal(calls[0][1].language, 'en');
  assert.equal(get('dictionary-test-result').textContent, '<safe result>');
  assert.deepEqual(saves, []);
  assert.equal(JSON.parse(dictionary.value())[0].replacement, 'OpenAI');
});

test('rule changes invalidate an in-flight preview', async () => {
  let resolve;
  const {dictionary, get, change} = fixture(() => new Promise(done => {resolve = done;}));
  dictionary.load(JSON.stringify([rule]));
  const pending = get('preview-dictionary').fire('click');
  await change('source', 'git hub');
  resolve('stale'); await pending;
  assert.equal(get('dictionary-test-result').textContent, '');
});

test('add from history loads original for testing but requires explicit rule and save', async () => {
  const {dictionary, get, change, saves} = fixture();
  dictionary.load('');
  dictionary.addFromResult('I use OPEN AI.');
  assert.equal(get('dictionary-test-text').value, 'I use OPEN AI.');
  assert.equal(dictionary.value(), '');
  await get('save-text-rules').fire('click');
  assert.equal(saves.length, 0);
  await change('source', 'open ai');
  await change('replacement', 'OpenAI');
  await change('language', 'en');
  await change('match_mode', 'word');
  await change('ignore_case', true);
  await get('save-text-rules').fire('click');
  assert.deepEqual(JSON.parse(saves[0]), [rule]);
});

test('malformed dictionary does not silently overwrite saved raw data', async () => {
  const {dictionary, get, saves} = fixture();
  dictionary.load('[broken');
  assert.equal(dictionary.value(), '[broken');
  assert.equal(get('save-text-rules').disabled, true);
  await get('save-text-rules').fire('click');
  assert.equal(saves.length, 0);
  assert.equal(dictionary.value(), '[broken');
});

test('rule deletion is a draft until save and failed save preserves saved version', async () => {
  const raw = JSON.stringify([rule]);
  const {dictionary, get, fail} = fixture();
  dictionary.load(raw);
  await get('dictionary-rows').fire('click', {target: {closest: () => ({dataset: {deleteRule: '0'}})}});
  assert.equal(dictionary.value(), raw);
  fail();
  await get('save-text-rules').fire('click');
  assert.equal(dictionary.value(), raw);
});
