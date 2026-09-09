import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./styles.css";

const $ = (id) => document.querySelector(`#${id}`);

const UI_TEXT_EN = {
  "说话中": "Speaking",
  "正在等待鼠标": "Waiting for mouse",
  "按住左键超过设定时间即可开始录音": "Hold the left mouse button to start recording",
  "实时预览": "Live preview",
  "正在等待语音…": "Waiting for speech…",
  "识别": "Recognition",
  "触发": "Trigger",
  "模型": "Models",
  "翻译": "Translation",
  "外观": "Appearance",
  "帮助": "Help",
  "方案": "Profile",
  "当前设置": "Current settings",
  "新建": "New",
  "改名": "Rename",
  "删除": "Delete",
  "付费 API": "Paid API",
  "本地离线": "Local offline",
  "付费 API · 需要网络和 API Key": "Paid API · Internet and API key required",
  "付费 API 仅支持说完输出": "Paid API only supports final output",
  "本地离线 · 边说边输入": "Local offline · Type while speaking",
  "本地离线 · 说完后输入": "Local offline · Insert after speaking",
  "输出方式": "Output",
  "实时流式": "Realtime",
  "说完输出": "Final output",
  "松开后输入": "Insert on release",
  "边说边输入": "Type while speaking",
  "付费接口": "Paid API connection",
  "服务厂商": "Provider",
  "测试连接": "Test connection",
  "测试连接中…": "Testing connection…",
  "获取中…": "Fetching models…",
  "OpenAI": "OpenAI",
  "Ollama (Local)": "Ollama (Local)",
  "Groq": "Groq",
  "Fireworks AI": "Fireworks AI",
  "DeepInfra": "DeepInfra",
  "SiliconFlow": "SiliconFlow",
  "智谱 AI": "Zhipu AI",
  "阿里云": "Alibaba Cloud",
  "DeepSeek（低价高频）": "DeepSeek (Low cost · High volume)",
  "智谱 AI": "Zhipu AI",
  "阿里云": "Alibaba Cloud",
  "SiliconFlow": "SiliconFlow",
  "Groq": "Groq",
  "OpenAI": "OpenAI",
  "跟随识别 API": "Follow recognition API",
  "自定义 API": "Custom API",
  "自定义": "Custom",
  "已保存": "Saved",
  "紫罗兰": "Violet",
  "蓝": "Blue",
  "青": "Cyan",
  "绿": "Green",
  "玫红": "Rose",
  "琥珀": "Amber",
  "转写模型": "Transcription model",
  "测试接口": "Test connection",
  "测试翻译接口": "Test translation",
  "获取模型": "Fetch models",
  "获取翻译模型": "Fetch translation models",
  "翻译测试中…": "Testing translation…",
  "获取翻译模型中…": "Fetching translation models…",
  "API Key 仅保存在本机。": "The API key is stored locally only.",
  "支持作者": "Support the author",
  "本次识别体验如何？": "How was this recognition?",
  "你的反馈会帮助我改进识别体验。": "Your feedback helps improve recognition.",
  "感谢反馈": "Thanks for the feedback",
  "喜欢这个工具？": "Like this tool?",
  "关闭反馈": "Dismiss feedback",
  "自由赞助": "Tip on Ko-fi",
  "支持 / 购买": "Support / purchase",
  "Ko-fi · 自由赞助": "Ko-fi · Tip",
  "Lemon Squeezy · 支持 / 购买": "Lemon Squeezy · Support / purchase",
  "☕ 支持作者": "☕ Support the author",
  "Ko-fi": "Ko-fi",
  "Lemon Squeezy": "Lemon Squeezy",
  "打开链接失败": "Could not open the link",
  "翻译使用识别 API；模型失效时自动选择可用文本模型。": "Uses the recognition API; selects an available text model if needed.",
  "使用 OpenAI 兼容接口，需要 API Key。": "Uses an OpenAI-compatible API and requires an API key.",
  "本地离线": "Local offline",
  "模型目录": "Model directory",
  "音频只在本机处理；模型请到": "Audio stays on this device; download models from ",
  "下载。": ".",
  "识别语言": "Recognition language",
  "自动检测": "Auto-detect",
  "中文": "Chinese",
  "英文": "English",
  "日语": "Japanese",
  "韩语": "Korean",
  "粤语": "Cantonese",
  "德语": "German",
  "法语": "French",
  "西班牙语": "Spanish",
  "俄语": "Russian",
  "葡萄牙语": "Portuguese",
  "意大利语": "Italian",
  "荷兰语": "Dutch",
  "波兰语": "Polish",
  "土耳其语": "Turkish",
  "阿拉伯语": "Arabic",
  "印地语": "Hindi",
  "印尼语": "Indonesian",
  "马来语": "Malay",
  "泰语": "Thai",
  "越南语": "Vietnamese",
  "乌克兰语": "Ukrainian",
  "波斯语": "Persian",
  "希伯来语": "Hebrew",
  "希腊语": "Greek",
  "瑞典语": "Swedish",
  "丹麦语": "Danish",
  "芬兰语": "Finnish",
  "匈牙利语": "Hungarian",
  "罗马尼亚语": "Romanian",
  "捷克语": "Czech",
  "保加利亚语": "Bulgarian",
  "加泰罗尼亚语": "Catalan",
  "孟加拉语": "Bengali",
  "泰米尔语": "Tamil",
  "挪威语": "Norwegian",
  "自动检测（共 99 种语言）": "Auto-detect (99 languages)",
  "流式模式不支持翻译。": "Translation is not available in streaming mode.",
  "开启后选择目标语言。": "Turn it on, then choose a target language.",
  "说完自动翻译": "Translate after speaking",
  "识别后自动翻译，再粘贴。": "Translate the result before inserting it.",
  "翻译通道": "Translation provider",
  "目标语言": "Target language",
  "翻译模型": "Translation model",
  "翻译设置": "Translation settings",
  "模型删除后可重新下载。": "Deleted models can be downloaded again.",
  "明暗主题": "Theme",
  "浅色": "Light",
  "深色": "Dark",
  "主题颜色": "Accent color",
  "自定义颜色": "Custom color",
  "界面语言": "Interface language",
  "开机启动": "Launch at startup",
  "登录后自动驻留托盘": "Start in the system tray after sign-in",
  "关闭窗口会退出程序；最小化可继续在后台使用。": "Closing the window exits the app; minimize to keep it running.",
  "按住鼠标左键": "Hold the left mouse button",
  "保持鼠标静止，长按后开始录音。": "Keep the mouse still; recording starts after a long press.",
  "说话并松开": "Speak and release",
  "看到录音状态后开始说话，松开左键结束。": "Start speaking when recording begins, then release to finish.",
  "文字自动输入": "Text is inserted automatically",
  "识别结果会粘贴到当前输入位置。": "The result is pasted into the active input.",
  "Esc 取消录音 · 单次最长 5 分钟": "Esc cancels recording · Maximum 5 minutes per recording",
  "按住鼠标静止，避免拖动文件或选择文字时误触。": "Keep the mouse still to avoid triggering while dragging or selecting text.",
  "键盘快捷键（可选）": "Keyboard shortcut (optional)",
  "关闭": "Off",
  "自定义…": "Custom…",
  "尚未设置": "Not set",
  "已使用预设快捷键": "Using a preset shortcut",
  "请按组合键…": "Press a key combination…",
  "录制快捷键": "Record shortcut",
  "录制": "Record",
  "修改": "Edit",
  "重置": "Reset",
  "松开快捷键结束录音；鼠标长按仍可用。": "Release the shortcut to stop; mouse press-and-hold still works.",
  "填写 Key": "Enter key",
  "填写模型": "Enter model",
  "切换识别方式": "Switch recognition mode",
  "开关自动翻译": "Toggle automatic translation",
  "修改快捷键": "Edit shortcut",
  "恢复默认": "Restore default",
  "每项功能都有独立默认快捷键，也可以直接修改。": "Each action has its own default shortcut, which you can edit.",
  "快捷键冲突": "Shortcut conflict",
  "请使用不同的组合键。": "Please use a different key combination.",
  "去下载模型": "Download model",
  "未选模型": "No model selected",
  "未配置 API Key": "API key not configured",
  "需要下载模型": "Model download required",
  "确定": "Confirm",
  "取消": "Cancel",
  "新建方案": "New profile",
  "为当前识别设置起一个名称。": "Name the current recognition settings.",
  "新方案": "New profile",
  "例如：中文 · 本地离线": "e.g. Chinese · Local offline",
  "方案已创建": "Profile created",
  "已保存当前设置": "Current settings saved",
  "修改方案名称": "Rename profile",
  "名称只用于快速识别这个方案。": "The name helps you identify this profile.",
  "输入方案名称": "Enter a profile name",
  "方案已重命名": "Profile renamed",
  "删除方案": "Delete profile",
  "删除": "Delete",
  "此操作不可撤销。": "This action cannot be undone.",
  "SenseVoice（离线）": "SenseVoice (offline)",
  "中 / 英 / 日 / 韩 / 粤语 · 松开一次成句，准确率高": "Chinese / English / Japanese / Korean / Cantonese · Accurate final sentences",
  "99 种语言 · 约 490 MB · CPU 推理较慢，适合小语种": "99 languages · about 490 MB · slower on CPU, suitable for less common languages",
  "Zipformer（流式）": "Zipformer (streaming)",
  "中 / 英 · 边说边出字，延迟低": "Chinese / English · words appear while speaking, low latency",
  "流式识别": "Streaming recognition",
  "多语言整句": "Multilingual final sentence",
  "离线整句": "Offline final sentence",
  "方案已删除": "Profile deleted",
  "当前设置仍然保留": "Current settings were kept",
  "保存失败": "Save failed",
  "启动失败": "Startup failed",
  "发生错误": "Error",
  "已完成": "Completed",
  "稳定文字已粘贴到当前输入位置": "Stable text was pasted into the active input",
  "已取消": "Cancelled",
  "本次录音已丢弃，没有继续转写": "This recording was discarded",
  "正在录音": "Recording",
  "稳定片段会自动输入，当前内容显示在实时预览": "Stable segments are inserted automatically; current text appears in the live preview",
  "松开鼠标左键完成转写": "Release the left mouse button to finish transcription",
  "正在转写": "Transcribing",
  "请稍候，完成后会自动粘贴": "Please wait; the result will be pasted automatically",
  "正在翻译": "Translating",
  "翻译完成后会自动粘贴": "The translation will be pasted automatically",
  "配置已切换": "Profile switched",
  "新的语言和翻译设置已生效": "The new language and translation settings are active",
  "正在识别…": "Recognizing…",
  "测试中…": "Testing…",
  "未检测到麦克风": "No microphone detected",
  "默认麦克风：": "Default microphone: ",
  "正在下载模型": "Downloading model",
  "模型已就绪": "Model ready",
  "模型下载失败": "Model download failed",
  "已切换模型": "Model switched",
  "模型已删除": "Model deleted",
  "磁盘空间已释放": "Disk space released",
  "确认删除？": "Confirm deletion?",
  "下载": "Download",
  "重新下载": "Download again",
  "设为当前": "Use this model",
  "已就绪": "Ready",
  "不完整": "Incomplete",
  "未下载": "Not downloaded",
  "使用中": "In use",
  "删除后可重新下载": "Can be downloaded again after deletion",
  "尚未下载": "Not downloaded",
  "打开目录": "Open folder",
  "下载中…": "Downloading…",
  "手动放置的自定义模型 · ": "Manually placed custom model · ",
  "首次下载较大；中断后再次点击可继续": "The first download is large; click again to resume if interrupted",
  "已自动设为当前模型，切换到“本地离线”即可使用": "Set as the current model; switch to Local offline to use it",
  "在线": "Online",
  "本地": "Local",
  "边说边输入": "Type while speaking",
  "说完输出": "Final output",
  "输入": "Input",
  "请稍候": "Please wait",
  "已占用": "Used ",
  "长按触发": "Hold to trigger",
  "全部重置": "Reset all",
  "长按时间": "Hold duration",
  "录音快捷键": "Recording shortcut",
  "0.5 秒": "0.5 sec",
  "1 秒": "1 sec",
  "2 秒": "2 sec",
  "3 秒": "3 sec",
  "系统": "System",
  "耳机": "Headset",
  "麦克风": "Microphone"
};

