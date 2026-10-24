import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const asset = JSON.parse(fs.readFileSync(path.join(root, 'docs/security/asset-checksums.json')))
  .assets.find(item => item.kind === 'native-windows-x64');

export function packagePortable(targetDir) {
  if (process.platform !== 'win32' || process.arch !== 'x64') throw Error('Portable packaging currently supports Windows x64 only.');
  const release = path.resolve(targetDir, 'release');
  const executable = path.join(release, 'mouse-dictation.exe');
  if (!fs.existsSync(executable) || !fs.lstatSync(executable).isFile()) throw Error('Build the release executable before packaging the portable ZIP.');
  execFileSync(process.execPath, [path.join(root, 'scripts/verify-native.mjs'), '--check-dir', release], {stdio: 'pipe', windowsHide: true});
  const output = path.join(release, 'bundle', 'portable');
  fs.mkdirSync(output, {recursive: true});
  const stage = fs.mkdtempSync(path.join(output, '.staging-'));
  const archive = path.join(output, 'Mouse-Dictation-windows-x64-portable.zip');
  try {
    const bundle = path.join(stage, 'Mouse Dictation');
    fs.mkdirSync(bundle);
    for (const name of ['mouse-dictation.exe', ...asset.files.filter(file => file.name.endsWith('.dll')).map(file => file.name)]) {
      fs.copyFileSync(path.join(release, name), path.join(bundle, name));
    }
    for (const name of ['LICENSE', 'PRIVACY.md']) fs.copyFileSync(path.join(root, name), path.join(bundle, name));
    fs.writeFileSync(path.join(bundle, 'START-HERE.txt'), `Mouse Dictation - Windows x64\r\n\r\nExtract the entire ZIP, then run mouse-dictation.exe from this folder.\r\nKeep all four DLLs beside the executable. Microsoft Edge WebView2 Runtime is required:\r\nhttps://developer.microsoft.com/microsoft-edge/webview2/\r\n\r\nSelect a local model (download once) or configure your own transcription API.\r\nSettings and models use your Windows user directories; API keys use Windows Credential Manager.\r\nThis is an installation-free app, not a self-contained user-data folder.\r\n\r\nTo keep using the installation-free version, download the latest portable ZIP and replace the app files.\r\nThe in-app automatic updater uses the standard installer.\r\n\r\nDownloads: https://github.com/Kevinlabs26/Mouse-Dictation/releases/latest\r\nFeedback: https://github.com/Kevinlabs26/Mouse-Dictation/issues/new/choose\r\n\r\nThis build may be unsigned. Verify its source before running it; a portable ZIP does not bypass Windows security checks.\r\n`, 'utf8');
    // Compress only the fresh allowlisted folder, never the build tree or user data.
    execFileSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
      "$ErrorActionPreference = 'Stop'; [void][System.Reflection.Assembly]::LoadWithPartialName('System.IO.Compression.FileSystem'); [System.IO.Compression.ZipFile]::CreateFromDirectory($env:MD_PORTABLE_ROOT, $env:MD_PORTABLE_ZIP, [System.IO.Compression.CompressionLevel]::Optimal, $true)"],
    {env: {...process.env, MD_PORTABLE_ROOT: bundle, MD_PORTABLE_ZIP: path.join(stage, 'portable.zip')}, stdio: 'pipe', windowsHide: true});
    fs.copyFileSync(path.join(stage, 'portable.zip'), archive);
    return archive;
  } finally {
    if (path.dirname(path.resolve(stage)) !== output || !path.basename(stage).startsWith('.staging-')) throw Error('Unsafe staging cleanup path.');
    fs.rmSync(stage, {recursive: true, force: true});
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const archive = packagePortable(path.resolve(root, process.env.CARGO_TARGET_DIR || 'src-tauri/target'));
  console.log(`Portable ZIP: ${archive}`);
}
