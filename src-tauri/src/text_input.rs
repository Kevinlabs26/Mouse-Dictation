use crate::dictation_session::{Cancellation, CANCELLED_ERROR};
use std::{
    thread,
    time::{Duration, Instant},
};
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP,
    KEYEVENTF_UNICODE, VK_CONTROL, VK_LWIN, VK_MENU, VK_RWIN, VK_SHIFT,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    GetForegroundWindow, GetGUIThreadInfo, GetWindowThreadProcessId, IsWindow, GUITHREADINFO,
    GUI_INMENUMODE, GUI_INMOVESIZE, GUI_POPUPMENUMODE, GUI_SYSTEMMENUMODE,
};

const TARGET_CHANGED: &str = "文字未输入：输入目标已切换或不可用，请回到目标输入框重新听写。";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct InputTarget {
    foreground: usize,
    focus: usize,
    thread: u32,
    focus_thread: u32,
}

impl InputTarget {
    pub fn capture() -> Result<Self, String> {
        let unavailable = "无法确认当前输入目标，请先点击目标输入框后重试。";
        // SAFETY: these APIs only inspect handles; info is initialized with its required size.
        unsafe {
            let foreground = GetForegroundWindow();
            if foreground.is_null() {
                return Err(unavailable.into());
            }
            let thread = GetWindowThreadProcessId(foreground, std::ptr::null_mut());
            let mut info = GUITHREADINFO {
                cbSize: std::mem::size_of::<GUITHREADINFO>() as u32,
                ..Default::default()
            };
            if thread == 0
                || GetGUIThreadInfo(thread, &mut info) == 0
                || info.hwndActive != foreground
                || info.hwndFocus.is_null()
                || IsWindow(info.hwndFocus) == 0
                || info.flags
                    & (GUI_INMENUMODE | GUI_INMOVESIZE | GUI_POPUPMENUMODE | GUI_SYSTEMMENUMODE)
                    != 0
                || GetForegroundWindow() != foreground
            {
                return Err(unavailable.into());
            }
            let focus_thread = GetWindowThreadProcessId(info.hwndFocus, std::ptr::null_mut());
            if focus_thread == 0 {
                return Err(unavailable.into());
            }
            Ok(Self {
                foreground: foreground as usize,
                focus: info.hwndFocus as usize,
                thread,
                focus_thread,
            })
        }
    }

    fn check_current(&self) -> Result<(), String> {
        // shortcut: native HWND identity cannot distinguish fields within one webview; use UI Automation when field-level protection is required.
        match Self::capture() {
            Ok(current) if current == *self => Ok(()),
            _ => Err(TARGET_CHANGED.into()),
        }
    }
}

#[cfg(test)]
pub(crate) fn test_target() -> InputTarget {
    InputTarget {
        foreground: 1,
        focus: 2,
        thread: 3,
        focus_thread: 3,
    }
}

fn unicode_inputs(text: &str) -> Vec<INPUT> {
    // Windows text controls expect CR for a line break; normalize CRLF once.
    text.replace("\r\n", "\n")
        .replace('\n', "\r")
        .encode_utf16()
        .flat_map(|unit| {
            [KEYEVENTF_UNICODE, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP].map(|flags| INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: 0,
                        wScan: unit,
                        dwFlags: flags,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            })
        })
        .collect()
}

pub fn insert_text(text: &str, target: &InputTarget, cancel: &Cancellation) -> Result<(), String> {
    insert_text_with(
        text,
        cancel,
        || target.check_current(),
        || {
            [VK_CONTROL, VK_MENU, VK_SHIFT, VK_LWIN, VK_RWIN]
                .iter()
                .any(|key| {
                    // SAFETY: GetAsyncKeyState accepts these documented virtual-key codes.
                    unsafe { GetAsyncKeyState(i32::from(*key)) < 0 }
                })
        },
        || thread::sleep(Duration::from_millis(20)),
        |inputs| {
            // SAFETY: inputs contains initialized INPUT records and the size matches the ABI.
            unsafe {
                SendInput(
                    inputs.len() as u32,
                    inputs.as_ptr(),
                    std::mem::size_of::<INPUT>() as i32,
                )
            }
        },
    )
}

