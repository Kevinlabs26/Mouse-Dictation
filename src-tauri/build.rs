use std::{env, path::PathBuf};

fn main() {
    println!("cargo:rerun-if-changed=icons/icon.ico");
    let manifest_dir =
        PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is missing"));
    let icon_path = manifest_dir.join("icons").join("icon.ico");
    let windows = tauri_build::WindowsAttributes::new().window_icon_path(icon_path);
    let attributes = tauri_build::Attributes::new().windows_attributes(windows);
    tauri_build::try_build(attributes).expect("failed to run tauri build");
}
