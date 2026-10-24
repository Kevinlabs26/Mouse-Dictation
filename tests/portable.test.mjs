import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {packagePortable} from '../scripts/package-portable.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const windowsX64 = process.platform === 'win32' && process.arch === 'x64';
const native = JSON.parse(fs.readFileSync(path.join(root, 'docs/security/asset-checksums.json')))
  .assets.find(asset => asset.kind === 'native-windows-x64');
const libraries = path.join(root, 'src-tauri/target/sherpa-onnx-prebuilt', native.name.replace(/\.tar\.bz2$/, ''), 'lib');
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function fixture(t) {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'mouse-dictation-portable-test-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(target)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(target).startsWith('mouse-dictation-portable-test-'));
    fs.rmSync(target, {recursive: true, force: true});
  });
  return target;
}

test('portable packaging rejects a missing release executable', {skip: !windowsX64}, t => {
  assert.throws(() => packagePortable(fixture(t)), /Build the release executable/);
});

test('portable ZIP includes only reviewed runtime files and rejects tampering', {skip: !windowsX64}, t => {
  if (!fs.existsSync(libraries)) { t.skip('Run npm run build:desktop to prepare reviewed native libraries.'); return; }
  const target = fixture(t);
  const release = path.join(target, 'release');
  fs.mkdirSync(release);
  fs.writeFileSync(path.join(release, 'mouse-dictation.exe'), 'test executable, never executed');
  for (const library of native.files.filter(file => file.name.endsWith('.dll'))) {
    fs.copyFileSync(path.join(libraries, library.name), path.join(release, library.name));
  }
  for (const extra of ['settings.json', '.env', 'private.key', 'recording.wav', 'mouse_dictation.pdb']) fs.writeFileSync(path.join(release, extra), 'must stay out');
  const archive = packagePortable(target);
  const entries = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `
    $ErrorActionPreference = 'Stop'
    [void][System.Reflection.Assembly]::LoadWithPartialName('System.IO.Compression.FileSystem')
    $zip = [System.IO.Compression.ZipFile]::OpenRead($env:MD_TEST_ARCHIVE)
    try {
      @($zip.Entries | Where-Object { $_.Name } | ForEach-Object {
        $stream = $_.Open()
        $sha = [System.Security.Cryptography.SHA256]::Create()
        try { [PSCustomObject]@{name=$_.FullName; sha256=[BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','').ToLowerInvariant()} }
        finally { $stream.Dispose(); $sha.Dispose() }
      }) | ConvertTo-Json -Compress
    } finally { $zip.Dispose() }
  `], {env: {...process.env, MD_TEST_ARCHIVE: archive}, encoding: 'utf8', windowsHide: true}));
  const files = Object.fromEntries(entries.map(entry => [entry.name.replaceAll('\\', '/').replace(/^Mouse Dictation\//, ''), entry.sha256]));
  assert.deepEqual(Object.keys(files).sort(), ['mouse-dictation.exe', ...native.files.filter(file => file.name.endsWith('.dll')).map(file => file.name), 'LICENSE', 'PRIVACY.md', 'START-HERE.txt'].sort());
  assert.equal(files['mouse-dictation.exe'], digest(path.join(release, 'mouse-dictation.exe')));
  for (const library of native.files.filter(file => file.name.endsWith('.dll'))) assert.equal(files[library.name], library.sha256);
  const archiveHash = digest(archive);
  fs.writeFileSync(path.join(release, 'onnxruntime.dll'), 'tampered');
  assert.throws(() => packagePortable(target), /checksum mismatch/i);
  assert.equal(digest(archive), archiveHash, 'failed verification must preserve the last good archive');
});