const UI_TEXTS = {
  en: UI_TEXT_EN,
  fr: {
    "说话中": "Parler", "正在等待鼠标": "En attente de la souris", "按住左键超过设定时间即可开始录音": "Maintenez le bouton gauche pour commencer l’enregistrement", "实时预览": "Aperçu en direct", "识别": "Reconnaissance", "触发": "Déclenchement", "模型": "Modèles", "翻译": "Traduction", "外观": "Apparence", "帮助": "Aide", "方案": "Profil", "当前设置": "Paramètres actuels", "新建": "Nouveau", "改名": "Renommer", "删除": "Supprimer", "在线 API": "API en ligne", "本地离线": "Hors ligne", "输出方式": "Sortie", "实时流式": "Temps réel", "说完输出": "Sortie finale", "松开后输入": "Insérer au relâchement", "边说边输入": "Écrire en parlant", "在线接口": "Connexion en ligne", "服务厂商": "Fournisseur", "转写模型": "Modèle de transcription", "测试接口": "Tester la connexion", "模型目录": "Dossier du modèle", "识别语言": "Langue de reconnaissance", "自动检测": "Détection automatique", "中文": "Chinois", "英文": "Anglais", "日语": "Japonais", "韩语": "Coréen", "法语": "Français", "德语": "Allemand", "西班牙语": "Espagnol", "翻译设置": "Paramètres de traduction", "说完自动翻译": "Traduire après avoir parlé", "翻译通道": "Fournisseur de traduction", "目标语言": "Langue cible", "翻译模型": "Modèle de traduction", "明暗主题": "Thème", "浅色": "Clair", "深色": "Sombre", "主题颜色": "Couleur d’accent", "自定义颜色": "Couleur personnalisée", "界面语言": "Langue de l’interface", "开机启动": "Lancer au démarrage", "键盘快捷键（可选）": "Raccourci clavier (facultatif)", "关闭": "Désactivé", "自定义…": "Personnalisé…", "尚未设置": "Non défini", "录制快捷键": "Enregistrer le raccourci", "填写 Key": "Saisir la clé", "去下载模型": "Télécharger le modèle", "未选模型": "Aucun modèle sélectionné", "确定": "Confirmer", "取消": "Annuler", "新建方案": "Nouveau profil", "为当前识别设置起一个名称。": "Nommez ces paramètres de reconnaissance.", "新方案": "Nouveau profil", "修改方案名称": "Renommer le profil", "输入方案名称": "Saisissez un nom de profil", "删除方案": "Supprimer le profil", "方案已创建": "Profil créé", "方案已重命名": "Profil renommé", "方案已删除": "Profil supprimé", "当前设置仍然保留": "Les paramètres actuels sont conservés", "已完成": "Terminé", "已取消": "Annulé", "正在录音": "Enregistrement", "正在转写": "Transcription", "正在翻译": "Traduction en cours", "发生错误": "Erreur", "保存失败": "Échec de l’enregistrement", "启动失败": "Échec du démarrage", "正在下载模型": "Téléchargement du modèle", "模型已就绪": "Modèle prêt", "模型下载失败": "Échec du téléchargement", "已切换模型": "Modèle changé", "模型已删除": "Modèle supprimé", "下载": "Télécharger", "重新下载": "Télécharger à nouveau", "设为当前": "Utiliser ce modèle", "已就绪": "Prêt", "不完整": "Incomplet", "未下载": "Non téléchargé", "使用中": "En cours d’utilisation"
  },
  de: {
    "说话中": "Sprechen", "正在等待鼠标": "Warten auf die Maus", "按住左键超过设定时间即可开始录音": "Linke Maustaste gedrückt halten, um die Aufnahme zu starten", "实时预览": "Live-Vorschau", "识别": "Erkennung", "触发": "Auslöser", "模型": "Modelle", "翻译": "Übersetzung", "外观": "Darstellung", "帮助": "Hilfe", "方案": "Profil", "当前设置": "Aktuelle Einstellungen", "新建": "Neu", "改名": "Umbenennen", "删除": "Löschen", "在线 API": "Online-API", "本地离线": "Lokal offline", "输出方式": "Ausgabe", "实时流式": "Echtzeit", "说完输出": "Ausgabe am Ende", "松开后输入": "Beim Loslassen einfügen", "边说边输入": "Während des Sprechens einfügen", "在线接口": "Online-Verbindung", "服务厂商": "Anbieter", "转写模型": "Transkriptionsmodell", "测试接口": "Verbindung testen", "模型目录": "Modellordner", "识别语言": "Erkennungssprache", "自动检测": "Automatisch erkennen", "中文": "Chinesisch", "英文": "Englisch", "日语": "Japanisch", "韩语": "Koreanisch", "法语": "Französisch", "德语": "Deutsch", "西班牙语": "Spanisch", "翻译设置": "Übersetzungseinstellungen", "说完自动翻译": "Nach dem Sprechen übersetzen", "翻译通道": "Übersetzungsanbieter", "目标语言": "Zielsprache", "翻译模型": "Übersetzungsmodell", "明暗主题": "Design", "浅色": "Hell", "深色": "Dunkel", "主题颜色": "Akzentfarbe", "自定义颜色": "Benutzerdefinierte Farbe", "界面语言": "Oberflächensprache", "开机启动": "Beim Start ausführen", "键盘快捷键（可选）": "Tastenkürzel (optional)", "关闭": "Aus", "自定义…": "Benutzerdefiniert…", "尚未设置": "Nicht festgelegt", "录制快捷键": "Tastenkürzel aufnehmen", "填写 Key": "Key eingeben", "去下载模型": "Modell herunterladen", "未选模型": "Kein Modell ausgewählt", "确定": "Bestätigen", "取消": "Abbrechen", "新建方案": "Neues Profil", "为当前识别设置起一个名称。": "Gib diesen Erkennungseinstellungen einen Namen.", "新方案": "Neues Profil", "修改方案名称": "Profil umbenennen", "输入方案名称": "Profilnamen eingeben", "删除方案": "Profil löschen", "方案已创建": "Profil erstellt", "方案已重命名": "Profil umbenannt", "方案已删除": "Profil gelöscht", "当前设置仍然保留": "Aktuelle Einstellungen bleiben erhalten", "已完成": "Abgeschlossen", "已取消": "Abgebrochen", "正在录音": "Aufnahme", "正在转写": "Transkription", "正在翻译": "Übersetzung läuft", "发生错误": "Fehler", "保存失败": "Speichern fehlgeschlagen", "启动失败": "Start fehlgeschlagen", "正在下载模型": "Modell wird heruntergeladen", "模型已就绪": "Modell bereit", "模型下载失败": "Modell-Download fehlgeschlagen", "已切换模型": "Modell gewechselt", "模型已删除": "Modell gelöscht", "下载": "Herunterladen", "重新下载": "Erneut herunterladen", "设为当前": "Dieses Modell verwenden", "已就绪": "Bereit", "不完整": "Unvollständig", "未下载": "Nicht heruntergeladen", "使用中": "In Verwendung"
  },
  ja: {
    "说话中": "話しています", "正在等待鼠标": "マウスを待機中", "按住左键超过设定时间即可开始录音": "左ボタンを長押しすると録音を開始します", "实时预览": "ライブプレビュー", "识别": "認識", "触发": "トリガー", "模型": "モデル", "翻译": "翻訳", "外观": "外観", "帮助": "ヘルプ", "方案": "プロファイル", "当前设置": "現在の設定", "新建": "新規", "改名": "名前を変更", "删除": "削除", "在线 API": "オンライン API", "本地离线": "ローカル・オフライン", "输出方式": "出力方式", "实时流式": "リアルタイム", "说完输出": "発話後に出力", "松开后输入": "離した後に入力", "边说边输入": "話しながら入力", "在线接口": "オンライン接続", "服务厂商": "プロバイダー", "转写模型": "文字起こしモデル", "测试接口": "接続をテスト", "模型目录": "モデルフォルダー", "识别语言": "認識言語", "自动检测": "自動検出", "中文": "中国語", "英文": "英語", "日语": "日本語", "韩语": "韓国語", "法语": "フランス語", "德语": "ドイツ語", "西班牙语": "スペイン語", "翻译设置": "翻訳設定", "说完自动翻译": "発話後に翻訳", "翻译通道": "翻訳プロバイダー", "目标语言": "対象言語", "翻译模型": "翻訳モデル", "明暗主题": "テーマ", "浅色": "ライト", "深色": "ダーク", "主题颜色": "アクセントカラー", "自定义颜色": "カスタムカラー", "界面语言": "インターフェース言語", "开机启动": "起動時に実行", "键盘快捷键（可选）": "キーボードショートカット（任意）", "关闭": "オフ", "自定义…": "カスタム…", "尚未设置": "未設定", "录制快捷键": "ショートカットを録音", "填写 Key": "キーを入力", "去下载模型": "モデルをダウンロード", "未选模型": "モデル未選択", "确定": "確認", "取消": "キャンセル", "新建方案": "新しいプロファイル", "为当前识别设置起一个名称。": "現在の認識設定に名前を付けます。", "新方案": "新しいプロファイル", "修改方案名称": "プロファイル名を変更", "输入方案名称": "プロファイル名を入力", "删除方案": "プロファイルを削除", "方案已创建": "プロファイルを作成しました", "方案已重命名": "プロファイル名を変更しました", "方案已删除": "プロファイルを削除しました", "当前设置仍然保留": "現在の設定は保持されます", "已完成": "完了", "已取消": "キャンセルしました", "正在录音": "録音中", "正在转写": "文字起こし中", "正在翻译": "翻訳中", "发生错误": "エラー", "保存失败": "保存に失敗しました", "启动失败": "起動に失敗しました", "正在下载模型": "モデルをダウンロード中", "模型已就绪": "モデルの準備完了", "模型下载失败": "モデルのダウンロードに失敗しました", "已切换模型": "モデルを切り替えました", "模型已删除": "モデルを削除しました", "下载": "ダウンロード", "重新下载": "再ダウンロード", "设为当前": "このモデルを使用", "已就绪": "準備完了", "不完整": "不完全", "未下载": "未ダウンロード", "使用中": "使用中"
  },
  es: {
    "说话中": "Hablando", "正在等待鼠标": "Esperando el ratón", "按住左键超过设定时间即可开始录音": "Mantén pulsado el botón izquierdo para empezar a grabar", "实时预览": "Vista previa en directo", "识别": "Reconocimiento", "触发": "Activación", "模型": "Modelos", "翻译": "Traducción", "外观": "Apariencia", "帮助": "Ayuda", "方案": "Perfil", "当前设置": "Configuración actual", "新建": "Nuevo", "改名": "Cambiar nombre", "删除": "Eliminar", "在线 API": "API en línea", "本地离线": "Local sin conexión", "输出方式": "Salida", "实时流式": "Tiempo real", "说完输出": "Salida final", "松开后输入": "Insertar al soltar", "边说边输入": "Escribir mientras hablas", "在线接口": "Conexión en línea", "服务厂商": "Proveedor", "转写模型": "Modelo de transcripción", "测试接口": "Probar conexión", "模型目录": "Carpeta del modelo", "识别语言": "Idioma de reconocimiento", "自动检测": "Detección automática", "中文": "Chino", "英文": "Inglés", "日语": "Japonés", "韩语": "Coreano", "法语": "Francés", "德语": "Alemán", "西班牙语": "Español", "翻译设置": "Configuración de traducción", "说完自动翻译": "Traducir después de hablar", "翻译通道": "Proveedor de traducción", "目标语言": "Idioma de destino", "翻译模型": "Modelo de traducción", "明暗主题": "Tema", "浅色": "Claro", "深色": "Oscuro", "主题颜色": "Color de acento", "自定义颜色": "Color personalizado", "界面语言": "Idioma de la interfaz", "开机启动": "Iniciar con el sistema", "键盘快捷键（可选）": "Atajo de teclado (opcional)", "关闭": "Desactivado", "自定义…": "Personalizado…", "尚未设置": "Sin configurar", "录制快捷键": "Grabar atajo", "填写 Key": "Introducir clave", "去下载模型": "Descargar modelo", "未选模型": "Ningún modelo seleccionado", "确定": "Confirmar", "取消": "Cancelar", "新建方案": "Nuevo perfil", "为当前识别设置起一个名称。": "Nombra esta configuración de reconocimiento.", "新方案": "Nuevo perfil", "修改方案名称": "Cambiar nombre del perfil", "输入方案名称": "Introduce un nombre de perfil", "删除方案": "Eliminar perfil", "方案已创建": "Perfil creado", "方案已重命名": "Perfil renombrado", "方案已删除": "Perfil eliminado", "当前设置仍然保留": "Se conservará la configuración actual", "已完成": "Completado", "已取消": "Cancelado", "正在录音": "Grabando", "正在转写": "Transcribiendo", "正在翻译": "Traduciendo", "发生错误": "Error", "保存失败": "Error al guardar", "启动失败": "Error al iniciar", "正在下载模型": "Descargando modelo", "模型已就绪": "Modelo listo", "模型下载失败": "Error al descargar el modelo", "已切换模型": "Modelo cambiado", "模型已删除": "Modelo eliminado", "下载": "Descargar", "重新下载": "Descargar de nuevo", "设为当前": "Usar este modelo", "已就绪": "Listo", "不完整": "Incompleto", "未下载": "No descargado", "使用中": "En uso"
  },
  ko: {
    "说话中": "말하는 중", "正在等待鼠标": "마우스 대기 중", "按住左键超过设定时间即可开始录音": "왼쪽 버튼을 길게 눌러 녹음을 시작하세요", "实时预览": "실시간 미리보기", "识别": "인식", "触发": "트리거", "模型": "모델", "翻译": "번역", "外观": "모양", "帮助": "도움말", "方案": "프로필", "当前设置": "현재 설정", "新建": "새로 만들기", "改名": "이름 변경", "删除": "삭제", "在线 API": "온라인 API", "本地离线": "로컬 오프라인", "输出方式": "출력", "实时流式": "실시간", "说完输出": "말한 후 출력", "松开后输入": "놓은 후 입력", "边说边输入": "말하면서 입력", "在线接口": "온라인 연결", "服务厂商": "제공업체", "转写模型": "음성 변환 모델", "测试接口": "연결 테스트", "模型目录": "모델 폴더", "识别语言": "인식 언어", "自动检测": "자동 감지", "中文": "중국어", "英文": "영어", "日语": "일본어", "韩语": "한국어", "法语": "프랑스어", "德语": "독일어", "西班牙语": "스페인어", "翻译设置": "번역 설정", "说完自动翻译": "말한 후 번역", "翻译通道": "번역 제공업체", "目标语言": "대상 언어", "翻译模型": "번역 모델", "明暗主题": "테마", "浅色": "밝게", "深色": "어둡게", "主题颜色": "강조 색상", "自定义颜色": "사용자 지정 색상", "界面语言": "인터페이스 언어", "开机启动": "시작 시 실행", "键盘快捷键（可选）": "키보드 단축키(선택 사항)", "关闭": "끔", "自定义…": "사용자 지정…", "尚未设置": "설정되지 않음", "录制快捷键": "단축키 기록", "填写 Key": "키 입력", "去下载模型": "모델 다운로드", "未选模型": "선택한 모델 없음", "确定": "확인", "取消": "취소", "新建方案": "새 프로필", "为当前识别设置起一个名称。": "현재 인식 설정의 이름을 입력하세요.", "新方案": "새 프로필", "修改方案名称": "프로필 이름 변경", "输入方案名称": "프로필 이름 입력", "删除方案": "프로필 삭제", "方案已创建": "프로필이 생성되었습니다", "方案已重命名": "프로필 이름이 변경되었습니다", "方案已删除": "프로필이 삭제되었습니다", "当前设置仍然保留": "현재 설정은 유지됩니다", "已完成": "완료", "已取消": "취소됨", "正在录音": "녹음 중", "正在转写": "변환 중", "正在翻译": "번역 중", "发生错误": "오류", "保存失败": "저장 실패", "启动失败": "시작 실패", "正在下载模型": "모델 다운로드 중", "模型已就绪": "모델 준비 완료", "模型下载失败": "모델 다운로드 실패", "已切换模型": "모델 전환 완료", "模型已删除": "모델 삭제 완료", "下载": "다운로드", "重新下载": "다시 다운로드", "设为当前": "이 모델 사용", "已就绪": "준비됨", "不完整": "불완전", "未下载": "다운로드 안 됨", "使用中": "사용 중"
  },
  pt: {
    "说话中": "Falando", "正在等待鼠标": "Aguardando o mouse", "按住左键超过设定时间即可开始录音": "Mantenha o botão esquerdo pressionado para começar a gravar", "实时预览": "Pré-visualização ao vivo", "识别": "Reconhecimento", "触发": "Gatilho", "模型": "Modelos", "翻译": "Tradução", "外观": "Aparência", "帮助": "Ajuda", "方案": "Perfil", "当前设置": "Configurações atuais", "新建": "Novo", "改名": "Renomear", "删除": "Excluir", "在线 API": "API online", "本地离线": "Local offline", "输出方式": "Saída", "实时流式": "Tempo real", "说完输出": "Saída final", "松开后输入": "Inserir ao soltar", "边说边输入": "Digitar enquanto fala", "在线接口": "Conexão online", "服务厂商": "Provedor", "转写模型": "Modelo de transcrição", "测试接口": "Testar conexão", "模型目录": "Pasta do modelo", "识别语言": "Idioma de reconhecimento", "自动检测": "Detecção automática", "中文": "Chinês", "英文": "Inglês", "日语": "Japonês", "韩语": "Coreano", "法语": "Francês", "德语": "Alemão", "西班牙语": "Espanhol", "翻译设置": "Configurações de tradução", "说完自动翻译": "Traduzir após falar", "翻译通道": "Provedor de tradução", "目标语言": "Idioma de destino", "翻译模型": "Modelo de tradução", "明暗主题": "Tema", "浅色": "Claro", "深色": "Escuro", "主题颜色": "Cor de destaque", "自定义颜色": "Cor personalizada", "界面语言": "Idioma da interface", "开机启动": "Iniciar com o sistema", "键盘快捷键（可选）": "Atalho de teclado (opcional)", "关闭": "Desativado", "自定义…": "Personalizado…", "尚未设置": "Não definido", "录制快捷键": "Gravar atalho", "填写 Key": "Inserir chave", "去下载模型": "Baixar modelo", "未选模型": "Nenhum modelo selecionado", "确定": "Confirmar", "取消": "Cancelar", "新建方案": "Novo perfil", "为当前识别设置起一个名称。": "Dê um nome a estas configurações de reconhecimento.", "新方案": "Novo perfil", "修改方案名称": "Renomear perfil", "输入方案名称": "Digite um nome de perfil", "删除方案": "Excluir perfil", "方案已创建": "Perfil criado", "方案已重命名": "Perfil renomeado", "方案已删除": "Perfil excluído", "当前设置仍然保留": "As configurações atuais foram mantidas", "已完成": "Concluído", "已取消": "Cancelado", "正在录音": "Gravando", "正在转写": "Transcrevendo", "正在翻译": "Traduzindo", "发生错误": "Erro", "保存失败": "Falha ao salvar", "启动失败": "Falha ao iniciar", "正在下载模型": "Baixando modelo", "模型已就绪": "Modelo pronto", "模型下载失败": "Falha ao baixar o modelo", "已切换模型": "Modelo alterado", "模型已删除": "Modelo excluído", "下载": "Baixar", "重新下载": "Baixar novamente", "设为当前": "Usar este modelo", "已就绪": "Pronto", "不完整": "Incompleto", "未下载": "Não baixado", "使用中": "Em uso"
  }
};

