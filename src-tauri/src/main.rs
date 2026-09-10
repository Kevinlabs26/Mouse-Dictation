#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use arboard::Clipboard;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use rdev::{listen, simulate, Button, Event, EventType, Key};
use serde::{Deserialize, Serialize};
use sherpa_onnx::{
    OfflineRecognizer, OfflineRecognizerConfig, OfflineSenseVoiceModelConfig,
    OfflineWhisperModelConfig, OnlineRecognizer, OnlineRecognizerConfig, OnlineStream, Wave,
};
use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::{mpsc, Arc, Mutex},
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{
    menu::{CheckMenuItemBuilder, Menu, MenuBuilder, MenuEvent, MenuItemBuilder, SubmenuBuilder},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, Runtime, State, WebviewUrl,
    WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_autostart::ManagerExt as AutostartManagerExt;

#[derive(Clone, Serialize, Deserialize)]
#[serde(default)]
struct Settings {
    engine: String,
    api_url: String,
    api_key: String,
    online_language: String,
    model: String,
    hold_ms: u64,
    local_model_dir: String,
    local_language: String,
    local_mode: String,
    output_mode: String,
    hotkey: String,
    engine_hotkey: String,
    translate_hotkey: String,
    start_on_login: bool,
    translate_on: bool,
    translate_target: String,
    translate_model: String,
    translate_api: String,
    translate_url: String,
    translate_key: String,
    theme: String,
    accent: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            engine: "online".into(),
            api_url: "https://api.openai.com/v1".into(),
            api_key: String::new(),
            online_language: "auto".into(),
            model: "whisper-1".into(),
            hold_ms: 1000,
            local_model_dir: default_local_model_dir().to_string_lossy().into_owned(),
            local_language: "auto".into(),
            local_mode: "offline".into(),
            output_mode: "final".into(),
            hotkey: "disabled".into(),
            engine_hotkey: "primary-alt-e".into(),
            translate_hotkey: "primary-alt-t".into(),
            start_on_login: false,
            translate_on: false,
            translate_target: "en".into(),
            translate_model: String::new(),
            translate_api: "follow".into(),
            translate_url: String::new(),
            translate_key: String::new(),
            theme: "dark".into(),
            accent: "#8b7cff".into(),
        }
    }
}

#[derive(Clone, Serialize, Deserialize, Default)]
#[serde(default)]
struct Profile {
    id: String,
    name: String,
    settings: Settings,
}

#[derive(Clone, Serialize)]
struct ProfileSummary {
    id: String,
    name: String,
    active: bool,
}

const SENSEVOICE_MODEL_URL: &str = "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17.tar.bz2";
const STREAMING_MODEL_URL: &str = "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20.tar.bz2";
const WHISPER_MODEL_URL: &str = "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-small.tar.bz2";

fn default_local_model_dir() -> PathBuf {
    default_model_dir("offline")
}

fn default_model_dir(mode: &str) -> PathBuf {
    dirs_next::data_dir()
        .unwrap_or_else(std::env::temp_dir)
        .join("mouse-dictation")
        .join("models")
        .join(match mode {
            "streaming" => "streaming-zipformer-zh-en",
            "whisper" => "whisper-small",
            _ => "sensevoice-zh",
        })
}

fn model_is_ready(model_dir: &Path) -> bool {
    model_dir.join("model.int8.onnx").is_file() && model_dir.join("tokens.txt").is_file()
}

fn whisper_model_is_ready(model_dir: &Path) -> bool {
    [
        "small-encoder.int8.onnx",
        "small-decoder.int8.onnx",
        "small-tokens.txt",
    ]
    .iter()
    .all(|name| model_dir.join(name).is_file())
}

fn model_ready_for_mode(mode: &str, model_dir: &Path) -> bool {
    match mode {
        "streaming" => streaming_model_is_ready(model_dir),
        "whisper" => whisper_model_is_ready(model_dir),
        _ => model_is_ready(model_dir),
    }
}

fn streaming_model_is_ready(model_dir: &Path) -> bool {
    [
        "encoder-epoch-99-avg-1.int8.onnx",
        "decoder-epoch-99-avg-1.onnx",
        "joiner-epoch-99-avg-1.int8.onnx",
        "tokens.txt",
    ]
    .iter()
    .all(|name| model_dir.join(name).is_file())
}

#[derive(Clone, Serialize)]
struct LocalModelStatus {
    ready: bool,
    model_dir: String,
    mode: String,
}

#[derive(Clone, Serialize)]
struct AudioStatus {
    available: bool,
    name: String,
    detail: String,
}

#[derive(Clone, Serialize)]
struct ModelInfo {
    dir: String,
    mode: String,
    ready: bool,
    size_bytes: u64,
}

fn models_root() -> PathBuf {
    default_model_dir("offline")
        .parent()
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
}

fn dir_size(path: &Path) -> u64 {
    fs::read_dir(path)
        .map(|entries| {
            entries
                .flatten()
                .map(|entry| {
                    let child = entry.path();
                    if child.is_dir() {
                        dir_size(&child)
                    } else {
                        entry.metadata().map(|m| m.len()).unwrap_or(0)
                    }
                })
                .sum()
        })
        .unwrap_or(0)
}

#[derive(Clone, Serialize)]
struct ModelDownloadProgress {
    downloaded: u64,
    total: Option<u64>,
}

struct Recorder {
    stop: mpsc::Sender<()>,
    done: mpsc::Receiver<()>,
    max_stop: mpsc::Sender<()>,
    started_at: Instant,
    samples: Arc<Mutex<Vec<i16>>>,
    sample_rate: u32,
    channels: u16,
    streaming_stop: Option<mpsc::Sender<()>>,
    streaming_done: Option<mpsc::Receiver<Result<(), String>>>,
}

const MAX_RECORDING_TIME: Duration = Duration::from_secs(5 * 60);
const PASTE_SETTLE_TIME: Duration = Duration::from_millis(90);

struct StreamingAudio {
    next_output: usize,
}

impl StreamingAudio {
    fn new() -> Self {
        Self { next_output: 0 }
    }
}

struct LocalRecognizerCache {
    model_dir: String,
    recognizer: OfflineRecognizer,
}

struct StreamingRecognizerCache {
    model_dir: String,
    recognizer: Arc<OnlineRecognizer>,
}

struct AppState {
    settings: Mutex<Settings>,
    ui_locale: Mutex<String>,
    profiles: Mutex<Vec<Profile>>,
    active_profile: Mutex<Option<String>>,
    recorder: Mutex<Option<Recorder>>,
    local_recognizer: Mutex<Option<LocalRecognizerCache>>,
    streaming_recognizer: Mutex<Option<StreamingRecognizerCache>>,
}

struct MouseSession {
    token: u64,
    pressed: bool,
    triggered: bool,
    hotkey_pressed: bool,
    engine_toggle_pressed: bool,
    translate_toggle_pressed: bool,
    ctrl_down: bool,
    alt_down: bool,
    shift_down: bool,
    meta_down: bool,
    start_x: f64,
    start_y: f64,
    last_x: f64,
    last_y: f64,
}

#[derive(Clone, Copy)]
struct HotkeySpec {
    primary: bool,
    ctrl: bool,
    alt: bool,
    shift: bool,
    meta: bool,
    key: Key,
}

fn key_from_code(code: &str) -> Option<Key> {
    Some(match code {
        "Space" => Key::Space,
        "Enter" => Key::Return,
        "Escape" => Key::Escape,
        "Tab" => Key::Tab,
        "Backspace" => Key::Backspace,
        "Delete" => Key::Delete,
        "Insert" => Key::Insert,
        "Home" => Key::Home,
        "End" => Key::End,
        "PageUp" => Key::PageUp,
        "PageDown" => Key::PageDown,
        "ArrowUp" => Key::UpArrow,
        "ArrowDown" => Key::DownArrow,
        "ArrowLeft" => Key::LeftArrow,
        "ArrowRight" => Key::RightArrow,
        "Backquote" => Key::BackQuote,
        "Minus" => Key::Minus,
        "Equal" => Key::Equal,
        "BracketLeft" => Key::LeftBracket,
        "BracketRight" => Key::RightBracket,
        "Semicolon" => Key::SemiColon,
        "Quote" => Key::Quote,
        "Backslash" => Key::BackSlash,
        "Comma" => Key::Comma,
        "Period" => Key::Dot,
        "Slash" => Key::Slash,
        "F1" => Key::F1,
        "F2" => Key::F2,
        "F3" => Key::F3,
        "F4" => Key::F4,
        "F5" => Key::F5,
        "F6" => Key::F6,
        "F7" => Key::F7,
        "F8" => Key::F8,
        "F9" => Key::F9,
        "F10" => Key::F10,
        "F11" => Key::F11,
        "F12" => Key::F12,
        "Digit0" => Key::Num0,
        "Digit1" => Key::Num1,
        "Digit2" => Key::Num2,
        "Digit3" => Key::Num3,
        "Digit4" => Key::Num4,
        "Digit5" => Key::Num5,
        "Digit6" => Key::Num6,
        "Digit7" => Key::Num7,
        "Digit8" => Key::Num8,
        "Digit9" => Key::Num9,
        "KeyA" => Key::KeyA,
        "KeyB" => Key::KeyB,
        "KeyC" => Key::KeyC,
        "KeyD" => Key::KeyD,
        "KeyE" => Key::KeyE,
        "KeyF" => Key::KeyF,
        "KeyG" => Key::KeyG,
        "KeyH" => Key::KeyH,
        "KeyI" => Key::KeyI,
        "KeyJ" => Key::KeyJ,
        "KeyK" => Key::KeyK,
        "KeyL" => Key::KeyL,
        "KeyM" => Key::KeyM,
        "KeyN" => Key::KeyN,
        "KeyO" => Key::KeyO,
        "KeyP" => Key::KeyP,
        "KeyQ" => Key::KeyQ,
        "KeyR" => Key::KeyR,
        "KeyS" => Key::KeyS,
        "KeyT" => Key::KeyT,
        "KeyU" => Key::KeyU,
        "KeyV" => Key::KeyV,
        "KeyW" => Key::KeyW,
        "KeyX" => Key::KeyX,
        "KeyY" => Key::KeyY,
        "KeyZ" => Key::KeyZ,
        _ => return None,
    })
}

fn parse_hotkey(hotkey: &str) -> Option<HotkeySpec> {
    match hotkey {
        "primary-alt-space" => Some(HotkeySpec {
            primary: true,
            ctrl: false,
            alt: true,
            shift: false,
            meta: false,
            key: Key::Space,
        }),
        "primary-alt-m" => Some(HotkeySpec {
            primary: true,
            ctrl: false,
            alt: true,
            shift: false,
            meta: false,
            key: Key::KeyM,
        }),
        "primary-alt-e" => Some(HotkeySpec {
            primary: true,
            ctrl: false,
            alt: true,
            shift: false,
            meta: false,
            key: Key::KeyE,
        }),
        "primary-alt-q" => Some(HotkeySpec {
            primary: true,
            ctrl: false,
            alt: true,
            shift: false,
            meta: false,
            key: Key::KeyQ,
        }),
        "primary-alt-x" => Some(HotkeySpec {
            primary: true,
            ctrl: false,
            alt: true,
            shift: false,
            meta: false,
            key: Key::KeyX,
        }),
        "primary-alt-t" => Some(HotkeySpec {
            primary: true,
            ctrl: false,
            alt: true,
            shift: false,
            meta: false,
            key: Key::KeyT,
        }),
        _ => {
            let parts: Vec<_> = hotkey.strip_prefix("custom:")?.split('+').collect();
            if parts.len() < 2 {
                return None;
            }
            let mut spec = HotkeySpec {
                primary: false,
                ctrl: false,
                alt: false,
                shift: false,
                meta: false,
                key: key_from_code(parts.last()?)?,
            };
            for modifier in &parts[..parts.len() - 1] {
                match *modifier {
                    "ctrl" => spec.ctrl = true,
                    "alt" => spec.alt = true,
                    "shift" => spec.shift = true,
                    "meta" => spec.meta = true,
                    _ => return None,
                }
            }
            if spec.ctrl || spec.alt || spec.shift || spec.meta {
                Some(spec)
            } else {
                None
            }
        }
    }
}

fn config_path() -> Option<PathBuf> {
    dirs_next::config_dir().map(|dir| dir.join("mouse-dictation").join("settings.json"))
}

