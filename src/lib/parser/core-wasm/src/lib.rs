use wasm_bindgen::prelude::*;

// Import the `console.log` function from the Web API
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

// Define a macro to provide `println!(..)` style syntax for `console.log` logging.
#[macro_export]
macro_rules! console_log {
    ( $( $t:tt )* ) => {
        crate::log(&format!( $( $t )* ))
    }
}

pub mod types;
pub mod utils;
pub mod pokemon;
pub mod save_parser;

// Re-export main types for JavaScript consumption
pub use pokemon::Pokemon;
pub use save_parser::SaveParser;
pub use types::{SaveData, PlayTimeData};

// Export a simple test function to verify WASM is working
#[wasm_bindgen]
pub fn test_wasm() -> String {
    console_log!("WASM Pokemon Save Parser loaded successfully!");
    "Pokemon Save Parser WASM module is working!".to_string()
}