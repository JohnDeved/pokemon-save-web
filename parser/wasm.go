// +build js,wasm

package main

import (
	"encoding/json"
	"syscall/js"
	"github.com/JohnDeved/pokemon-save-web/parser/core"
)

// parseBytes is the main WASM function exposed to JavaScript
func parseBytes(this js.Value, args []js.Value) interface{} {
	// Return a promise
	handler := js.FuncOf(func(this js.Value, args []js.Value) interface{} {
		resolve := args[0]
		reject := args[1]

		go func() {
			defer func() {
				if r := recover(); r != nil {
					errorMsg := map[string]interface{}{
						"error": "panic occurred during parsing",
						"details": r,
					}
					errorBytes, _ := json.Marshal(errorMsg)
					reject.Invoke(js.ValueOf(string(errorBytes)))
				}
			}()

			if len(args) < 1 {
				errorMsg := map[string]interface{}{
					"error": "missing save data argument",
				}
				errorBytes, _ := json.Marshal(errorMsg)
				reject.Invoke(js.ValueOf(string(errorBytes)))
				return
			}

			// Get save data from JavaScript Uint8Array
			jsArray := args[0]
			if jsArray.Type() != js.TypeObject {
				errorMsg := map[string]interface{}{
					"error": "invalid save data type",
				}
				errorBytes, _ := json.Marshal(errorMsg)
				reject.Invoke(js.ValueOf(string(errorBytes)))
				return
			}

			// Convert JS Uint8Array to Go byte slice
			length := jsArray.Get("length").Int()
			saveData := make([]byte, length)
			js.CopyBytesToGo(saveData, jsArray)

			// Parse the save data
			parser := core.NewPokemonSaveParser(nil, nil)
			err := parser.LoadSaveData(saveData)
			if err != nil {
				errorMsg := map[string]interface{}{
					"error": "failed to load save data",
					"details": err.Error(),
				}
				errorBytes, _ := json.Marshal(errorMsg)
				reject.Invoke(js.ValueOf(string(errorBytes)))
				return
			}

			saveResult, err := parser.ParseSaveFile()
			if err != nil {
				errorMsg := map[string]interface{}{
					"error": "failed to parse save file",
					"details": err.Error(),
				}
				errorBytes, _ := json.Marshal(errorMsg)
				reject.Invoke(js.ValueOf(string(errorBytes)))
				return
			}

			// Convert result to JSON
			resultBytes, err := json.Marshal(saveResult)
			if err != nil {
				errorMsg := map[string]interface{}{
					"error": "failed to serialize result",
					"details": err.Error(),
				}
				errorBytes, _ := json.Marshal(errorMsg)
				reject.Invoke(js.ValueOf(string(errorBytes)))
				return
			}

			resolve.Invoke(js.ValueOf(string(resultBytes)))
		}()

		return nil
	})

	promiseConstructor := js.Global().Get("Promise")
	return promiseConstructor.New(handler)
}

// encodeText converts a string to GBA character encoding
func encodeText(this js.Value, args []js.Value) interface{} {
	if len(args) < 1 {
		return js.ValueOf("")
	}

	text := args[0].String()
	maxLength := 10
	if len(args) >= 2 {
		maxLength = args[1].Int()
	}

	encoded := core.EncodePokemonText(text, maxLength)
	
	// Convert Go byte slice to JavaScript Uint8Array
	jsArray := js.Global().Get("Uint8Array").New(len(encoded))
	js.CopyBytesToJS(jsArray, encoded)
	
	return jsArray
}

// decodeText converts GBA character encoding to string
func decodeText(this js.Value, args []js.Value) interface{} {
	if len(args) < 1 {
		return js.ValueOf("")
	}

	// Get byte data from JavaScript Uint8Array
	jsArray := args[0]
	if jsArray.Type() != js.TypeObject {
		return js.ValueOf("")
	}

	length := jsArray.Get("length").Int()
	data := make([]byte, length)
	js.CopyBytesToGo(data, jsArray)

	decoded := core.DecodePokemonText(data)
	return js.ValueOf(decoded)
}

// getVersion returns the parser version
func getVersion(this js.Value, args []js.Value) interface{} {
	return js.ValueOf("1.0.0-go")
}

func main() {
	c := make(chan struct{}, 0)

	// Register functions to be available from JavaScript
	js.Global().Set("parseBytes", js.FuncOf(parseBytes))
	js.Global().Set("encodeText", js.FuncOf(encodeText))  
	js.Global().Set("decodeText", js.FuncOf(decodeText))
	js.Global().Set("getVersion", js.FuncOf(getVersion))

	// Signal that WASM is ready
	js.Global().Call("postMessage", map[string]interface{}{
		"type": "wasm-ready",
		"version": "1.0.0-go",
	})

	<-c // Keep the program running
}