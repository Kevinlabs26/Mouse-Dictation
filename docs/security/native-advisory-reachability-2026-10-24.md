# 原生识别库公告的应用可达性

日期：2026-10-24。对象：sherpa-onnx 1.13.7 / CVE-2026-108954（GHSA-f5q5-vp8g-wh4x）。

结论：**当前应用已审配置没有启用公告涉及的离线 Transducer 解码器，该公告在这条配置路径上不适用。** 这是静态调用路径结论，不表示整套原生库不存在其他漏洞。

- 应用的 `transcribe_local` 从默认 `OfflineRecognizerConfig` 构造配置，仅设置 SenseVoice 或 Whisper 字段；离线 Transducer 配置保持默认空值。
- Rust 包 `sherpa-onnx 1.13.7/src/offline_asr.rs` 将这些独立的模型配置字段分别传给 C API，没有将 SenseVoice/Whisper 改写为离线 Transducer。
- 官方同版本的原生工厂在 SenseVoice 模型路径非空时选择 SenseVoice，在 Whisper encoder 非空时选择 Whisper；这些分支先于后面的 Transducer 模型推断。见 [对应版本的工厂实现](https://github.com/k2-fsa/sherpa-onnx/blob/v1.13.7/sherpa-onnx/csrc/offline-recognizer-impl.cc)。
- 实时模式使用 `OnlineRecognizer`，不使用公告命名的 `OfflineTransducerGreedySearchDecoder::Decode`。

[上游问题](https://github.com/k2-fsa/sherpa-onnx/issues/3983) 针对畸形离线 Transducer 模型的词表元数据；[公告](https://github.com/advisories/GHSA-f5q5-vp8g-wh4x) 仍未给出确认的修复版本。本次没有因此盲目升级原生 ABI 或修改可信 DLL 摘要。

若以后引入离线 Transducer 或允许外部传入完整原生配置，此结论失效，必须重新检查公告、模型验证和解码器补丁。未进行恶意模型动态复现或原生库全部源码审计。
