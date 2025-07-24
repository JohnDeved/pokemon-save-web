#include <cstring>
#include <napi.h>
#include <mgba/core/core.h>
#include <mgba/core/config.h>
#include <mgba/core/serialize.h>
#include <mgba/core/scripting.h>
#include <mgba/script/context.h>
#include <mgba-util/vfs.h>
#include <thread>
#include <chrono>

class MgbaScriptRunner : public Napi::ObjectWrap<MgbaScriptRunner> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    MgbaScriptRunner(const Napi::CallbackInfo& info);
    ~MgbaScriptRunner();

private:
    static Napi::FunctionReference constructor;
    
    // Instance methods
    Napi::Value StartScript(const Napi::CallbackInfo& info);
    Napi::Value StopScript(const Napi::CallbackInfo& info);
    Napi::Value IsRunning(const Napi::CallbackInfo& info);
    
    // Member variables
    struct mCore* core;
    struct mScriptContext* scriptContext;
    bool running;
    std::thread* runThread;
};

// Static member initialization
Napi::FunctionReference MgbaScriptRunner::constructor;

Napi::Object MgbaScriptRunner::Init(Napi::Env env, Napi::Object exports) {
    Napi::HandleScope scope(env);

    Napi::Function func = DefineClass(env, "MgbaScriptRunner", {
        InstanceMethod("startScript", &MgbaScriptRunner::StartScript),
        InstanceMethod("stopScript", &MgbaScriptRunner::StopScript),
        InstanceMethod("isRunning", &MgbaScriptRunner::IsRunning),
    });

    constructor = Napi::Persistent(func);
    constructor.SuppressDestruct();

    exports.Set("MgbaScriptRunner", func);
    return exports;
}

MgbaScriptRunner::MgbaScriptRunner(const Napi::CallbackInfo& info) 
    : Napi::ObjectWrap<MgbaScriptRunner>(info), core(nullptr), scriptContext(nullptr), running(false), runThread(nullptr) {
    Napi::Env env = info.Env();
    Napi::HandleScope scope(env);
}

MgbaScriptRunner::~MgbaScriptRunner() {
    if (running) {
        running = false;
        if (runThread && runThread->joinable()) {
            runThread->join();
            delete runThread;
        }
    }
    
    if (scriptContext) {
        mScriptContextDeinit(scriptContext);
        free(scriptContext);
    }
    
    if (core) {
        mCoreConfigDeinit(&core->config);
        core->deinit(core);
        free(core);
    }
}

Napi::Value MgbaScriptRunner::StartScript(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1) {
        Napi::TypeError::New(env, "Script path required").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    if (!info[0].IsString()) {
        Napi::TypeError::New(env, "Script path must be a string").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string scriptPath = info[0].As<Napi::String>().Utf8Value();
    
    try {
        // Initialize script context
        scriptContext = (struct mScriptContext*)calloc(1, sizeof(struct mScriptContext));
        mScriptContextInit(scriptContext);
        
        // Load and run the script
        struct VFile* vf = VFileOpen(scriptPath.c_str(), O_RDONLY);
        if (!vf) {
            Napi::Error::New(env, "Failed to open script file").ThrowAsJavaScriptException();
            return env.Null();
        }
        
        // Create a simple run thread that keeps the script context alive
        running = true;
        runThread = new std::thread([this, vf]() {
            // For now, just keep the context alive
            // TODO: Implement proper script execution
            while (running) {
                std::this_thread::sleep_for(std::chrono::milliseconds(100));
            }
            vf->close(vf);
        });
        
        return Napi::Boolean::New(env, true);
    } catch (const std::exception& e) {
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return env.Null();
    }
}

Napi::Value MgbaScriptRunner::StopScript(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (running) {
        running = false;
        if (runThread && runThread->joinable()) {
            runThread->join();
            delete runThread;
            runThread = nullptr;
        }
    }
    
    return Napi::Boolean::New(env, true);
}

Napi::Value MgbaScriptRunner::IsRunning(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Boolean::New(env, running);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    return MgbaScriptRunner::Init(env, exports);
}

NODE_API_MODULE(mgba_bridge, Init)