fn profiles_path() -> Option<PathBuf> {
    dirs_next::config_dir().map(|dir| dir.join("mouse-dictation").join("profiles.json"))
}

const KEYRING_SERVICE: &str = "com.mousedictation.desktop";

fn read_secret_for(service: &str, name: &str) -> Option<String> {
    keyring::Entry::new(service, name)
        .ok()
        .and_then(|entry| entry.get_password().ok())
        .filter(|secret| !secret.is_empty())
}

fn write_secret_for(service: &str, name: &str, value: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(service, name).map_err(|e| e.to_string())?;
    entry
        .set_password(value)
        .map_err(|e| format!("保存安全凭据失败：{e}"))
}

fn clear_secret_for(service: &str, name: &str) -> Result<(), String> {
    // 没有保存过凭据时不要调用 delete_credential。Windows 凭据管理器会
    // 把“没有这个条目”作为错误返回，但这对清空设置来说是正常情况。
    if read_secret_for(service, name).is_none() {
        return Ok(());
    }

    let entry = keyring::Entry::new(service, name).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("删除安全凭据失败：{error}")),
    }
}

fn save_secret_for(service: &str, name: &str, value: &str, label: &str) -> Result<(), String> {
    if value.is_empty() {
        clear_secret_for(service, name)
    } else {
        write_secret_for(service, name, value).map_err(|error| format!("保存{label}失败：{error}"))
    }
}

fn read_secret(name: &str) -> Option<String> {
    read_secret_for(KEYRING_SERVICE, name)
}

fn write_secret(name: &str, value: &str) -> Result<(), String> {
    write_secret_for(KEYRING_SERVICE, name, value)
}

fn save_secret(name: &str, value: &str, label: &str) -> Result<(), String> {
    save_secret_for(KEYRING_SERVICE, name, value, label)
}

fn profile_secret_name(profile_id: &str, kind: &str) -> String {
    format!("profile/{profile_id}/{kind}")
}

fn load_profiles() -> Vec<Profile> {
    let mut profiles: Vec<Profile> = profiles_path()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|data| serde_json::from_str(&data).ok())
        .unwrap_or_default();
    for profile in &mut profiles {
        if let Some(secret) =
            read_secret(&profile_secret_name(&profile.id, "transcription-api-key"))
        {
            profile.settings.api_key = secret;
        }
        if let Some(secret) = read_secret(&profile_secret_name(&profile.id, "translation-api-key"))
        {
            profile.settings.translate_key = secret;
        }
    }
    profiles.retain(|profile| !profile.id.is_empty() && !profile.name.trim().is_empty());
    profiles
}

fn save_profile_secrets(profile: &Profile) -> Result<(), String> {
    save_secret(
        &profile_secret_name(&profile.id, "transcription-api-key"),
        &profile.settings.api_key,
        "方案识别 API Key",
    )?;
    save_secret(
        &profile_secret_name(&profile.id, "translation-api-key"),
        &profile.settings.translate_key,
        "方案翻译 API Key",
    )?;
    Ok(())
}

fn save_profiles_file(profiles: &[Profile]) -> Result<(), String> {
    let path = profiles_path().ok_or("无法找到系统配置目录")?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let mut persisted = profiles.to_vec();
    for profile in &mut persisted {
        profile.settings.api_key.clear();
        profile.settings.translate_key.clear();
    }
    let json = serde_json::to_string_pretty(&persisted).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

fn load_settings() -> Settings {
    let mut settings: Settings = config_path()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|data| serde_json::from_str(&data).ok())
        .unwrap_or_default();
    let mut migrated = false;
    if let Some(secret) = read_secret("transcription-api-key") {
        settings.api_key = secret;
    } else if !settings.api_key.is_empty()
        && write_secret("transcription-api-key", &settings.api_key).is_ok()
    {
        migrated = true;
    }
    if let Some(secret) = read_secret("translation-api-key") {
        settings.translate_key = secret;
    } else if !settings.translate_key.is_empty()
        && write_secret("translation-api-key", &settings.translate_key).is_ok()
    {
        migrated = true;
    }
    if migrated {
        let _ = save_settings_file(&settings);
    }
    settings
}

fn save_settings_file(settings: &Settings) -> Result<(), String> {
    let path = config_path().ok_or("无法找到系统配置目录")?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let mut persisted = settings.clone();
    persisted.api_key.clear();
    persisted.translate_key.clear();
    let json = serde_json::to_string_pretty(&persisted).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_settings(state: State<'_, AppState>) -> Settings {
    state.settings.lock().unwrap().clone()
}

#[tauri::command]
fn set_ui_locale(locale: String, state: State<'_, AppState>, app: AppHandle) -> Result<(), String> {
    let locale = match locale.as_str() {
        "en" | "fr" | "de" | "ja" | "es" | "ko" | "pt" => locale,
        _ => "zh".into(),
    };
    *state.ui_locale.lock().map_err(|_| "界面语言锁定失败")? = locale;
    let settings = state.settings.lock().map_err(|_| "设置锁定失败")?.clone();
    refresh_tray_menu(&app, &settings)
}

#[tauri::command]
fn get_profiles(state: State<'_, AppState>) -> Vec<ProfileSummary> {
    profile_summaries(&state)
}

fn profile_summaries(state: &AppState) -> Vec<ProfileSummary> {
    let active = state.active_profile.lock().unwrap().clone();
    state
        .profiles
        .lock()
        .unwrap()
        .iter()
        .map(|profile| ProfileSummary {
            id: profile.id.clone(),
            name: profile.name.clone(),
            active: active.as_deref() == Some(profile.id.as_str()),
        })
        .collect()
}

#[tauri::command]
fn create_profile(
    name: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<ProfileSummary, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("方案名称不能为空".into());
    }
    if name.chars().count() > 32 {
        return Err("方案名称不能超过 32 个字符".into());
    }
    let current = state.settings.lock().map_err(|_| "设置锁定失败")?.clone();
    let mut profiles = state.profiles.lock().map_err(|_| "方案锁定失败")?;
    if profiles
        .iter()
        .any(|profile| profile.name.eq_ignore_ascii_case(&name))
    {
        return Err("已经存在同名方案".into());
    }
    let id = format!(
        "profile-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_nanos()
    );
    let profile = Profile {
        id: id.clone(),
        name,
        settings: current,
    };
    save_profile_secrets(&profile)?;
    profiles.push(profile.clone());
    save_profiles_file(&profiles)?;
    drop(profiles);
    *state
        .active_profile
        .lock()
        .map_err(|_| "方案状态锁定失败")? = Some(id.clone());
    let settings = state.settings.lock().map_err(|_| "设置锁定失败")?.clone();
    let _ = refresh_tray_menu(&app, &settings);
    Ok(ProfileSummary {
        id,
        name: profile.name,
        active: true,
    })
}

#[tauri::command]
fn rename_profile(
    id: String,
    name: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("方案名称不能为空".into());
    }
    if name.chars().count() > 32 {
        return Err("方案名称不能超过 32 个字符".into());
    }
    let mut profiles = state.profiles.lock().map_err(|_| "方案锁定失败")?;
    if profiles
        .iter()
        .any(|profile| profile.id != id && profile.name.eq_ignore_ascii_case(&name))
    {
        return Err("已经存在同名方案".into());
    }
    let profile = profiles
        .iter_mut()
        .find(|profile| profile.id == id)
        .ok_or("找不到方案")?;
    profile.name = name;
    save_profiles_file(&profiles)?;
    drop(profiles);
    let settings = state.settings.lock().map_err(|_| "设置锁定失败")?.clone();
    let _ = refresh_tray_menu(&app, &settings);
    Ok(())
}

#[tauri::command]
fn delete_profile(id: String, state: State<'_, AppState>, app: AppHandle) -> Result<(), String> {
    let mut profiles = state.profiles.lock().map_err(|_| "方案锁定失败")?;
    let removed = profiles
        .iter()
        .find(|profile| profile.id == id)
        .cloned()
        .ok_or("找不到方案")?;
    profiles.retain(|profile| profile.id != id);
    save_profiles_file(&profiles)?;
    let _ = clear_secret_for(
        KEYRING_SERVICE,
        &profile_secret_name(&removed.id, "transcription-api-key"),
    );
    let _ = clear_secret_for(
        KEYRING_SERVICE,
        &profile_secret_name(&removed.id, "translation-api-key"),
    );
    drop(profiles);
    if state.active_profile.lock().unwrap().as_deref() == Some(id.as_str()) {
        *state
            .active_profile
            .lock()
            .map_err(|_| "方案状态锁定失败")? = None;
    }
    let settings = state.settings.lock().map_err(|_| "设置锁定失败")?.clone();
    let _ = refresh_tray_menu(&app, &settings);
    Ok(())
}

fn apply_profile_impl<R: Runtime>(
    id: String,
    state: State<'_, AppState>,
    app: &AppHandle<R>,
) -> Result<(), String> {
    let profile = state
        .profiles
        .lock()
        .map_err(|_| "方案锁定失败")?
        .iter()
        .find(|profile| profile.id == id)
        .cloned()
        .ok_or("找不到方案")?;
    let start_on_login = state
        .settings
        .lock()
        .map_err(|_| "设置锁定失败")?
        .start_on_login;
    let mut settings = profile.settings;
    settings.start_on_login = start_on_login;
    let streaming_model_changed = {
        let current = state.settings.lock().map_err(|_| "设置锁定失败")?;
        current.local_mode != settings.local_mode
            || current.local_model_dir != settings.local_model_dir
    };
    save_settings_file(&settings)?;
    *state.settings.lock().map_err(|_| "设置锁定失败")? = settings.clone();
    *state
        .active_profile
        .lock()
        .map_err(|_| "方案状态锁定失败")? = Some(id);
    if streaming_model_changed {
        *state.streaming_recognizer.lock().unwrap() = None;
        *state.local_recognizer.lock().unwrap() = None;
    }
    emit(&app, "settings-changed", settings.clone());
    let _ = refresh_tray_menu(&app, &settings);
    Ok(())
}

#[tauri::command]
fn apply_profile(id: String, state: State<'_, AppState>, app: AppHandle) -> Result<(), String> {
    apply_profile_impl(id, state, &app)
}

