# Mouse Dictation 安全审核报告

审核日期：2026-10-03。对象：当前工作目录及审核前已有的未提交修改。安全修复保留了原有的文字输入、界面及文档修改；审核阶段未提交、发布应用或轮换密钥；之后开发者授权发布 v0.1.22，发布准备包括本报告列出的修复及原有输入/界面改动。

结论：发现并修复了 Tauri 高危 IPC 漏洞、rustls 协议状态校验漏洞和 source-map-js 高危构建依赖漏洞，并加固 HTML 输出、桌面 IPC、模型解压、录音临时文件、API 请求及凭据迁移。远程 API 已强制 HTTPS，仅本机回环地址允许 HTTP。剩余事项包括 Linux/glib 迁移及停止维护的间接包、未完成的运行验证、其他平台原生库的验证和初始信任局限。不能据此宣称项目没有任何漏洞。

## 1. 项目概况与审核范围

| 项目 | 结果 |
| --- | --- |
| 语言与框架 | Rust 2021、Tauri 2、原生 JavaScript/CSS、Vite 6；Windows 优先，代码包含 macOS/Linux 分支 |
| 包管理器 | npm（package-lock.json），Cargo（src-tauri/Cargo.lock） |
| 直接依赖 | 原有 21 项；修复后 23 项：npm 4 项、Rust 19 项（含构建及目标平台依赖） |
| 锁文件范围 | 最终 651 个 crates.io 包版本条目、78 个 npm 条目，共 729 项；包含其他平台及可选包，不等于 Windows 实际加载数量 |
| 代码范围 | src/main.js、src/html.js、src/styles.css、src-tauri/src/main.rs、src-tauri/src/text_input.rs、build.rs、全部 Tauri 配置/capabilities、Vite 配置、HTML、release workflow、原生库验证脚本、测试 |
| 凭据范围 | 配置、示例、文档、注释、可检查构建产物，以及当前本地全部 Git refs 可达历史：23 个提交、150 个文本 blob |
| 工具与来源 | npm audit、逐包 WebSearch、按全部锁定版本调用 OSV API、GitHub Advisory/RustSec、官方源码/changelog/GitHub release 元数据 |

本地没有安装 cargo-audit，因此未宣称运行过 cargo audit；使用 OSV 对 Cargo 锁文件进行全量查询，并用官方公告交叉核对。没有把 npm audit 返回 0 当作没有漏洞的证明：本次 Tauri 和 source-map-js 公告没有被相应的精确生态/版本查询命中，通过 WebSearch 和官方记录发现。

完整清单见 [dependency-inventory.tsv](<D:/Codage/03 Mouse Dictation/docs/security/dependency-inventory.tsv>)；告警、官方 release/action 元数据和历史扫描统计见 [audit-evidence.json](<D:/Codage/03 Mouse Dictation/docs/security/audit-evidence.json>)。这些文件不包含真实凭据。

### 全部直接依赖

“未检出”表示本次 OSV 精确版本查询与逐包搜索未确认该版本受影响，不是安全保证。Rust 的 0.x 跨次版本迁移可能不兼容，未为追新而升级。

