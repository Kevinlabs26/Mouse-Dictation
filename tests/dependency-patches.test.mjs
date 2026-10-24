import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('the lockfile excludes legacy ZIP readers and keeps the native ABI version', () => {
  const blocks = fs.readFileSync(new URL('../src-tauri/Cargo.lock', import.meta.url), 'utf8').split('[[package]]').slice(1);
  const versions = name => blocks.filter(block => block.includes(`name = "${name}"\n`) || block.includes(`name = "${name}"\r\n`)).map(block => block.match(/^version = "([^"]+)"/m)[1]);
  assert.deepEqual(versions('zip'), ['9.1.0']);
  assert.deepEqual(versions('sherpa-onnx-sys'), ['1.13.7']);
  const manifest = fs.readFileSync(new URL('../src-tauri/Cargo.toml', import.meta.url), 'utf8');
  assert.match(manifest, /tauri-plugin-updater = \{[^\n]*default-features = false[^\n]*"rustls-tls"[^\n]*"system-proxy"[^\n]*\}/);
});

test('the reviewed glib backport passes a mutable C out-pointer', () => {
  const source = fs.readFileSync(new URL('../src-tauri/vendor/glib-0.18.5/src/variant_iter.rs', import.meta.url), 'utf8');
  const get = source.slice(source.indexOf('fn impl_get('), source.indexOf("impl<'a> Iterator for VariantStrIter"));
  assert.match(get, /let mut p: \*mut libc::c_char/);
  assert.match(get, /g_variant_get_child\([\s\S]*?&mut p,/);
  assert.doesNotMatch(get, /\s&p,/);
});