#[tauri::command]
fn save_settings(
    settings: Settings,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    let settings =
        Settings {
            engine: if settings.engine == "local" {
                "local".into()
            } else {
                "online".into()
            },
            api_url: settings.api_url.trim().trim_end_matches('/').to_string(),
            api_key: normalize_api_key(&settings.api_key),
            online_language: match settings.online_language.as_str() {
                "zh" | "en" | "ja" | "ko" | "de" | "fr" | "es" | "ru" | "pt" | "it" | "nl"
                | "pl" | "tr" | "ar" | "hi" | "id" | "ms" | "th" | "vi" | "uk" | "fa" | "he"
                | "el" | "sv" | "da" | "fi" | "hu" | "ro" | "cs" | "bg" | "ca" | "bn" | "ta"
                | "no" => settings.online_language.trim().into(),
                _ => "auto".into(),
            },
            model: if settings.model.trim().is_empty() {
                "whisper-1".into()
            } else {
                settings.model.trim().into()
            },
            hold_ms: settings.hold_ms.clamp(300, 5000),
            local_model_dir: settings.local_model_dir.trim().into(),
            local_language: if settings.local_language.trim().is_empty() {
                "auto".into()
            } else {
                settings.local_language.trim().into()
            },
            local_mode: match settings.local_mode.as_str() {
                "streaming" | "whisper" => settings.local_mode.clone(),
                _ => "offline".into(),
            },
            output_mode: if settings.output_mode == "streaming" {
                "streaming".into()
            } else {
                "final".into()
            },
            hotkey: if parse_hotkey(&settings.hotkey).is_some() {
                settings.hotkey
            } else {
                "disabled".into()
            },
            engine_hotkey: if settings.engine_hotkey == "disabled"
                || parse_hotkey(&settings.engine_hotkey).is_some()
            {
                settings.engine_hotkey
            } else {
                "primary-alt-e".into()
            },
            translate_hotkey: if settings.translate_hotkey == "disabled"
                || parse_hotkey(&settings.translate_hotkey).is_some()
            {
                settings.translate_hotkey
            } else {
                "primary-alt-t".into()
            },
            start_on_login: settings.start_on_login,
            translate_on: settings.translate_on
                && !(settings.engine == "local" && settings.local_mode == "streaming"),
            translate_target: match settings.translate_target.as_str() {
                "zh" | "ja" | "ko" | "fr" | "de" | "es" | "ru" | "pt" | "it" | "nl" | "pl"
                | "tr" | "ar" | "hi" | "id" | "th" | "vi" | "uk" | "fa" | "he" | "sv" | "da"
                | "fi" | "no" => settings.translate_target,
                _ => "en".into(),
            },
            translate_model: settings.translate_model.trim().into(),
            translate_api: match settings.translate_api.as_str() {
                "follow" | "custom" | "deepseek" | "zhipu" | "dashscope" | "siliconflow"
                | "groq" | "openai" => settings.translate_api,
                "auto" | "google" => "follow".into(),
                _ => "follow".into(),
            },
            translate_url: settings.translate_url.trim().trim_end_matches('/').into(),
            translate_key: settings.translate_key.trim().into(),
            theme: match settings.theme.as_str() {
                "light" => "light".into(),
                _ => "dark".into(),
            },
            accent: {
                let trimmed = settings.accent.trim();
                let valid = trimmed.starts_with('#')
                    && (trimmed.len() == 7 || trimmed.len() == 4)
                    && trimmed[1..].chars().all(|c| c.is_ascii_hexdigit());
                if valid {
                    trimmed.to_string()
                } else {
                    "#8b7cff".into()
                }
            },
        };
    save_secret("transcription-api-key", &settings.api_key, "识别 API Key")?;
    save_secret(
        "translation-api-key",
        &settings.translate_key,
        "翻译 API Key",
    )?;
    let previous_start_on_login = state.settings.lock().unwrap().start_on_login;
    if settings.start_on_login && !previous_start_on_login {
        app.autolaunch().enable().map_err(|e| e.to_string())?;
    } else if !settings.start_on_login && previous_start_on_login {
        // auto-launch 的 disable 在 Windows 上删除不存在的注册表值时会返回
        // ERROR_FILE_NOT_FOUND。先检查状态，避免把正常的“已经关闭”当成失败。
        if app.autolaunch().is_enabled().unwrap_or(false) {
            app.autolaunch()
                .disable()
                .map_err(|e| format!("关闭开机启动失败：{e}"))?;
        }
    }
    let streaming_model_changed = {
        let current = state.settings.lock().unwrap();
        current.local_mode != settings.local_mode
            || current.local_model_dir != settings.local_model_dir
    };
    save_settings_file(&settings)?;
    *state.settings.lock().unwrap() = settings.clone();
    if let Some(active_id) = state.active_profile.lock().unwrap().clone() {
        let mut profiles = state.profiles.lock().map_err(|_| "方案锁定失败")?;
        if let Some(profile) = profiles.iter_mut().find(|profile| profile.id == active_id) {
            profile.settings = settings.clone();
            save_profile_secrets(profile)?;
            save_profiles_file(&profiles)?;
        }
    }
    if streaming_model_changed {
        *state.streaming_recognizer.lock().unwrap() = None;
    }
    let _ = refresh_tray_menu(&app, &settings);
    Ok(())
}

#[tauri::command]
fn get_local_model_status(state: State<'_, AppState>) -> LocalModelStatus {
    let (model_dir, mode) = state
        .settings
        .lock()
        .map(|settings| {
            (
                settings.local_model_dir.clone(),
                settings.local_mode.clone(),
            )
        })
        .unwrap_or_default();
    let path = PathBuf::from(&model_dir);
    LocalModelStatus {
        ready: model_ready_for_mode(&mode, &path),
        model_dir,
        mode,
    }
}

#[tauri::command]
fn get_audio_status() -> AudioStatus {
    let host = cpal::default_host();
    let Some(device) = host.default_input_device() else {
        return AudioStatus {
            available: false,
            name: String::new(),
            detail: "系统没有可用的默认麦克风，请检查设备连接和系统权限。".into(),
        };
    };
    let name = device.name().unwrap_or_else(|_| "默认麦克风".into());
    match device.default_input_config() {
        Ok(config) => AudioStatus {
            available: true,
            detail: format!("{} · {} Hz", name, config.sample_rate().0),
            name,
        },
        Err(error) => AudioStatus {
            available: false,
            detail: format!("{} · 无法读取麦克风配置：{error}", name),
            name,
        },
    }
}

#[tauri::command]
fn get_recording_elapsed(state: State<'_, AppState>) -> Option<u64> {
    state
        .recorder
        .lock()
        .ok()?
        .as_ref()
        .map(|recorder| recorder.started_at.elapsed().as_secs())
}

#[tauri::command]
fn list_local_models() -> Vec<ModelInfo> {
    let root = models_root();
    let mut models: Vec<ModelInfo> = fs::read_dir(&root)
        .map(|entries| {
            entries
                .flatten()
                .filter_map(|entry| {
                    let path = entry.path();
                    if !path.is_dir() {
                        return None;
                    }
                    let name = path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or_default()
                        .to_owned();
                    let mode = if streaming_model_is_ready(&path) {
                        "streaming".to_string()
                    } else if whisper_model_is_ready(&path) {
                        "whisper".to_string()
                    } else if model_is_ready(&path) {
                        "offline".to_string()
                    } else if name.contains("streaming") {
                        "streaming".to_string()
                    } else if name.contains("whisper") {
                        "whisper".to_string()
                    } else {
                        "offline".to_string()
                    };
                    let ready = model_ready_for_mode(&mode, &path);
                    Some(ModelInfo {
                        dir: path.to_string_lossy().into_owned(),
                        mode,
                        ready,
                        size_bytes: dir_size(&path),
                    })
                })
                .collect()
        })
        .unwrap_or_default();
    models.sort_by(|a, b| a.dir.cmp(&b.dir));
    models
}

#[tauri::command]
fn delete_local_model(dir: String, state: State<'_, AppState>) -> Result<(), String> {
    let path = PathBuf::from(&dir)
        .canonicalize()
        .map_err(|e| format!("模型目录不存在：{e}"))?;
    let root = models_root()
        .canonicalize()
        .map_err(|e| format!("无法访问模型根目录：{e}"))?;
    if path.parent() != Some(root.as_path()) {
        return Err("出于安全考虑，只能删除本应用模型目录下的模型".into());
    }
    let current = state
        .settings
        .lock()
        .map_err(|_| "设置锁定失败")?
        .local_model_dir
        .clone();
    if PathBuf::from(current).canonicalize().ok().as_deref() == Some(path.as_path()) {
        return Err("该模型正在使用中，请先切换到其他模型再删除".into());
    }
    fs::remove_dir_all(&path).map_err(|e| format!("删除模型失败：{e}"))
}

#[tauri::command]
fn open_model_folder(dir: String) -> Result<(), String> {
    let path = PathBuf::from(&dir);
    if !path.is_dir() {
        return Err("目录不存在".into());
    }
    let spawned = {
        #[cfg(windows)]
        {
            std::process::Command::new("explorer").arg(&path).spawn()
        }
        #[cfg(target_os = "macos")]
        {
            std::process::Command::new("open").arg(&path).spawn()
        }
        #[cfg(all(unix, not(target_os = "macos")))]
        {
            std::process::Command::new("xdg-open").arg(&path).spawn()
        }
    };
    spawned
        .map(|_| ())
        .map_err(|e| format!("打开目录失败：{e}"))
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    let url = url.trim();
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("只允许打开 HTTP 或 HTTPS 链接".into());
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer.exe")
            .arg(url)
            .spawn()
            .map_err(|e| format!("无法打开链接：{e}"))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("无法打开链接：{e}"))?;
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("无法打开链接：{e}"))?;
    }
    Ok(())
}

fn download_local_model_blocking(app: AppHandle, mode: String) -> Result<String, String> {
    let streaming = mode == "streaming";
    let whisper = mode == "whisper";
    let model_dir = default_model_dir(&mode);
    let model_url = if streaming {
        STREAMING_MODEL_URL
    } else if whisper {
        WHISPER_MODEL_URL
    } else {
        SENSEVOICE_MODEL_URL
    };
    fs::create_dir_all(&model_dir).map_err(|e| format!("创建本地模型目录失败：{e}"))?;
    let archive_name = model_dir
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("model");
    let partial_path = model_dir
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join(format!(".{archive_name}.download.tar.bz2"));

    let result = (|| -> Result<(), String> {
        let client = reqwest::blocking::Client::builder()
            .connect_timeout(Duration::from_secs(15))
            .timeout(Duration::from_secs(30 * 60))
            .build()
            .map_err(|e| format!("创建模型下载客户端失败：{e}"))?;
        let resume_from = fs::metadata(&partial_path)
            .map(|meta| meta.len())
            .unwrap_or(0);
        let mut request = client.get(model_url);
        if resume_from > 0 {
            request = request.header("Range", format!("bytes={resume_from}-"));
        }
        let mut response = request
            .send()
            .map_err(|e| format!("下载本地模型失败：{e}"))?;
        if resume_from > 0 && response.status() == reqwest::StatusCode::RANGE_NOT_SATISFIABLE {
            let _ = fs::remove_file(&partial_path);
            response = client
                .get(model_url)
                .send()
                .map_err(|e| format!("重新开始下载本地模型失败：{e}"))?;
        }
        if !response.status().is_success() {
            return Err(format!("模型下载返回 HTTP {}", response.status()));
        }
        let resumed = resume_from > 0 && response.status() == reqwest::StatusCode::PARTIAL_CONTENT;
        let mut downloaded = if resumed { resume_from } else { 0 };
        let total = response.content_length().map(|length| length + downloaded);
        let mut file = OpenOptions::new()
            .create(true)
            .write(true)
            .append(resumed)
            .truncate(!resumed)
            .open(&partial_path)
            .map_err(|e| format!("创建模型临时文件失败：{e}"))?;
        let mut buffer = [0_u8; 64 * 1024];
        loop {
            let count = response
                .read(&mut buffer)
                .map_err(|e| format!("读取模型下载内容失败：{e}"))?;
            if count == 0 {
                break;
            }
            file.write_all(&buffer[..count])
                .map_err(|e| format!("保存模型下载内容失败：{e}"))?;
            downloaded += count as u64;
            emit(
                &app,
                "model-download",
                ModelDownloadProgress { downloaded, total },
            );
        }
        file.flush().map_err(|e| format!("写入模型文件失败：{e}"))?;

        let archive_file =
            File::open(&partial_path).map_err(|e| format!("打开模型压缩包失败：{e}"))?;
        let decoder = bzip2::read::BzDecoder::new(archive_file);
        let mut archive = tar::Archive::new(decoder);
        let mut found_files = 0;
        for entry in archive
            .entries()
            .map_err(|e| format!("读取模型压缩包失败：{e}"))?
        {
            let mut entry = entry.map_err(|e| format!("读取模型文件失败：{e}"))?;
            let filename = entry
                .path()
                .map_err(|e| format!("读取模型文件名失败：{e}"))?
                .file_name()
                .and_then(|name| name.to_str())
                .map(str::to_owned);
            let wanted = if streaming {
                matches!(
                    filename.as_deref(),
                    Some(
                        "encoder-epoch-99-avg-1.int8.onnx"
                            | "decoder-epoch-99-avg-1.onnx"
                            | "joiner-epoch-99-avg-1.int8.onnx"
                            | "tokens.txt"
                    )
                )
            } else if whisper {
                matches!(
                    filename.as_deref(),
                    Some(
                        "small-encoder.int8.onnx" | "small-decoder.int8.onnx" | "small-tokens.txt"
                    )
                )
            } else {
                matches!(filename.as_deref(), Some("model.int8.onnx" | "tokens.txt"))
            };
            if wanted {
                let filename = filename.expect("wanted model archive entry has a filename");
                entry
                    .unpack(model_dir.join(filename))
                    .map_err(|e| format!("解压模型文件失败：{e}"))?;
                found_files += 1;
            }
        }
        let ready = if streaming {
            found_files == 4 && streaming_model_is_ready(&model_dir)
        } else if whisper {
            found_files == 3 && whisper_model_is_ready(&model_dir)
        } else {
            found_files == 2 && model_is_ready(&model_dir)
        };
        if !ready {
            return Err("模型压缩包中缺少必要模型文件".into());
        }
        Ok(())
    })();
    if result.is_ok() {
        let _ = fs::remove_file(&partial_path);
    }
    result?;

    let model_dir_string = model_dir.to_string_lossy().into_owned();
    let state = app.state::<AppState>();
    {
        let mut settings = state.settings.lock().map_err(|_| "设置锁定失败")?;
        settings.local_model_dir = model_dir_string.clone();
        settings.local_mode = mode;
        if settings.local_mode == "streaming" {
            settings.translate_on = false;
        }
        save_settings_file(&settings)?;
    }
    *state
        .local_recognizer
        .lock()
        .map_err(|_| "本地模型状态锁定失败")? = None;
    *state
        .streaming_recognizer
        .lock()
        .map_err(|_| "实时模型缓存锁定失败")? = None;
    emit(
        &app,
        "model-download",
        ModelDownloadProgress {
            downloaded: 1,
            total: Some(1),
        },
    );
    Ok(model_dir_string)
}