| 生态 | 包 | 声明范围（最终） | 实际锁定版本 | 本次结论 |
| --- | --- | --- | --- | --- |
| npm | @tauri-apps/api | ^2.0.0 | 2.11.1 | 未检出本版本适用公告 |
| npm | @tauri-apps/plugin-updater | ^2.11.0 | 2.11.0 | 未检出；检查了更新签名配置 |
| npm/dev | @tauri-apps/cli | ^2.0.0 | 2.11.4 | 未检出；Vite 没有暴露 TAURI_ 环境变量前缀 |
| npm/dev | vite | ^6.0.0 | 6.4.3 | 已包含 Windows fs.deny 绕过修复；未升级大版本 |
| Cargo | tauri | ~2.11.6 | **2.11.5 → 2.11.6** | 修复 D01；限定 2.11 补丁系列 |
| Cargo/build | tauri-build | 2 | 2.6.3 | 未检出本版本适用公告 |
| Cargo | tauri-plugin-autostart | 2 | 2.5.1 | 未检出 |
| Cargo | serde | 1 + derive | 1.0.229 | 未检出 |
| Cargo | serde_json | 1 | 1.0.151 | 未检出 |
| Cargo | rdev | 0.5 | 0.5.3 | 未检出；长期无发布，见 D06 |
| Cargo | cpal | 0.15 | 0.15.3 | 未检出；较新系列存在，未擅自迁移 |
| Cargo | hound | 3.5 | 3.5.1 | 未检出；长期无发布，见 D06 |
| Cargo | arboard | 3.4 | 3.6.1 | 未检出 |
| Cargo | dirs-next | 2 | 2.0.0 | 未检出；长期无发布，见 D06 |
| Cargo | keyring | 4.1.6 | 4.2.0 | 未检出；修复旧明文凭据迁移逻辑 |
| Cargo | reqwest | 0.12，禁用默认功能，启用 blocking/json/multipart/rustls-tls | 0.12.28 | 未检出直接包告警；TLS 间接依赖修复 D02 |
| Cargo | sherpa-onnx | 1.13.7，shared | 1.13.7 | 未检出；预编译原生库另有验证限制 |
| Cargo | tar | 0.4 | 0.4.46 | 已超过已核实的 0.4.45 安全修复版本；应用解压逻辑另外加固 |
| Cargo | bzip2 | 0.5 | 0.5.2 | 已超过 RUSTSEC-2023-0004 的 0.4.4 修复版本 |
| Cargo/Windows | windows-sys | 0.61.2 | 0.61.2 | 未检出；审核前已有的输入功能依赖 |
| Cargo/desktop | tauri-plugin-updater | 2.11.0 | 2.11.0 | 未检出；公钥与 HTTPS 更新源存在 |
| Cargo/新增直接引用 | tempfile | 3 | 3.27.0 | 原有间接包，复用其安全创建与清理临时文件能力 |
| Cargo/新增直接引用 | sha2 | 0.10 | 0.10.9 | 原有间接包，用于校验官方模型 SHA-256 |

### 关键间接依赖实际版本

| 包 | 最终版本 | 结论/用途 |
| --- | --- | --- |
| rustls | **0.23.43 → 0.23.45** | D02 已修复，API/更新器的 TLS 链 |
| rustls-webpki / ring | 0.103.15 / 0.17.14 | 精确版本查询未检出；webpki 已超过已核实的 0.103.12 修复版本 |
| reqwest（更新器链） | 0.13.4 | 与应用直接引用的 0.12.28 并存 |
| tokio / hyper / time | 1.53.1 / 1.11.1 / 0.3.55 | 未检出；time 已超过 RFC2822 栈耗尽漏洞的 0.3.47 修复版本 |
| tauri-utils / wry / tao | 2.9.3 / 0.55.1 / 0.35.3 | 保留原框架组件；Linux GTK 与 unic 链见下文 |
| glib / proc-macro-error | 0.18.5 / 1.0.4 | D04/D05，未强行迁移 |
| unic-char-property / unic-char-range / unic-common / unic-ucd-ident / unic-ucd-version | 均为 0.9.0 | 均有停止维护公告，D05 |
| sherpa-onnx-sys / ureq | 1.13.7 / 2.12.1 | 原生构建/下载链；未检出适用精确版本公告 |
| zip | 2.4.2 与 4.6.1 | 均超过已核实的 RUSTSEC-2025-0168 修复下限 2.3.0 |
| bzip2（间接） | 0.4.4 | 已包含 RUSTSEC-2023-0004 修复 |
| getrandom / sha2（另一版本） | 0.3.4、0.4.3 / 0.11.0 | 与其他版本并存，完整明细见 TSV |
| esbuild / rollup | 0.25.12 / 4.63.1 | 未检出适用公告；esbuild 的 Deno 公告不适用于本项目 Node/npm 构建 |
| postcss / nanoid / picomatch | 8.5.28 / 3.3.18 / 4.0.7 | 已超过本次核实的对应修复版本 |
| source-map-js | **1.2.1 → 1.2.2** | D03 已修复；Vite → PostCSS 构建链 |
| tinyglobby / fdir | 0.2.17 / 6.5.0 | 未检出适用公告 |

## 2. 问题汇总

严重级别是结合利用条件的审核判断；依赖公告原始级别另在详情中列出。未发现可确认的 Critical 问题。位置为修复后的文件行号，便于复核；锁文件变动后行号可能继续变化。

