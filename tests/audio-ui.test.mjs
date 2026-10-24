import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const audioCode = source.slice(source.indexOf('function renderAudioDevices('), source.indexOf('async function onModelAction('));

function fixture(status, invoke = async () => status) {
  const select = {value: '', replaceChildren(...children) { this.children = children; }};
  const message = {textContent: '', classList: {toggle() {}}};
  const context = vm.createContext({
    audioStatus: status, invoke, t: value => value,
    $: id => id === 'input-device' ? select : message,
    Option: function (text, value) { this.text = text; this.value = value; },
    setStatus() { throw Error('A device refresh must not overwrite the recording status'); }
  });
  vm.runInContext(audioCode, context);
  return {select, message, context};
}

test('microphone options preserve literal device names and the system-default choice', () => {
  const name = '<option onclick="attack()">Headset & mic';
  const {select, context} = fixture({available: true, detail: name, devices: [name]});
  context.selected = name;
  vm.runInContext('renderAudioDevices(selected)', context);
  assert.equal(select.children[0].value, '');
  assert.equal(select.children[1].value, name);
  assert.equal(select.children[1].text, name);
  assert.equal(select.value, name);
});

test('a disconnected selected microphone remains visible instead of switching to default', async () => {
  const {select, message, context} = fixture({available: false, detail: 'Selected headset is disconnected', devices: ['Laptop mic']});
  select.value = 'Headset mic';
  await vm.runInContext('refreshAudioStatus()', context);
  assert.equal(select.value, 'Headset mic');
  assert.equal(select.children[2].value, 'Headset mic');
  assert.match(select.children[2].text, /不可用/);
  assert.match(message.textContent, /disconnected/);
});

test('stale microphone refreshes cannot reset a newly selected device', async () => {
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  const {select, message, context} = fixture(null, () => pending);
  select.value = 'Old mic';
  const refresh = vm.runInContext('refreshAudioStatus()', context);
  select.value = 'New mic';
  resolve({available: true, detail: 'Old mic', devices: ['Old mic']});
  await refresh;
  assert.equal(select.value, 'New mic');
  assert.equal(message.textContent, '');
});

test('microphone query errors retain the selected device and explain the failure', async () => {
  const {select, message, context} = fixture(null, async () => { throw Error('device query failed'); });
  select.value = 'Headset mic';
  await vm.runInContext('refreshAudioStatus()', context);
  assert.equal(select.value, 'Headset mic');
  assert.match(message.textContent, /device query failed/);
});

test('settings saves preserve the exact microphone name and empty system-default value', async () => {
  const calls = [];
  const device = {value: '  USB headset  '};
  const field = {value: '', checked: false, classList: {add() {}, remove() {}}};
  const code = source.slice(source.indexOf('async function saveSettings()'), source.indexOf('async function testApi()'));
  const context = vm.createContext({
    $: id => id === 'input-device' ? device : field,
    inputTools: {values: () => ({text_rules: 'existing dictionary'})},
    invoke: async (...args) => { calls.push(args); }, setTimeout() {},
    modelValue: () => '', translationModelValue: () => '', engine: 'online',
    localMode: 'offline', outputMode: 'final', hotkeyValue: '', engineHotkeyValue: '',
    translateHotkeyValue: '', theme: 'dark', accentColor: '#8b7cff'
  });
  vm.runInContext(code, context);
  await vm.runInContext('saveSettings()', context);
  assert.equal(calls[0][0], 'save_settings');
  assert.equal(calls[0][1].settings.input_device, '  USB headset  ');
  assert.equal(calls[0][1].settings.text_rules, 'existing dictionary');
  device.value = '';
  await vm.runInContext('saveSettings()', context);
  assert.equal(calls[1][1].settings.input_device, '');
});

test('the overlay stops claiming to record when no recording exists', () => {
  const classes = new Set();
  const overlay = {classList: {toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); }}};
  const label = {textContent: ''};
  const code = source.slice(source.indexOf('  const formatDuration ='), source.indexOf('  const updateOverlayTimer ='));
  const context = vm.createContext({document: {querySelector: () => overlay}, $: () => label, t: value => value});
  vm.runInContext(`${code}; renderOverlayStatus({elapsed: 65, has_voice: true});`, context);
  assert.equal(label.textContent, '正在录音 · 01:05');
  assert.ok(classes.has('voice-active'));
  vm.runInContext('renderOverlayStatus(null)', context);
  assert.equal(label.textContent, '录音已结束');
  assert.equal(classes.has('voice-active'), false);
  assert.ok(!label.textContent.includes('00:00'));
});
