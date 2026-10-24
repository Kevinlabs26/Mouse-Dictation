# Mouse Dictation 安全审核技术记录（2026-10-24）

## 1. 项目与范围

Rust 2021 / Tauri 2、JavaScript/CSS / Vite 6；npm 和 Cargo。24 个直接依赖（npm 4、Rust 20），锁文件 711 个包版本条目（npm 78、Cargo 633）。范围为当前源码、配置、测试、构建/发布脚本、本地可达 Git 历史和选定产物。所有原有未提交改动保留；未安装、发布或轮换真实密钥。

方法：逐包公开检索与 GitHub Advisory/RustSec/官方公告核对、npm audit、OSV 精确版本查询、Cargo 正常/构建/全平台依赖树、逐文件安全边界审查和凭据模式扫描。cargo-audit 未安装，没有声称执行其扫描。新 vendor 源码与官方 .crate 归档逐文件比对并审查差异；不宣称审计了全部第三方原生源码。

### 全部直接依赖

| 生态 | 包 | 实际版本 |
| --- | --- | --- |
| npm | @tauri-apps/api | 2.11.1 |
| npm | @tauri-apps/plugin-updater | 2.11.0 |
| npm | @tauri-apps/cli | 2.11.4 |
| npm | vite | 6.4.5 |
| crates.io | arboard | 3.6.1 |
| crates.io | bzip2 | 0.5.2 |
| crates.io | cpal | 0.15.3 |
| crates.io | dirs-next | 2.0.0 |
| crates.io | hound | 3.5.1 |
| crates.io | keyring | 4.2.0 |
| crates.io | rdev | 0.5.3 |
| crates.io | reqwest | 0.12.28 |
| crates.io | serde | 1.0.229 |
| crates.io | serde_json | 1.0.151 |
| crates.io | sha2 | 0.10.9 |
| crates.io | sherpa-onnx | 1.13.7 |
| crates.io | tar | 0.4.46 |
| crates.io | tauri | 2.11.6 |
| crates.io | tauri-build | 2.6.3 |
| crates.io | tauri-plugin-autostart | 2.5.1 |
| crates.io | tauri-plugin-updater | 2.11.0 |
| crates.io | tempfile | 3.27.0 |
| crates.io | uuid | 1.26.0 |
| crates.io | windows-sys | 0.61.2 |

新增直接使用 uuid 1.26.0 的 v4 随机引用功能；它已在现有 Tauri 依赖图中，不是新增的未审计包版本。引用不是加密密钥，真实值仍在系统凭据库中。

### 关键间接依赖

| 包 | 实际版本 | 说明 |
| --- | --- | --- |
| rustls | 0.23.46 | 锁文件实际解析版本 |
| rustls-webpki | 0.103.16 | 锁文件实际解析版本 |
| webpki-roots | 0.26.11、1.0.10 | 锁文件实际解析版本 |
| webpki-root-certs | 1.0.10 | 锁文件实际解析版本 |
| tokio | 1.53.3 | 锁文件实际解析版本 |
| ctutils | 0.4.4 | 锁文件实际解析版本 |
| quinn-proto | 0.11.18 | 锁文件实际解析版本 |
| zip | 9.1.0 | 锁文件实际解析版本 |
| glib | 0.18.5 | 本地回补，见 PATCHES.md |
| proc-macro-error | 1.0.4 | 锁文件实际解析版本 |
| unic-char-property | 0.9.0 | 锁文件实际解析版本 |
| unic-char-range | 0.9.0 | 锁文件实际解析版本 |
| unic-common | 0.9.0 | 锁文件实际解析版本 |
| unic-ucd-ident | 0.9.0 | 锁文件实际解析版本 |
| unic-ucd-version | 0.9.0 | 锁文件实际解析版本 |
| zbus_names | 4.3.4 | 锁文件实际解析版本 |
| zvariant | 5.15.0 | 锁文件实际解析版本 |
| zvariant_derive | 5.15.0 | 锁文件实际解析版本 |
| sherpa-onnx-sys | 1.13.7 | 本地回补，见 PATCHES.md |
| rollup | 4.63.1 | 锁文件实际解析版本 |
| esbuild | 0.25.12 | 锁文件实际解析版本 |
| postcss | 8.5.28 | 锁文件实际解析版本 |
| source-map-js | 1.2.2 | 锁文件实际解析版本 |

