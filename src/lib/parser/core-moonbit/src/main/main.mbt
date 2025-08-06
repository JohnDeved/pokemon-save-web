/// Main entry point for Pokemon save parser WebAssembly module
/// This initializes the parser and exports the main interface

fn main {
  // Initialize the parser with default configuration
  @lib.init_parser()
  println("Pokemon Save Parser WASM module initialized")
}