#[tauri::command]
async fn download_local_model(app: AppHandle, mode: Option<String>) -> Result<String, String> {
    let mode = mode.unwrap_or_else(|| {
        app.state::<AppState>()
            .settings
            .lock()
            .map(|settings| settings.local_mode.clone())
            .unwrap_or_else(|_| "offline".into())
    });
    tauri::async_runtime::spawn_blocking(move || download_local_model_blocking(app, mode))
        .await
        .map_err(|e| format!("本地模型下载任务失败：{e}"))?
}

fn emit<R: Runtime>(app: &AppHandle<R>, event: &str, payload: impl Serialize + Clone) {
    let _ = app.emit(event, payload);
}

fn position_overlay_at_cursor<R: Runtime>(app: &AppHandle<R>) {
    if let Ok(pos) = app.cursor_position() {
        if let Some(win) = app.get_webview_window("overlay") {
            let size = win.inner_size().unwrap_or(PhysicalSize::new(200, 200));
            let x = (pos.x - size.width as f64 / 2.0).round() as i32;
            let y = (pos.y - size.height as f64 / 2.0).round() as i32;
            let _ = win.set_position(PhysicalPosition::new(x, y));
        }
    }
}

fn show_overlay<R: Runtime>(app: &AppHandle<R>) {
    position_overlay_at_cursor(app);
    if let Some(win) = app.get_webview_window("overlay") {
        // Windows can lose the z-order after another window is activated;
        // reassert topmost each time the overlay is shown without focusing it.
        let _ = win.set_always_on_top(true);
        let _ = win.show();
    }
}

fn hide_overlay<R: Runtime>(app: &AppHandle<R>) {
    if let Some(win) = app.get_webview_window("overlay") {
        let _ = win.hide();
    }
}

fn create_streaming_recognizer(settings: &Settings) -> Result<OnlineRecognizer, String> {
    let model_dir = PathBuf::from(settings.local_model_dir.trim());
    if !streaming_model_is_ready(&model_dir) {
        return Err(format!(
            "实时模型不完整，需要 encoder、decoder、joiner 和 tokens.txt：{}",
            model_dir.display()
        ));
    }
    let mut config = OnlineRecognizerConfig::default();
    config.model_config.transducer.encoder = Some(
        model_dir
            .join("encoder-epoch-99-avg-1.int8.onnx")
            .to_string_lossy()
            .into_owned(),
    );
    config.model_config.transducer.decoder = Some(
        model_dir
            .join("decoder-epoch-99-avg-1.onnx")
            .to_string_lossy()
            .into_owned(),
    );
    config.model_config.transducer.joiner = Some(
        model_dir
            .join("joiner-epoch-99-avg-1.int8.onnx")
            .to_string_lossy()
            .into_owned(),
    );
    config.model_config.tokens = Some(model_dir.join("tokens.txt").to_string_lossy().into_owned());
    config.model_config.num_threads = 2;
    config.decoding_method = Some("greedy_search".into());
    config.enable_endpoint = true;
    config.rule1_min_trailing_silence = 0.8;
    config.rule2_min_trailing_silence = 0.4;
    config.rule3_min_utterance_length = 0.8;
    OnlineRecognizer::create(&config).ok_or("加载实时模型失败".into())
}

fn get_streaming_recognizer(
    app: &AppHandle,
    settings: &Settings,
) -> Result<Arc<OnlineRecognizer>, String> {
    let model_dir = PathBuf::from(settings.local_model_dir.trim());
    let cache_key = model_dir.to_string_lossy().into_owned();
    let state = app.state::<AppState>();
    let mut cache = state
        .streaming_recognizer
        .lock()
        .map_err(|_| "实时模型缓存锁定失败")?;
    if cache
        .as_ref()
        .map(|cached| cached.model_dir != cache_key)
        .unwrap_or(true)
    {
        *cache = Some(StreamingRecognizerCache {
            model_dir: cache_key,
            recognizer: Arc::new(create_streaming_recognizer(settings)?),
        });
    }
    Ok(Arc::clone(
        &cache.as_ref().expect("实时模型缓存刚刚创建").recognizer,
    ))
}

fn resample_available(
    samples: &[i16],
    sample_rate: u32,
    channels: u16,
    state: &mut StreamingAudio,
    flush: bool,
) -> Vec<f32> {
    let channels = channels.max(1) as usize;
    let frames = samples.len() / channels;
    let mut output = Vec::new();
    while state.next_output < frames {
        let position = state.next_output as f64 * sample_rate as f64 / 16_000.0;
        let left = position.floor() as usize;
        if left >= frames || (!flush && left + 1 >= frames) {
            break;
        }
        let right = (left + 1).min(frames - 1);
        let fraction = (position - left as f64) as f32;
        let mono = |frame: usize| {
            let start = frame * channels;
            samples[start..start + channels]
                .iter()
                .map(|sample| *sample as f32 / 32768.0)
                .sum::<f32>()
                / channels as f32
        };
        let value = mono(left) * (1.0 - fraction) + mono(right) * fraction;
        output.push(value);
        state.next_output += 1;
    }
    output
}

fn emit_stream_preview(app: &AppHandle, last_preview: &mut String, text: &str) {
    let text = text.trim();
    if !text.is_empty() && text != last_preview {
        *last_preview = text.to_string();
        emit(app, "dictation-partial", text.to_string());
    }
}

fn append_segment(target: &mut String, segment: &str) {
    let segment = segment.trim();
    if segment.is_empty() {
        return;
    }
    if !target.is_empty()
        && (target.chars().last().is_some_and(|ch| ch.is_ascii())
            || segment.chars().next().is_some_and(|ch| ch.is_ascii()))
    {
        target.push(' ');
    }
    target.push_str(segment);
}

fn spawn_streaming_worker(
    app: AppHandle,
    samples: Arc<Mutex<Vec<i16>>>,
    sample_rate: u32,
    channels: u16,
    recognizer: Arc<OnlineRecognizer>,
    live_output: bool,
) -> (mpsc::Sender<()>, mpsc::Receiver<Result<(), String>>) {
    let (stop_tx, stop_rx) = mpsc::channel();
    let (done_tx, done_rx) = mpsc::channel();
    thread::spawn(move || {
        let result = (|| -> Result<(), String> {
            let stream: OnlineStream = recognizer.create_stream();
            let mut audio = StreamingAudio::new();
            let mut last_preview = String::new();
            let mut completed = String::new();
            loop {
                let stopping = stop_rx.try_recv().is_ok();
                let chunk = {
                    let captured = samples.lock().map_err(|_| "音频数据锁定失败")?;
                    resample_available(&captured, sample_rate, channels, &mut audio, stopping)
                };
                if !chunk.is_empty() {
                    stream.accept_waveform(16_000, &chunk);
                    while recognizer.is_ready(&stream) {
                        recognizer.decode(&stream);
                    }
                    if let Some(result) = recognizer.get_result(&stream) {
                        if live_output {
                            emit_stream_preview(&app, &mut last_preview, &result.text);
                        }
                        if recognizer.is_endpoint(&stream) {
                            let text = result.text.trim();
                            if !text.is_empty() {
                                if live_output {
                                    paste_text(text)?;
                                    emit(&app, "dictation-committed", text.to_string());
                                } else {
                                    append_segment(&mut completed, text);
                                }
                            }
                        }
                    }
                }
                if recognizer.is_endpoint(&stream) {
                    recognizer.reset(&stream);
                    last_preview.clear();
                }
                if stopping {
                    stream.input_finished();
                    while recognizer.is_ready(&stream) {
                        recognizer.decode(&stream);
                    }
                    if let Some(result) = recognizer.get_result(&stream) {
                        let text = result.text.trim();
                        if !text.is_empty() {
                            if live_output {
                                paste_text(text)?;
                                emit(&app, "dictation-committed", text.to_string());
                            } else {
                                append_segment(&mut completed, text);
                            }
                        }
                    }
                    if !live_output && !completed.is_empty() {
                        paste_text(&completed)?;
                        emit(&app, "dictation-committed", completed);
                    }
                    break;
                }
                thread::sleep(Duration::from_millis(80));
            }
            Ok(())
        })();
        let _ = done_tx.send(result);
    });
    (stop_tx, done_rx)
}

fn start_recording(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    let mut recorder_slot = state.recorder.lock().map_err(|_| "录音状态锁定失败")?;
    if recorder_slot.is_some() {
        return Ok(());
    }

    let settings = state.settings.lock().map_err(|_| "设置锁定失败")?.clone();
    let streaming_recognizer = if settings.engine == "local" && settings.local_mode == "streaming" {
        Some(get_streaming_recognizer(app, &settings)?)
    } else {
        None
    };

    let host = cpal::default_host();
    let device = host.default_input_device().ok_or("找不到默认麦克风")?;
    let supported = device
        .default_input_config()
        .map_err(|e| format!("无法读取麦克风配置：{e}"))?;
    let sample_format = supported.sample_format();
    let config: cpal::StreamConfig = supported.into();
    let sample_rate = config.sample_rate.0;
    let channels = config.channels.max(1);
    let (stop_tx, stop_rx) = mpsc::channel();
    let (done_tx, done_rx) = mpsc::channel();
    let (max_stop_tx, max_stop_rx) = mpsc::channel();
    let started_at = Instant::now();
    let watchdog_app = app.clone();
    let watchdog_started_at = started_at;
    thread::spawn(move || {
        if max_stop_rx.recv_timeout(MAX_RECORDING_TIME).is_err() {
            let should_finish = watchdog_app
                .state::<AppState>()
                .recorder
                .lock()
                .ok()
                .and_then(|recorder| {
                    recorder
                        .as_ref()
                        .map(|rec| rec.started_at == watchdog_started_at)
                })
                .unwrap_or(false);
            if should_finish {
                finish_dictation(watchdog_app);
            }
        }
    });
    let samples = Arc::new(Mutex::new(Vec::<i16>::new()));
    let worker_samples = Arc::clone(&samples);
    let worker_app = app.clone();
    thread::spawn(move || {
        let result = (|| -> Result<(), String> {
            let captured = Arc::clone(&worker_samples);
            let error_callback = |error| eprintln!("audio stream error: {error}");
            let stream = match sample_format {
                cpal::SampleFormat::I16 => device.build_input_stream(
                    &config,
                    move |data: &[i16], _| {
                        if let Ok(mut target) = captured.lock() {
                            target.extend(data.iter().copied());
                        }
                    },
                    error_callback,
                    None,
                ),
                cpal::SampleFormat::U16 => device.build_input_stream(
                    &config,
                    move |data: &[u16], _| {
                        if let Ok(mut target) = captured.lock() {
                            target
                                .extend(data.iter().map(|&sample| (sample as i32 - 32768) as i16));
                        }
                    },
                    error_callback,
                    None,
                ),
                cpal::SampleFormat::F32 => device.build_input_stream(
                    &config,
                    move |data: &[f32], _| {
                        if let Ok(mut target) = captured.lock() {
                            target.extend(
                                data.iter()
                                    .map(|&sample| (sample.clamp(-1.0, 1.0) * 32767.0) as i16),
                            );
                        }
                    },
                    error_callback,
                    None,
                ),
                format => return Err(format!("不支持的麦克风格式：{format:?}")),
            }
            .map_err(|e| format!("无法打开麦克风：{e}"))?;
            stream.play().map_err(|e| format!("无法开始录音：{e}"))?;
            let _ = stop_rx.recv();
            drop(stream);
            Ok(())
        })();
        if let Err(error) = result {
            if let Ok(mut slot) = worker_app.state::<AppState>().recorder.lock() {
                slot.take();
            }
            emit(&worker_app, "dictation-error", error);
        }
        let _ = done_tx.send(());
    });
    let (streaming_stop, streaming_done) = streaming_recognizer
        .map(|recognizer| {
            spawn_streaming_worker(
                app.clone(),
                Arc::clone(&samples),
                sample_rate,
                channels,
                recognizer,
                settings.output_mode == "streaming",
            )
        })
        .map_or((None, None), |(stop, done)| (Some(stop), Some(done)));
    *recorder_slot = Some(Recorder {
        stop: stop_tx,
        done: done_rx,
        max_stop: max_stop_tx,
        started_at,
        samples,
        sample_rate,
        channels,
        streaming_stop,
        streaming_done,
    });
    show_overlay(app);
    emit(app, "dictation-state", "recording");
    Ok(())
}

