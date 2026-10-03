use std::{
    thread,
    time::{Duration, Instant},
};
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP,
    KEYEVENTF_UNICODE, VK_CONTROL, VK_LWIN, VK_MENU, VK_RWIN, VK_SHIFT,
};

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

pub fn insert_text(text: &str) -> Result<(), String> {
    let inputs = unicode_inputs(text);
    if inputs.is_empty() {
        return Ok(());
    }
    let count = u32::try_from(inputs.len()).map_err(|_| "输入文字过长")?;
    let started = Instant::now();
    // Let the user release a dictation hotkey without changing their key state.
    while [VK_CONTROL, VK_MENU, VK_SHIFT, VK_LWIN, VK_RWIN]
        .iter()
        .any(|key| {
            // SAFETY: GetAsyncKeyState accepts these documented virtual-key codes.
            unsafe { GetAsyncKeyState(i32::from(*key)) < 0 }
        })
    {
        if started.elapsed() >= Duration::from_secs(2) {
            return Err("文字未输入：请松开 Ctrl、Alt、Shift 或 Windows 键后再试。".into());
        }
        thread::sleep(Duration::from_millis(20));
    }
    // SAFETY: inputs remains alive, contains count initialized INPUT records,
    // and the structure size matches the Windows API ABI.
    let sent = unsafe { SendInput(count, inputs.as_ptr(), std::mem::size_of::<INPUT>() as i32) };
    if sent != count {
        return Err(format!(
            "文字输入未完成（{sent}/{count} 个输入事件）。请确认目标输入框可编辑，且应用权限一致。"
        ));
    }
    Ok(())
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
}
