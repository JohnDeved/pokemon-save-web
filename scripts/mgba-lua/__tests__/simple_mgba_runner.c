#include <mgba/core/core.h>
#include <mgba/core/config.h>
#include <mgba/script/context.h>
#include <mgba-util/vfs.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <signal.h>

static volatile int keep_running = 1;

void signal_handler(int sig) {
    keep_running = 0;
}

int main(int argc, char* argv[]) {
    if (argc < 2) {
        printf("Usage: %s <script.lua>\n", argv[0]);
        return 1;
    }
    
    // Set up signal handler
    signal(SIGINT, signal_handler);
    signal(SIGTERM, signal_handler);
    
    printf("Initializing mGBA script context...\n");
    
    // Initialize script context
    struct mScriptContext* context = calloc(1, sizeof(struct mScriptContext));
    if (!context) {
        printf("Failed to allocate script context\n");
        return 1;
    }
    
    mScriptContextInit(context);
    
    // Load script file
    struct VFile* script = VFileOpen(argv[1], O_RDONLY);
    if (!script) {
        printf("Failed to open script file: %s\n", argv[1]);
        mScriptContextDeinit(context);
        free(context);
        return 1;
    }
    
    printf("Script loaded, starting script execution...\n");
    
    // TODO: Actually execute the script using the mGBA script engine
    // For now, just keep the context alive to test the approach
    
    printf("Entering main loop (press Ctrl+C to exit)...\n");
    
    // Main loop - keep the context alive
    int loop_count = 0;
    while (keep_running) {
        usleep(100000); // 100ms
        loop_count++;
        if (loop_count % 10 == 0) {
            printf("Running... (loop %d)\n", loop_count);
        }
    }
    
    // Cleanup
    printf("\nShutting down...\n");
    script->close(script);
    mScriptContextDeinit(context);
    free(context);
    
    printf("Script context closed.\n");
    return 0;
}