//! Immutable, endpoint-bound keyring snapshots committed by atomic config replacement.
use super::{write_config_file, Profile, Settings, KEYRING_SERVICE};
use serde::{Deserialize, Serialize};
use std::{fs, path::Path};

pub(super) trait Secrets {
    fn get(&self, name: &str) -> Result<Option<String>, String>;
    fn set(&self, name: &str, value: &str) -> Result<(), String>;
    fn delete(&self, name: &str) -> Result<(), String>;
}

pub(super) struct SystemSecrets;
impl Secrets for SystemSecrets {
    fn get(&self, name: &str) -> Result<Option<String>, String> {
        let entry = keyring::Entry::new(KEYRING_SERVICE, name).map_err(|_| "无法访问系统凭据库")?;
        match entry.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(_) => Err("无法读取系统凭据，请恢复凭据库访问后重启应用".into()),
        }
    }
    fn set(&self, name: &str, value: &str) -> Result<(), String> {
        super::write_secret_for(KEYRING_SERVICE, name, value)
    }
    fn delete(&self, name: &str) -> Result<(), String> {
        super::clear_secret_for(KEYRING_SERVICE, name)
    }
}

#[derive(Clone, Serialize, Deserialize)]
pub(super) struct StoredSettings {
    #[serde(flatten)]
    pub settings: Settings,
    // None means legacy; an empty reference explicitly means no credentials.
    #[serde(default)]
    pub credentials: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub(super) struct StoredProfile {
    pub id: String,
    pub name: String,
    pub settings: StoredSettings,
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct BoundCredentials {
    scope: String,
    api_url: String,
    translate_url: String,
    translate_api: String,
    api_key: String,
    translate_key: String,
}

fn check_reference(name: &str, scope: &str) -> Result<(), String> {
    let prefix = format!("v2/{scope}/");
    let id = name
        .strip_prefix(&prefix)
        .ok_or("安全凭据引用不属于此配置")?;
    uuid::Uuid::parse_str(id).map_err(|_| "安全凭据引用无效")?;
    Ok(())
}

fn legacy_names(scope: &str) -> [String; 2] {
    if scope == "current" {
        ["transcription-api-key".into(), "translation-api-key".into()]
    } else {
        let id = scope
            .strip_prefix("profile/")
            .expect("internal profile scope");
        [
            super::profile_secret_name(id, "transcription-api-key"),
            super::profile_secret_name(id, "translation-api-key"),
        ]
    }
}

fn old_names(stored: &StoredSettings, scope: &str) -> Result<Vec<String>, String> {
    match stored.credentials.as_deref() {
        None => Ok(legacy_names(scope).into()),
        Some("") => Ok(Vec::new()),
        Some(name) => {
            check_reference(name, scope)?;
            Ok(vec![name.into()])
        }
    }
}

pub(super) fn load(
    stored: &StoredSettings,
    scope: &str,
    secrets: &impl Secrets,
) -> Result<Settings, String> {
    let mut settings = stored.settings.clone();
    if let Some(name) = stored.credentials.as_deref() {
        settings.api_key.clear();
        settings.translate_key.clear();
        if name.is_empty() {
            return Ok(settings);
        }
        check_reference(name, scope)?;
        let value = secrets
            .get(name)?
            .ok_or("安全凭据缺失，请恢复凭据后重启应用")?;
        let bound: BoundCredentials =
            serde_json::from_str(&value).map_err(|_| "安全凭据格式无效")?;
        if bound.scope != scope
            || bound.api_url != settings.api_url
            || bound.translate_url != settings.translate_url
            || bound.translate_api != settings.translate_api
        {
            return Err("安全凭据与 API 地址不匹配，已阻止加载".into());
        }
        settings.api_key = bound.api_key;
        settings.translate_key = bound.translate_key;
    } else {
        let names = legacy_names(scope);
        if settings.api_key.is_empty() {
            settings.api_key = secrets.get(&names[0])?.unwrap_or_default();
        }
        if settings.translate_key.is_empty() {
            settings.translate_key = secrets.get(&names[1])?.unwrap_or_default();
        }
    }
    Ok(settings)
}

fn snapshot(
    settings: &Settings,
    scope: &str,
    secrets: &impl Secrets,
) -> Result<StoredSettings, String> {
    if settings.credential_error {
        return Err("凭据读取异常，已阻止覆盖配置；请恢复系统凭据库后重启应用".into());
    }
    let mut persisted = settings.clone();
    persisted.api_key.clear();
    persisted.translate_key.clear();
    let name = if settings.api_key.is_empty() && settings.translate_key.is_empty() {
        String::new()
    } else {
        let name = format!("v2/{scope}/{}", uuid::Uuid::new_v4());
        let value = serde_json::to_string(&BoundCredentials {
            scope: scope.into(),
            api_url: settings.api_url.clone(),
            translate_url: settings.translate_url.clone(),
            translate_api: settings.translate_api.clone(),
            api_key: settings.api_key.clone(),
            translate_key: settings.translate_key.clone(),
        })
        .map_err(|_| "无法编码安全凭据")?;
        secrets.set(&name, &value)?;
        name
    };
    Ok(StoredSettings {
        settings: persisted,
        credentials: Some(name),
    })
}

fn cleanup(names: &[String], secrets: &impl Secrets) -> Result<(), String> {
    let mut failed = false;
    for name in names {
        failed |= secrets.delete(name).is_err();
    }
    if failed {
        Err("安全凭据清理失败，请检查系统凭据管理器".into())
    } else {
        Ok(())
    }
}

fn commit(
    path: &Path,
    json: &str,
    fresh: &[String],
    obsolete: &[String],
    secrets: &impl Secrets,
) -> Result<(), String> {
    if let Err(error) = write_config_file(path, json) {
        cleanup(fresh, secrets).map_err(|cleanup| format!("配置未保存：{error}；{cleanup}"))?;
        return Err(error);
    }
    // Old snapshots remain usable until the new reference is durably committed.
    cleanup(obsolete, secrets).map_err(|error| format!("配置已保存，但{error}"))
}

pub(super) fn save_settings(
    path: &Path,
    settings: &Settings,
    secrets: &impl Secrets,
) -> Result<(), String> {
    let obsolete = if path
        .try_exists()
        .map_err(|_| "无法访问原配置，已阻止覆盖")?
    {
        let previous: StoredSettings =
            serde_json::from_slice(&fs::read(path).map_err(|_| "无法读取原配置")?)
                .map_err(|_| "原配置损坏，已阻止覆盖")?;
        old_names(&previous, "current")?
    } else {
        Vec::new()
    };
    let stored = snapshot(settings, "current", secrets)?;
    let fresh: Vec<String> = stored
        .credentials
        .iter()
        .filter(|name| !name.is_empty())
        .cloned()
        .collect();
    let json = serde_json::to_string_pretty(&stored).map_err(|_| "无法编码配置")?;
    commit(path, &json, &fresh, &obsolete, secrets)
}

pub(super) fn save_profiles(
    path: &Path,
    profiles: &[Profile],
    secrets: &impl Secrets,
) -> Result<(), String> {
    let mut obsolete = Vec::new();
    if path
        .try_exists()
        .map_err(|_| "无法访问原方案配置，已阻止覆盖")?
    {
        let previous: Vec<StoredProfile> =
            serde_json::from_slice(&fs::read(path).map_err(|_| "无法读取原方案")?)
                .map_err(|_| "原方案配置损坏，已阻止覆盖")?;
        for profile in previous {
            obsolete.extend(old_names(
                &profile.settings,
                &format!("profile/{}", profile.id),
            )?);
        }
    }
    let mut fresh = Vec::new();
    let mut stored = Vec::new();
    for profile in profiles {
        let settings = match snapshot(
            &profile.settings,
            &format!("profile/{}", profile.id),
            secrets,
        ) {
            Ok(settings) => settings,
            Err(error) => {
                cleanup(&fresh, secrets)
                    .map_err(|cleanup| format!("方案未保存：{error}；{cleanup}"))?;
                return Err(error);
            }
        };
        fresh.extend(
            settings
                .credentials
                .iter()
                .filter(|name| !name.is_empty())
                .cloned(),
        );
        stored.push(StoredProfile {
            id: profile.id.clone(),
            name: profile.name.clone(),
            settings,
        });
    }
    let json = serde_json::to_string_pretty(&stored).map_err(|_| "无法编码方案")?;
    commit(path, &json, &fresh, &obsolete, secrets)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        cell::{Cell, RefCell},
        collections::HashMap,
    };

    #[derive(Default)]
    struct MemorySecrets {
        values: RefCell<HashMap<String, String>>,
        writes: Cell<usize>,
        fail_write: Cell<Option<usize>>,
        fail_delete: Cell<bool>,
    }
    impl Secrets for MemorySecrets {
        fn get(&self, name: &str) -> Result<Option<String>, String> {
            Ok(self.values.borrow().get(name).cloned())
        }
        fn set(&self, name: &str, value: &str) -> Result<(), String> {
            self.writes.set(self.writes.get() + 1);
            if self.fail_write.get() == Some(self.writes.get()) {
                return Err("simulated keyring failure".into());
            }
            self.values.borrow_mut().insert(name.into(), value.into());
            Ok(())
        }
        fn delete(&self, name: &str) -> Result<(), String> {
            if self.fail_delete.get() {
                return Err("simulated cleanup failure".into());
            }
            self.values.borrow_mut().remove(name);
            Ok(())
        }
    }
    fn settings(url: &str, key: &str) -> Settings {
        Settings {
            api_url: url.into(),
            api_key: key.into(),
            translate_url: "https://translation.example/v1".into(),
            translate_key: "translation-fixture".into(),
            ..Default::default()
        }
    }
    fn read(path: &Path) -> StoredSettings {
        serde_json::from_slice(&fs::read(path).unwrap()).unwrap()
    }

    #[test]
    fn restart_restores_one_bound_pair_and_json_contains_no_keys() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        let store = MemorySecrets::default();
        let first = settings("https://first.example/v1", "first-fixture");
        save_settings(&path, &first, &store).unwrap();
        let old_reference = read(&path).credentials.unwrap();
        let next = settings("https://next.example/v1", "next-fixture");
        save_settings(&path, &next, &store).unwrap();
        let json = fs::read_to_string(&path).unwrap();
        assert!(!json.contains("next-fixture"));
        assert!(!json.contains("translation-fixture"));
        let loaded = load(&read(&path), "current", &store).unwrap();
        assert_eq!(
            (loaded.api_url, loaded.api_key, loaded.translate_key),
            (next.api_url, next.api_key, next.translate_key)
        );
        assert!(!store.values.borrow().contains_key(&old_reference));
        assert_eq!(store.values.borrow().len(), 1);
    }