struct StoppedRecording {
    path: PathBuf,
    streaming_result: Option<Result<(), String>>,
}

fn stop_recording(app: &AppHandle) -> Result<StoppedRecording, String> {
    let recorder = app
        .state::<AppState>()
        .recorder
        .lock()
        .map_err(|_| "录音状态锁定失败")?
        .take()
        .ok_or("当前没有录音")?;
    let Recorder {
        stop,
        done,
        max_stop,
        started_at: _,
        samples,
        sample_rate,
        channels,
        streaming_stop,
        streaming_done,
    } = recorder;
    let _ = max_stop.send(());
    let _ = stop.send(());
    let _ = done.recv_timeout(Duration::from_millis(500));
    let samples = samples.lock().map_err(|_| "音频数据锁定失败")?.clone();
    let streaming_result = streaming_stop.and_then(|stop| {
        let _ = stop.send(());
        streaming_done.and_then(|done| done.recv_timeout(Duration::from_secs(3)).ok())
    });
    if samples.is_empty() {
        return Err("没有录到声音，请检查麦克风权限".into());
    }

    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let path = std::env::temp_dir().join(format!("mouse-dictation-{stamp}.wav"));
    let samples = normalize_audio(&samples, sample_rate, channels);
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate: 16_000,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let mut writer =
        hound::WavWriter::create(&path, spec).map_err(|e| format!("无法写入录音：{e}"))?;
    for sample in samples {
        writer
            .write_sample(sample)
            .map_err(|e| format!("无法写入录音：{e}"))?;
    }
    writer
        .finalize()
        .map_err(|e| format!("无法完成录音：{e}"))?;
    Ok(StoppedRecording {
        path,
        streaming_result,
    })
}

fn cancel_recording(app: &AppHandle) -> Result<bool, String> {
    let recorder = app
        .state::<AppState>()
        .recorder
        .lock()
        .map_err(|_| "录音状态锁定失败")?
        .take();
    let Some(Recorder {
        stop,
        done,
        max_stop,
        streaming_stop,
        streaming_done,
        ..
    }) = recorder
    else {
        return Ok(false);
    };
    let _ = max_stop.send(());
    let _ = stop.send(());
    let _ = done.recv_timeout(Duration::from_millis(500));
    if let Some(stop) = streaming_stop {
        let _ = stop.send(());
        if let Some(done) = streaming_done {
            let _ = done.recv_timeout(Duration::from_secs(3));
        }
    }
    hide_overlay(app);
    emit(app, "dictation-state", "cancelled");
    Ok(true)
}

fn normalize_audio(samples: &[i16], sample_rate: u32, channels: u16) -> Vec<i16> {
    let channels = channels.max(1) as usize;
    let frames = samples.len() / channels;
    if frames == 0 {
        return Vec::new();
    }

    let mono: Vec<f32> = (0..frames)
        .map(|frame| {
            let start = frame * channels;
            let sum: f32 = samples[start..start + channels]
                .iter()
                .map(|sample| *sample as f32)
                .sum();
            sum / channels as f32
        })
        .collect();

    if sample_rate == 16_000 {
        return mono.into_iter().map(|sample| sample as i16).collect();
    }

    let output_len = ((frames as u64 * 16_000) / sample_rate.max(1) as u64).max(1) as usize;
    (0..output_len)
        .map(|index| {
            let position = index as f64 * sample_rate as f64 / 16_000.0;
            let left = position.floor() as usize;
            let right = (left + 1).min(mono.len() - 1);
            let fraction = (position - left as f64) as f32;
            (mono[left.min(mono.len() - 1)] * (1.0 - fraction) + mono[right] * fraction) as i16
        })
        .collect()
}

fn normalize_api_key(value: &str) -> String {
    let value = value.trim().trim_matches(['"', '\'']).trim();
    let value = value
        .strip_prefix("Bearer ")
        .or_else(|| value.strip_prefix("bearer "))
        .unwrap_or(value)
        .trim();
    value.trim_matches(['"', '\'']).trim().to_string()
}

fn api_model_id(model: &serde_json::Value) -> Option<&str> {
    if let Some(id) = model.as_str() {
        return Some(id);
    }
    ["id", "model", "name"]
        .iter()
        .find_map(|key| model.get(*key).and_then(serde_json::Value::as_str))
}

fn is_speech_to_text_model(model: &serde_json::Value, id: &str) -> bool {
    let text = format!("{} {}", id, model).to_lowercase();
    [
        "whisper",
        "asr",
        "transcrib",
        "speech_to_text",
        "speech-to-text",
        "sensevoice",
        "paraformer",
        "funaudio",
        "wav2vec",
        "zipformer",
    ]
    .iter()
    .any(|term| text.contains(term))
}

fn api_error_message(status: reqwest::StatusCode, body: &str, fallback: &str) -> String {
    let message = serde_json::from_str::<serde_json::Value>(body)
        .ok()
        .and_then(|json| {
            json.get("error")
                .and_then(|error| {
                    error
                        .get("message")
                        .and_then(serde_json::Value::as_str)
                        .or_else(|| error.as_str())
                })
                .or_else(|| json.get("message").and_then(serde_json::Value::as_str))
                .map(str::trim)
                .filter(|message| !message.is_empty())
                .map(str::to_string)
        });
    if let Some(message) = message {
        return format!("HTTP {}：{message}", status.as_u16());
    }
    let preview: String = body.trim().chars().take(160).collect();
    if preview.is_empty() {
        format!("HTTP {}：{fallback}", status.as_u16())
    } else {
        format!("HTTP {}：{fallback}（{preview}）", status.as_u16())
    }
}

#[tauri::command]
fn fetch_api_models(base: &str, api_key: &str) -> Result<Vec<serde_json::Value>, String> {
    let base = base.trim().trim_end_matches('/');
    if base.is_empty() {
        return Err("请先填写 API Base URL".into());
    }
    let api_key = normalize_api_key(api_key);
    let url = if base.ends_with("/models") {
        base.to_string()
    } else {
        format!("{base}/models")
    };
    let client = reqwest::blocking::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| format!("创建模型客户端失败：{e}"))?;
    let request = client.get(url);
    let request = if api_key.is_empty() {
        request
    } else {
        request.bearer_auth(api_key)
    };
    let response = request
        .send()
        .map_err(|e| format!("获取模型失败：{e}"))?;
    let status = response.status();
    let body = response.text().unwrap_or_default();
    if !status.is_success() {
        return Err(api_error_message(status, &body, "获取模型失败"));
    }
    let json = serde_json::from_str::<serde_json::Value>(&body)
        .map_err(|e| format!("模型接口返回格式错误：{e}"))?;
    Ok(json
        .get("data")
        .or_else(|| json.get("models"))
        .and_then(serde_json::Value::as_array)
        .into_iter()
        .flatten()
        .cloned()
        .collect())
}

#[tauri::command]
fn list_api_models(settings: Settings, include_all: bool) -> Result<Vec<String>, String> {
    if normalize_api_key(&settings.api_key).is_empty() {
        return Err("请先填写 API Key".into());
    }
    let models = fetch_api_models(&settings.api_url, &settings.api_key)?;
    let mut ids = models
        .iter()
        .filter_map(|model| api_model_id(model).map(|id| (id, model)))
        .filter(|(id, model)| include_all || is_speech_to_text_model(model, id))
        .map(|(id, _)| id.to_string())
        .collect::<Vec<_>>();
    ids.sort_unstable();
    ids.dedup();
    Ok(ids)
}

fn translation_connection(settings: &Settings) -> (String, String, String) {
    let follow = matches!(settings.translate_api.as_str(), "follow" | "auto" | "google");
    let base = if follow {
        settings.api_url.clone()
    } else {
        settings.translate_url.clone()
    };
    let key = if follow {
        settings.api_key.clone()
    } else {
        settings.translate_key.clone()
    };
    (base, key, settings.translate_model.clone())
}

#[tauri::command]
fn list_translation_models(settings: Settings) -> Result<Vec<String>, String> {
    let (base, key, _) = translation_connection(&settings);
    let models = fetch_api_models(&base, &key)?;
    let mut ids = models
        .iter()
        .filter_map(api_model_id)
        .filter(|id| is_translation_model(id))
        .map(str::to_string)
        .collect::<Vec<_>>();
    ids.sort_unstable();
    ids.dedup();
    Ok(ids)
}

fn transcribe(path: &Path, settings: &Settings) -> Result<String, String> {
    let api_key = normalize_api_key(&settings.api_key);
    if api_key.is_empty() {
        return Err(
            "当前使用付费 API，但没有填写识别 API Key。请到“识别”→“付费 API”填写；如果想离线使用，请切换到“本地离线”并下载模型。".into(),
        );
    }
    let base = settings.api_url.trim_end_matches('/');
    let url = if base.ends_with("/audio/transcriptions") {
        base.to_string()
    } else {
        format!("{base}/audio/transcriptions")
    };
    let file =
        reqwest::blocking::multipart::Part::file(path).map_err(|e| format!("读取录音失败：{e}"))?;
    let mut form = reqwest::blocking::multipart::Form::new()
        .text("model", settings.model.clone())
        .text("temperature", "0")
        .text(
            "prompt",
            match settings.online_language.as_str() {
                "zh" => "中文语音转写，自然标点。",
                "en" => "English speech transcription, natural punctuation.",
                "ja" => "日本語の音声文字起こし。自然な句読点。",
                "ko" => "한국어 음성 전사, 자연스러운 문장 부호.",
                _ => "Speech transcription with natural punctuation.",
            },
        )
        .part("file", file);
    if settings.online_language != "auto" {
        form = form.text("language", settings.online_language.clone());
    }
    let response = reqwest::blocking::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(90))
        .build()
        .map_err(|e| format!("创建转写客户端失败：{e}"))?
        .post(url)
        .bearer_auth(api_key)
        .multipart(form)
        .send()
        .map_err(|e| format!("请求转写接口失败：{e}"))?;
    let status = response.status();
    let body_text = response.text().unwrap_or_default();
    if !status.is_success() {
        return Err(api_error_message(status, &body_text, "转写接口返回错误"));
    }
    let body: serde_json::Value =
        serde_json::from_str(&body_text).map_err(|e| format!("接口返回格式错误：{e}"))?;
    body.get("text")
        .and_then(|text| text.as_str())
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(str::to_string)
        .ok_or("没有识别到文字".into())
}

#[tauri::command]
fn test_api(settings: Settings) -> Result<String, String> {
    let base = settings.api_url.trim().trim_end_matches('/');
    if base.is_empty() {
        return Err("请先填写 API Base URL".into());
    }
    let api_key = normalize_api_key(&settings.api_key);
    if api_key.is_empty() {
        return Err(
            "当前使用付费 API，请先填写识别 API Key；也可以切换到“本地离线”使用本地模型".into(),
        );
    }
    let url = if base.ends_with("/models") {
        base.to_string()
    } else {
        format!("{base}/models")
    };
    let response = reqwest::blocking::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| format!("创建测试客户端失败：{e}"))?
        .get(url)
        .bearer_auth(api_key)
        .send()
        .map_err(|e| format!("连接 API 失败：{e}"))?;
    let status = response.status();
    let body = response.text().unwrap_or_default();
    if !status.is_success() {
        return Err(api_error_message(status, &body, "连接 API 失败"));
    }
    Ok(format!("连接成功 · HTTP {}", status.as_u16()))
}

fn lang_name(code: &str) -> &str {
    match code {
        "zh" => "中文（普通话）",
        "en" => "英文",
        "ja" => "日语",
        "ko" => "韩语",
        "fr" => "法语",
        "de" => "德语",
        "es" => "西班牙语",
        "ru" => "俄语",
        "pt" => "葡萄牙语",
        "it" => "意大利语",
        "nl" => "荷兰语",
        "pl" => "波兰语",
        "tr" => "土耳其语",
        "ar" => "阿拉伯语",
        "hi" => "印地语",
        "id" => "印尼语",
        "th" => "泰语",
        "vi" => "越南语",
        "uk" => "乌克兰语",
        "fa" => "波斯语",
        "he" => "希伯来语",
        "sv" => "瑞典语",
        "da" => "丹麦语",
        "fi" => "芬兰语",
        "no" => "挪威语",
        _ => "英文",
    }
}