const UI_TEXT_COMMON = {
  fr: { "长按触发": "Maintenir pour d\u00e9clencher", "全部重置": "Tout r\u00e9initialiser", "长按时间": "Dur\u00e9e du maintien", "录音快捷键": "Raccourci d\u2019enregistrement", "0.5 秒": "0,5 s", "1 秒": "1 s", "2 秒": "2 s", "3 秒": "3 s", "系统": "Syst\u00e8me", "耳机": "Casque", "麦克风": "Microphone", "已保存": "Enregistré", "已占用": "Utilisé ", "在线 API · 需要网络和 API Key": "API en ligne · Internet et clé API requis", "本地离线 · 边说边输入": "Hors ligne · Écrire en parlant", "本地离线 · 说完后输入": "Hors ligne · Insérer après avoir parlé" },
  de: { "长按触发": "Halten zum Ausl\u00f6sen", "全部重置": "Alles zur\u00fccksetzen", "长按时间": "Dauer des Haltens", "录音快捷键": "Aufnahme-Tastenk\u00fcrzel", "0.5 秒": "0,5 Sek.", "1 秒": "1 Sek.", "2 秒": "2 Sek.", "3 秒": "3 Sek.", "系统": "System", "耳机": "Kopfh\u00f6rer", "麦克风": "Mikrofon", "已保存": "Gespeichert", "已占用": "Verwendet ", "在线 API · 需要网络和 API Key": "Online-API · Internet und API-Key erforderlich", "本地离线 · 边说边输入": "Lokal offline · Während des Sprechens einfügen", "本地离线 · 说完后输入": "Lokal offline · Nach dem Sprechen einfügen" },
  ja: { "长按触发": "長押しで起動", "全部重置": "すべてリセット", "长按时间": "長押し時間", "录音快捷键": "録音ショートカット", "0.5 秒": "0.5秒", "1 秒": "1秒", "2 秒": "2秒", "3 秒": "3秒", "系统": "システム", "耳机": "ヘッドセット", "麦克风": "マイク", "已保存": "保存済み", "已占用": "使用済み ", "在线 API · 需要网络和 API Key": "オンライン API · インターネットと API キーが必要", "本地离线 · 边说边输入": "ローカル・オフライン · 話しながら入力", "本地离线 · 说完后输入": "ローカル・オフライン · 発話後に入力" },
  es: { "长按触发": "Mantener para activar", "全部重置": "Restablecer todo", "长按时间": "Duraci\u00f3n de pulsaci\u00f3n", "录音快捷键": "Atajo de grabaci\u00f3n", "0.5 秒": "0,5 s", "1 秒": "1 s", "2 秒": "2 s", "3 秒": "3 s", "系统": "Sistema", "耳机": "Auriculares", "麦克风": "Micr\u00f3fono", "已保存": "Guardado", "已占用": "Usado ", "在线 API · 需要网络和 API Key": "API en línea · Se necesita Internet y clave API", "本地离线 · 边说边输入": "Local sin conexión · Escribir mientras hablas", "本地离线 · 说完后输入": "Local sin conexión · Insertar después de hablar" },
  ko: { "长按触发": "길게 눌러 실행", "全部重置": "모두 재설정", "长按时间": "길게 누르는 시간", "录音快捷键": "녹음 단축키", "0.5 秒": "0.5초", "1 秒": "1초", "2 秒": "2초", "3 秒": "3초", "系统": "시스템", "耳机": "헤드셋", "麦克风": "마이크", "已保存": "저장됨", "已占用": "사용됨 ", "在线 API · 需要网络和 API Key": "온라인 API · 인터넷과 API 키 필요", "本地离线 · 边说边输入": "로컬 오프라인 · 말하면서 입력", "本地离线 · 说完后输入": "로컬 오프라인 · 말한 후 입력" },
  pt: { "长按触发": "Manter pressionado para ativar", "全部重置": "Redefinir tudo", "长按时间": "Duração do pressionamento", "录音快捷键": "Atalho de gravação", "0.5 秒": "0,5 s", "1 秒": "1 s", "2 秒": "2 s", "3 秒": "3 s", "系统": "Sistema", "耳机": "Headset", "麦克风": "Microfone", "已保存": "Salvo", "已占用": "Usado ", "在线 API · 需要网络和 API Key": "API online · Internet e chave de API necessários", "本地离线 · 边说边输入": "Local offline · Digitar enquanto fala", "本地离线 · 说完后输入": "Local offline · Inserir após falar" }
};
for (const [locale, entries] of Object.entries(UI_TEXT_COMMON)) Object.assign(UI_TEXTS[locale], entries);

const LOCALE_OPTIONS = [
  ["zh", "中文"],
  ["en", "English"],
  ["fr", "Français"],
  ["de", "Deutsch"],
  ["ja", "日本語"],
  ["es", "Español"],
  ["ko", "한국어"],
  ["pt", "Português"]
];
const SUPPORTED_LOCALES = new Set(LOCALE_OPTIONS.map(([value]) => value));
const storedLocale = localStorage.getItem("md-locale");
let uiLocale = SUPPORTED_LOCALES.has(storedLocale) ? storedLocale : "zh";
const UI_ATTR_TEXT = {
  "在“模型”选项卡中点击下载": "Click Download in the Models tab",
  "开启翻译": "Enable translation",
  "开机启动": "Launch at startup",
  "例如：中文 · 本地离线": "e.g. Chinese · Local offline",
  "显示 Key": "Show API key",
  "隐藏 Key": "Hide API key"
};
const UI_TEXT_ZH = Object.fromEntries(Object.entries(UI_TEXT_EN).map(([zh, en]) => [en, zh]));
const UI_ATTR_TEXT_ZH = Object.fromEntries(Object.entries(UI_ATTR_TEXT).map(([zh, en]) => [en, zh]));

function t(value) {
  const text = String(value ?? "");
  if (uiLocale === "zh") return text;
  const dictionary = UI_TEXTS[uiLocale] || UI_TEXT_EN;
  if (dictionary[text]) return dictionary[text];
  if (UI_TEXT_EN[text]) return UI_TEXT_EN[text];
  const dynamic = {
    en: [
      [/^默认麦克风：(.+) · 按住左键超过设定时间即可开始录音$/, "Default microphone: $1 · Hold the left mouse button to start recording"],
      [/^(.+) 已保存当前设置$/, "$1 saved"], [/^(.+) 已设为当前本地模型$/, "$1 is now the current local model"],
      [/^临时文件已保留，再次点击可继续：(.+)$/, "Temporary files kept; click again to resume: $1"],
      [/^已下载 (.+) MB$/, "$1 MB downloaded"], [/^无法检查麦克风：(.+)$/, "Unable to check microphone: $1"]
    ],
    fr: [[/^默认麦克风：(.+) · 按住左键超过设定时间即可开始录音$/, "Microphone par défaut : $1 · Maintenez le bouton gauche pour enregistrer"], [/^(.+) 已保存当前设置$/, "$1 enregistré"], [/^(.+) 已设为当前本地模型$/, "$1 est maintenant le modèle local"], [/^已下载 (.+) MB$/, "$1 Mo téléchargés"], [/^无法检查麦克风：(.+)$/, "Microphone indisponible : $1"]],
    de: [[/^默认麦克风：(.+) · 按住左键超过设定时间即可开始录音$/, "Standardmikrofon: $1 · Linke Maustaste gedrückt halten, um aufzunehmen"], [/^(.+) 已保存当前设置$/, "$1 gespeichert"], [/^(.+) 已设为当前本地模型$/, "$1 ist jetzt das lokale Modell"], [/^已下载 (.+) MB$/, "$1 MB heruntergeladen"], [/^无法检查麦克风：(.+)$/, "Mikrofonprüfung fehlgeschlagen: $1"]],
    ja: [[/^默认麦克风：(.+) · 按住左键超过设定时间即可开始录音$/, "既定のマイク: $1 · 左ボタンを長押しして録音を開始"], [/^(.+) 已保存当前设置$/, "$1を保存しました"], [/^(.+) 已设为当前本地模型$/, "$1を現在のローカルモデルに設定しました"], [/^已下载 (.+) MB$/, "$1 MBダウンロード済み"], [/^无法检查麦克风：(.+)$/, "マイクを確認できません: $1"]],
    es: [[/^默认麦克风：(.+) · 按住左键超过设定时间即可开始录音$/, "Micrófono predeterminado: $1 · Mantén pulsado el botón izquierdo para grabar"], [/^(.+) 已保存当前设置$/, "$1 guardado"], [/^(.+) 已设为当前本地模型$/, "$1 es ahora el modelo local"], [/^已下载 (.+) MB$/, "$1 MB descargados"], [/^无法检查麦克风：(.+)$/, "No se pudo comprobar el micrófono: $1"]],
    ko: [[/^默认麦克风：(.+) · 按住左键超过设定时间即可开始录音$/, "기본 마이크: $1 · 왼쪽 버튼을 길게 눌러 녹음을 시작하세요"], [/^(.+) 已保存当前设置$/, "$1 저장됨"], [/^(.+) 已设为当前本地模型$/, "$1이 현재 로컬 모델로 설정됨"], [/^已下载 (.+) MB$/, "$1MB 다운로드됨"], [/^无法检查麦克风：(.+)$/, "마이크를 확인할 수 없음: $1"]],
    pt: [[/^默认麦克风：(.+) · 按住左键超过设定时间即可开始录音$/, "Microfone padrão: $1 · Mantenha o botão esquerdo pressionado para gravar"], [/^(.+) 已保存当前设置$/, "$1 salvo"], [/^(.+) 已设为当前本地模型$/, "$1 agora é o modelo local"], [/^已下载 (.+) MB$/, "$1 MB baixados"], [/^无法检查麦克风：(.+)$/, "Não foi possível verificar o microfone: $1"]]
  }[uiLocale] || [];
  let localized = text;
  for (const [pattern, replacement] of dynamic) {
    if (pattern.test(localized)) {
      localized = localized.replace(pattern, replacement);
      break;
    }
  }
  const fragments = Object.entries({ ...UI_TEXT_EN, ...dictionary })
    .filter(([source, target]) => source && target && source !== target)
    .sort(([first], [second]) => second.length - first.length);
  for (const [source, target] of fragments) localized = localized.split(source).join(target);
  return localized;
}

function applyLocale() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    if (node.parentElement?.closest("#ui-language")) continue;
    const trimmed = node.nodeValue.trim();
    if (!trimmed) continue;
    const source = node._mdSource || UI_TEXT_ZH[trimmed] || trimmed;
    node._mdSource = source;
    node.nodeValue = node.nodeValue.replace(trimmed, t(source));
  }
  document.querySelectorAll("[placeholder], [title]").forEach((element) => {
    for (const attr of ["placeholder", "title"]) {
      if (!element.hasAttribute(attr)) continue;
      const current = element.getAttribute(attr);
      const source = element.dataset[`md${attr}Source`] || UI_ATTR_TEXT_ZH[current] || current;
      element.dataset[`md${attr}Source`] = source;
      element.setAttribute(attr, t(source));
    }
  });
  const language = $("ui-language");
  if (language) {
    language.innerHTML = LOCALE_OPTIONS.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
    language.value = uiLocale;
  }
  document.documentElement.lang = uiLocale === "zh" ? "zh-CN" : uiLocale;
}