| 编号 | 类别 | 严重级别 | 位置 | 状态 |
| --- | --- | --- | --- | --- |
| D01 | 依赖 | High | [Cargo.toml:13](<D:/Codage/03 Mouse Dictation/src-tauri/Cargo.toml:13>)、Cargo.lock 的 tauri | 已修复 |
| D02 | 依赖 | Medium | [Cargo.lock:4044](<D:/Codage/03 Mouse Dictation/src-tauri/Cargo.lock:4044>) | 已修复 |
| D03 | 依赖 | High（公告；本项目仅构建链） | [package-lock.json:1261](<D:/Codage/03 Mouse Dictation/package-lock.json:1261>) | 已修复 |
| D04 | 依赖 | Medium | [Cargo.lock:1879](<D:/Codage/03 Mouse Dictation/src-tauri/Cargo.lock:1879>) | 建议关注（已决定暂缓迁移） |
| D05 | 依赖 | Low | [Cargo.lock:3663](<D:/Codage/03 Mouse Dictation/src-tauri/Cargo.lock:3663>)、[Cargo.lock:5522](<D:/Codage/03 Mouse Dictation/src-tauri/Cargo.lock:5522>) | 建议关注（已决定暂缓迁移） |
| D06 | 依赖 | Low | [Cargo.toml:17](<D:/Codage/03 Mouse Dictation/src-tauri/Cargo.toml:17>)、hound、dirs-next | 建议关注 |
| C01 | 代码 | Medium | [main.js:1385](<D:/Codage/03 Mouse Dictation/src/main.js:1385>)、[main.js:1968](<D:/Codage/03 Mouse Dictation/src/main.js:1968>) | 已修复 |
| C02 | 代码 | Medium | [tauri.conf.json:25](<D:/Codage/03 Mouse Dictation/src-tauri/tauri.conf.json:25>) | 已修复 |
| C03 | 代码 | Medium | [build.rs:11](<D:/Codage/03 Mouse Dictation/src-tauri/build.rs:11>)、capabilities、[main.rs:1416](<D:/Codage/03 Mouse Dictation/src-tauri/src/main.rs:1416>) | 已修复 |
| C04 | 代码 | Medium | [main.rs:1372](<D:/Codage/03 Mouse Dictation/src-tauri/src/main.rs:1372>) | 已修复 |
| C05 | 代码 | Medium | [main.rs:1152](<D:/Codage/03 Mouse Dictation/src-tauri/src/main.rs:1152>)、[main.rs:2053](<D:/Codage/03 Mouse Dictation/src-tauri/src/main.rs:2053>) | 已修复 |
| C06 | 代码 | Medium | [main.rs:1998](<D:/Codage/03 Mouse Dictation/src-tauri/src/main.rs:1998>)、[main.rs:2029](<D:/Codage/03 Mouse Dictation/src-tauri/src/main.rs:2029>) | 已修复 |
| C07 | 代码 | Medium | [main.rs:1827](<D:/Codage/03 Mouse Dictation/src-tauri/src/main.rs:1827>)、[main.rs:1873](<D:/Codage/03 Mouse Dictation/src-tauri/src/main.rs:1873>) | 已修复 |
| C08 | 密钥 | Low | [main.rs:2084](<D:/Codage/03 Mouse Dictation/src-tauri/src/main.rs:2084>) | 已修复 |
| C09 | 代码 | Low | [main.rs:185](<D:/Codage/03 Mouse Dictation/src-tauri/src/main.rs:185>)、[main.rs:1095](<D:/Codage/03 Mouse Dictation/src-tauri/src/main.rs:1095>) | 已修复 |
| C10 | 代码 | High（启用远程 HTTP 时） | [main.rs:1998](<D:/Codage/03 Mouse Dictation/src-tauri/src/main.rs:1998>) | 已修复 |
| C11 | 代码 | Medium | [main.rs:1332](<D:/Codage/03 Mouse Dictation/src-tauri/src/main.rs:1332>)、模型下载、sherpa-onnx-sys 原生构建链 | 已修复（模型和 Windows x64）；其他平台建议关注 |
| C12 | 代码 | Medium | [release.yml:19](<D:/Codage/03 Mouse Dictation/.github/workflows/release.yml:19>) | 已修复 |
| K01 | 密钥 | Medium | [main.rs:531](<D:/Codage/03 Mouse Dictation/src-tauri/src/main.rs:531>)、[main.rs:602](<D:/Codage/03 Mouse Dictation/src-tauri/src/main.rs:602>) | 已修复（迁移失败的残余见下文） |
| K02 | 密钥 | Low | [.gitignore:11](<D:/Codage/03 Mouse Dictation/.gitignore:11>)、[.env.example](<D:/Codage/03 Mouse Dictation/.env.example>) | 已修复（预防性） |

## 3. 已修复问题及利用条件

### D01 — Tauri 跨 WebView IPC 数据访问