完整清单含所有版本、直接/间接、本地补丁来源及公告 ID，见 dependency-inventory-2026-10-24.tsv。

## 2. 问题与当前状态

严重级别取自原公告或项目利用条件；不把锁文件命中直接当成 Windows 可利用。当前结果以源码审查、扫描和测试的验证结果为准。

| 编号 | 类别 | 严重级别 | 位置 | 当前状态 |
| --- | --- | --- | --- | --- |
| D01 | 依赖 | High（开发环境） | package.json:25 | 通过，Vite 6.4.5 |
| D02–D06 | 依赖 | High / Medium（各公告） | src-tauri/Cargo.lock（下表实际版本） | 通过，兼容补丁后未再命中原公告 |
| D07 | 依赖 | Critical（上游最高） | src-tauri/Cargo.lock:6613；src-tauri/Cargo.toml | 通过，ZIP 2/4 已移除；ZIP 9.1.0 仅构建使用 |
| D08 | 依赖 | Medium（Linux） | src-tauri/vendor/glib-0.18.5/src/variant_iter.rs:118 | 源码补丁核对通过；Linux 运行待确认 |
| D09/D10 | 依赖 | Low（维护） | Cargo.lock 的 proc-macro-error/unic*/zbus*；Cargo.toml 的 rdev/cpal/hound/dirs-next | 建议关注，保留维护告警 |
| D11 | 依赖 | Low（上游未审核公告） | src-tauri/src/main.rs:2997 | 当前应用已审配置不启用受影响功能 |
| C01 | 代码 | Medium | src-tauri/src/text_processing.rs:533 | 通过，1 MiB 边界回归通过 |
| K01/K02 | 密钥 | Medium / High | src-tauri/src/main.rs:908、929 | 通过，明确清理错误，完整绑定快照 |
| K03 | 密钥 | Medium（异常写入） | src-tauri/src/credential_config.rs:130、175 | 通过逻辑/故障模拟，不再覆盖旧凭据后再改地址 |
| C02 | 代码 | Low（初始供应链信任） | scripts/verify-native.mjs；asset-checksums.json | 建议关注，SHA-256 检测变化，不能替代初始渠道信任 |
| C03 | 代码 | Medium（macOS/Linux） | src-tauri/src/main.rs（非 Windows paste_text） | 按开发者此前决定保留；不计 Windows 运行验收 |

## 3. 本轮具体改动及验证

### 凭据绑定与异常一致性（K01/K02/K03）

原利用条件：在系统凭据先写入、配置尚未完整写入的间隙失败或被中断，重启可能将旧地址与新 Key 混用；旧的原地写文件还可能截断配置。

credential_config.rs 现在为每个当前配置/方案创建 UUID 标识的不可变凭据快照，单条记录保存两类 Key、API 地址、翻译通道和作用域。配置只保存引用。只有快照保存成功才原子替换配置；成功提交后再清理旧记录，清理失败明确报告“配置已保存，但凭据清理失败”。提交失败清理新记录，旧配置和旧记录保留。进程在新记录创建后强退会留下不可达记录，但读取仍依据旧配置引用，不会混用新 Key。

读取验证作用域、端点和通道；缺失、错误或不匹配时不回退旧 Key，阻止覆盖无法读取的配置。空引用明确表示没有 Key，防止旧值复活。旧 JSON 明文/旧 keyring 条目只在无新格式引用的旧配置路径读取，并在新引用提交后清理；没有读取任何真实用户配置进行迁移。

main.rs 的所有当前设置和方案持久化入口共用新模块；设置、托盘切换、方案创建/修改/删除、下载模型后保存及快速配置均经过对应持久化函数。Settings 的 credential_error 是后端私有跳过序列化的状态，IPC 提交不能解除后端的读取失败保护。写凭据失败采用不含值的通用错误。

回归覆盖：正常保存/重启、JSON 不含 Key、放弃快照模拟强退、地址/通道篡改、跨方案引用、凭据缺失无旧值回退、旧 keyring 迁移、旧方案明文迁移、显式清空/删除、批量方案部分失败、清理失败、坏配置禁止覆盖，以及 Windows 文件锁导致提交失败。使用内存凭据库和临时目录；这不冒充个人系统凭据库的实际升级验收。