function setLocale(next) {
  uiLocale = SUPPORTED_LOCALES.has(next) ? next : "zh";
  localStorage.setItem("md-locale", uiLocale);
  applyLocale();
  updateLanguageOptions();
  updateOnlineLanguageOptions();
  updateTranslateUi();
  updateOutputModeUi();
  updateConfigSummary();
  updateHoldDisplay();
  updateHotkeyUi();
  updateEngineHotkeyUi();
  updateTranslateHotkeyUi();
  renderAccentSwatches();
  renderProfiles();
  if (models.length) renderModels();
  setStatus(currentStatus.title, currentStatus.detail, currentStatus.mode);
}


let theme = "dark";
let accentColor = "#8b7cff";
let modelOptions = [];

function hexToRgb(hex) {
  let h = String(hex).replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
function mix(hex, other, weight) {
  const a = hexToRgb(hex), b = hexToRgb(other);
  return rgbToHex(a[0] * (1 - weight) + b[0] * weight, a[1] * (1 - weight) + b[1] * weight, a[2] * (1 - weight) + b[2] * weight);
}
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function rgba(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function applyAccent(hex) {
  const base = hex || "#8b7cff";
  const dark = document.documentElement.dataset.theme !== "light";
  const accent = dark ? base : mix(base, "#000000", 0.18);
  const accent2 = dark ? mix(base, "#ffffff", 0.25) : mix(base, "#000000", 0.05);
  const accentSoft = rgba(dark ? base : mix(base, "#000000", 0.06), dark ? 0.14 : 0.12);
  const ink = luminance(base) > 0.45 ? "#0d0a1a" : "#ffffff";
  const st = document.documentElement.style;
  st.setProperty("--accent", accent);
  st.setProperty("--accent-2", accent2);
  st.setProperty("--accent-soft", accentSoft);
  st.setProperty("--accent-ink", ink);
}
function applyTheme(next) {
  theme = next;
  document.documentElement.dataset.theme = next;
  localStorage.setItem("md-theme", next);
  document.querySelectorAll(".seg[data-theme-mode]").forEach((b) => b.classList.toggle("active", b.dataset.themeMode === next));
  applyAccent(accentColor);
}

const initialTheme = localStorage.getItem("md-theme") || "dark";
document.documentElement.dataset.theme = initialTheme;
const initialAccent = localStorage.getItem("md-accent") || "#8b7cff";
accentColor = initialAccent;
applyAccent(accentColor);

const isOverlay = new URLSearchParams(location.search).has("overlay");

if (isOverlay) {
  document.body.classList.add("overlay-mode");
  document.body.innerHTML = `
  <div class="overlay">
    <div class="overlay-rings">
      <span class="ripple r1"></span>
      <span class="ripple r2"></span>
      <span class="ripple r3"></span>
      <span class="ripple r4"></span>
    </div>
    <div class="overlay-mic">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><path d="M12 18v4"/></svg>
    </div>
    <div id="overlay-label" class="overlay-label">${t("说话中")} · 00:00</div>
  </div>`;
  let overlayTheme = localStorage.getItem("md-theme") || "dark";
  let overlayAccent = localStorage.getItem("md-accent") || "#8b7cff";
  const syncOverlayAppearance = () => {
    const nextTheme = localStorage.getItem("md-theme") || "dark";
    const nextAccent = localStorage.getItem("md-accent") || "#8b7cff";
    if (nextTheme === overlayTheme && nextAccent === overlayAccent) return;
    overlayTheme = nextTheme;
    overlayAccent = nextAccent;
    document.documentElement.dataset.theme = nextTheme;
    applyAccent(nextAccent);
  };
  const formatDuration = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const updateOverlayTimer = async () => {
    syncOverlayAppearance();
    try {
      const elapsed = await invoke("get_recording_elapsed");
      $("overlay-label").textContent = `${t("说话中")} · ${formatDuration(elapsed || 0)}`;
    } catch (_) {
      // The overlay can start before the backend is ready.
    }
  };
  setInterval(updateOverlayTimer, 250);
  updateOverlayTimer();
  window.addEventListener("storage", (e) => {
    if (e.key === "md-theme" || e.key === "md-accent") {
      syncOverlayAppearance();
    }
  });
} else {
  const app = document.querySelector("#app");

  app.innerHTML = `
  <div class="app">
    <section class="hero" id="hero" data-mode="idle">
      <div class="beacon"><span class="beacon-core"></span></div>
      <div>
        <strong id="status-title">正在等待鼠标</strong>
        <p id="status-detail">按住左键超过设定时间即可开始录音</p>
      </div>
    </section>

    <section class="live-preview" id="live-preview" hidden>
      <span>实时预览</span>
      <p id="live-text">正在等待语音…</p>
    </section>

    <section class="feedback-card" id="feedback-card" hidden>
      <div class="feedback-copy">
        <strong>本次识别体验如何？</strong>
        <p id="feedback-message">你的反馈会帮助我改进识别体验。</p>
      </div>
      <button id="feedback-dismiss" class="feedback-close" type="button" title="关闭反馈" aria-label="关闭反馈">×</button>
      <div class="feedback-rating" id="feedback-rating" role="group" aria-label="识别体验评分">
        <button type="button" data-rating="1" aria-label="1 星">★</button>
        <button type="button" data-rating="2" aria-label="2 星">★</button>
        <button type="button" data-rating="3" aria-label="3 星">★</button>
        <button type="button" data-rating="4" aria-label="4 星">★</button>
        <button type="button" data-rating="5" aria-label="5 星">★</button>
      </div>
      <div class="feedback-support" id="feedback-support-row" hidden>
        <span>喜欢这个工具？</span>
        <button id="feedback-support" class="footer-link footer-link-primary" type="button">☕ 支持作者</button>
      </div>
    </section>

    <nav class="tabs" role="tablist">
      <button class="tab active" data-tab="engine" type="button" role="tab">
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><path d="M12 18v4"/></svg><span>识别</span>
      </button>
      <button class="tab" data-tab="trigger" type="button" role="tab">
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="5"/><path d="M12 6v3"/></svg><span>触发</span>
      </button>
      <button class="tab" data-tab="models" type="button" role="tab">
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg><span>模型</span>
      </button>
      <button class="tab" data-tab="translate" type="button" role="tab">
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.66 2.5 15.34 0 18"/><path d="M12 3c-2.5 2.66-2.5 15.34 0 18"/></svg><span>翻译</span>
      </button>
      <button class="tab" data-tab="appearance" type="button" role="tab">
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 0 20 2.5 2.5 0 0 0 2.5-2.5c0-.7-.3-1.3-.7-1.7a2.5 2.5 0 0 1 1.7-4.3H17a5 5 0 0 0 5-5c0-3.5-4.5-6.5-10-6.5z"/><circle cx="7.5" cy="10.5" r="1.5"/><circle cx="12" cy="7.5" r="1.5"/><circle cx="16.5" cy="10.5" r="1.5"/></svg><span>外观</span>
      </button>
    </nav>

    <div class="panes">
      <section class="pane active" id="pane-engine">
        <div class="config-summary" id="config-summary">
          <div class="config-summary-copy">
            <span id="config-summary-main"></span>
            <span id="config-summary-readiness"></span>
          </div>
          <button id="setup-action" class="config-action" type="button" hidden></button>
        </div>

        <div class="profile-row">
          <label for="profile-select">方案</label>
          <select id="profile-select">
            <option value="">当前设置</option>
          </select>
          <button id="profile-new" class="ghost" type="button">新建</button>
          <button id="profile-rename" class="ghost" type="button" disabled>改名</button>
          <button id="profile-delete" class="ghost danger" type="button" disabled>删除</button>
        </div>

        <div class="segmented">
          <button class="seg active" data-engine="online" type="button">付费 API</button>
          <button class="seg" data-engine="local" type="button">本地离线</button>
        </div>

        <p id="engine-note" class="engine-note">付费 API · 需要网络和 API Key</p>
          <div class="compact-setting" id="output-setting">
          <span class="compact-label">输出方式</span>
          <div class="mini-segmented" id="output-mode">
            <button class="mini-seg" data-output="streaming" type="button">实时流式</button>
            <button class="mini-seg active" data-output="final" type="button">说完输出</button>
          </div>
        </div>

        <div class="group" id="online-settings">
           <h3 class="group-title">付费接口</h3>
          <div class="field">
            <label for="provider">服务厂商</label>
            <select id="provider">
              <option value="openai">OpenAI</option>
              <option value="groq">Groq</option>
              <option value="fireworks">Fireworks AI</option>
              <option value="deepinfra">DeepInfra</option>
              <option value="siliconflow">SiliconFlow</option>
              <option value="zhipu">Zhipu AI</option>
              <option value="dashscope">Alibaba Cloud</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div class="field" id="api-url-field">
            <label for="api-url">API Base URL</label>
            <input id="api-url" placeholder="https://api.openai.com/v1" autocomplete="off" />
          </div>
          <div class="field">
            <label for="api-key">API Key</label>
            <div class="secret-control">
              <input id="api-key" type="password" placeholder="sk-..." autocomplete="off" />
              <button id="toggle-api-key" class="icon-button" type="button" title="显示 Key" aria-label="显示 Key">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z"/><circle cx="12" cy="12" r="2.5"/></svg>
              </button>
            </div>
          </div>
          <div class="field">
            <label for="online-language">识别语言</label>
            <select id="online-language"></select>
          </div>
          <div class="field">
            <label for="model">转写模型</label>
            <div class="model-control">
              <select id="model" aria-label="转写模型"></select>
              <input id="model-custom" hidden placeholder="例如 whisper-large-v3-turbo" autocomplete="off" aria-label="自定义转写模型" />
              <button id="toggle-model-input" class="icon-button" type="button" title="手动输入模型" aria-label="手动输入模型">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16.5-.8 3.3 3.3-.8L18.8 6.7a2.2 2.2 0 0 0-3.1-3.1L4 16.5Z"/><path d="m14.6 4.4 5 5"/></svg>
              </button>
              <button id="test-api" class="icon-button" type="button" title="测试连接" aria-label="测试连接">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v4m0 10v4M3 12h4m10 0h4M5.6 5.6l2.8 2.8m7.2 7.2 2.8 2.8m0-12.8-2.8 2.8m-7.2 7.2-2.8 2.8"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <button id="fetch-models" class="icon-button" type="button" title="获取模型" aria-label="获取模型">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"/></svg>
              </button>
            </div>
            <div class="model-filter-row" id="model-filter-row" hidden>
              <input id="model-filter" type="search" placeholder="筛选模型" autocomplete="off" aria-label="筛选模型" />
            </div>
            <div class="field-actions"><span id="api-test-result" class="inline-result" aria-live="polite"></span></div>
          </div>
          <p class="hint">API Key 仅保存在本机。</p>
        </div>

        <div class="group" id="local-settings" hidden>
          <h3 class="group-title">本地离线</h3>
          <div class="field">
            <label for="local-model-dir">模型目录</label>
            <input id="local-model-dir" placeholder="在“模型”选项卡中点击下载" autocomplete="off" />
          </div>
          <div class="field field-gap">
            <label for="local-language">识别语言</label>
            <select id="local-language">
              <option value="auto">自动检测</option>
              <option value="zh">中文</option>
              <option value="en">英文</option>
              <option value="ja">日语</option>
              <option value="ko">韩语</option>
            </select>
          </div>
        </div>
      </section>

      <section class="pane" id="pane-trigger">
        <div class="group">
            <div class="group-title-row">
              <h3 class="group-title">长按触发</h3>
              <button id="reset-hotkeys" class="ghost" type="button">全部重置</button>
            </div>
          <div class="field-head">
            <label for="hold-ms">长按时间</label>
            <output id="hold-val">1000 ms</output>
          </div>
          <input id="hold-ms" type="range" min="300" max="5000" step="100" value="1000" />
          <div class="range-scale"><span>300 ms</span><span>5000 ms</span></div>
          <div class="chips" id="hold-presets">
            <button class="chip" data-ms="500" type="button">0.5 秒</button>
            <button class="chip" data-ms="1000" type="button">1 秒</button>
            <button class="chip" data-ms="2000" type="button">2 秒</button>
            <button class="chip" data-ms="3000" type="button">3 秒</button>
          </div>
          <div class="field field-gap">
            <label for="hotkey">录音快捷键</label>
            <select id="hotkey">
              <option value="disabled">关闭</option>
              <option value="primary-alt-space">Ctrl+Alt+Space / ⌘⌥Space</option>
              <option value="primary-alt-m">Ctrl+Alt+M / ⌘⌥M</option>
              <option value="custom">自定义…</option>
            </select>
          </div>
          <div class="hotkey-custom" id="hotkey-custom" hidden>
            <span id="hotkey-display" class="hotkey-display">尚未设置</span>
            <button id="record-hotkey" class="ghost" type="button">录制</button>
          </div>
          <div class="hotkey-setting field-gap">
            <label>切换识别方式</label>
            <div class="hotkey-setting-row">
              <span id="engine-hotkey-display" class="hotkey-display">Ctrl + Alt + E</span>
              <button id="record-engine-hotkey" class="ghost" type="button">修改</button>
              <button id="reset-engine-hotkey" class="ghost" type="button">重置</button>
            </div>
          </div>
          <div class="hotkey-setting field-gap">
            <label>开关自动翻译</label>
            <div class="hotkey-setting-row">
              <span id="translate-hotkey-display" class="hotkey-display">Ctrl + Alt + T</span>
              <button id="record-translate-hotkey" class="ghost" type="button">修改</button>
              <button id="reset-translate-hotkey" class="ghost" type="button">重置</button>
            </div>
          </div>
          <p class="hint">Esc 取消录音 · 单次最长 5 分钟</p>
        </div>
      </section>

      <section class="pane" id="pane-translate">
        <div class="group translate-group">
          <h3 class="group-title">翻译设置</h3>
          <div class="switch-row">
            <div>
              <b>说完自动翻译</b>
            </div>
            <label class="switch" title="开启翻译">
              <input id="translate-on" type="checkbox" />
              <span class="track"></span>
            </label>
          </div>
          <div id="translate-body" hidden>
            <div class="field field-gap">
              <label for="translate-api">翻译通道</label>
              <select id="translate-api">
                <option value="deepseek">DeepSeek</option>
                <option value="zhipu">Zhipu AI</option>
                <option value="dashscope">Alibaba Cloud</option>
                <option value="siliconflow">SiliconFlow</option>
                <option value="groq">Groq</option>
                <option value="openai">OpenAI</option>
                <option value="ollama">Ollama (Local)</option>
                <option value="follow">跟随识别 API</option>
                <option value="custom">自定义 API</option>
              </select>
            </div>
            <div class="field field-gap" id="translate-url-field">
              <label for="translate-url">API Base URL</label>
              <input id="translate-url" placeholder="https://api.example.com/v1" autocomplete="off" />
            </div>
            <div class="field" id="translate-key-field">
              <label for="translate-key">API Key</label>
              <input id="translate-key" type="password" placeholder="sk-..." autocomplete="off" />
            </div>
            <div class="field" id="translate-target-field">
              <label for="translate-target">目标语言</label>
              <select id="translate-target">
                <option value="en">英文</option>
                <option value="zh">中文</option>
                <option value="ja">日语</option>
                <option value="ko">韩语</option>
                <option value="fr">法语</option>
                <option value="de">德语</option>
                <option value="es">西班牙语</option>
                <option value="ru">俄语</option>
                <option value="pt">葡萄牙语</option>
                <option value="it">意大利语</option>
                <option value="nl">荷兰语</option>
                <option value="pl">波兰语</option>
                <option value="tr">土耳其语</option>
                <option value="ar">阿拉伯语</option>
                <option value="hi">印地语</option>
                <option value="id">印尼语</option>
                <option value="th">泰语</option>
                <option value="vi">越南语</option>
                <option value="uk">乌克兰语</option>
                <option value="fa">波斯语</option>
                <option value="he">希伯来语</option>
                <option value="sv">瑞典语</option>
                <option value="da">丹麦语</option>
                <option value="fi">芬兰语</option>
                <option value="no">挪威语</option>
              </select>
            </div>
            <div class="field" id="translate-model-field">
              <label for="translate-model">翻译模型</label>
              <div class="model-control translation-model-control">
                <select id="translate-model-select" aria-label="翻译模型"></select>
                <input id="translate-model" hidden placeholder="例如 llama-3.3-70b-versatile" autocomplete="off" aria-label="自定义翻译模型" />
                <button id="toggle-translate-model" class="icon-button" type="button" title="手动输入模型" aria-label="手动输入模型">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16.5-.8 3.3 3.3-.8L18.8 6.7a2.2 2.2 0 0 0-3.1-3.1L4 16.5Z"/><path d="m14.6 4.4 5 5"/></svg>
                </button>
                <button id="test-translate" class="icon-button" type="button" title="测试翻译接口" aria-label="测试翻译接口">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v4m0 10v4M3 12h4m10 0h4M5.6 5.6l2.8 2.8m7.2 7.2 2.8 2.8m0-12.8-2.8 2.8m-7.2 7.2-2.8 2.8"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <button id="fetch-translate-models" class="icon-button" type="button" title="获取翻译模型" aria-label="获取翻译模型">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"/></svg>
                </button>
              </div>
              <div class="field-actions"><span id="translate-test-result" class="inline-result" aria-live="polite"></span></div>
            </div>
            <p class="hint" id="translate-note"></p>
          </div>
        </div>
        <p class="hint" id="translate-off-tip" hidden></p>
      </section>

      <section class="pane" id="pane-models">
        <div id="model-cards" class="model-cards">
          <div class="model-card skeleton-card"><div class="model-card-top"><div class="sk sk-title"></div><div class="sk sk-badge"></div></div><div class="sk sk-line"></div><div class="model-card-foot"><div class="sk sk-meta"></div></div></div>
          <div class="model-card skeleton-card"><div class="model-card-top"><div class="sk sk-title"></div><div class="sk sk-badge"></div></div><div class="sk sk-line"></div><div class="model-card-foot"><div class="sk sk-meta"></div></div></div>
          <div class="model-card skeleton-card"><div class="model-card-top"><div class="sk sk-title"></div><div class="sk sk-badge"></div></div><div class="sk sk-line"></div><div class="model-card-foot"><div class="sk sk-meta"></div></div></div>
        </div>
      </section>

      <section class="pane" id="pane-appearance">
        <div class="group">
          <h3 class="group-title">界面语言</h3>
          <div class="field">
            <select id="ui-language" aria-label="界面语言"></select>
          </div>
        </div>
        <div class="group">
          <h3 class="group-title">明暗主题</h3>
          <div class="segmented" id="theme-mode">
            <button class="seg" data-theme-mode="light" type="button">浅色</button>
            <button class="seg active" data-theme-mode="dark" type="button">深色</button>
          </div>
        </div>
        <div class="group">
          <h3 class="group-title">主题颜色</h3>
          <div class="swatches" id="accent-swatches"></div>
          <div class="custom-color">
            <div class="color-row">
              <label for="accent-custom">自定义颜色</label>
              <input id="accent-custom" type="color" value="#8b7cff" />
              <span id="accent-value" class="accent-value">#8b7cff</span>
            </div>
          </div>
        </div>
        <div class="group">
          <h3 class="group-title">系统</h3>
          <div class="switch-row">
            <div>
              <b>开机启动</b>
            </div>
            <label class="switch" title="开机启动">
              <input id="start-on-login" type="checkbox" />
              <span class="track"></span>
            </label>
          </div>
        </div>
      </section>
    </div>

    <footer class="footer">
      <span id="saved" class="saved">已保存</span>
      <div class="footer-links">
        <span class="footer-support-label">☕ 支持作者</span>
        <button id="support-kofi" class="footer-link footer-link-primary" type="button">Ko-fi</button>
        <button id="support-store" class="footer-link" type="button">Lemon Squeezy</button>
      </div>
    </footer>

    <div id="dialog-root" class="dialog-root" hidden>
      <div class="dialog-backdrop" data-dialog-cancel></div>
      <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <h2 id="dialog-title"></h2>
        <p id="dialog-message"></p>
        <input id="dialog-input" type="text" autocomplete="off" />
        <div class="dialog-actions">
          <button id="dialog-cancel" class="ghost" type="button">取消</button>
          <button id="dialog-confirm" class="ghost primary-ghost" type="button">确定</button>
        </div>
      </section>
    </div>
  </div>
`;

  applyLocale();

let engine = "online";
let localMode = "offline";
let outputMode = "final";
let hotkeyValue = "disabled";
let engineHotkeyValue = "primary-alt-e";
let translateHotkeyValue = "primary-alt-t";
let recordingHotkey = false;
let recordingEngineHotkey = false;
let recordingTranslateHotkey = false;
let models = [];
let downloadingMode = null;
let audioStatus = null;
let profiles = [];
let dialogResolve = null;
let currentStatus = { title: "正在等待鼠标", detail: "按住左键超过设定时间即可开始录音", mode: "idle" };

const ACCENTS = [
  { id: "violet", name: "紫罗兰", color: "#8b7cff" },
  { id: "blue", name: "蓝", color: "#4d8df0" },
  { id: "cyan", name: "青", color: "#22c2e0" },
  { id: "green", name: "绿", color: "#2fc98a" },
  { id: "rose", name: "玫红", color: "#f06a9b" },
  { id: "amber", name: "琥珀", color: "#f5a524" }
];

const PROVIDERS = {
  openai: { url: "https://api.openai.com/v1", model: "whisper-1", tmodel: "gpt-4o-mini" },
  groq: { url: "https://api.groq.com/openai/v1", model: "whisper-large-v3-turbo", tmodel: "openai/gpt-oss-120b" },
  fireworks: { url: "https://fireworks.ai/api/v1", model: "accounts/fireworks/models/whisper-v3", tmodel: "accounts/fireworks/models/llama-v3p1-8b-instruct" },
  deepinfra: { url: "https://api.deepinfra.com/v1/openai", model: "openai/whisper-large-v3", tmodel: "meta-llama/Llama-3.3-70B-Instruct" },
  siliconflow: { url: "https://api.siliconflow.cn/v1", model: "FunAudioLLM/SenseVoiceSmall", tmodel: "Qwen/Qwen2.5-7B-Instruct" },
  zhipu: { url: "https://open.bigmodel.cn/api/paas/v4", model: "glm-asr", tmodel: "glm-4-flash" },
  dashscope: { url: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen3-asr-flash", tmodel: "qwen-turbo" }
};

const SUPPORT_LINKS = {
  kofi: "https://ko-fi.com/kevinlabs",
  store: "https://kevinlabs.lemonsqueezy.com/checkout/buy/7b60b363-50b5-4233-a982-91a0611eccd6"
};

const MODEL_CATALOG = [
  {
    dirName: "sensevoice-zh",
    mode: "offline",
    title: "SenseVoice（离线）",
    desc: "中 / 英 / 日 / 韩 / 粤语 · 松开一次成句，准确率高"
  },
  {
    dirName: "whisper-small",
    mode: "whisper",
    title: "Whisper Small",
    desc: "99 种语言 · 约 490 MB · CPU 推理较慢，适合小语种"
  },
  {
    dirName: "streaming-zipformer-zh-en",
    mode: "streaming",
    title: "Zipformer（流式）",
    desc: "中 / 英 · 边说边出字，延迟低"
  }
];

const MODE_LABEL = {
  streaming: "流式识别",
  whisper: "多语言整句",
  offline: "离线整句"
};

const LANG_OPTIONS = {
  base: [
    ["auto", "自动检测"],
    ["zh", "中文"],
    ["en", "英文"],
    ["ja", "日语"],
    ["ko", "韩语"],
    ["yue", "粤语"]
  ],
  stream: [
    ["auto", "自动检测"],
    ["zh", "中文"],
    ["en", "英文"]
  ],
  whisper: [
    ["auto", "自动检测（共 99 种语言）"],
    ["zh", "中文"],
    ["en", "英文"],
    ["ja", "日语"],
    ["ko", "韩语"],
    ["yue", "粤语"],
    ["de", "德语"],
    ["fr", "法语"],
    ["es", "西班牙语"],
    ["ru", "俄语"],
    ["pt", "葡萄牙语"],
    ["it", "意大利语"],
    ["nl", "荷兰语"],
    ["pl", "波兰语"],
    ["tr", "土耳其语"],
    ["ar", "阿拉伯语"],
    ["hi", "印地语"],
    ["id", "印尼语"],
    ["ms", "马来语"],
    ["th", "泰语"],
    ["vi", "越南语"],
    ["uk", "乌克兰语"],
    ["fa", "波斯语"],
    ["he", "希伯来语"],
    ["el", "希腊语"],
    ["sv", "瑞典语"],
    ["da", "丹麦语"],
    ["fi", "芬兰语"],
    ["hu", "匈牙利语"],
    ["ro", "罗马尼亚语"],
    ["cs", "捷克语"],
    ["bg", "保加利亚语"],
    ["ca", "加泰罗尼亚语"],
    ["bn", "孟加拉语"],
    ["ta", "泰米尔语"],
    ["no", "挪威语"]
  ]
};

function updateLanguageOptions() {
  const sel = $("local-language");
  const current = sel.value || "auto";
  const list = localMode === "whisper" ? LANG_OPTIONS.whisper : localMode === "streaming" ? LANG_OPTIONS.stream : LANG_OPTIONS.base;
  sel.innerHTML = list.map(([v, l]) => `<option value="${v}">${t(l)}</option>`).join("");
  sel.value = list.some(([v]) => v === current) ? current : "auto";
}

function updateOnlineLanguageOptions() {
  const sel = $("online-language");
  if (!sel) return;
  const current = sel.value || "auto";
  const list = LANG_OPTIONS.whisper.filter(([value]) => value !== "yue");
  sel.innerHTML = list.map(([value, label]) => `<option value="${value}">${t(label)}</option>`).join("");
  sel.value = list.some(([value]) => value === current) ? current : "auto";
}

function modelCacheKey(url = $("api-url")?.value) {
  const normalized = String(url || "").trim().replace(/\/+$/, "");
  return normalized ? `md-models:${normalized}` : "";
}

function cachedModelOptions(url = $("api-url")?.value) {
  const key = modelCacheKey(url);
  if (!key) return [];
  try {
    const values = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(values) ? values.filter((value) => typeof value === "string" && value.trim()) : [];
  } catch (_) {
    return [];
  }
}

function setModelOptions(ids = [], selected = "", url = $("api-url")?.value) {
  const select = $("model");
  if (!select) return;
  const current = selected || modelValue();
  const fetched = [...new Set(ids.filter(Boolean))];
  if (fetched.length) {
    const key = modelCacheKey(url);
    if (key) localStorage.setItem(key, JSON.stringify(fetched));
  }
  modelOptions = [...new Set([current, ...fetched, ...cachedModelOptions(url)].filter(Boolean))];
  const filterRow = $("model-filter-row");
  const filter = $("model-filter");
  if (filterRow) filterRow.hidden = modelOptions.length <= 8;
  if (filter && modelOptions.length <= 8) filter.value = "";
  const query = filter?.value.trim().toLowerCase() || "";
  const visible = modelOptions.filter((value) => !query || value.toLowerCase().includes(query));
  const values = [...new Set([current, ...visible].filter(Boolean))];
  select.replaceChildren(...values.map((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    return option;
  }));
  select.value = current || values[0] || "";
}

function modelValue() {
  const custom = $("model-custom");
  return (custom.hidden ? $("model").value : custom.value).trim();
}

function setManualModelMode(manual) {
  const select = $("model");
  const input = $("model-custom");
  if (manual) input.value = select.value;
  else setModelOptions([], input.value || select.value);
  select.hidden = manual;
  input.hidden = !manual;
  $("toggle-model-input").title = manual ? "选择模型" : "手动输入模型";
  $("toggle-model-input").setAttribute("aria-label", manual ? "选择模型" : "手动输入模型");
}

function matchProvider(url) {
  const normalized = url.trim().replace(/\/+$/, "");
  const found = Object.entries(PROVIDERS).find(([, p]) => p.url === normalized);
  return found ? found[0] : "custom";
}

function updateProviderUi() {
  $("api-url-field").hidden = !$("provider").value || $("provider").value !== "custom";
}

const TRANSLATE_NOTES = {
  follow: "翻译使用识别 API；模型失效时自动选择可用文本模型。",
  ollama: "使用本机 Ollama，无需 API Key。",
  custom: "使用 OpenAI 兼容接口，需要 API Key。"
};

const TRANSLATE_PROVIDERS = {
  deepseek: { url: "https://api.deepseek.com", model: "deepseek-chat" },
  zhipu: { url: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash" },
  dashscope: { url: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-turbo" },
  siliconflow: { url: "https://api.siliconflow.cn/v1", model: "Qwen/Qwen2.5-7B-Instruct" },
  groq: { url: "https://api.groq.com/openai/v1", model: "openai/gpt-oss-120b" },
  openai: { url: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  ollama: { url: "http://127.0.0.1:11434/v1", model: "" }
};

function applyTranslateChannel() {
  if (["auto", "follow"].includes($("translate-api").value)) {
    const provider = PROVIDERS[matchProvider($("api-url").value)];
    if (provider?.tmodel) setTranslationModelOptions([], provider.tmodel);
    return;
  }
  const p = TRANSLATE_PROVIDERS[$("translate-api").value];
  if (!p) return;
  $("translate-url").value = p.url;
  setTranslationModelOptions([], p.model);
}

function matchTranslateChannel(settings) {
  if (["auto", "google"].includes(settings.translate_api)) return "follow";
  if (settings.translate_api !== "custom") return settings.translate_api || "follow";
  const url = (settings.translate_url || "").replace(/\/+$/, "");
  const found = Object.entries(TRANSLATE_PROVIDERS).find(([, p]) => p.url === url);
  return found ? found[0] : "custom";
}

function updateTranslateUi() {
  const unsupported = engine === "local" && localMode === "streaming";
  const toggle = $("translate-on");
  toggle.disabled = unsupported;
  if (unsupported) toggle.checked = false;
  const on = toggle.checked;
  $("translate-body").hidden = !on || unsupported;
  $("translate-off-tip").hidden = !unsupported;
  if (unsupported) $("translate-off-tip").textContent = t("流式模式不支持翻译。");
  if (!on || unsupported) return;
  const channel = $("translate-api").value;
  $("translate-url-field").hidden = channel !== "custom";
  $("translate-key-field").hidden = channel === "follow";
  $("translate-model-field").hidden = false;
  $("translate-note").textContent = t(TRANSLATE_NOTES[channel] || TRANSLATE_NOTES.custom);
}

function applyProvider(id) {
  const p = PROVIDERS[id];
  if (!p) return;
  setManualModelMode(false);
  $("api-url").value = p.url;
  setModelOptions([], p.model);
  if (p.tmodel && (!translationModelValue() || $("translate-api").value === "follow")) {
    setTranslationModelOptions([], p.tmodel);
  }
}

function setStatus(title, detail, mode = "idle") {
  currentStatus = { title, detail, mode };
  $("status-title").textContent = t(title);
  $("status-detail").textContent = t(detail);
  $("hero").dataset.mode = mode;
}

function updateOutputModeUi() {
  const canStream = engine === "local" && localMode === "streaming";
  if (!canStream) outputMode = "final";
  $("output-setting").hidden = engine === "online";
  document.querySelectorAll(".mini-seg").forEach((button) => {
    button.disabled = button.dataset.output === "streaming" && !canStream;
    button.classList.toggle("active", button.dataset.output === outputMode);
  });
  updateTranslateUi();
  $("engine-note").textContent = engine === "online"
    ? t("付费 API · 需要网络和 API Key")
    : localMode === "streaming"
      ? t("本地离线 · 边说边输入")
      : t("本地离线 · 说完后输入");
  updateConfigSummary();
}

function setEngine(next) {
  engine = next;
  document.querySelectorAll(".seg[data-engine]").forEach((b) => b.classList.toggle("active", b.dataset.engine === next));
  $("online-settings").hidden = next !== "online";
  $("local-settings").hidden = next !== "local";
  updateOutputModeUi();
}

function updateConfigSummary() {
  const parts = [];
  if (engine === "online") {
    parts.push(t("付费 API"));
    parts.push(modelValue() || t("未选模型"));
  } else {
    const dir = dirBase($("local-model-dir").value.trim());
    parts.push(t("本地"));
    parts.push(dir || t("未选模型"));
  }
  parts.push(outputMode === "streaming" ? t("边说边输入") : t("说完输出"));
  $("config-summary-main").textContent = parts.join(" · ");
  const action = $("setup-action");
  const readiness = $("config-summary-readiness");
  if (engine === "online" && !$("api-key").value.trim()) {
    readiness.textContent = ` · ${t("未配置 API Key")}`;
    action.hidden = false;
    action.dataset.action = "api-key";
    action.textContent = t("填写 Key");
  } else if (engine === "online" && !modelValue()) {
    readiness.textContent = ` · ${t("未选模型")}`;
    action.hidden = false;
    action.dataset.action = "model";
    action.textContent = t("填写模型");
  } else if (engine === "local" && !currentModelReady()) {
    readiness.textContent = ` · ${t("需要下载模型")}`;
    action.hidden = false;
    action.dataset.action = "model";
    action.textContent = t("去下载模型");
  } else {
    readiness.textContent = "";
    action.hidden = true;
    action.dataset.action = "";
    action.textContent = "";
  }
}

function currentModelReady() {
  const currentDir = $("local-model-dir").value.trim().replace(/[\\/]+$/, "").toLowerCase();
  return !!currentDir && models.some((model) => {
    const modelDir = model.dir.replace(/[\\/]+$/, "").toLowerCase();
    return model.ready && model.mode === localMode && modelDir === currentDir;
  });
}

function renderProfiles() {
  const select = $("profile-select");
  const active = profiles.find((profile) => profile.active);
  select.innerHTML = `<option value="">${t("当前设置")}</option>${profiles
    .map((profile) => `<option value="${profile.id}">${profile.name}</option>`)
    .join("")}`;
  select.value = active?.id || "";
  $("profile-rename").disabled = !select.value;
  $("profile-delete").disabled = !select.value;
}

async function refreshProfiles() {
  profiles = await invoke("get_profiles");
  renderProfiles();
}

function closeDialog(result = null) {
  const root = $("dialog-root");
  if (!dialogResolve) return;
  root.hidden = true;
  const resolve = dialogResolve;
  dialogResolve = null;
  resolve(result);
}

function showDialog({ title, message, value = "", placeholder = "", input = false, confirmText = "确定", danger = false }) {
  return new Promise((resolve) => {
    const root = $("dialog-root");
    const field = $("dialog-input");
    const confirm = $("dialog-confirm");
    dialogResolve = resolve;
    $("dialog-title").textContent = t(title);
    $("dialog-message").textContent = t(message);
    confirm.textContent = t(confirmText);
    confirm.classList.toggle("danger", danger);
    field.hidden = !input;
    field.value = value;
    field.placeholder = t(placeholder);
    confirm.disabled = input && !value.trim();
    root.hidden = false;
    requestAnimationFrame(() => (input ? field : confirm).focus());
  });
}

async function createProfile() {
  const name = await showDialog({
    title: "新建方案",
    message: "为当前识别设置起一个名称。",
    value: t("新方案"),
    placeholder: "例如：中文 · 本地离线",
    input: true
  });
  if (!name?.trim()) return;
  await invoke("create_profile", { name: name.trim() });
  await refreshProfiles();
  setStatus("方案已创建", uiLocale === "en" ? `${name.trim()} saved` : `${name.trim()} 已保存当前设置`, "done");
}

async function renameProfile() {
  const id = $("profile-select").value;
  const profile = profiles.find((item) => item.id === id);
  if (!profile) return;
  const name = await showDialog({
    title: "修改方案名称",
    message: "名称只用于快速识别这个方案。",
    value: profile.name,
    placeholder: "输入方案名称",
    input: true
  });
  if (!name?.trim()) return;
  await invoke("rename_profile", { id, name: name.trim() });
  await refreshProfiles();
  setStatus("方案已重命名", name.trim(), "done");
}

async function deleteProfile() {
  const id = $("profile-select").value;
  const profile = profiles.find((item) => item.id === id);
  if (!profile) return;
  const confirmed = await showDialog({
    title: "删除方案",
    message: uiLocale === "en"
      ? `Delete “${profile.name}”? ${t("此操作不可撤销。")}`
      : `确定删除“${profile.name}”吗？此操作不可撤销。`,
    confirmText: "删除",
    danger: true
  });
  if (!confirmed) return;
  await invoke("delete_profile", { id });
  await refreshProfiles();
  setStatus("方案已删除", "当前设置仍然保留", "idle");
}

async function applySelectedProfile() {
  const id = $("profile-select").value;
  if (!id) return;
  await invoke("apply_profile", { id });
  await refreshProfiles();
}

function renderAccentSwatches() {
  $("accent-swatches").innerHTML = ACCENTS.map((a) =>
    `<button class="swatch" data-color="${a.color}" type="button" title="${t(a.name)}" style="--swatch: ${a.color}"></button>`
  ).join("");
}

function updateAccentUi() {
  const custom = $("accent-custom");
  const value = $("accent-value");
  if (custom) custom.value = accentColor;
  if (value) value.textContent = accentColor;
  document.querySelectorAll("#accent-swatches .swatch").forEach((s) => {
    s.classList.toggle("active", s.dataset.color.toLowerCase() === accentColor.toLowerCase());
  });
}

function setAccent(hex) {
  accentColor = hex;
  applyAccent(hex);
  localStorage.setItem("md-accent", hex);
  updateAccentUi();
  scheduleSave();
}

function openSupportLink(url) {
  invoke("open_external_url", { url }).catch((error) => {
    setStatus("打开链接失败", String(error), "error");
  });
}

const FEEDBACK_MIN_USES = 3;
const FEEDBACK_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

function hideFeedbackCard(markSeen = true) {
  $("feedback-card").hidden = true;
  if (markSeen) localStorage.setItem("md-feedback-last-shown", String(Date.now()));
}

function maybeShowFeedback() {
  const uses = Number(localStorage.getItem("md-feedback-successes") || 0) + 1;
  localStorage.setItem("md-feedback-successes", String(uses));
  const lastShown = Number(localStorage.getItem("md-feedback-last-shown") || 0);
  if (uses < FEEDBACK_MIN_USES || Date.now() - lastShown < FEEDBACK_COOLDOWN_MS) return;
  $("feedback-card").hidden = false;
  $("feedback-support-row").hidden = true;
  $("feedback-message").textContent = t("你的反馈会帮助我改进识别体验。");
  document.querySelectorAll("#feedback-rating button").forEach((button) => button.classList.remove("selected"));
}

function submitFeedbackRating(rating) {
  localStorage.setItem("md-feedback-rating", String(rating));
  document.querySelectorAll("#feedback-rating button").forEach((button) => {
    button.classList.toggle("selected", Number(button.dataset.rating) <= rating);
  });
  $("feedback-message").textContent = t("感谢反馈");
  $("feedback-support-row").hidden = rating < 4;
  localStorage.setItem("md-feedback-last-shown", String(Date.now()));
}

function updateHoldDisplay() {
  const ms = Number($("hold-ms").value);
  $("hold-val").textContent = `${ms} ms`;
  const pct = ((ms - 300) / (5000 - 300)) * 100;
  $("hold-ms").style.setProperty("--fill", `${pct}%`);
  document.querySelectorAll("#hold-presets .chip").forEach((c) => c.classList.toggle("active", Number(c.dataset.ms) === ms));
}

function hotkeyLabel(value) {
  const presets = {
    "primary-alt-e": "Ctrl + Alt + E",
    "primary-alt-m": "Ctrl + Alt + M",
    "primary-alt-q": "Ctrl + Alt + Q",
    "primary-alt-space": "Ctrl + Alt + Space",
    "primary-alt-t": "Ctrl + Alt + T",
    "primary-alt-x": "Ctrl + Alt + X"
  };
  if (!value?.startsWith("custom:")) return value === "disabled" ? "尚未设置" : presets[value] || "已使用预设快捷键";
  const parts = value.slice(7).split("+");
  const key = parts.pop() || "";
  const names = { ctrl: "Ctrl", alt: "Alt", shift: "Shift", meta: "⌘" };
  const keyNames = { Space: "Space", Enter: "Enter", Escape: "Esc", KeyK: "K", KeyM: "M" };
  const label = keyNames[key] || key.replace(/^Key/, "").replace(/^Digit/, "");
  return [...parts.map((part) => names[part] || part), label].join(" + ");
}

function updateHotkeyUi() {
  const custom = $("hotkey").value === "custom";
  $("hotkey-custom").hidden = !custom;
  $("hotkey-display").textContent = hotkeyLabel(hotkeyValue);
  $("record-hotkey").textContent = recordingHotkey ? t("请按组合键…") : t("录制");
  $("record-hotkey").classList.toggle("primary-ghost", recordingHotkey);
}

function updateEngineHotkeyUi() {
  $("engine-hotkey-display").textContent = hotkeyLabel(engineHotkeyValue);
  $("record-engine-hotkey").textContent = recordingEngineHotkey ? t("请按组合键…") : t("修改");
  $("record-engine-hotkey").classList.toggle("primary-ghost", recordingEngineHotkey);
}

function updateTranslateHotkeyUi() {
  $("translate-hotkey-display").textContent = hotkeyLabel(translateHotkeyValue);
  $("record-translate-hotkey").textContent = recordingTranslateHotkey ? t("请按组合键…") : t("修改");
  $("record-translate-hotkey").classList.toggle("primary-ghost", recordingTranslateHotkey);
}

function hotkeysConflict(first, second) {
  const aliases = {
    "primary-alt-e": "custom:ctrl+alt+KeyE",
    "primary-alt-m": "custom:ctrl+alt+KeyM",
    "primary-alt-q": "custom:ctrl+alt+KeyQ",
    "primary-alt-space": "custom:ctrl+alt+Space",
    "primary-alt-t": "custom:ctrl+alt+KeyT",
    "primary-alt-x": "custom:ctrl+alt+KeyX"
  };
  const firstKey = aliases[first] || first;
  const secondKey = aliases[second] || second;
  return firstKey !== "disabled" && secondKey !== "disabled" && firstKey === secondKey;
}

function recordingShortcut() {
  return $("hotkey").value === "custom" ? hotkeyValue : $("hotkey").value;
}

function stopHotkeyCapture() {
  recordingHotkey = false;
  recordingEngineHotkey = false;
  recordingTranslateHotkey = false;
  updateHotkeyUi();
  updateEngineHotkeyUi();
  updateTranslateHotkeyUi();
}

function captureHotkey(event) {
  if ((!recordingHotkey && !recordingEngineHotkey && !recordingTranslateHotkey) || event.repeat) return;
  if (event.key === "Escape") {
    event.preventDefault();
    stopHotkeyCapture();
    return;
  }
  const modifier = event.key === "Control" || event.key === "Alt" || event.key === "Shift" || event.key === "Meta";
  if (modifier) {
    event.preventDefault();
    return;
  }
  const modifiers = [];
  if (event.ctrlKey) modifiers.push("ctrl");
  if (event.altKey) modifiers.push("alt");
  if (event.shiftKey) modifiers.push("shift");
  if (event.metaKey) modifiers.push("meta");
  if (!modifiers.length || !event.code) return;
  event.preventDefault();
  const next = `custom:${[...modifiers, event.code].join("+")}`;
  if (recordingEngineHotkey) {
    if (hotkeysConflict(next, recordingShortcut()) || hotkeysConflict(next, translateHotkeyValue)) {
      stopHotkeyCapture();
      setStatus("快捷键冲突", "请使用不同的组合键。", "error");
      return;
    }
    engineHotkeyValue = next;
  } else if (recordingTranslateHotkey) {
    if (hotkeysConflict(next, recordingShortcut()) || hotkeysConflict(next, engineHotkeyValue)) {
      stopHotkeyCapture();
      setStatus("快捷键冲突", "请使用不同的组合键。", "error");
      return;
    }
    translateHotkeyValue = next;
  } else {
    if (hotkeysConflict(next, engineHotkeyValue) || hotkeysConflict(next, translateHotkeyValue)) {
      stopHotkeyCapture();
      setStatus("快捷键冲突", "请使用不同的组合键。", "error");
      return;
    }
    hotkeyValue = next;
    $("hotkey").value = "custom";
  }
  stopHotkeyCapture();
  scheduleSave();
}

async function saveSettings() {
  const settings = {
    engine,
    api_url: $("api-url").value.trim(),
    api_key: $("api-key").value.trim(),
    online_language: $("online-language").value,
    model: modelValue() || "whisper-1",
    hold_ms: Math.max(300, Math.min(5000, Number($("hold-ms").value) || 1000)),
    local_model_dir: $("local-model-dir").value.trim(),
    local_language: $("local-language").value,
    local_mode: localMode,
    output_mode: outputMode,
    hotkey: $("hotkey").value === "custom" ? (hotkeyValue.startsWith("custom:") ? hotkeyValue : "disabled") : $("hotkey").value,
    engine_hotkey: engineHotkeyValue,
    translate_hotkey: translateHotkeyValue,
    start_on_login: $("start-on-login").checked,
    translate_on: $("translate-on").checked,
    translate_target: $("translate-target").value,
    translate_model: translationModelValue(),
    translate_api: $("translate-api").value,
    translate_url: $("translate-url").value.trim(),
    translate_key: $("translate-key").value.trim(),
    theme,
    accent: accentColor
  };
  await invoke("save_settings", { settings });
  $("saved").classList.add("show");
  setTimeout(() => $("saved").classList.remove("show"), 1800);
}

async function testApi() {
  const button = $("test-api");
  const result = $("api-test-result");
  button.disabled = true;
  result.className = "inline-result pending";
  result.textContent = t("测试连接中…");
  try {
    const message = await invoke("test_api", {
      settings: {
        api_url: $("api-url").value.trim(),
        api_key: $("api-key").value.trim(),
        model: modelValue() || "whisper-1"
      }
    });
    result.className = "inline-result success";
    result.textContent = message;
  } catch (error) {
    result.className = "inline-result error";
    result.textContent = String(error);
  } finally {
    button.disabled = false;
  }
}

async function fetchApiModels() {
  const button = $("fetch-models");
  const result = $("api-test-result");
  button.disabled = true;
  result.className = "inline-result pending";
  result.textContent = t("获取中…");
  try {
    const settings = {
      api_url: $("api-url").value.trim(),
      api_key: $("api-key").value.trim()
    };
    let modelIds = await invoke("list_api_models", {
      settings,
      includeAll: false
    });
    const filtered = modelIds.length > 0;
    if (!filtered) {
      modelIds = await invoke("list_api_models", { settings, includeAll: true });
    }
    setModelOptions(modelIds);
    result.className = "inline-result success";
    result.textContent = filtered
      ? `已找到 ${modelIds.length} 个语音转文字模型`
      : modelIds.length
        ? `未识别出语音模型，已显示全部 ${modelIds.length} 个模型`
        : "未找到模型，可手动输入模型名";
  } catch (error) {
    result.className = "inline-result error";
    result.textContent = String(error);
  } finally {
    button.disabled = false;
  }
}

function translationSettingsPayload() {
  return {
    api_url: $("api-url").value.trim(),
    api_key: $("api-key").value.trim(),
    translate_api: $("translate-api").value,
    translate_target: $("translate-target").value,
    translate_model: translationModelValue(),
    translate_url: $("translate-url").value.trim(),
    translate_key: $("translate-key").value.trim()
  };
}

function translationModelValue() {
  const input = $("translate-model");
  return (input.hidden ? $("translate-model-select").value : input.value).trim();
}

function setTranslationModelOptions(modelIds = [], selected = "") {
  const select = $("translate-model-select");
  const input = $("translate-model");
  const current = selected || translationModelValue();
  const values = [...new Set([current, ...modelIds].filter(Boolean))];
  select.replaceChildren(...values.map((id) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = id;
    return option;
  }));
  select.value = current || values[0] || "";
  if (current && !values.includes(current)) input.value = current;
}

function setManualTranslationModelMode(manual) {
  const select = $("translate-model-select");
  const input = $("translate-model");
  if (manual) input.value = select.value;
  else setTranslationModelOptions([], input.value || select.value);
  select.hidden = manual;
  input.hidden = !manual;
  $("toggle-translate-model").title = manual ? "选择模型" : "手动输入模型";
  $("toggle-translate-model").setAttribute("aria-label", manual ? "选择模型" : "手动输入模型");
}

async function testTranslationApi() {
  const button = $("test-translate");
  const result = $("translate-test-result");
  button.disabled = true;
  result.className = "inline-result pending";
  result.textContent = t("翻译测试中…");
  try {
    const message = await invoke("test_translation_api", {
      settings: translationSettingsPayload()
    });
    result.className = "inline-result success";
    result.textContent = message;
  } catch (error) {
    result.className = "inline-result error";
    result.textContent = String(error);
  } finally {
    button.disabled = false;
  }
}

async function fetchTranslationModels() {
  const button = $("fetch-translate-models");
  const result = $("translate-test-result");
  button.disabled = true;
  result.className = "inline-result pending";
  result.textContent = t("获取翻译模型中…");
  try {
    const modelIds = await invoke("list_translation_models", {
      settings: translationSettingsPayload()
    });
    setTranslationModelOptions(modelIds);
    if (modelIds.length && !modelIds.includes(translationModelValue())) {
      setTranslationModelOptions(modelIds, modelIds[0]);
      scheduleSave();
    } else {
      setTranslationModelOptions(modelIds, translationModelValue());
    }
    result.className = "inline-result success";
    result.textContent = modelIds.length
      ? `已找到 ${modelIds.length} 个翻译模型`
      : "未找到可用文本模型";
  } catch (error) {
    result.className = "inline-result error";
    result.textContent = String(error);
  } finally {
    button.disabled = false;
  }
}

let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveSettings().catch((error) => setStatus("保存失败", String(error), "error"));
  }, 400);
}

function dirBase(dir) {
  return dir.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || dir;
}

function fmtSize(bytes) {
  if (!bytes) return "0 MB";
  const mb = bytes / 1048576;
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${Math.max(1, Math.round(mb))} MB`;
}

function modelStatus(m) {
  const savedDir = $("local-model-dir").value.trim().replace(/[\\/]+$/, "");
  return { isCurrent: !!m && !!savedDir && m.dir.replace(/[\\/]+$/, "") === savedDir };
}

function renderModels() {
  const byName = new Map(models.map((m) => [dirBase(m.dir).toLowerCase(), m]));
  const entries = MODEL_CATALOG.map((def) => ({ ...def, info: byName.get(def.dirName) || null }));
  for (const m of models) {
    if (!MODEL_CATALOG.some((def) => def.dirName === dirBase(m.dir).toLowerCase())) {
      entries.push({
        dirName: dirBase(m.dir),
        mode: m.mode,
        title: dirBase(m.dir),
        desc: `${t("手动放置的自定义模型 · ")}${t(MODE_LABEL[m.mode] || "离线整句")}`,
        info: m
      });
    }
  }
  $("model-cards").innerHTML = entries
    .map((e) => {
      const m = e.info;
      const ready = !!m?.ready;
      const { isCurrent } = modelStatus(m);
      const badge = isCurrent
        ? `<span class="badge use">${t("使用中")}</span>`
        : ready
          ? `<span class="badge ok">${t("已就绪")}</span>`
          : m
            ? `<span class="badge warn">${t("不完整")}</span>`
            : `<span class="badge">${t("未下载")}</span>`;
      const bar = downloadingMode === e.mode
        ? `<div class="model-bar"><div class="model-bar-fill" id="dl-fill"></div></div>`
        : "";
      const actions = ready
        ? `${isCurrent ? "" : `<button class="ghost" data-act="use" data-mode="${e.mode}" data-dir="${m.dir}" type="button">设为当前</button>`}
             <button class="ghost" data-act="open" data-dir="${m.dir}" type="button">${t("打开目录")}</button>
             ${isCurrent ? "" : `<button class="ghost danger" data-act="delete" data-dir="${m.dir}" type="button">${t("删除")}</button>`}`
        : `<button class="ghost primary-ghost" data-act="download" data-mode="${e.mode}" type="button">${t(m ? "重新下载" : "下载")}</button>
           ${m ? `<button class="ghost" data-act="open" data-dir="${m.dir}" type="button">${t("打开目录")}</button>
                 <button class="ghost danger" data-act="delete" data-dir="${m.dir}" type="button">${t("删除")}</button>` : ""}`;
      return `
        <article class="model-card">
          <div class="model-card-top">
            <div>
              <b>${t(e.title)}</b>
              <p class="model-desc">${t(e.desc)}</p>
            </div>
            ${badge}
          </div>
          ${bar}
          <div class="model-card-foot">
            <span class="model-meta">${m ? `${t("已占用")}${fmtSize(m.size_bytes)}` : t("尚未下载")}</span>
            <div class="model-card-actions">${downloadingMode === e.mode ? `<span class="model-meta">${t("下载中…")}</span>` : actions}</div>
          </div>
        </article>`;
    })
    .join("");
}

async function refreshModels() {
  models = await invoke("list_local_models");
  renderModels();
  updateConfigSummary();
}

async function refreshAudioStatus() {
  try {
    audioStatus = await invoke("get_audio_status");
    if (!audioStatus.available) {
      setStatus("未检测到麦克风", audioStatus.detail, "error");
    } else if (audioStatus.detail) {
      setStatus("正在等待鼠标", `默认麦克风：${audioStatus.detail} · 按住左键超过设定时间即可开始录音`, "idle");
    }
  } catch (error) {
    audioStatus = { available: false, detail: `无法检查麦克风：${error}` };
  }
}

async function onModelAction(event) {
  const btn = event.target.closest("button[data-act]");
  if (!btn || btn.disabled) return;
  const { act, mode, dir } = btn.dataset;
  if (act === "download") {
    downloadingMode = mode;
    renderModels();
    setStatus("正在下载模型", "首次下载较大；中断后再次点击可继续", "processing");
    try {
      const modelDir = await invoke("download_local_model", { mode });
      $("local-model-dir").value = modelDir;
      localMode = mode;
      updateOutputModeUi();
      setStatus("模型已就绪", "已自动设为当前模型，切换到“本地离线”即可使用", "done");
    } catch (error) {
      setStatus("模型下载失败", `临时文件已保留，再次点击可继续：${String(error)}`, "error");
    } finally {
      downloadingMode = null;
      await Promise.all([refreshModels(), afterModelDirChange()]);
    }
  } else if (act === "use") {
    $("local-model-dir").value = dir;
    localMode = mode;
    updateOutputModeUi();
    await saveSettings();
    await afterModelDirChange();
    setStatus("已切换模型", `${dirBase(dir)} 已设为当前本地模型`, "done");
  } else if (act === "open") {
    await invoke("open_model_folder", { dir });
  } else if (act === "delete") {
    if (btn.dataset.armed !== "1") {
      btn.dataset.armed = "1";
      btn.textContent = "确认删除？";
      setTimeout(() => {
        if (btn.isConnected && btn.dataset.armed === "1") {
          btn.dataset.armed = "";
          btn.textContent = "删除";
        }
      }, 3000);
      return;
    }
    await invoke("delete_local_model", { dir });
    await refreshModels();
    setStatus("模型已删除", "磁盘空间已释放", "idle");
  }
}

async function afterModelDirChange() {
  const status = await invoke("get_local_model_status");
  localMode = status.mode || localMode;
  updateOutputModeUi();
  updateLanguageOptions();
  renderModels();
}

async function init() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab));
  });
  const panes = document.querySelector(".panes");
  panes.addEventListener("input", scheduleSave);
  panes.addEventListener("change", scheduleSave);
  document.querySelectorAll(".seg[data-engine]").forEach((seg) => seg.addEventListener("click", () => { setEngine(seg.dataset.engine); scheduleSave(); }));
  document.querySelectorAll(".mini-seg").forEach((button) => button.addEventListener("click", () => {
    if (!button.disabled) {
      outputMode = button.dataset.output;
      updateOutputModeUi();
      scheduleSave();
    }
  }));
  $("provider").addEventListener("change", (e) => { applyProvider(e.target.value); updateProviderUi(); updateConfigSummary(); });
  $("test-api").addEventListener("click", () => testApi());
  $("fetch-models").addEventListener("click", () => fetchApiModels());
  $("toggle-api-key").addEventListener("click", () => {
    const input = $("api-key");
    const visible = input.type === "text";
    input.type = visible ? "password" : "text";
    const label = visible ? "显示 Key" : "隐藏 Key";
    $("toggle-api-key").title = label;
    $("toggle-api-key").setAttribute("aria-label", label);
  });
  $("api-url").addEventListener("input", (e) => { $("provider").value = matchProvider(e.target.value); setModelOptions([], modelValue(), e.target.value); updateProviderUi(); $("api-test-result").textContent = ""; updateConfigSummary(); });
  $("api-key").addEventListener("input", () => { $("api-test-result").textContent = ""; updateConfigSummary(); });
  $("model").addEventListener("change", () => { $("api-test-result").textContent = ""; updateConfigSummary(); });
  $("model-filter").addEventListener("input", () => {
    const selected = modelValue();
    const query = $("model-filter").value.trim().toLowerCase();
    const visible = modelOptions.filter((value) => !query || value.toLowerCase().includes(query));
    const select = $("model");
    select.replaceChildren(...[...new Set([selected, ...visible].filter(Boolean))].map((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      return option;
    }));
    select.value = selected || visible[0] || "";
  });
  $("model-custom").addEventListener("input", () => { $("api-test-result").textContent = ""; updateConfigSummary(); });
  $("toggle-model-input").addEventListener("click", () => {
    setManualModelMode($("model-custom").hidden);
    updateConfigSummary();
  });
  $("online-language").addEventListener("change", scheduleSave);
  $("local-model-dir").addEventListener("input", updateConfigSummary);
  $("setup-action").addEventListener("click", () => {
    if ($("setup-action").dataset.action === "model") {
      if (engine === "online") $("model").focus();
      else activateTab("models");
    } else {
      setEngine("online");
      $("api-key").focus();
    }
  });
  $("profile-select").addEventListener("change", () => {
    applySelectedProfile().catch((error) => setStatus("切换方案失败", String(error), "error"));
  });
  $("profile-new").addEventListener("click", () => {
    createProfile().catch((error) => setStatus("创建方案失败", String(error), "error"));
  });
  $("profile-rename").addEventListener("click", () => {
    renameProfile().catch((error) => setStatus("重命名失败", String(error), "error"));
  });
  $("profile-delete").addEventListener("click", () => {
    deleteProfile().catch((error) => setStatus("删除方案失败", String(error), "error"));
  });
  $("dialog-cancel").addEventListener("click", () => closeDialog());
  $("dialog-confirm").addEventListener("click", () => {
    const field = $("dialog-input");
    closeDialog(field.hidden ? true : field.value);
  });
  $("dialog-input").addEventListener("input", (event) => {
    $("dialog-confirm").disabled = !event.target.value.trim();
  });
  $("dialog-input").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.value.trim()) closeDialog(event.target.value);
  });
  $("dialog-root").addEventListener("click", (event) => {
    if (event.target.dataset.dialogCancel !== undefined) closeDialog();
  });
  $("dialog-root").addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDialog();
  });
  $("hold-ms").addEventListener("input", updateHoldDisplay);
  $("hotkey").addEventListener("change", (event) => {
    const next = event.target.value === "custom"
      ? (hotkeyValue.startsWith("custom:") ? hotkeyValue : "disabled")
      : event.target.value;
    if (hotkeysConflict(next, engineHotkeyValue) || hotkeysConflict(next, translateHotkeyValue)) {
      event.target.value = hotkeyValue.startsWith("custom:") ? "custom" : hotkeyValue;
      setStatus("快捷键冲突", "请使用不同的组合键。", "error");
      return;
    }
    hotkeyValue = next;
    updateHotkeyUi();
    scheduleSave();
  });
  $("record-hotkey").addEventListener("click", () => {
    recordingEngineHotkey = false;
    recordingTranslateHotkey = false;
    recordingHotkey = !recordingHotkey;
    updateHotkeyUi();
    updateEngineHotkeyUi();
    updateTranslateHotkeyUi();
  });
  $("record-engine-hotkey").addEventListener("click", () => {
    recordingHotkey = false;
    recordingTranslateHotkey = false;
    recordingEngineHotkey = !recordingEngineHotkey;
    updateHotkeyUi();
    updateEngineHotkeyUi();
    updateTranslateHotkeyUi();
  });
  $("reset-engine-hotkey").addEventListener("click", () => {
    if (hotkeysConflict("primary-alt-e", recordingShortcut()) || hotkeysConflict("primary-alt-e", translateHotkeyValue)) {
      setStatus("快捷键冲突", "请使用不同的组合键。", "error");
      return;
    }
    engineHotkeyValue = "primary-alt-e";
    updateEngineHotkeyUi();
    scheduleSave();
  });
  $("record-translate-hotkey").addEventListener("click", () => {
    recordingHotkey = false;
    recordingEngineHotkey = false;
    recordingTranslateHotkey = !recordingTranslateHotkey;
    updateHotkeyUi();
    updateEngineHotkeyUi();
    updateTranslateHotkeyUi();
  });
  $("reset-translate-hotkey").addEventListener("click", () => {
    if (hotkeysConflict("primary-alt-t", recordingShortcut()) || hotkeysConflict("primary-alt-t", engineHotkeyValue)) {
      setStatus("快捷键冲突", "请使用不同的组合键。", "error");
      return;
    }
    translateHotkeyValue = "primary-alt-t";
    updateTranslateHotkeyUi();
    scheduleSave();
  });
  $("reset-hotkeys").addEventListener("click", () => {
    stopHotkeyCapture();
    hotkeyValue = "disabled";
    $("hotkey").value = "disabled";
    engineHotkeyValue = "primary-alt-e";
    translateHotkeyValue = "primary-alt-t";
    updateHotkeyUi();
    updateEngineHotkeyUi();
    updateTranslateHotkeyUi();
    scheduleSave();
  });
  window.addEventListener("keydown", captureHotkey, true);
  window.addEventListener("blur", stopHotkeyCapture);
  $("hold-presets").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    $("hold-ms").value = chip.dataset.ms;
    updateHoldDisplay();
    scheduleSave();
  });
  $("model-cards").addEventListener("click", (e) => {
    onModelAction(e).catch((error) => setStatus("操作失败", String(error), "error"));
  });
  document.querySelectorAll(".seg[data-theme-mode]").forEach((b) => b.addEventListener("click", () => {
    applyTheme(b.dataset.themeMode);
    scheduleSave();
  }));
  $("ui-language").addEventListener("change", (event) => {
    setLocale(event.target.value);
    scheduleSave();
  });
  renderAccentSwatches();
  updateAccentUi();
  $("accent-swatches").addEventListener("click", (e) => {
    const btn = e.target.closest(".swatch");
    if (!btn) return;
    setAccent(btn.dataset.color);
  });
  $("accent-custom").addEventListener("input", (e) => setAccent(e.target.value));
  $("support-kofi").addEventListener("click", () => openSupportLink(SUPPORT_LINKS.kofi));
  $("support-store").addEventListener("click", () => openSupportLink(SUPPORT_LINKS.store));
  $("feedback-dismiss").addEventListener("click", () => hideFeedbackCard());
  $("feedback-rating").addEventListener("click", (event) => {
    const button = event.target.closest("[data-rating]");
    if (button) submitFeedbackRating(Number(button.dataset.rating));
  });
  $("feedback-support").addEventListener("click", () => openSupportLink(SUPPORT_LINKS.kofi));
  $("translate-on").addEventListener("change", updateTranslateUi);
  $("translate-api").addEventListener("change", () => {
    applyTranslateChannel();
    setTranslationModelOptions([]);
    updateTranslateUi();
  });
  $("translate-model-select").addEventListener("change", () => {
    $("translate-test-result").textContent = "";
    scheduleSave();
  });
  $("translate-model").addEventListener("input", () => {
    $("translate-test-result").textContent = "";
    scheduleSave();
  });
  $("toggle-translate-model").addEventListener("click", () => {
    setManualTranslationModelMode($("translate-model").hidden);
    scheduleSave();
  });
  $("test-translate").addEventListener("click", testTranslationApi);
  $("fetch-translate-models").addEventListener("click", fetchTranslationModels);
  $("translate-url").addEventListener("input", (e) => {
    const channel = $("translate-api").value;
    if (channel !== "custom" && !TRANSLATE_PROVIDERS[channel]) return;
    const url = e.target.value.trim().replace(/\/+$/, "");
    const found = Object.entries(TRANSLATE_PROVIDERS).find(([, p]) => p.url === url);
    $("translate-api").value = found ? found[0] : "custom";
  });

  const settings = await invoke("get_settings");
  setEngine(settings.engine);
  $("api-url").value = settings.api_url;
  $("api-key").value = settings.api_key;
  setModelOptions([], settings.model);
  $("provider").value = matchProvider(settings.api_url || PROVIDERS.openai.url);
  updateProviderUi();
  updateOnlineLanguageOptions();
  $("online-language").value = settings.online_language || "auto";
  $("hold-ms").value = settings.hold_ms;
  hotkeyValue = settings.hotkey || "disabled";
  $("hotkey").value = hotkeyValue.startsWith("custom:") ? "custom" : hotkeyValue;
  updateHotkeyUi();
  engineHotkeyValue = settings.engine_hotkey || "primary-alt-e";
  updateEngineHotkeyUi();
  translateHotkeyValue = settings.translate_hotkey || "primary-alt-t";
  updateTranslateHotkeyUi();
  $("start-on-login").checked = !!settings.start_on_login;
  $("local-model-dir").value = settings.local_model_dir;
  localMode = settings.local_mode || "offline";
  outputMode = settings.output_mode || "final";
  updateLanguageOptions();
  $("local-language").value = settings.local_language;
  $("translate-on").checked = !!settings.translate_on;
  setManualTranslationModelMode(false);
  setTranslationModelOptions([], settings.translate_model || "");
  $("translate-target").value = settings.translate_target || "en";
  $("translate-api").value = matchTranslateChannel(settings);
  $("translate-url").value = settings.translate_url || "";
  $("translate-key").value = settings.translate_key || "";
  accentColor = settings.accent || "#8b7cff";
  applyTheme(settings.theme || "dark");
  updateAccentUi();
  updateTranslateUi();
  updateHoldDisplay();
  updateOutputModeUi();
  updateConfigSummary();

  await refreshModels();
  await refreshProfiles();
  await refreshAudioStatus();

  await listen("dictation-state", ({ payload }) => {
    if (payload === "recording") {
      const streaming = engine === "local" && localMode === "streaming";
      $("live-preview").hidden = !streaming;
      setStatus("正在录音", streaming ? "稳定片段会自动输入，当前内容显示在实时预览" : "松开鼠标左键完成转写", "recording");
    } else if (payload === "processing") setStatus("正在转写", "请稍候，完成后会自动粘贴", "processing");
    else if (payload === "translating") setStatus("正在翻译", "翻译完成后会自动粘贴", "translating");
    else if (payload === "done") {
      $("live-preview").hidden = true;
      setStatus("已完成", "稳定文字已粘贴到当前输入位置", "done");
      maybeShowFeedback();
    } else if (payload === "cancelled") {
      $("live-preview").hidden = true;
      setStatus("已取消", "本次录音已丢弃，没有继续转写", "idle");
    } else {
      $("live-preview").hidden = true;
      setStatus("正在等待鼠标", "按住左键超过设定时间即可开始录音", "idle");
    }
  });
  await listen("dictation-error", ({ payload }) => {
    $("live-preview").hidden = true;
    setStatus("发生错误", payload, "error");
  });
  await listen("settings-changed", ({ payload }) => {
    if (!payload) return;
    setEngine(payload.engine || "online");
    $("api-url").value = payload.api_url || "";
    $("api-key").value = payload.api_key || "";
    $("online-language").value = payload.online_language || "auto";
    setManualModelMode(false);
    setModelOptions([], payload.model || "whisper-1");
    $("provider").value = matchProvider(payload.api_url || PROVIDERS.openai.url);
    updateProviderUi();
    $("local-model-dir").value = payload.local_model_dir || "";
    localMode = payload.local_mode || "offline";
    outputMode = payload.output_mode || "final";
    hotkeyValue = payload.hotkey || "disabled";
    $("hotkey").value = hotkeyValue.startsWith("custom:") ? "custom" : hotkeyValue;
    updateHotkeyUi();
    engineHotkeyValue = payload.engine_hotkey || "primary-alt-e";
    updateEngineHotkeyUi();
    translateHotkeyValue = payload.translate_hotkey || "primary-alt-t";
    updateTranslateHotkeyUi();
    $("start-on-login").checked = !!payload.start_on_login;
    updateLanguageOptions();
    $("local-language").value = payload.local_language || "auto";
    $("translate-on").checked = !!payload.translate_on;
    $("translate-target").value = payload.translate_target || "en";
    setManualTranslationModelMode(false);
    setTranslationModelOptions([], payload.translate_model || "");
    $("translate-api").value = matchTranslateChannel(payload);
    $("translate-url").value = payload.translate_url || "";
    $("translate-key").value = payload.translate_key || "";
    updateTranslateUi();
    updateOutputModeUi();
    refreshProfiles().catch(() => {});
    setStatus("配置已切换", "新的语言和翻译设置已生效", "done");
  });
  await listen("dictation-partial", ({ payload }) => {
    if (localMode === "streaming") {
      $("live-preview").hidden = false;
      $("live-text").textContent = payload || "正在识别…";
    }
  });
  await listen("model-download", ({ payload }) => {
    const fill = document.getElementById("dl-fill");
    if (!fill) return;
    if (payload?.total) {
      fill.style.width = `${Math.min(100, Math.round((payload.downloaded / payload.total) * 100))}%`;
    } else {
      $("status-detail").textContent = `已下载 ${Math.round((payload?.downloaded || 0) / 1048576)} MB`;
    }
  });
}

function activateTab(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll(".pane").forEach((p) => p.classList.toggle("active", p.id === `pane-${name}`));
}

  init().catch((error) => setStatus("启动失败", String(error), "error"));
}