fn insert_text_with(
    text: &str,
    cancel: &Cancellation,
    mut check_target: impl FnMut() -> Result<(), String>,
    mut modifiers_down: impl FnMut() -> bool,
    mut wait: impl FnMut(),
    send: impl FnOnce(&[INPUT]) -> u32,
) -> Result<(), String> {
    let inputs = unicode_inputs(text);
    if inputs.is_empty() {
        return Ok(());
    }
    let count = u32::try_from(inputs.len()).map_err(|_| "输入文字过长")?;
    let started = Instant::now();
    // Let the user release a dictation hotkey without changing their key state.
    loop {
        if cancel.is_cancelled() {
            return Err(CANCELLED_ERROR.into());
        }
        check_target()?;
        if !modifiers_down() {
            break;
        }
        if started.elapsed() >= Duration::from_secs(2) {
            return Err("文字未输入：请松开 Ctrl、Alt、Shift 或 Windows 键后再试。".into());
        }
        wait();
    }
    cancel.run_if_active(|| {
        check_target()?;
        let sent = send(&inputs);
        if sent != count {
            return Err(format!(
                "文字输入未完成（{sent}/{count} 个输入事件）。请确认目标输入框可编辑，且应用权限一致。"
            ));
        }
        Ok(())
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unicode_input_preserves_chinese_emoji_and_single_line_breaks() {
        let inputs = unicode_inputs("中文，OK！😀\r\n下一行\n");
        let expected: Vec<u16> = "中文，OK！😀\r下一行\r".encode_utf16().collect();
        assert_eq!(inputs.len(), expected.len() * 2);
        for (pair, unit) in inputs.chunks_exact(2).zip(expected) {
            for (input, flags) in pair
                .iter()
                .zip([KEYEVENTF_UNICODE, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP])
            {
                assert_eq!(input.r#type, INPUT_KEYBOARD);
                // SAFETY: unicode_inputs initializes the ki member for each input.
                let key = unsafe { input.Anonymous.ki };
                assert_eq!((key.wVk, key.wScan, key.dwFlags), (0, unit, flags));
            }
        }
        assert!(unicode_inputs("").is_empty());
    }

    #[test]
    fn cancellation_while_waiting_for_modifiers_prevents_input() {
        let cancel = Cancellation::default();
        let result = insert_text_with(
            "hello",
            &cancel,
            || Ok(()),
            || true,
            || {
                cancel.cancel();
            },
            |_| panic!("cancelled dictation must not send keys"),
        );
        assert_eq!(result, Err(CANCELLED_ERROR.into()));
    }

    #[test]
    fn changed_focus_immediately_before_send_prevents_input() {
        let mut checks = 0;
        let result = insert_text_with(
            "hello",
            &Cancellation::default(),
            || {
                checks += 1;
                if checks == 1 {
                    Ok(())
                } else {
                    Err(TARGET_CHANGED.into())
                }
            },
            || false,
            || panic!("no modifiers are held"),
            |_| panic!("changed target must not receive keys"),
        );
        assert_eq!(checks, 2);
        assert_eq!(result, Err(TARGET_CHANGED.into()));
    }

    #[test]
    fn cancellation_after_modifier_check_prevents_input() {
        let cancel = Cancellation::default();
        let result = insert_text_with(
            "hello",
            &cancel,
            || Ok(()),
            || {
                cancel.cancel();
                false
            },
            || panic!("no modifiers are held"),
            |_| panic!("cancelled dictation must not send keys"),
        );
        assert_eq!(result, Err(CANCELLED_ERROR.into()));
    }

    #[test]
    fn unchanged_target_receives_one_complete_unicode_batch() {
        let result = insert_text_with(
            "中文😀\n",
            &Cancellation::default(),
            || Ok(()),
            || false,
            || panic!("no modifiers are held"),
            |inputs| {
                assert_eq!(inputs.len(), 10);
                inputs.len() as u32
            },
        );
        assert_eq!(result, Ok(()));
    }

    #[test]
    fn incomplete_send_is_still_an_error() {
        let result = insert_text_with(
            "hi",
            &Cancellation::default(),
            || Ok(()),
            || false,
            || panic!("no modifiers are held"),
            |_| 2,
        );
        assert!(result.unwrap_err().contains("2/4"));
    }
}
