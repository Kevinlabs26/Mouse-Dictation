# macOS test builds

The **Build macOS** GitHub Actions workflow builds separate DMGs for Apple Silicon (`arm64`) and Intel (`x64`). Download the matching artifact from a successful workflow run, unzip it, then open the DMG and copy Mouse Dictation to Applications.

- Requires **macOS 15.5 or later**: the pinned upstream ONNX Runtime libraries target 15.5.
- Uses an **ad-hoc signature**, without Apple Developer ID signing or notarization. macOS may block the first launch; use its Privacy & Security approval flow only if you trust this build.
- The pinned Tauri version requires its macOS private-API feature for the transparent overlay. This build targets direct testing, not Mac App Store submission.
- Grant **Microphone**, **Accessibility**, and **Input Monitoring** permissions when needed. Restart after changing permissions.
- These are test builds. Microphone capture, shortcuts, dictation, credential migration and automatic input still need testing on a personal Mac.
- Automatic input uses clipboard paste and does not yet verify the original input target. Avoid switching windows during recognition; this can send text to the wrong window.
- These DMGs do not add a macOS package to the existing Windows updater feed. Update by downloading a new Mac build.

To build on a Mac:

```sh
npm ci
npm run tauri -- build --config src-tauri/tauri.macos.conf.json
```

Native archives and their three dylibs are verified against `docs/security/asset-checksums.json` before bundling. The build workflow verifies the app's ad-hoc signature and required bundled libraries.
