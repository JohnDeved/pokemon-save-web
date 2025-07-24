{
  "targets": [
    {
      "target_name": "mgba_bridge",
      "sources": [ "mgba_bridge.cpp" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "/usr/include/mgba",
        "/usr/include/mgba-util"
      ],
      "libraries": [
        "-lmgba"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ]
    }
  ]
}