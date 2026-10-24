use std::sync::Mutex;

pub const CANCELLED_ERROR: &str = "听写已取消";

#[derive(Default)]
pub struct Cancellation {
    cancelled: Mutex<bool>,
}

impl Cancellation {
    pub fn cancel(&self) {
        if let Ok(mut cancelled) = self.cancelled.lock() {
            *cancelled = true;
        }
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancelled.lock().map(|value| *value).unwrap_or(true)
    }

    pub fn check(&self) -> Result<(), String> {
        if self.is_cancelled() {
            Err(CANCELLED_ERROR.into())
        } else {
            Ok(())
        }
    }

    pub fn run_if_active<T>(
        &self,
        action: impl FnOnce() -> Result<T, String>,
    ) -> Result<T, String> {
        let cancelled = self
            .cancelled
            .lock()
            .map_err(|_| CANCELLED_ERROR.to_string())?;
        if *cancelled {
            return Err(CANCELLED_ERROR.into());
        }
        action()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cancellation_blocks_late_side_effects() {
        let cancellation = Cancellation::default();
        assert_eq!(cancellation.run_if_active(|| Ok(42)).unwrap(), 42);
        cancellation.cancel();
        let mut sent = false;
        assert_eq!(
            cancellation
                .run_if_active(|| {
                    sent = true;
                    Ok(())
                })
                .unwrap_err(),
            CANCELLED_ERROR
        );
        assert!(!sent);
        assert!(cancellation.check().is_err());
    }
}
