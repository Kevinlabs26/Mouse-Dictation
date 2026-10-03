# 模型与原生库摘要的核验和维护

基线日期：2026-10-03。开发者已确认采用经核验的摘要清单。

## 覆盖范围

[asset-checksums.json](<D:/Codage/03 Mouse Dictation/docs/security/asset-checksums.json>) 是唯一摘要来源，记录官方 URL、GitHub asset ID、时间、上传者、大小及 SHA-256。

- 应用的三个模型压缩包：SenseVoice、Streaming Zipformer、Whisper Small。
- Windows x64 sherpa-onnx v1.13.7 共享库归档，以及其中 4 个 DLL 和 3 个导入库。

SenseVoice 和 Windows 归档具有官方 GitHub asset digest。其余两份模型没有该字段：从官方 release 通过 HTTPS 流式下载，核对完整字节数和下载前后不变的资产元数据，再计算摘要。清单中分别记录了这两种依据。这不是独立的发行方签名验证；初始信任仍依赖 GitHub 账号、TLS 和此次核验。摘要可检测基线建立之后的资产替换。

## 校验如何运行

模型下载读取编译内置的清单，在解压前核验每份归档；不匹配会报错并丢弃损坏的续传文件。未知 URL 没有回退摘要。

Windows x64 的 Tauri 开发/构建前运行 `node scripts/verify-native.mjs --prepare`。脚本核对 Cargo.lock 中 sherpa-onnx-sys 的版本，验证归档后才首次解压，逐个验证缓存中的 DLL/导入库；额外的 DLL/导入库也会被拒绝。`SHERPA_ONNX_LIB_DIR` 自定义库目录仍必须匹配该基线。`CARGO_TARGET_DIR` 可选择缓存根目录。

发布配置的 beforeBundleCommand 运行 `npm run verify:native`，验证 release 目录的四个 DLL；bundle.resources 只包含这四个明确文件。验证脚本只读取这些库，不加载或执行它们。当前安装包/签名全过程没有实际运行。

直接使用 Cargo 时，不会执行 Tauri hook；先手工运行准备脚本。其他平台/架构会明确提示当前没有对应原生摘要基线，不假装已经验证。当前基线针对正常 Windows x64 输出布局，特殊交叉编译输出需要另行适配。

## 更新流程

1. 从官方仓库核对 release、资产名字/ID、上传者、大小、更新时间及官方 digest；保留可复核来源。
2. 对没有官方 digest 的资产，从已核对的 HTTPS URL 下载完整文件，核对大小及前后元数据；如有独立发行方签名或可信第二来源，同时核验。
3. 重新计算归档摘要；原生包须先通过归档校验，再核对其中每个运行库和导入库。不要根据现有本地 DLL 直接重置“可信”基线。
4. 通过代码审查同时更新依赖版本、清单和相关平台校验；不要自动接受下载到的新字节作为修复。
5. 验证首次缓存路径、正常文件接受、篡改文件拒绝，再运行构建与测试。

本次已经验证现有缓存及 release DLL 与重新下载且匹配官方 digest 的归档一致；另在独立空缓存测试首次下载/解压，并验证改动 DLL 一个字节即拒绝。需要清理不匹配缓存时，只处理报告指出的生成目录，避免删除用户模型或凭据。
