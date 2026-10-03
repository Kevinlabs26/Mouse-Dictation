use std::{env, path::PathBuf};

fn main() {
    println!("cargo:rerun-if-changed=icons/icon.ico");
    let manifest_dir =
        PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is missing"));
    let icon_path = manifest_dir.join("icons").join("icon.ico");
    let windows = tauri_build::WindowsAttributes::new().window_icon_path(icon_path);
    let attributes = tauri_build::Attributes::new()
        .windows_attributes(windows)
        .app_manifest(tauri_build::AppManifest::new().commands(&[
            "get_settings",
            "set_ui_locale",
            "get_profiles",
            "create_profile",
            "rename_profile",
            "delete_profile",
            "apply_profile",
            "save_settings",
            "test_api",
            "list_api_models",
            "test_translation_api",
            "list_translation_models",
            "get_local_model_status",
            "get_audio_status",
            "get_recording_elapsed",
            "download_local_model",
            "list_local_models",
            "delete_local_model",
            "open_model_folder",
            "open_external_url",
        ]));
    tauri_build::try_build(attributes).expect("failed to run tauri build");
}