fn chat_translate(
    base: &str,
    api_key: &str,
    model: &str,
    text: &str,
    target: &str,
) -> Result<String, String> {
    let api_key = normalize_api_key(api_key);
    if base.trim().is_empty() {
        return Err("翻译需要 API Base URL".into());
    }
    let body = serde_json::json!({
        "model": model,
        "temperature": 0.2,
        "messages": [
            {
                "role": "system",
                "content": format!(
                    "你是专业译员。把用户输入的语音转写文本翻译成{}。保留原意与语气，不要解释、不要注音，只输出译文。",
                    lang_name(target)
                )
            },
            { "role": "user", "content": text }
        ]
    });
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;
    let request = client.post(format!("{base}/chat/completions"));
    let request = if api_key.is_empty() {
        request
    } else {
        request.bearer_auth(api_key)
    };
    let response = request
        .json(&body)
        .send()
        .map_err(|e| format!("请求翻译接口失败：{e}"))?;
    let status = response.status();
    let body_text = response.text().unwrap_or_default();
    if !status.is_success() {
        return Err(api_error_message(status, &body_text, "翻译接口返回错误"));
    }
    let parsed: serde_json::Value =
        serde_json::from_str(&body_text).map_err(|e| format!("翻译接口返回格式错误：{e}"))?;
    parsed
        .get("choices")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .map(str::trim)
        .filter(|c| !c.is_empty())
        .map(str::to_string)
        .ok_or("翻译没有返回结果".into())
}

fn is_translation_model(id: &str) -> bool {
    let id = id.to_ascii_lowercase();
    ![
        "whisper",
        "asr",
        "transcrib",
        "speech",
        "audio",
        "sensevoice",
        "paraformer",
        "funaudio",
        "wav2vec",
        "zipformer",
        "tts",
        "embedding",
        "rerank",
        "moderation",
        "safety",
        "guard",
        "image",
        "vision",
    ]
    .iter()
    .all(|term| !id.contains(term))
}

fn translation_model_candidates(
    base: &str,
    api_key: &str,
    configured: &str,
) -> Result<Vec<String>, String> {
    let models = fetch_api_models(base, api_key)?;
    let mut ids = models
        .iter()
        .filter_map(api_model_id)
        .filter(|id| is_translation_model(id))
        .map(str::to_string)
        .collect::<Vec<_>>();
    ids.dedup();
    if !configured.trim().is_empty() {
        ids.sort_by_key(|id| if id == configured.trim() { 0 } else { 1 });
    }
    Ok(ids)
}

fn translate_with_available_model(
    base: &str,
    api_key: &str,
    configured: &str,
    text: &str,
    target: &str,
) -> Result<String, String> {
    let configured = configured.trim();
    if !configured.is_empty() {
        match chat_translate(base, api_key, configured, text, target) {
            Ok(result) => return Ok(result),
            Err(error) if !error.contains("HTTP 400") && !error.contains("HTTP 404") => {
                return Err(error)
            }
            Err(_) => {}
        }
    }

    let candidates = translation_model_candidates(base, api_key, configured)
        .map_err(|error| format!("翻译模型不可用，且无法获取当前模型列表：{error}"))?;
    let mut last_error = String::from("接口没有提供可用的文本模型");
    for model in candidates {
        if model == configured {
            continue;
        }
        match chat_translate(base, api_key, &model, text, target) {
            Ok(result) => return Ok(result),
            Err(error) => last_error = format!("{model}: {error}"),
        }
    }
    Err(format!("翻译模型不可用：{last_error}。请点击“获取模型”后选择可用的文本模型"))
}

fn translate_text(text: &str, settings: &Settings) -> Result<String, String> {
    let model = settings.translate_model.trim();
    match settings.translate_api.as_str() {
        "follow" | "auto" | "google" => translate_with_available_model(
            settings.api_url.trim().trim_end_matches('/'),
            &settings.api_key,
            model,
            text,
            &settings.translate_target,
        ),
        "custom" | "deepseek" | "zhipu" | "dashscope" | "siliconflow" | "groq" | "openai" => translate_with_available_model(
            settings.translate_url.trim().trim_end_matches('/'),
            &settings.translate_key,
            model,
            text,
            &settings.translate_target,
        ),
        _ => Err("请先选择翻译通道".into()),
    }
}

#[tauri::command]
fn test_translation_api(settings: Settings) -> Result<String, String> {
    let (base, key, model) = translation_connection(&settings);
    let translated = translate_with_available_model(
        base.trim().trim_end_matches('/'),
        &key,
        model.trim(),
        "This is a translation test.",
        &settings.translate_target,
    )?;
    if translated.trim().is_empty() {
        return Err("翻译接口没有返回结果".into());
    }
    Ok("连接成功 · 翻译接口可用".into())
}

fn transcribe_local(app: &AppHandle, path: &Path, settings: &Settings) -> Result<String, String> {
    let model_dir = PathBuf::from(settings.local_model_dir.trim());
    if !model_ready_for_mode(&settings.local_mode, &model_dir) {
        return Err(format!(
            "本地模型不完整，请在“模型”选项卡重新下载：{}",
            model_dir.display()
        ));
    }

    let filename = path.to_str().ok_or("本地音频路径不是有效的 UTF-8")?;
    let wave = Wave::read(filename).ok_or("读取本地音频失败")?;
    let mut config = OfflineRecognizerConfig::default();
    if settings.local_mode == "whisper" {
        config.model_config.whisper = OfflineWhisperModelConfig {
            encoder: Some(
                model_dir
                    .join("small-encoder.int8.onnx")
                    .to_string_lossy()
                    .into_owned(),
            ),
            decoder: Some(
                model_dir
                    .join("small-decoder.int8.onnx")
                    .to_string_lossy()
                    .into_owned(),
            ),
            language: Some(if settings.local_language == "auto" {
                String::new()
            } else {
                settings.local_language.clone()
            }),
            task: Some("transcribe".into()),
            tail_paddings: -1,
            enable_token_timestamps: false,
            enable_segment_timestamps: false,
        };
        config.model_config.tokens = Some(
            model_dir
                .join("small-tokens.txt")
                .to_string_lossy()
                .into_owned(),
        );
    } else {
        config.model_config.sense_voice = OfflineSenseVoiceModelConfig {
            model: Some(
                model_dir
                    .join("model.int8.onnx")
                    .to_string_lossy()
                    .into_owned(),
            ),
            language: Some(settings.local_language.clone()),
            use_itn: true,
        };
        config.model_config.tokens =
            Some(model_dir.join("tokens.txt").to_string_lossy().into_owned());
    }
    let cache_key = format!("{}::{}", settings.local_mode, model_dir.to_string_lossy());
    let app_state = app.state::<AppState>();
    let mut cache = app_state
        .local_recognizer
        .lock()
        .map_err(|_| "本地模型状态锁定失败")?;
    if cache
        .as_ref()
        .map(|cached| cached.model_dir != cache_key)
        .unwrap_or(true)
    {
        let recognizer = OfflineRecognizer::create(&config).ok_or("加载本地模型失败")?;
        *cache = Some(LocalRecognizerCache {
            model_dir: cache_key,
            recognizer,
        });
    }
    let recognizer = &cache.as_ref().expect("本地模型缓存刚刚创建").recognizer;
    let stream = recognizer.create_stream();
    stream.accept_waveform(wave.sample_rate(), wave.samples());
    recognizer.decode(&stream);
    stream
        .get_result()
        .map(|result| result.text.trim().to_string())
        .filter(|text| !text.is_empty())
        .ok_or("本地模型没有识别到文字".into())
}

fn paste_text(text: &str) -> Result<(), String> {
    let mut clipboard = Clipboard::new().map_err(|e| format!("无法访问剪贴板：{e}"))?;
    let previous_text = clipboard.get_text().ok();
    clipboard
        .set_text(text)
        .map_err(|e| format!("无法写入剪贴板：{e}"))?;
    let modifier = if cfg!(target_os = "macos") {
        Key::MetaLeft
    } else {
        Key::ControlLeft
    };
    let result = (|| -> Result<(), String> {
        simulate(&EventType::KeyPress(modifier)).map_err(|e| format!("无法模拟粘贴：{e:?}"))?;
        simulate(&EventType::KeyPress(Key::KeyV)).map_err(|e| format!("无法模拟粘贴：{e:?}"))?;
        thread::sleep(PASTE_SETTLE_TIME);
        Ok(())
    })();
    let _ = simulate(&EventType::KeyRelease(Key::KeyV));
    let _ = simulate(&EventType::KeyRelease(modifier));
    if let Some(previous_text) = previous_text {
        let _ = clipboard.set_text(previous_text);
    }
    result
}

fn finish_dictation(app: AppHandle) {
    emit(&app, "dictation-state", "processing");
    let result = stop_recording(&app).and_then(|recording| {
        let settings = app
            .state::<AppState>()
            .settings
            .lock()
            .map_err(|_| "设置锁定失败")?
            .clone();
        let result = if settings.engine == "local" && settings.local_mode == "streaming" {
            recording
                .streaming_result
                .unwrap_or_else(|| Err("实时识别线程没有返回结果".into()))
        } else {
            let text = if settings.engine == "local" {
                transcribe_local(&app, &recording.path, &settings)
            } else {
                transcribe(&recording.path, &settings)
            };
            let text = text.and_then(|text| {
                let need_api_translate = settings.translate_on
                    && !(settings.engine == "local" && settings.local_mode == "streaming");
                if need_api_translate {
                    emit(&app, "dictation-state", "translating");
                    translate_text(&text, &settings)
                } else {
                    Ok(text)
                }
            });
            text.and_then(|text| paste_text(&text).map(|_| ()))
        };
        let _ = fs::remove_file(recording.path);
        result
    });
    match result {
        Ok(_) => emit(&app, "dictation-state", "done"),
        Err(error) if error == "当前没有录音" => {}
        Err(error) => emit(&app, "dictation-error", error),
    }
    hide_overlay(&app);
}

fn update_modifier_state(state: &mut MouseSession, key: Key, pressed: bool) {
    match key {
        Key::ControlLeft | Key::ControlRight => state.ctrl_down = pressed,
        Key::Alt | Key::AltGr => state.alt_down = pressed,
        Key::ShiftLeft | Key::ShiftRight => state.shift_down = pressed,
        Key::MetaLeft | Key::MetaRight => state.meta_down = pressed,
        _ => {}
    }
}

fn hotkey_matches(
    hotkey: &str,
    ctrl_down: bool,
    alt_down: bool,
    shift_down: bool,
    meta_down: bool,
    key: Key,
) -> bool {
    let Some(spec) = parse_hotkey(hotkey) else {
        return false;
    };
    let primary_down = if cfg!(target_os = "macos") {
        meta_down
    } else {
        ctrl_down
    };
    (!spec.primary || primary_down)
        && (!spec.ctrl || ctrl_down)
        && (!spec.alt || alt_down)
        && (!spec.shift || shift_down)
        && (!spec.meta || meta_down)
        && key == spec.key
}

fn hotkey_part(hotkey: &str, key: Key) -> bool {
    let Some(spec) = parse_hotkey(hotkey) else {
        return false;
    };
    let primary_key = if cfg!(target_os = "macos") {
        matches!(key, Key::MetaLeft | Key::MetaRight)
    } else {
        matches!(key, Key::ControlLeft | Key::ControlRight)
    };
    key == spec.key
        || (spec.primary && primary_key)
        || (spec.ctrl && matches!(key, Key::ControlLeft | Key::ControlRight))
        || (spec.alt && matches!(key, Key::Alt | Key::AltGr))
        || (spec.shift && matches!(key, Key::ShiftLeft | Key::ShiftRight))
        || (spec.meta && matches!(key, Key::MetaLeft | Key::MetaRight))
}