    #[test]
    fn abandoned_snapshot_never_changes_the_restart_credentials() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        let store = MemorySecrets::default();
        save_settings(
            &path,
            &settings("https://old.example", "old-fixture"),
            &store,
        )
        .unwrap();
        let _abandoned = snapshot(
            &settings("https://other.example", "other-fixture"),
            "current",
            &store,
        )
        .unwrap();
        let loaded = load(&read(&path), "current", &store).unwrap();
        assert_eq!(loaded.api_url, "https://old.example");
        assert_eq!(loaded.api_key, "old-fixture");
    }

    #[test]
    fn endpoint_tampering_missing_records_and_foreign_references_fail_closed() {
        let store = MemorySecrets::default();
        let original = settings("https://good.example", "bound-fixture");
        let stored = snapshot(&original, "current", &store).unwrap();
        let mut tampered = stored.clone();
        tampered.settings.api_url = "https://other.example".into();
        assert!(load(&tampered, "current", &store).is_err());
        tampered = stored.clone();
        tampered.settings.translate_url = "https://other.example".into();
        assert!(load(&tampered, "current", &store).is_err());
        tampered = stored.clone();
        tampered.settings.translate_api = "custom".into();
        assert!(load(&tampered, "current", &store).is_err());
        assert!(load(&stored, "profile/other", &store).is_err());
        store.values.borrow_mut().clear();
        store
            .set("transcription-api-key", "legacy-must-not-load")
            .unwrap();
        assert!(load(&stored, "current", &store).is_err());
        tampered.credentials = Some("transcription-api-key".into());
        assert!(load(&tampered, "current", &store).is_err());
    }

    #[test]
    fn legacy_keys_migrate_only_after_the_snapshot_is_persisted() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        let store = MemorySecrets::default();
        let original = Settings::default();
        write_config_file(&path, &serde_json::to_string(&original).unwrap()).unwrap();
        store
            .set("transcription-api-key", "legacy-fixture")
            .unwrap();
        let loaded = load(&read(&path), "current", &store).unwrap();
        assert_eq!(loaded.api_key, "legacy-fixture");
        store.fail_write.set(Some(store.writes.get() + 1));
        assert!(save_settings(&path, &loaded, &store).is_err());
        assert!(read(&path).credentials.is_none());
        assert!(store.values.borrow().contains_key("transcription-api-key"));
        store.fail_write.set(None);
        save_settings(&path, &loaded, &store).unwrap();
        assert_eq!(
            load(&read(&path), "current", &store).unwrap().api_key,
            "legacy-fixture"
        );
        assert!(!store.values.borrow().contains_key("transcription-api-key"));
    }

    #[test]
    fn legacy_profile_plaintext_and_keyring_values_migrate_without_plaintext_json() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("profiles.json");
        let store = MemorySecrets::default();
        let mut old = settings("https://example.test", "");
        old.translate_key = "legacy-inline-translation-fixture".into();
        let profiles = vec![Profile {
            id: "one".into(),
            name: "One".into(),
            settings: old,
        }];
        write_config_file(&path, &serde_json::to_string(&profiles).unwrap()).unwrap();
        store
            .set(
                "profile/one/transcription-api-key",
                "legacy-profile-fixture",
            )
            .unwrap();
        let stored: Vec<StoredProfile> = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        let loaded = load(&stored[0].settings, "profile/one", &store).unwrap();
        assert_eq!(loaded.api_key, "legacy-profile-fixture");
        assert_eq!(loaded.translate_key, "legacy-inline-translation-fixture");
        let profiles = vec![Profile {
            id: "one".into(),
            name: "One".into(),
            settings: loaded,
        }];
        save_profiles(&path, &profiles, &store).unwrap();
        let json = fs::read_to_string(&path).unwrap();
        assert!(!json.contains("legacy-profile-fixture"));
        assert!(!json.contains("legacy-inline-translation-fixture"));
        assert!(!store
            .values
            .borrow()
            .contains_key("profile/one/transcription-api-key"));
        let stored: Vec<StoredProfile> = serde_json::from_str(&json).unwrap();
        assert_eq!(
            load(&stored[0].settings, "profile/one", &store)
                .unwrap()
                .api_key,
            "legacy-profile-fixture"
        );
    }

    #[test]
    fn explicit_clear_and_profile_delete_remove_the_old_snapshots() {
        let dir = tempfile::tempdir().unwrap();
        let store = MemorySecrets::default();
        let path = dir.path().join("settings.json");
        save_settings(
            &path,
            &settings("https://example.test", "delete-fixture"),
            &store,
        )
        .unwrap();
        save_settings(&path, &Settings::default(), &store).unwrap();
        assert_eq!(read(&path).credentials.as_deref(), Some(""));
        assert!(store.values.borrow().is_empty());
        let path = dir.path().join("profiles.json");
        let profiles = vec![Profile {
            id: "one".into(),
            name: "One".into(),
            settings: settings("https://example.test", "delete-profile-fixture"),
        }];
        save_profiles(&path, &profiles, &store).unwrap();
        assert_eq!(store.values.borrow().len(), 1);
        save_profiles(&path, &[], &store).unwrap();
        assert!(store.values.borrow().is_empty());
        assert!(
            serde_json::from_slice::<Vec<StoredProfile>>(&fs::read(path).unwrap())
                .unwrap()
                .is_empty()
        );
    }

    #[test]
    fn explicitly_empty_credentials_never_resurrect_legacy_keys() {
        let store = MemorySecrets::default();
        store
            .set("transcription-api-key", "legacy-fixture")
            .unwrap();
        let stored = StoredSettings {
            settings: settings("https://example.test", "stale-inline-fixture"),
            credentials: Some(String::new()),
        };
        let loaded = load(&stored, "current", &store).unwrap();
        assert!(loaded.api_key.is_empty());
        assert!(loaded.translate_key.is_empty());
    }

    #[test]
    fn profile_batch_failure_retains_old_file_and_cleans_uncommitted_records() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("profiles.json");
        let store = MemorySecrets::default();
        let profiles: Vec<Profile> = ["one", "two"]
            .iter()
            .map(|id| Profile {
                id: (*id).into(),
                name: (*id).into(),
                settings: settings("https://example.test", id),
            })
            .collect();
        save_profiles(&path, &profiles, &store).unwrap();
        let original = fs::read(&path).unwrap();
        let keys = store.values.borrow().clone();
        store.fail_write.set(Some(store.writes.get() + 2));
        assert!(save_profiles(&path, &profiles, &store).is_err());
        assert_eq!(fs::read(&path).unwrap(), original);
        assert_eq!(*store.values.borrow(), keys);
        let stored: Vec<StoredProfile> = serde_json::from_slice(&original).unwrap();
        assert_eq!(
            load(&stored[0].settings, "profile/one", &store)
                .unwrap()
                .api_key,
            "one"
        );
        assert!(load(&stored[0].settings, "profile/two", &store).is_err());
    }

    #[test]
    fn cleanup_errors_report_the_commit_without_breaking_the_new_reference() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        let store = MemorySecrets::default();
        save_settings(
            &path,
            &settings("https://old.example", "old-fixture"),
            &store,
        )
        .unwrap();
        store.fail_delete.set(true);
        let error = save_settings(
            &path,
            &settings("https://new.example", "new-fixture"),
            &store,
        )
        .unwrap_err();
        assert!(error.starts_with("配置已保存，但"));
        assert_eq!(
            load(&read(&path), "current", &store).unwrap().api_key,
            "new-fixture"
        );
    }

    #[test]
    fn unreadable_credentials_and_corrupt_configs_cannot_be_overwritten() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        let store = MemorySecrets::default();
        save_settings(
            &path,
            &settings("https://example.test", "valid-fixture"),
            &store,
        )
        .unwrap();
        let original = fs::read(&path).unwrap();
        let unavailable = super::super::unavailable_credentials(Settings::default());
        assert!(save_settings(&path, &unavailable, &store).is_err());
        assert_eq!(fs::read(&path).unwrap(), original);
        fs::write(&path, "{broken").unwrap();
        assert!(save_settings(&path, &Settings::default(), &store).is_err());
        assert_eq!(fs::read_to_string(path).unwrap(), "{broken");
    }

    #[test]
    fn inaccessible_storage_metadata_fails_before_creating_any_credentials() {
        let directory = tempfile::tempdir().unwrap();
        let invalid = directory.path().join("invalid\0configuration.json");
        let store = MemorySecrets::default();
        let settings = settings("https://example.test", "metadata-fixture");
        assert!(save_settings(&invalid, &settings, &store).is_err());
        let profiles = vec![Profile {
            id: "one".into(),
            name: "One".into(),
            settings,
        }];
        assert!(save_profiles(&invalid, &profiles, &store).is_err());
        assert_eq!(store.writes.get(), 0);
        assert!(store.values.borrow().is_empty());
    }

    #[cfg(windows)]
    #[test]
    fn file_commit_failure_keeps_the_old_snapshot_and_discards_the_new_one() {
        use std::os::windows::fs::OpenOptionsExt;
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        let store = MemorySecrets::default();
        save_settings(
            &path,
            &settings("https://old.example", "old-fixture"),
            &store,
        )
        .unwrap();
        let original = fs::read(&path).unwrap();
        let keys = store.values.borrow().clone();
        let writes = store.writes.get();
        let locked = fs::OpenOptions::new()
            .read(true)
            .share_mode(1)
            .open(&path)
            .unwrap();
        assert!(save_settings(
            &path,
            &settings("https://other.example", "other-fixture"),
            &store
        )
        .is_err());
        drop(locked);
        assert_eq!(store.writes.get(), writes + 1);
        assert_eq!(fs::read(&path).unwrap(), original);
        assert_eq!(*store.values.borrow(), keys);
        assert_eq!(
            load(&read(&path), "current", &store).unwrap().api_key,
            "old-fixture"
        );
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    }
}
