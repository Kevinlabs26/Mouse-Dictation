import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const kind = process.platform === 'darwin' ? `native-macos-${process.arch}` : 'native-windows-x64';
const asset = JSON.parse(fs.readFileSync(path.join(root, 'docs/security/asset-checksums.json'))).assets.find(a => a.kind === kind);
const supported = process.platform === 'darwin' || (process.platform === 'win32' && process.arch === 'x64');

test('native verification rejects a changed library and an extra unreviewed library', {skip: !supported}, t => {
  assert.ok(asset);
  const libraries = path.join(root, 'src-tauri/target/sherpa-onnx-prebuilt', asset.name.replace(/\.tar\.bz2$/, ''), 'lib');
  if (!fs.existsSync(libraries)) { t.skip('Run npm run build:desktop first.'); return; }
  if (process.platform === 'darwin') {
    for (const file of asset.files) {
      const prepared = path.join(root, 'src-tauri/target/macos-native', file.name);
      assert.equal(createHash('sha256').update(fs.readFileSync(prepared)).digest('hex'), file.sha256);
    }
  }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mouse-dictation-native-test-'));
  t.after(() => {
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('mouse-dictation-native-test-'));
    fs.rmSync(directory, {recursive: true, force: true});
  });
  const runtime = asset.files.filter(f => f.name.endsWith(process.platform === 'darwin' ? '.dylib' : '.dll'));
  for (const file of runtime) fs.copyFileSync(path.join(libraries, file.name), path.join(directory, file.name));
  const verify = () => execFileSync(process.execPath, [path.join(root, 'scripts/verify-native.mjs'), '--check-dir', directory], {stdio: 'pipe', windowsHide: true});
  assert.doesNotThrow(verify);
  const extra = path.join(directory, 'unreviewed' + (process.platform === 'darwin' ? '.dylib' : '.dll'));
  fs.writeFileSync(extra, 'unreviewed');
  assert.throws(verify, /Unreviewed native library/);
  fs.unlinkSync(extra);
  fs.writeFileSync(path.join(directory, runtime[0].name), 'changed');
  assert.throws(verify, /checksum mismatch/);
});
