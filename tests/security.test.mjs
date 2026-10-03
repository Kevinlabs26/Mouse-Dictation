import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { escapeHtml } from '../src/html.js';

test('source-map dependency rejects or bounds malicious indexed-map offsets', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import sourceMap from 'source-map-js';
    for (const line of [Infinity, 1e9]) {
      const map = {version: 3, sections: [{offset: {line, column: 0},
        map: {version: 3, sources: ['input.js'], names: [], mappings: 'AAAA'}}]};
      try {
        const node = sourceMap.SourceNode.fromStringWithSourceMap('x', new sourceMap.SourceMapConsumer(map));
        assert.ok(node.toString().length < 100);
      } catch (error) {
        if (error instanceof assert.AssertionError) throw error;
        assert.match(error.message, /offset/i);
      }
    }
  `], {timeout: 3000, encoding: 'utf8'});
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});

test('model text and attributes cannot introduce HTML or event handlers', () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.equal(escapeHtml('" autofocus onfocus=\'alert(1)\' &'), '&quot; autofocus onfocus=&#39;alert(1)&#39; &amp;');
  assert.equal(escapeHtml('中文 & model'), '中文 &amp; model');
});

test('profile renderer treats hostile names and IDs as option text and values', () => {
  const source = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const code = source.slice(source.indexOf('function renderProfiles()'), source.indexOf('async function refreshProfiles()'));
  const nodes = {'profile-select': {replaceChildren(...children) { this.children = children; }}, 'profile-rename': {}, 'profile-delete': {}};
  const profile = {id: '" onmouseover="attack()', name: '<option onmouseover=attack()>', active: true};
  vm.runInNewContext(`${code}; renderProfiles();`, {
    $: id => nodes[id], t: value => value, profiles: [profile],
    Option: function (text, value) { this.text = text; this.value = value; }
  });
  assert.equal(nodes['profile-select'].children[1].text, profile.name);
  assert.equal(nodes['profile-select'].children[1].value, profile.id);
  assert.equal(nodes['profile-select'].value, profile.id);
});

test('every registered IPC command has an explicit main-window permission; overlay has only a timer', () => {
  const root = new URL('../', import.meta.url);
  const source = fs.readFileSync(new URL('src-tauri/src/main.rs', root), 'utf8');
  const build = fs.readFileSync(new URL('src-tauri/build.rs', root), 'utf8');
  const commands = source.match(/tauri::generate_handler!\[([\s\S]*?)\]/)[1].split(',').map(v => v.trim()).filter(Boolean);
  const main = JSON.parse(fs.readFileSync(new URL('src-tauri/capabilities/default.json', root), 'utf8'));
  const overlay = JSON.parse(fs.readFileSync(new URL('src-tauri/capabilities/overlay.json', root), 'utf8'));
  for (const command of commands) {
    assert.ok(build.includes(`"${command}"`), `${command} is missing from AppManifest`);
    assert.ok(main.permissions.includes(`allow-${command.replaceAll('_', '-')}`));
  }
  assert.deepEqual(main.windows, ['main']);
  assert.deepEqual(overlay.windows, ['overlay']);
  assert.deepEqual(overlay.permissions, ['allow-get-recording-elapsed']);
  assert.equal(main.remote, undefined);
  assert.equal(overlay.remote, undefined);
});
