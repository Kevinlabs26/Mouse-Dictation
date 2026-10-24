# macOS test builds

Download the DMG matching your Mac, open it, then copy Mouse Dictation to Applications. Both test builds are attached to the [v0.1.24 Release](https://github.com/Kevinlabs26/Mouse-Dictation/releases/tag/v0.1.24).

Verified builds: [Apple Silicon DMG](https://github.com/Kevinlabs26/Mouse-Dictation/releases/download/v0.1.24/Mouse-Dictation_0.1.24_arm64.dmg) · [Intel DMG](https://github.com/Kevinlabs26/Mouse-Dictation/releases/download/v0.1.24/Mouse-Dictation_0.1.24_x64.dmg). Both passed 35 applicable JavaScript tests and 59 Rust tests, app signature checks, bundled-library checks, and download verification. [Checksums and build record](security/macos-build-2026-10-24.json).

The Release links above are separate from the temporary, 30-day Actions artifacts. The **Build macOS** workflow can create new test builds.

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
