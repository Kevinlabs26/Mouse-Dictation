# Mouse Dictation

Mouse Dictation is a Windows-first desktop speech input tool. Hold the left mouse button, or use a global hotkey, to transcribe speech directly into the active text field.

Current version: `0.1.6`

## Features

- Mouse press-and-hold or configurable global hotkeys
- Paid transcription APIs through OpenAI-compatible endpoints
- Local offline transcription with sherpa-onnx
- Realtime local transcription with a streaming Zipformer model
- Automatic translation after transcription
- Configurable recognition languages, models, themes, and profiles
- API keys stored in the operating system credential manager
- System tray support and optional launch at startup

## Development

Requirements:

- Node.js and npm
- Rust and the Tauri prerequisites for your operating system

Install dependencies and start the development app:

```powershell
npm install
npm run tauri:dev
```

Build the production application:

```powershell
npm run tauri:build
```

## Recognition modes

### Paid API

Configure an OpenAI-compatible API Base URL, API key, and transcription model in the Recognition tab. The default workflow starts recording after the mouse button is held for one second, then sends the recording to `/audio/transcriptions` when the button is released.

Realtime streaming depends on the provider and model. The paid API workflow currently uses final output after recording.

### Local offline

The high-accuracy mode downloads and configures a SenseVoice int8 model. The realtime mode uses a streaming Zipformer model and inserts stable partial results while speaking.

Local mode processes audio on the device and supports manually selected model directories. Official model downloads are available from the [sherpa-onnx ASR models](https://github.com/k2-fsa/sherpa-onnx/releases/tag/asr-models) page.

## Translation

Automatic translation can be enabled after transcription. You can use a configured OpenAI-compatible translation provider or a local Ollama model. Translation sends the transcribed text to the selected provider; local Ollama keeps the request on the device.

## Data and privacy

- Local offline mode does not upload recordings.
- Paid API mode sends recordings to the API provider configured by the user.
- Automatic translation sends transcribed text to the selected translation provider.
- API keys are stored in the system credential manager rather than the normal settings file.
- The application does not include telemetry, advertising, or background analytics.

See [`PRIVACY.md`](PRIVACY.md) for details.

## First-run permissions

On Windows, allow microphone access when requested. On macOS, microphone, Accessibility, and Input Monitoring permissions may be required for global mouse listening and simulated text input.

## Release checklist

Before publishing a Windows release, test the application on a clean machine without the development environment installed:

- First launch and microphone permissions
- System tray and launch-at-startup behavior
- Mouse trigger and global hotkeys
- Overlay visibility and recording timer
- Local model download and deletion
- Paid API transcription
- Automatic translation
- Installer and uninstall flow

The Windows release currently uses an NSIS installer. Code signing is recommended for public distribution.

## License

The source code is available under the [Apache License 2.0](LICENSE). The Mouse Dictation name, brand, and icon are not granted as trademarks by that license.

## Performance notes

Recording and global mouse listening run in Rust background threads. Local inference runs through sherpa-onnx; online performance depends mainly on network latency and the selected provider. Local performance depends on CPU speed, model size, and the first model load.