官方公告 [GHSA-w28w-mhc8-qvjv](https://github.com/tauri-apps/tauri/security/advisories/GHSA-w28w-mhc8-qvjv) 为 High，受影响版本为 2.0.0 至 2.11.5，修复下限 2.11.6；公告未给出 CVE。攻击者需要在某个 WebView 执行 JavaScript，并遇到另一 WebView 待取的大型 channel 响应。本项目存在 main/overlay 两个窗口及更新器 channel；是否能在真实运行中取得含密钥的排队 payload **待确认**，未伪称复现窃密。

修改：Rust tauri 升至 2.11.6，声明使用 ~2.11.6，更新 Cargo.lock；保留原有其他 Tauri 组件版本。修复依赖本身是必要措施，单靠应用 ACL 无法替代这个框架补丁。

### D02 — rustls TLS 1.3 消息层级校验

[RUSTSEC-2026-0285](https://rustsec.org/advisories/RUSTSEC-2026-0285.html) / [GHSA-2mjx-qc3c-rqvc](https://github.com/rustls/rustls/security/advisories/GHSA-2mjx-qc3c-rqvc) 为 Medium。原 0.23.43 属于受影响版本，项目 reqwest 的 rustls-tls 及更新器链实际使用该包。恶意 TLS 对端可触发不正确的握手消息层级接受；该公告不等于攻击者可绕过所有证书/握手认证。

修改：锁定到兼容补丁 0.23.45，最终 OSV 查询不再命中此项。

### D03 — source-map-js 恶意 indexed source map 导致阻塞

[CVE-2026-93749 的 OSV 记录](https://osv.dev/vulnerability/CVE-2026-93749) 和[官方 1.2.2 changelog 提交](https://github.com/7rulnik/source-map-js/commit/4c6fa26)确认漏洞与修复。攻击者需要把超大/无限 section offset 的 source map 送入相关消费和 SourceNode 重建路径。本项目通过 Vite → PostCSS 间接引入，仅在开发/构建使用；未发现接收外部用户 source map 的服务，也未发现项目直接调用 SourceNode.fromStringWithSourceMap，线上利用路径未确认。

修改：package-lock.json 中 1.2.1 → 1.2.2；核对安装包新增 offset 校验和循环边界。增加带子进程超时的恶意 offset 回归验证，避免测试本身挂死。npm audit 仍返回 0，说明必须保留官方公告核对。

### C01/C02 — HTML 输出及 CSP

原方案名称/ID 和模型目录插入 innerHTML/属性时未统一编码。恶意配置或可控模型目录名可能改变 DOM，进一步形成事件处理器注入；macOS/Linux 的文件名可包含更多特殊字符。实际桌面 WebView 上的脚本执行链 **待确认**，不是已证实的远程攻击入口。

修改：方案列表通过原生 Option 构造并 replaceChildren；新增 src/html.js 的 escapeHtml，模型文本及属性统一编码。其他 innerHTML 插值核对为静态可信枚举/文案，转写和错误展示使用文本输出。Tauri 原 csp:null 改为明确 production/dev CSP：脚本仅同源，禁止对象、frame、base 覆盖及表单提交，网络仅允许 IPC（开发时另允许本机 HMR）。保留 unsafe-inline 样式以支持现有动态主题。配置符合 [Tauri CSP 文档](https://v2.tauri.app/security/csp/)；真实 GUI 的 CSP 行为仍需冒烟验证。

### C03 — 原生命令默认权限与凭据事件范围

仅配置 capability 并不足以自动限制所有自定义命令；没有 AppManifest 命令 ACL 时，本地 WebView 的自定义命令可能默认可调用。受控 overlay 不应访问配置密钥、目录删除或 API 上传功能，尤其在发生 HTML 注入后。原 settings-changed 广播还包含运行时密钥。

修改：build.rs 枚举全部 20 个应用命令以启用显式 ACL；main 只授予实际所需命令、版本、事件监听和更新器权限；overlay 独立 capability，仅允许 get_recording_elapsed。没有 remote capability。settings-changed 仅发送给 main。增加命令注册与能力清单一致性回归检查。依据 [Tauri capabilities 文档](https://v2.tauri.app/security/capabilities/)。该措施缩小后果，不替代 D01 的框架升级。

### C04/C05 — 模型压缩包与不受限输入

原代码虽然已有文件名白名单，不宜将其直接描述为已证实的普通 ../ Zip Slip，但允许 tar entry 解包而未明确禁止链接/特殊 entry、重复文件与超大输入。恶意下载响应、被修改的断点续传文件或异常 API 返回可造成文件语义混淆、资源耗尽。具体跨目录覆盖利用 **待确认**。

修改：只接收白名单普通文件；拒绝选中文件的软/硬链接、目录/设备、非 Normal 路径组件、重复名字及超大文件；不再使用 Entry.unpack，复制到目标目录的随机临时文件后 persist。压缩下载上限 1 GiB、解压读取上限 4 GiB、单模型文件上限 2 GiB；限制并发下载为一个，校验模式枚举。API 响应最多 1 MiB，读取/UTF-8 错误不再当空结果吞掉。现有官方三个下载包均低于压缩上限。

### C06 — API 重定向转发录音/文本及 URL 信息泄露

reqwest 默认重定向策略可能把 307/308 请求体转发到另一来源。即使 Authorization 不跨域转发，录音和翻译正文仍可能泄露；需恶意/被劫持的配置 API 对端返回重定向。

修改：统一四类 API 调用的 URL 解析和客户端；只允许 HTTP(S)，拒绝 URL 内嵌用户名、密码、query、fragment；重定向仅允许相同 scheme/host/port，最多五次，阻止跨域和 HTTPS 降级。网络异常移除 URL。使用双本地端口回归测试确认第二来源没有收到上传。远程 API 的 HTTPS 要求已按 C10 实施，本机回环 HTTP 保留。

### C07 — 可预测录音临时文件及失败后的录音残留

原时间戳文件名及路径创建存在本地预创建/竞态风险，异常返回也可能跳过手工清理。利用依赖攻击者能写入相应临时目录、猜测时机，或录音转写失败；不能泛称任意远程文件覆盖。

修改：使用 tempfile 随机且独占创建，直接通过已打开的文件句柄写 WAV；StoppedRecording 持有 TempPath，正常退出和错误路径自动清理。系统临时目录访问权限仍取决于 OS；进程崩溃/强制结束可能留下文件，见剩余风险。

### C08 — 提供商错误反射 API Key

恶意或故障的提供商可能在错误 JSON/正文中反射请求密钥，原代码将其展示给用户。修改：错误消息在原始正文和 JSON 解码后分别脱敏当前密钥，统一限制为 160 字符；测试覆盖 Unicode 转义形式。未声称能识别服务方反射的任意其他秘密、转写内容或编码变体。

### C09 — 打开目录参数与符号链接递归

open/xdg-open 对以连字符开头的相对路径可能按选项解释；目录统计跟随符号链接可能访问树外或循环。修改：打开前 canonicalize 为绝对现有路径；统计使用 entry.file_type，不递归链接/重解析点。现有命令使用 .arg 传参，未发现 shell 拼接式命令注入；原模型删除的 canonicalize/root 范围校验保留。

### C12 — CI Action 浮动引用

原 checkout/setup-node/rust-toolchain/tauri-action 使用 tag/branch；上游引用被改写或供应链账号失陷时，构建可运行不同代码，发布任务还持有签名 secret 与仓库写权限。

修改：四个 Action 固定到通过 GitHub API 核实的完整 commit SHA；默认 contents:read，仅发布 job 保留所需 contents:write；checkout 禁用 persist-credentials。原 workflow 仅 tag push 触发，没有发现 pull_request_target 或将 PR 标题等不可信内容插入 shell。Node lts/*、Rust stable、windows-latest 仍浮动，属于后续可复现性改进项。

补充发布测试门禁：release job 在发布前依次执行 npm test、npm run build:desktop（前端构建及原生库校验）、cargo test --manifest-path src-tauri/Cargo.toml --locked --target-dir src-tauri/target。没有 continue-on-error 或 always() 绕过失败；任一步失败均阻止后续发布。复用已有命令，没有引入新 Action 或依赖。本地逐项运行通过；GitHub 托管 runner 上的完整流程尚未运行，未创建发布 tag。

### K01/K02 — 明文迁移与本地签名材料

运行时 API Key 已使用 OS keyring，但旧 profiles 的明文没有完整迁移；settings 的部分成功迁移可能过早清除另一个失败凭据。

修改：识别旧配置中的全部密钥，逐项保存在系统凭据库；只有所有项成功或已有相应 keyring 值时才重新写入去密钥 JSON。迁移/落盘失败仅输出不含密钥的提示，保留旧文件避免数据丢失。此时旧明文仍可能存在，需检查实际用户配置和 keyring 权限；本次未读取个人凭据库或修改现有用户配置。

补充 .env/.env.*、私钥/证书容器扩展名的忽略规则，仅放行 .env.example；示例只列 TAURI_SIGNING_PRIVATE_KEY 和 TAURI_SIGNING_PRIVATE_KEY_PASSWORD 的空变量名。产品中的 API Key 继续用 OS keyring，未改为前端环境变量。忽略规则不影响已经跟踪过的文件，历史泄露仍需远端撤销。

## 4. 已确认方案与暂缓迁移事项

开发者已确认 C11 摘要清单方案，并授权按推荐方案继续处理。C10、C11 已完成；D04/D05 暂保留兼容版本，记录迁移风险。当前没有等待开发者答复才能完成的安全修复。

### C10 — 已完成：远程 API 强制 HTTPS

原代码允许用户主动配置远程 http:// 地址，链路上的攻击者可读取 API Key、录音及文本，并篡改响应。已在所有 API 请求共用的地址校验处拒绝远程明文地址，仅允许解析后的 localhost 或字面回环 IP（IPv4 127/8、IPv6 ::1）使用 HTTP；不通过 DNS 判断本机，也不接受 localhost.evil、局域网地址或未指定地址。应用是用户本地客户端，不存在已证实的公开服务端 SSRF 入口。

| 方案 | 影响 | 建议 |
| --- | --- | --- |
| 强制远程 HTTPS，允许 localhost/127.0.0.1/::1 本机 HTTP | 保护远程链路；已有局域网明文代理需加 TLS；应按 URL 解析后的字面主机精确判断，不接受 localhost.evil 等 | **已采用** |
| 保留远程 HTTP，增加明确风险提示/显式启用 | 兼容旧服务，但仍会明文暴露凭据；涉及界面与用户流程调整 | 有明确兼容性需求时选 |

新增回归测试覆盖允许和拒绝的主机形式及模型、转写、翻译端点。原有局域网/公网 HTTP 配置会在请求前报错，需将服务配置为 HTTPS；没有自动改写旧 URL，避免连接到错误服务。README 已补充兼容性说明。

### D04/D05 — glib 跨系列迁移与无修复版本的停止维护包

glib 0.18.5 命中 [GHSA-wrw7-89jp-8q8g](https://github.com/advisories/GHSA-wrw7-89jp-8q8g) / RUSTSEC-2024-0429（公告 Medium，6.9）。问题为 VariantStrIter 的空指针/未定义行为，修复下限 0.20.0。当前 Windows 依赖树不激活 glib；Linux GTK 链会涉及该系列，但项目是否调用受影响方法 **待确认**。直接把锁文件覆盖为 0.20 不能保证 GTK/Tauri 类型兼容。

proc-macro-error 1.0.4 命中 [RUSTSEC-2024-0370](https://rustsec.org/advisories/RUSTSEC-2024-0370.html)；五个 unic 0.9.0 包分别命中 [0081](https://rustsec.org/advisories/RUSTSEC-2025-0081.html)、[0075](https://rustsec.org/advisories/RUSTSEC-2025-0075.html)、[0080](https://rustsec.org/advisories/RUSTSEC-2025-0080.html)、[0100](https://rustsec.org/advisories/RUSTSEC-2025-0100.html)、[0098](https://rustsec.org/advisories/RUSTSEC-2025-0098.html)。这些是 unmaintained 提醒，没有可声明的修复版本，不等同六个已证实可利用漏洞。unic 通过 urlpattern → tauri-utils 被引入，也存在于当前 Windows 构建链。

| 方案 | 影响 | 建议 |
| --- | --- | --- |
| 当前保持兼容版本，记录风险，专项评估上游 GTK/Tauri 迁移 | 不破坏当前 Windows 功能；Linux 发布前必须验证 glib 调用可达性和适配方案 | **已采用，迁移另行评估** |
| 现在开展框架/GTK 迁移或维护 fork 的评估，审阅具体兼容改动后实施 | 可清理旧包，但可能改变图形后端、构建和平台支持；不能仅靠 npm/Cargo 强制 overrides | 若继续发布 Linux，优先安排 |

当前按推荐方案暂缓迁移，D04/D05 仍是剩余风险，不能标为已修复。后续先核实 Linux VariantStrIter 调用可达性，再评估上游 GTK/Tauri 的兼容升级；迁移应另行审阅并验证目标平台构建。没有删 Linux 功能、强制替换包或把缺乏信息的 fork 当成修复。

### C11 — 已确认并完成：模型与 Windows 原生库摘要清单

开发者已选择建立经核验的模型/DLL 摘要清单。实施文件：[asset-checksums.json](<D:/Codage/03 Mouse Dictation/docs/security/asset-checksums.json>)、[verify-native.mjs](<D:/Codage/03 Mouse Dictation/scripts/verify-native.mjs>)；维护说明见 [ASSET_VERIFICATION.md](<D:/Codage/03 Mouse Dictation/docs/security/ASSET_VERIFICATION.md>)。

- 三个模型均在解压前校验编译进应用的 SHA-256。SenseVoice 使用官方 GitHub digest；Streaming/Whisper 从官方 HTTPS release 流式下载，核对完整大小及下载前后的 asset ID/size/name/updated_at/digest，计算实际摘要。记录上传者和来源 URL，不将自行计算值冒称为发行方签名。
- Windows x64 的 sherpa-onnx v1.13.7 原生归档重新下载，SHA-256 与官方 GitHub digest 匹配；对其中 4 个 DLL、3 个导入库分别建档。现有缓存和 release DLL 与官方归档字节一致。ONNX Runtime DLL 文件版本为 1.27.1；sherpa DLL 未提供可核实文件版本。
- Tauri 开发/构建前核验原生归档和 7 个缓存文件，首次缓存只在验证归档后解压；打包前核验 4 个 release DLL。拒绝额外 DLL/导入库，并将资源配置由 *.dll 收紧为四个明确文件。sherpa-onnx-sys 版本偏离清单时要求先审核更新摘要。
- 测试了全新缓存下载/解压/校验、合法 release 文件接受，以及改动 DLL 一个字节后被拒绝；测试不执行被修改的 DLL。

SHA-256 防止基线建立后的字节替换，不证明初始发行者未失陷；未取得独立发行方签名，初始信任仍依赖官方 GitHub 账号及 TLS。[官方模型 release](https://github.com/k2-fsa/sherpa-onnx/releases/tag/asr-models)与[官方原生 release](https://github.com/k2-fsa/sherpa-onnx/releases/tag/v1.13.7)为核验来源。

当前原生基线只覆盖 Windows x64 标准构建；其他平台/架构明确提示未验证。直接 cargo 命令不执行 Tauri 的前置 hook，应先运行准备脚本。已安装或用户手工选取的模型文件不自动覆盖；下载校验不能认证任意本地自定义模型。安装包完整打包/签名流程未实际运行，打包前命令已单独验证并通过本地 CLI 配置 schema 核对。

## 5. 密钥搜索结果

- 当前文件和可达历史未发现可确认的真实硬编码 API Key、GitHub Token、云 AccessKey、私钥或 Webhook 凭据；高置信度历史规则检查了 23 个提交、150 个文本 blob。任意格式密码、外部 Git refs、GitHub Secrets、发布平台及云端备份不在可证明范围内，不能宣称绝对无泄露。
- 未发现跟踪的 .env 或私钥文件。Tauri updater 的 pubkey 是公开验证密钥；workflow 的 secrets 引用是变量引用，均不视为秘密值泄露。
- 对构建产物、依赖源码及二进制进行字符串模式扫描；一些 sk- 形式命中来自拼接 CSS mask-* 关键字，经上下文复核为误报。未对所有二进制做逆向，也未检查已发布的远程安装包。
- Vite 配置未设置把 TAURI_ 变量注入前端的 envPrefix；核对了 [Tauri 相关环境变量泄露公告](https://github.com/tauri-apps/tauri/security/advisories/GHSA-2rcp-jvr4-r259)。
- **如任何密钥曾提交、分享或发布过，必须到对应平台作废并重新生成；删除代码、加入 .gitignore 或清理历史都不能使旧密钥失效。** 本次未确认真实泄露，因此未擅自轮换签名/API 密钥。

## 6. 其他代码审查结论

逐文件检查了注入、网络与桌面边界、序列化、加密和 CI。未发现 SQL/NoSQL 使用、eval/动态执行远程 JS、模板执行、不可信反序列化为可执行对象、关闭 TLS 证书校验、硬编码 IV/盐或自造加密。JSON 为数据结构解析，文件上传为用户录音发送到用户选择的 API；相关 URL、请求体重定向与响应大小已加固。

本项目不是浏览器扩展或公开 Web 服务；没有 extension host_permissions、服务端鉴权/CORS/CSRF 管理面。Tauri Rust 后端网络请求不受浏览器 CSP 代替保护。应用主窗口仍有读取运行时 API Key 的必要权限，故 HTML/CSP/IPC 加固尤其重要；没有宣称 keyring 等于内存中不存在明文。

D06：crates.io 官方元数据记录 rdev 0.5.3 最后发布 2023-06-26、hound 3.5.1 为 2023-09-25、dirs-next 2.0.0 为 2020-10-22，已属长期无新版本，建议关注。仅以发布时间不能断言维护者已放弃；未发现可确认的直接依赖仿冒包，但未对所有发布者账号开展完整取证。cpal/sherpa 有较新版本，并非仅因版本较旧就必须迁移。

## 7. 构建和测试结果

| 验证 | 结果 |
| --- | --- |
| npm test | **4/4 通过**：source-map 恶意 offset、HTML 编码、真实方案渲染函数、IPC 能力清单 |
| cargo test --manifest-path src-tauri/Cargo.toml --locked --target-dir src-tauri/target | **17/17 通过**：原有测试及全部模型摘要覆盖、模型条目/路径/哈希、API 地址/脱敏、本机 HTTP 与远程 HTTPS 策略、跨来源重定向回归 |
| npm run build | **通过**，Vite 6.4.3 生成最终前端；默认沙箱写 Vite 临时缓存曾报 EPERM，以获批的权限运行后通过 |
| npm run tauri:build -- --no-bundle | **通过**，使用现有 release 配置生成 src-tauri/target/release/mouse-dictation.exe；包括 Tauri 2.11.6 与最终 npm 锁文件 |
| npm audit --json | **0 条工具告警**，总依赖条目 78；必须结合人工公告结果解释 |
| OSV 全量最终查询 | 729 项；剩余 7 个受提示包：glib 和 6 个停止维护包，GHSA/RUSTSEC 别名已去重解释 |
| 原生库验证 | 全新缓存 7 个文件通过；release 4 个 DLL 通过；单字节篡改被拒绝 |
| node --check src/main.js、Cargo 格式、git diff --check | 通过 |
| CI 发布测试门禁 | 步骤顺序及失败绕过检查通过；三个新增步骤对应命令本地运行通过；GitHub Actions 实际运行待确认 |
| Windows 桌面启动 | 最新生产构建副本成功启动，主窗口正常渲染且 Telegram 链接不存在；页面切换操作因开发者按 Escape 中止，未判定通过 |

没有进行真实麦克风录制、付费 API 请求、实际键盘发送、Windows 页面切换及 GUI/CSP/更新器全流程、macOS/Linux 构建或安装包签名验证。桌面检查已按开发者 Escape 操作停止。单元测试、静态清单检查和成功编译不能替代这些测试。以上为审核阶段验证记录；v0.1.22 发布另由 tag 触发的 CI 执行测试、构建及签名打包，不代表未验证的交互流程已通过。

## 8. 剩余风险与后续建议

1. 完成真实录音、页面切换、IPC 权限和更新流程验证；在 Linux 发布前核实 glib 受影响 API 可达性并评估框架迁移。C10 策略已落地，D04/D05 已记录暂缓迁移。
2. 应用崩溃/强制结束可能留下临时录音；模型解压中途失败可能留下部分已写入的正常模型文件。后续可设计启动清理与整包原子替换，但应明确保留/恢复策略，避免误删用户资料。
3. 凭据迁移失败时旧文件仍可能包含明文；需由开发者/用户核对自己的配置权限和凭据库状态。新版本的修复不会清理云备份或磁盘历史副本。
4. 自动化依赖审计应结合官方新公告，使用现有锁文件与 --locked/npm ci；本次两个数据库未命中实例说明只看 audit 的 0 不充分。
5. 固定 Action SHA 后仍需维护更新；按团队规则增加发布 tag/环境审批、固定工具链及扩展其他平台原生摘要。未擅自更改团队发布政策或引入新外部服务。

参考版本判断还核对了 [Vite Windows 公告](https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff)、[Vite 支持策略](https://vite.dev/releases)、[esbuild 的 Deno 公告](https://github.com/evanw/esbuild/security/advisories/GHSA-gv7w-rqvm-qjhr)、[picomatch 公告](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj)、[time RFC2822 公告](https://github.com/advisories/GHSA-r6v5-fh4h-64xc)。尚无法确定的调用链、真实 GUI 行为和原生资产来源均已标为待确认或验证限制，没有编造漏洞编号或修复版本。
