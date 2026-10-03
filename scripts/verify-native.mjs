import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/security/asset-checksums.json')));
const asset = manifest.assets.find(a => a.kind === 'native-windows-x64');
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const targetDir = path.resolve(root, process.env.CARGO_TARGET_DIR || 'src-tauri/target');
const windowsX64 = process.platform === 'win32' && process.arch === 'x64'
  && (!process.env.TAURI_ENV_PLATFORM || ['windows', 'win32'].includes(process.env.TAURI_ENV_PLATFORM))
  && (!process.env.TAURI_ENV_ARCH || ['x86_64', 'x64'].includes(process.env.TAURI_ENV_ARCH));

if (windowsX64) {
  const lock = fs.readFileSync(path.join(root, 'src-tauri/Cargo.lock'), 'utf8');
  const nativePackage = lock.split('[[package]]').find(block => /^name = "sherpa-onnx-sys"$/m.test(block));
  const lockedVersion = nativePackage?.match(/^version = "([^"]+)"$/m)?.[1];
  if (lockedVersion !== asset.name.match(/^sherpa-onnx-v([\d.]+)-/)[1]) {
    throw new Error('sherpa-onnx-sys version changed; review and update native checksum baseline first.');
  }
}

function verifyFiles(dir, runtimeOnly = false) {
  const expected = asset.files.filter(file => !runtimeOnly || file.name.endsWith('.dll'));
  for (const file of expected) {
    const location = path.join(dir, file.name);
    const stat = fs.lstatSync(location);
    if (!stat.isFile() || stat.size !== file.size || digest(location) !== file.sha256) {
      throw new Error(`Native library checksum mismatch: ${location}`);
    }
  }
  for (const name of fs.readdirSync(dir).filter(name => /\.(dll|lib)$/i.test(name))) {
    if (runtimeOnly && !name.endsWith('.dll')) continue;
    if (!expected.some(file => file.name === name)) throw new Error(`Unreviewed native library: ${name}`);
  }
  console.log(`Verified ${expected.length} native libraries: ${dir}`);
}

const checkIndex = process.argv.indexOf('--check-dir');
if (checkIndex !== -1) {
  if (!process.argv[checkIndex + 1]) throw new Error('--check-dir requires a directory');
  verifyFiles(path.resolve(root, process.argv[checkIndex + 1]), true);
} else if (windowsX64 && process.argv.includes('--release')) {
  verifyFiles(path.join(targetDir, 'release'), true);
} else if (windowsX64) {
  // Populate the exact cache used by sherpa-onnx-sys before its build script runs.
  // Cargo's downloaded crate checksum does not cover this native archive.
  const cache = path.join(targetDir, 'sherpa-onnx-prebuilt');
  fs.mkdirSync(cache, {recursive:true});
  const archive = path.join(cache, asset.name);
  if (!fs.existsSync(archive)) {
    const stage = fs.mkdtempSync(path.join(cache, '.download-'));
    const partial = path.join(stage, asset.name);
    const response = await fetch(asset.url, {signal:AbortSignal.timeout(300000)});
    if (!response.ok) throw new Error(`Native archive HTTP ${response.status}`);
    const fd = fs.openSync(partial, 'wx');
    let bytes = 0;
    try {
      for await (const chunk of response.body) {
        bytes += chunk.length;
        if (bytes > asset.size) throw new Error('Native archive exceeds reviewed size');
        fs.writeSync(fd, chunk);
      }
    } finally {fs.closeSync(fd);}
    if (bytes !== asset.size || digest(partial) !== asset.sha256) throw new Error('Native archive checksum mismatch');
    fs.renameSync(partial, archive);
    fs.rmdirSync(stage);
  }
  const archiveStat = fs.lstatSync(archive);
  if (!archiveStat.isFile() || archiveStat.size !== asset.size || digest(archive) !== asset.sha256) throw new Error(`Native archive checksum mismatch: ${archive}`);
  const stem = asset.name.replace(/\.tar\.bz2$/, '');
  const extracted = path.join(cache, stem);
  const override = process.env.SHERPA_ONNX_LIB_DIR;
  if (override) {
    verifyFiles(path.resolve(root, override));
  } else {
    if (!fs.existsSync(extracted)) {
      const stage = fs.mkdtempSync(path.join(cache, '.verified-'));
      execFileSync('tar', ['-xjf', archive, '-C', stage]);
      verifyFiles(path.join(stage, stem, 'lib'));
      fs.renameSync(path.join(stage, stem), extracted);
      fs.rmdirSync(stage);
    }
    verifyFiles(path.join(extracted, 'lib'));
  }
} else {
  console.log('Native checksum baseline currently covers Windows x64 only; other targets remain unverified.');
}
