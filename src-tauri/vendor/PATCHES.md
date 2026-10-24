# Local security patches

These sources were copied from Cargo's existing crates.io packages. Original
versions, source metadata, copyright notices and licenses are retained. No
upstream version number is fabricated and no advisory is suppressed.

- `glib-0.18.5`: only `src/variant_iter.rs` changes the C output pointer from
  `let p` / `&p` to `let mut p` / `&mut p`, following
  [upstream PR 1343](https://github.com/gtk-rs/gtk-rs-core/pull/1343).
  Addresses [RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html).
  The package stays at 0.18.5 for GTK 0.18 type compatibility. Version-only
  scanners will still flag it; inspect the source patch rather than ignoring
  that advisory or claiming the upstream package is fixed. Linux runtime
  validation is separate from Windows validation.
- `sherpa-onnx-sys-1.13.7`: only the build dependency in `Cargo.toml` and
  `Cargo.toml.orig` changes from ZIP 2.x to ZIP 9.1, with only DEFLATE support.
  Its existing `ZipArchive::extract` call now uses the patched ZIP branch.
  The original FFI sources, native release version, build script and DLL
  checksum baseline are unchanged. The ZIP branch downloads official iOS
  xcframeworks; Windows uses the existing verified tar.bz2 path.

The updater's unused Tauri 1 ZIP compatibility feature is disabled in the root
manifest; rustls and system-proxy support remain enabled. Standard Tauri 2 raw
EXE/MSI updater artifacts are retained. This does not affect creating a portable
ZIP with Windows .NET.

Review upstream fixes when upgrading these packages, then remove a local patch
only after its replacement contains the fix and relevant tests pass.