fn spawn_mouse_listener(app: AppHandle) {
    thread::spawn(move || {
        let session = Arc::new(Mutex::new(MouseSession {
            token: 0,
            pressed: false,
            triggered: false,
            hotkey_pressed: false,
            engine_toggle_pressed: false,
            translate_toggle_pressed: false,
            ctrl_down: false,
            alt_down: false,
            shift_down: false,
            meta_down: false,
            start_x: 0.0,
            start_y: 0.0,
            last_x: 0.0,
            last_y: 0.0,
        }));
        let listener_session = Arc::clone(&session);
        let listener_app = app.clone();
        let callback = move |event: Event| match event.event_type {
            EventType::ButtonPress(Button::Left) => {
                let (token, hold_ms) = {
                    let mut state = listener_session.lock().unwrap();
                    state.token += 1;
                    state.pressed = true;
                    state.triggered = false;
                    state.start_x = state.last_x;
                    state.start_y = state.last_y;
                    (
                        state.token,
                        listener_app
                            .state::<AppState>()
                            .settings
                            .lock()
                            .unwrap()
                            .hold_ms,
                    )
                };
                let timer_session = Arc::clone(&listener_session);
                let timer_app = listener_app.clone();
                thread::spawn(move || {
                    thread::sleep(Duration::from_millis(hold_ms));
                    let should_start = {
                        let mut state = timer_session.lock().unwrap();
                        if state.pressed && state.token == token && !state.triggered {
                            state.triggered = true;
                            true
                        } else {
                            false
                        }
                    };
                    if should_start {
                        if let Err(error) = start_recording(&timer_app) {
                            emit(&timer_app, "dictation-error", error);
                        }
                    }
                });
            }
            EventType::MouseMove { x, y } => {
                if listener_app
                    .state::<AppState>()
                    .recorder
                    .lock()
                    .map(|recorder| recorder.is_some())
                    .unwrap_or(false)
                {
                    position_overlay_at_cursor(&listener_app);
                }
                let mut state = listener_session.lock().unwrap();
                state.last_x = x;
                state.last_y = y;
                if state.pressed
                    && !state.triggered
                    && ((x - state.start_x).abs() + (y - state.start_y).abs() > 12.0)
                {
                    state.pressed = false;
                    state.token += 1;
                }
            }
            EventType::ButtonRelease(Button::Left) => {
                let should_finish = {
                    let mut state = listener_session.lock().unwrap();
                    let value = state.pressed && state.triggered;
                    state.pressed = false;
                    state.triggered = false;
                    state.token += 1;
                    value
                };
                if should_finish {
                    let finish_app = listener_app.clone();
                    thread::spawn(move || finish_dictation(finish_app));
                }
            }
            EventType::KeyPress(key) => {
                if key == Key::Escape {
                    let has_recording = listener_app
                        .state::<AppState>()
                        .recorder
                        .lock()
                        .map(|recorder| recorder.is_some())
                        .unwrap_or(false);
                    if has_recording {
                        listener_session.lock().unwrap().hotkey_pressed = false;
                        let cancel_app = listener_app.clone();
                        thread::spawn(move || {
                            if let Err(error) = cancel_recording(&cancel_app) {
                                emit(&cancel_app, "dictation-error", error);
                            }
                        });
                        return;
                    }
                }
                let (hotkey, engine_hotkey, translate_hotkey) = listener_app
                    .state::<AppState>()
                    .settings
                    .lock()
                    .map(|settings| {
                        (
                            settings.hotkey.clone(),
                            settings.engine_hotkey.clone(),
                            settings.translate_hotkey.clone(),
                        )
                    })
                    .unwrap_or_else(|_| ("disabled".into(), "disabled".into(), "disabled".into()));
                let should_start = {
                    let mut state = listener_session.lock().unwrap();
                    update_modifier_state(&mut state, key, true);
                    if !state.engine_toggle_pressed
                        && hotkey_matches(
                            &engine_hotkey,
                            state.ctrl_down,
                            state.alt_down,
                            state.shift_down,
                            state.meta_down,
                            key,
                        )
                    {
                        state.engine_toggle_pressed = true;
                        true
                    } else {
                        false
                    }
                };
                if should_start {
                    let toggle_app = listener_app.clone();
                    thread::spawn(move || {
                        if let Err(error) = toggle_engine(&toggle_app) {
                            emit(&toggle_app, "dictation-error", error);
                        }
                    });
                    return;
                }
                let should_toggle_translation = {
                    let mut state = listener_session.lock().unwrap();
                    if !state.translate_toggle_pressed
                        && hotkey_matches(
                            &translate_hotkey,
                            state.ctrl_down,
                            state.alt_down,
                            state.shift_down,
                            state.meta_down,
                            key,
                        )
                    {
                        state.translate_toggle_pressed = true;
                        true
                    } else {
                        false
                    }
                };
                if should_toggle_translation {
                    let toggle_app = listener_app.clone();
                    thread::spawn(move || {
                        if let Err(error) = toggle_translation(&toggle_app) {
                            emit(&toggle_app, "dictation-error", error);
                        }
                    });
                    return;
                }
                let should_start = {
                    let mut state = listener_session.lock().unwrap();
                    if !state.hotkey_pressed
                        && hotkey_matches(
                            &hotkey,
                            state.ctrl_down,
                            state.alt_down,
                            state.shift_down,
                            state.meta_down,
                            key,
                        )
                    {
                        state.hotkey_pressed = true;
                        true
                    } else {
                        false
                    }
                };
                if should_start {
                    let hotkey_app = listener_app.clone();
                    thread::spawn(move || {
                        if let Err(error) = start_recording(&hotkey_app) {
                            emit(&hotkey_app, "dictation-error", error);
                        }
                    });
                }
            }
            EventType::KeyRelease(key) => {
                let (hotkey, engine_hotkey, translate_hotkey) = listener_app
                    .state::<AppState>()
                    .settings
                    .lock()
                    .map(|settings| {
                        (
                            settings.hotkey.clone(),
                            settings.engine_hotkey.clone(),
                            settings.translate_hotkey.clone(),
                        )
                    })
                    .unwrap_or_else(|_| ("disabled".into(), "disabled".into(), "disabled".into()));
                let should_finish = {
                    let mut state = listener_session.lock().unwrap();
                    if hotkey_part(&engine_hotkey, key) {
                        state.engine_toggle_pressed = false;
                    }
                    if hotkey_part(&translate_hotkey, key) {
                        state.translate_toggle_pressed = false;
                    }
                    let value = state.hotkey_pressed && hotkey_part(&hotkey, key);
                    if value {
                        state.hotkey_pressed = false;
                    }
                    update_modifier_state(&mut state, key, false);
                    value
                };
                if should_finish {
                    let finish_app = listener_app.clone();
                    thread::spawn(move || finish_dictation(finish_app));
                }
            }
            _ => {}
        };
        if let Err(error) = listen(callback) {
            emit(
                &app,
                "dictation-error",
                format!("鼠标监听启动失败：{error:?}"),
            );
        }
    });
}

fn current_quick_profile(settings: &Settings) -> &'static str {
    if !settings.translate_on {
        "profile:plain"
    } else {
        match settings.translate_target.as_str() {
            "en" => "profile:en",
            "fr" => "profile:fr",
            "ja" => "profile:ja",
            "de" => "profile:de",
            "es" => "profile:es",
            "pt" => "profile:pt",
            "it" => "profile:it",
            "nl" => "profile:nl",
            "ru" => "profile:ru",
            "zh" => "profile:zh",
            "ko" => "profile:ko",
            "ar" => "profile:ar",
            "hi" => "profile:hi",
            "th" => "profile:th",
            _ => "profile:none",
        }
    }
}

fn commit_runtime_settings<R: Runtime>(
    app: &AppHandle<R>,
    settings: Settings,
) -> Result<(), String> {
    let state = app.state::<AppState>();
    save_settings_file(&settings)?;
    if let Some(active_id) = state.active_profile.lock().unwrap().clone() {
        let mut profiles = state.profiles.lock().map_err(|_| "方案锁定失败")?;
        if let Some(profile) = profiles.iter_mut().find(|profile| profile.id == active_id) {
            profile.settings = settings.clone();
            save_profiles_file(&profiles)?;
        }
    }
    *state.settings.lock().map_err(|_| "设置锁定失败")? = settings.clone();
    emit(app, "settings-changed", settings.clone());
    refresh_tray_menu(app, &settings)?;
    Ok(())
}

fn apply_engine<R: Runtime>(app: &AppHandle<R>, engine: &str) -> Result<(), String> {
    let settings = {
        let state = app.state::<AppState>();
        let mut settings = state.settings.lock().map_err(|_| "设置锁定失败")?;
        match engine {
            "online" => {
                if normalize_api_key(&settings.api_key).is_empty() {
                    return Err("请先填写付费 API 的 API Key".into());
                }
            }
            "local" => {
                let model_dir = PathBuf::from(settings.local_model_dir.trim());
                if !model_ready_for_mode(&settings.local_mode, &model_dir) {
                    return Err("本地模型尚未准备好，请先下载并选择模型".into());
                }
            }
            _ => return Err("未知的识别方式".into()),
        }
        settings.engine = engine.into();
        if engine == "online" {
            settings.output_mode = "final".into();
        }
        if engine == "local" && settings.local_mode == "streaming" {
            settings.translate_on = false;
        }
        settings.clone()
    };
    commit_runtime_settings(app, settings)
}

fn toggle_translation<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let settings = {
        let state = app.state::<AppState>();
        let mut settings = state.settings.lock().map_err(|_| "设置锁定失败")?;
        if settings.engine == "local" && settings.local_mode == "streaming" {
            return Err("本地流式模式暂不支持自动翻译".into());
        }
        settings.translate_on = !settings.translate_on;
        settings.clone()
    };
    commit_runtime_settings(app, settings)
}

fn toggle_engine<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let next = {
        let state = app.state::<AppState>();
        let settings = state.settings.lock().map_err(|_| "设置锁定失败")?;
        if settings.engine == "local" {
            "online"
        } else {
            "local"
        }
    };
    apply_engine(app, next)
}

fn tray_menu<R: Runtime, M: Manager<R>>(
    manager: &M,
    settings: &Settings,
    profiles: &[ProfileSummary],
    locale: &str,
) -> tauri::Result<Menu<R>> {
    let labels = tray_labels(locale);
    let online_engine = CheckMenuItemBuilder::with_id("engine:online", labels.paid_api)
        .checked(settings.engine != "local")
        .build(manager)?;
    let local_engine = CheckMenuItemBuilder::with_id("engine:local", labels.local_offline)
        .checked(settings.engine == "local")
        .build(manager)?;
    let engines = SubmenuBuilder::with_id(manager, "recognition-engine", labels.recognition_mode)
        .items(&[&online_engine, &local_engine])
        .build()?;
    let current = current_quick_profile(settings);
    let plain = CheckMenuItemBuilder::with_id("profile:plain", labels.transcribe_only)
        .checked(current == "profile:plain")
        .build(manager)?;
    let english = CheckMenuItemBuilder::with_id("profile:en", "English")
        .checked(current == "profile:en")
        .build(manager)?;
    let french = CheckMenuItemBuilder::with_id("profile:fr", "Français")
        .checked(current == "profile:fr")
        .build(manager)?;
    let japanese = CheckMenuItemBuilder::with_id("profile:ja", "日本語")
        .checked(current == "profile:ja")
        .build(manager)?;
    let german = CheckMenuItemBuilder::with_id("profile:de", "Deutsch")
        .checked(current == "profile:de")
        .build(manager)?;
    let spanish = CheckMenuItemBuilder::with_id("profile:es", "Español")
        .checked(current == "profile:es")
        .build(manager)?;
    let portuguese = CheckMenuItemBuilder::with_id("profile:pt", "Português")
        .checked(current == "profile:pt")
        .build(manager)?;
    let italian = CheckMenuItemBuilder::with_id("profile:it", "Italiano")
        .checked(current == "profile:it")
        .build(manager)?;
    let dutch = CheckMenuItemBuilder::with_id("profile:nl", "Nederlands")
        .checked(current == "profile:nl")
        .build(manager)?;
    let russian = CheckMenuItemBuilder::with_id("profile:ru", "Русский")
        .checked(current == "profile:ru")
        .build(manager)?;
    let chinese = CheckMenuItemBuilder::with_id("profile:zh", "中文")
        .checked(current == "profile:zh")
        .build(manager)?;
    let korean = CheckMenuItemBuilder::with_id("profile:ko", "한국어")
        .checked(current == "profile:ko")
        .build(manager)?;
    let arabic = CheckMenuItemBuilder::with_id("profile:ar", "العربية")
        .checked(current == "profile:ar")
        .build(manager)?;
    let hindi = CheckMenuItemBuilder::with_id("profile:hi", "हिन्दी")
        .checked(current == "profile:hi")
        .build(manager)?;
    let thai = CheckMenuItemBuilder::with_id("profile:th", "ไทย")
        .checked(current == "profile:th")
        .build(manager)?;

    let translations = SubmenuBuilder::with_id(
        manager,
        "translation-languages",
        labels.translation_languages,
    )
    .items(&[
            &english,
            &french,
            &japanese,
            &german,
            &spanish,
            &portuguese,
            &italian,
            &dutch,
            &russian,
            &chinese,
            &korean,
            &arabic,
            &hindi,
            &thai,
        ])
        .build()?;

    let mut builder = MenuBuilder::new(manager)
        .item(&engines)
        .separator()
        .item(&plain)
        .item(&translations);
    if !profiles.is_empty() {
        builder = builder.separator();
        let mut saved_profiles =
            SubmenuBuilder::with_id(manager, "saved-profiles", labels.saved_profiles);
        for profile in profiles {
            let item = CheckMenuItemBuilder::with_id(
                format!("saved-profile:{}", profile.id),
                &profile.name,
            )
            .checked(profile.active)
            .build(manager)?;
            saved_profiles = saved_profiles.item(&item);
        }
        let saved_profiles = saved_profiles.build()?;
        builder = builder.item(&saved_profiles);
    }
    builder
        .separator()
        .item(&MenuItemBuilder::with_id("open-settings", labels.open_settings).build(manager)?)
        .item(&MenuItemBuilder::with_id("quit", labels.quit).build(manager)?)
        .build()
}

