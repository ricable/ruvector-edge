//! WASM-Compatible Logging
//!
//! Provides logging macros that work across WASM (browser console)
//! and native environments (stdout).

// ============================================================================
// Logging Macros
// ============================================================================

/// Debug-level log
#[macro_export]
macro_rules! elex_debug {
    ($($arg:tt)*) => {
        #[cfg(target_arch = "wasm32")]
        web_sys::console::debug_1(&format_args!($($arg)*).to_string().into());

        #[cfg(not(target_arch = "wasm32"))]
        println!("[DEBUG] {}", format_args!($($arg)*));
    };
}

/// Info-level log
#[macro_export]
macro_rules! elex_info {
    ($($arg:tt)*) => {
        #[cfg(target_arch = "wasm32")]
        web_sys::console::info_1(&format_args!($($arg)*).to_string().into());

        #[cfg(not(target_arch = "wasm32"))]
        println!("[INFO] {}", format_args!($($arg)*));
    };
}

/// Warning-level log
#[macro_export]
macro_rules! elex_warn {
    ($($arg:tt)*) => {
        #[cfg(target_arch = "wasm32")]
        web_sys::console::warn_1(&format_args!($($arg)*).to_string().into());

        #[cfg(not(target_arch = "wasm32"))]
        println!("[WARN] {}", format_args!($($arg)*));
    };
}

/// Error-level log
#[macro_export]
macro_rules! elex_error {
    ($($arg:tt)*) => {
        #[cfg(target_arch = "wasm32")]
        web_sys::console::error_1(&format_args!($($arg)*).to_string().into());

        #[cfg(not(target_arch = "wasm32"))]
        eprintln!("[ERROR] {}", format_args!($($arg)*));
    };
}

// ============================================================================
// Log Level Filter
// ============================================================================

/// Log level for filtering
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum LogLevel {
    Debug = 0,
    Info = 1,
    Warn = 2,
    Error = 3,
    Off = 4,
}

/// Global log level (can be set at runtime)
static mut LOG_LEVEL: LogLevel = LogLevel::Info;

/// Set the minimum log level
pub fn set_log_level(level: LogLevel) {
    unsafe {
        LOG_LEVEL = level;
    }
}

/// Get current log level
pub fn log_level() -> LogLevel {
    unsafe { LOG_LEVEL }
}

/// Check if a log level should be printed
pub fn should_log(level: LogLevel) -> bool {
    level >= log_level()
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_log_level_comparison() {
        assert!(LogLevel::Debug < LogLevel::Info);
        assert!(LogLevel::Info < LogLevel::Warn);
        assert!(LogLevel::Warn < LogLevel::Error);
        assert!(LogLevel::Error < LogLevel::Off);
    }

    #[test]
    fn test_should_log() {
        set_log_level(LogLevel::Info);
        assert!(!should_log(LogLevel::Debug));
        assert!(should_log(LogLevel::Info));
        assert!(should_log(LogLevel::Warn));
        assert!(should_log(LogLevel::Error));
    }

    #[test]
    fn test_log_level_set_get() {
        set_log_level(LogLevel::Warn);
        assert_eq!(log_level(), LogLevel::Warn);
    }
}