改动文件：main.rs、credential_config.rs、Cargo.toml/Cargo.lock（直接启用既有 uuid）、PRIVACY.md/README.md、相关测试。原结构性顺序检查替换为实际持久化函数的故障模拟。

### ZIP 依赖链（D07）

ZIP 2.4.2 原经 sherpa-onnx-sys 构建依赖引入；ZIP 4.6.1 原经更新器旧版兼容功能引入。恶意 ZIP 进入 extract 路径时，上游公告涉及越界链接及 Unix 权限处理。更新器原另有签名边界，Windows 不应直接套用 Unix 提权结论。

已批准的方案：禁用更新器旧 Tauri 1 ZIP 兼容，保留 rustls/system-proxy 与当前 EXE/MSI；本地 sherpa-onnx-sys 1.13.7 仅将构建依赖升至 ZIP 9.1、只启用 DEFLATE。原 build.rs、FFI、原生 ABI 和 DLL 基线未改。锁文件没有 ZIP 2/4，当前 ZIP 9.1.0 仅出现在构建链，Windows 正常运行图没有 ZIP。

依据：[权限位问题](https://rustsec.org/advisories/RUSTSEC-2026-0367.html)、[越界符号链接](https://rustsec.org/advisories/RUSTSEC-2026-0368.html)、[经链接修改权限](https://rustsec.org/advisories/RUSTSEC-2026-0369.html)；公开修复下限 9.0.0。此次实际采用 9.1.0。没有直接升级识别库到 2.0。

### glib 源码回补（D08）

glib 0.18.5 的 VariantStrIter::impl_get 把不可变引用传给会修改该输出指针的 C 函数，违反 Rust 别名规则，优化构建可能崩溃。本地回补只把 let p / &p 改为 let mut p / &mut p，保持 GTK 0.18 类型兼容。

依据：[官方修复 PR 1343](https://github.com/gtk-rs/gtk-rs-core/pull/1343)、[RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html)。官方发布修复范围为 >=0.20.0；本地包仍标 0.18.5，版本扫描继续告警。不篡改版本或屏蔽公告。与官方归档比对的 121 个文件仅 variant_iter.rs 有两处预期源码改动；Node 静态回归验证补丁和 Cargo 使用路径。

本机无可用 Linux 分发环境，未运行 Linux glib 优化构建测试。Windows 依赖树不包含 glib。结论为“源码回补核对通过，Linux 运行待确认”，不是完整 Linux 验收。

补丁维护文档：[PATCHES.md](<src-tauri/vendor/PATCHES.md>)；官方归档摘要与逐文件差异：[vendor-patches-2026-10-24.json](<docs/security/vendor-patches-2026-10-24.json>)。sherpa 包的 22 个官方文件仅两个 manifest 有预期变化；保留上游许可证。

### 原生库公告可达性（D11）

该公告针对 OfflineTransducerGreedySearchDecoder::Decode。当前离线构造器只配置 SenseVoice 或 Whisper，实时使用 OnlineRecognizer；匹配版本的官方工厂在这些分支直接选择相应实现。已审路径不启用公告涉及的离线 Transducer。[完整路径证据](<docs/security/native-advisory-reachability-2026-10-24.md>)、[上游问题](https://github.com/k2-fsa/sherpa-onnx/issues/3983)、[公告](https://github.com/advisories/GHSA-f5q5-vp8g-wh4x)。

没有宣称原生库所有实现安全，也没有在未知修复版本下替换 ABI。未来新增离线 Transducer 或允许外部完整原生配置时必须重新审查。

### 此前安全处理的最终状态

Vite 6.4.5、rustls 0.23.46、rustls-webpki 0.103.16、webpki-roots/root-certs 1.0.10、Tokio 1.53.3、ctutils 0.4.4、quinn-proto 0.11.18 未再命中此前适用公告。其精确受影响范围、修复版本、特性条件和官方参考保存在证据 JSON 的 advisories 中。词典输入/输出 1 MiB 边界、凭据错误反馈及 Windows 输入保护相关回归继续通过。

## 4. 开发者决定

开发者本轮已明确批准最小兼容方案：凭据绑定迁移与原子配置；禁用旧 ZIP 更新兼容；本地回补 sherpa 构建依赖/glib，保留原生 ABI 和 GTK 接口。此前“暂缓 ZIP/glib/凭据迁移”的决定已由此次批准替代，无需重复确认。未批准或实施整库大版本升级、删除现用功能、轮换真实 Key、发布。

macOS/Linux 输入焦点保护仍按此前决定只记录源码风险；本轮 Windows 运行范围未扩展。

## 5. 剩余风险与安全核查覆盖

- 维护：proc-macro-error 1.0.4；五个 unic 0.9.0 包；zbus_names 4.3.4、zvariant/zvariant_derive 5.15.0，共 9 个 INFO 类维护告警。rdev/hound/dirs-next 长期无发布，cpal 为旧分支。未确认这些维护告警本身构成可利用漏洞，未确认仿冒包证据。随上游兼容替换跟进。
- 凭据：首次真实迁移尚未对个人配置执行；存储不可访问会阻止覆盖，恢复后需重启。强退可能保留系统凭据库中的未引用快照，清理失败明确提示；旧版回退可能需重填 Key。已泄露 Key 仍必须到提供商撤销，不能靠删除代码撤销；本次未发现确认泄露。
- 原生与其他平台：原生完整内部依赖清单/全部 C++ 实现未审计；手动选择模型仍依赖来源信任；Linux glib 运行和 macOS/Linux 焦点保护未验收。不能因此假定 Windows 有已复现的相同漏洞。
- 代码核查：可控 HTML 使用 escapeHtml/textContent/Option；CSP 与 25 命令能力隔离；HTTPS/同源重定向/响应上限/当前 Key 脱敏；模型 SHA-256、普通文件白名单、路径/大小限制及删除边界；录音临时文件和默认关闭的内存结果；Windows 目标/取消/修饰键处理；无确认的命令注入、eval、远程脚本或越权 IPC。未发现数据库/Web 服务/扩展/Electron 入口，对应 SQL、服务端 CSRF/CORS、扩展权限和 nodeIntegration 不适用。
- CI：固定 Action SHA、无 pull_request_target、无不可信文本直接插入 shell、最小权限和签名环境变量隔离的静态检查通过。未把线上是否发布或发布者信誉纳入安全失败项。
- 密钥：367 个当前扫描文件、21 个额外产物、28 个本地提交/226 个文本 blob，无确认秘密；.env/私钥忽略正常，.env.example 只有空签名变量。模式扫描不证明不存在未知/编码秘密，不覆盖不可达或仅远端历史；NSIS/MSI 压缩负载未全部解包，便携包 8 文件直接读取并扫描；重复解包缓存未重复计入扫描。

## 6. 最终验证

| 检查 | 结果 |
| --- | --- |
| npm audit | 0 告警 |
| OSV 精确版本查询 | 711 个包版本；ZIP 告警消失，glib 版本告警及 9 个维护包保留，未屏蔽 |
| npm test | 36/36，0 跳过 |
| Rust 测试 | 68/68，0 忽略 |
| Tauri 生产构建、便携 ZIP、NSIS | 本地构建通过；未安装/发布 |
| 实际 ZIP / DLL 校验 | 8 个允许文件；EXE 与当前 release 相同，4 DLL 符合原基线；安装包别名与原件一致 |
| vendor 来源与差异 | 官方归档 checksum 通过；143 文件逐一核对，只有 3 个预期修改文件 |
| cargo fmt / git diff --check | 通过（Git 仅行尾提示） |

本地预览 NSIS 未生成 updater 签名，运行时更新公钥验证保持启用。签名与一般安装验收不作为此安全范围的失败项。配置/依赖/原生字节变化后需相应复验。

## 7. 本次再次复核

183 个审核文件及交付产物摘要与前述验证快照一致；本次复核未新增代码修改。重新执行 npm audit（0 告警）、OSV（711 包版本，仍为 glib 版本告警及 9 个维护包）、前端 36/36、Rust 68/68、143 个 vendor 文件来源/补丁核对及秘密扫描（无确认秘密）。生产构建证据来自相同源码和产物快照，本次没有重复构建。扫描时间及新结果见证据 JSON 的 recheck、osvAfter、credentialsScan。