struct TrayLabels {
    recognition_mode: &'static str,
    paid_api: &'static str,
    local_offline: &'static str,
    transcribe_only: &'static str,
    translation_languages: &'static str,
    saved_profiles: &'static str,
    open_settings: &'static str,
    quit: &'static str,
}

fn tray_labels(locale: &str) -> TrayLabels {
    match locale {
        "en" => TrayLabels {
            recognition_mode: "Recognition mode",
            paid_api: "Paid API",
            local_offline: "Local offline",
            transcribe_only: "Transcribe only",
            translation_languages: "Translation languages",
            saved_profiles: "Saved profiles",
            open_settings: "Open settings",
            quit: "Quit Mouse Dictation",
        },
        "fr" => TrayLabels {
            recognition_mode: "Mode de reconnaissance",
            paid_api: "API payante",
            local_offline: "Hors ligne",
            transcribe_only: "Transcription uniquement",
            translation_languages: "Langues de traduction",
            saved_profiles: "Profils enregistrés",
            open_settings: "Ouvrir les paramètres",
            quit: "Quitter Mouse Dictation",
        },
        "de" => TrayLabels {
            recognition_mode: "Erkennungsmodus",
            paid_api: "Bezahlte API",
            local_offline: "Lokal offline",
            transcribe_only: "Nur transkribieren",
            translation_languages: "Übersetzungssprachen",
            saved_profiles: "Gespeicherte Profile",
            open_settings: "Einstellungen öffnen",
            quit: "Mouse Dictation beenden",
        },
        "ja" => TrayLabels {
            recognition_mode: "認識方式",
            paid_api: "有料 API",
            local_offline: "ローカル・オフライン",
            transcribe_only: "文字起こしのみ",
            translation_languages: "翻訳言語",
            saved_profiles: "保存済みプロファイル",
            open_settings: "設定を開く",
            quit: "Mouse Dictationを終了",
        },
        "es" => TrayLabels {
            recognition_mode: "Modo de reconocimiento",
            paid_api: "API de pago",
            local_offline: "Local sin conexión",
            transcribe_only: "Solo transcribir",
            translation_languages: "Idiomas de traducción",
            saved_profiles: "Perfiles guardados",
            open_settings: "Abrir configuración",
            quit: "Salir de Mouse Dictation",
        },
        "ko" => TrayLabels {
            recognition_mode: "인식 방식",
            paid_api: "유료 API",
            local_offline: "로컬 오프라인",
            transcribe_only: "전사만",
            translation_languages: "번역 언어",
            saved_profiles: "저장된 프로필",
            open_settings: "설정 열기",
            quit: "Mouse Dictation 종료",
        },
        "pt" => TrayLabels {
            recognition_mode: "Modo de reconhecimento",
            paid_api: "API paga",
            local_offline: "Local offline",
            transcribe_only: "Apenas transcrever",
            translation_languages: "Idiomas de tradução",
            saved_profiles: "Perfis salvos",
            open_settings: "Abrir configurações",
            quit: "Sair do Mouse Dictation",
        },
        _ => TrayLabels {
            recognition_mode: "识别方式",
            paid_api: "付费 API",
            local_offline: "本地离线",
            transcribe_only: "仅转写",
            translation_languages: "翻译语言",
            saved_profiles: "已保存方案",
            open_settings: "打开设置",
            quit: "退出 Mouse Dictation",
        },
    }
}

fn refresh_tray_menu<R: Runtime>(app: &AppHandle<R>, settings: &Settings) -> Result<(), String> {
    let profiles = profile_summaries(&app.state::<AppState>());
    let locale = app
        .state::<AppState>()
        .ui_locale
        .lock()
        .map_err(|_| "界面语言锁定失败")?
        .clone();
    let menu = tray_menu(app, settings, &profiles, &locale).map_err(|e| e.to_string())?;
    let tray = app
        .tray_by_id("main")
        .ok_or_else(|| "找不到系统托盘图标".to_string())?;
    tray.set_menu(Some(menu)).map_err(|e| e.to_string())
}

fn apply_quick_profile<R: Runtime>(app: &AppHandle<R>, profile: &str) -> Result<(), String> {
    let settings = {
        let state = app.state::<AppState>();
        let mut settings = state.settings.lock().map_err(|_| "设置锁定失败")?;
        match profile {
            "profile:plain" => settings.translate_on = false,
            "profile:en" => {
                settings.translate_on = true;
                settings.translate_target = "en".into();
            }
            "profile:fr" => {
                settings.translate_on = true;
                settings.translate_target = "fr".into();
            }
            "profile:ja" => {
                settings.translate_on = true;
                settings.translate_target = "ja".into();
            }
            "profile:de" => {
                settings.translate_on = true;
                settings.translate_target = "de".into();
            }
            "profile:es" => {
                settings.translate_on = true;
                settings.translate_target = "es".into();
            }
            "profile:pt" => {
                settings.translate_on = true;
                settings.translate_target = "pt".into();
            }
            "profile:it" => {
                settings.translate_on = true;
                settings.translate_target = "it".into();
            }
            "profile:nl" => {
                settings.translate_on = true;
                settings.translate_target = "nl".into();
            }
            "profile:ru" => {
                settings.translate_on = true;
                settings.translate_target = "ru".into();
            }
            "profile:zh" => {
                settings.translate_on = true;
                settings.translate_target = "zh".into();
            }
            "profile:ko" => {
                settings.translate_on = true;
                settings.translate_target = "ko".into();
            }
            "profile:ar" => {
                settings.translate_on = true;
                settings.translate_target = "ar".into();
            }
            "profile:hi" => {
                settings.translate_on = true;
                settings.translate_target = "hi".into();
            }
            "profile:th" => {
                settings.translate_on = true;
                settings.translate_target = "th".into();
            }
            _ => return Err("未知的快速配置".into()),
        }
        if settings.engine == "local" && settings.local_mode == "streaming" {
            settings.translate_on = false;
        }
        save_settings_file(&settings)?;
        settings.clone()
    };
    emit(app, "settings-changed", settings.clone());
    refresh_tray_menu(app, &settings)?;
    Ok(())
}

fn handle_tray_menu<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    let id = event.id().as_ref();
    if let Some(profile_id) = id.strip_prefix("saved-profile:") {
        if let Err(error) = apply_profile_impl(profile_id.to_string(), app.state(), app) {
            emit(app, "dictation-error", error);
        }
        return;
    }
    if id.starts_with("profile:") {
        if let Err(error) = apply_quick_profile(app, id) {
            emit(app, "dictation-error", error);
        }
        return;
    }
    if let Some(engine) = id.strip_prefix("engine:") {
        if let Err(error) = apply_engine(app, engine) {
            emit(app, "dictation-error", error);
        }
        return;
    }
    match id {
        "open-settings" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }
        "quit" => app.exit(0),
        _ => {}
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .args(["--hidden"])
                .build(),
        )
        .setup(|app| {
            let settings = load_settings();
            let profiles = load_profiles();
            app.manage(AppState {
                settings: Mutex::new(settings.clone()),
                ui_locale: Mutex::new("zh".into()),
                profiles: Mutex::new(profiles),
                active_profile: Mutex::new(None),
                recorder: Mutex::new(None),
                local_recognizer: Mutex::new(None),
                streaming_recognizer: Mutex::new(None),
            });
            let profiles = profile_summaries(&app.state::<AppState>());
            let menu = tray_menu(app, &settings, &profiles, "zh")?;
            let mut tray = TrayIconBuilder::with_id("main")
                .menu(&menu)
                .tooltip("Mouse Dictation")
                .on_menu_event(handle_tray_menu);
            if let Some(icon) = app.default_window_icon().cloned() {
                tray = tray.icon(icon);
            }
            tray.build(app)?;
            let _ = WebviewWindowBuilder::new(
                app,
                "overlay",
                WebviewUrl::App("index.html?overlay".into()),
            )
            .title("Mouse Dictation Overlay")
            .transparent(true)
            .decorations(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .shadow(false)
            .resizable(false)
            .focused(false)
            .visible(false)
            .inner_size(200.0, 200.0)
            .build()
            .and_then(|win| {
                win.set_ignore_cursor_events(true)?;
                Ok(())
            });
            if settings.start_on_login {
                let _ = app.autolaunch().enable();
            }
            if std::env::args().any(|arg| arg == "--hidden") {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            spawn_mouse_listener(app.handle().clone());
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "overlay" {
                return;
            }
            match event {
                WindowEvent::CloseRequested { .. } => window.app_handle().exit(0),
                WindowEvent::Resized(_) if window.is_minimized().unwrap_or(false) => {
                    let _ = window.hide();
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            set_ui_locale,
            get_profiles,
            create_profile,
            rename_profile,
            delete_profile,
            apply_profile,
            save_settings,
            test_api,
            list_api_models,
            test_translation_api,
            list_translation_models,
            get_local_model_status,
            get_audio_status,
            get_recording_elapsed,
            download_local_model,
            list_local_models,
            delete_local_model,
            open_model_folder,
            open_external_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running mouse dictation");
}

#[cfg(test)]
mod tests {
    use super::{
        hotkey_matches, is_speech_to_text_model, normalize_api_key, normalize_audio,
        resample_available, StreamingAudio,
    };
    use rdev::Key;

    #[test]
    fn normalizes_stereo_to_mono() {
        assert_eq!(
            normalize_audio(&[1000, -1000, 2000, -2000], 16_000, 2),
            vec![0, 0]
        );
    }

    #[test]
    fn normalizes_pasted_bearer_api_key() {
        assert_eq!(normalize_api_key("  'Bearer gsk_test'  "), "gsk_test");
    }

    #[test]
    fn filters_speech_models_without_showing_chat_models() {
        assert!(is_speech_to_text_model(
            &serde_json::json!({"id": "whisper-large-v3-turbo"}),
            "whisper-large-v3-turbo"
        ));
        assert!(!is_speech_to_text_model(
            &serde_json::json!({"id": "llama-3.3-70b-versatile"}),
            "llama-3.3-70b-versatile"
        ));
    }

    #[test]
    fn streaming_resampler_converts_16k_audio_without_dropping_samples() {
        let source = vec![0_i16, 1000, 2000, 3000];
        let mut state = StreamingAudio::new();
        let result = resample_available(&source, 16_000, 1, &mut state, true);
        assert_eq!(result.len(), source.len());
        assert_eq!(result[1], 1000.0 / 32768.0);
    }

    #[test]
    fn hotkey_requires_the_platform_primary_modifier() {
        let (ctrl, meta) = if cfg!(target_os = "macos") {
            (false, true)
        } else {
            (true, false)
        };
        assert!(hotkey_matches(
            "primary-alt-space",
            ctrl,
            true,
            false,
            meta,
            Key::Space
        ));
        assert!(!hotkey_matches(
            "primary-alt-space",
            !ctrl,
            true,
            false,
            !meta,
            Key::Space
        ));
        assert!(hotkey_matches(
            "custom:ctrl+shift+KeyK",
            true,
            false,
            true,
            false,
            Key::KeyK
        ));
    }
}
