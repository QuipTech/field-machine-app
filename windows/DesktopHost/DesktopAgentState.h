#pragma once
#include <Windows.h>
#include <atomic>
#include <mutex>
#include <string>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Data.Json.h>
#include "DesktopProtocol.h"
#include "../FieldMachine/Native/RemoteDesktopInputState.h"

namespace FieldMachine::Desktop {
// State shared by the agent's app, capture, check and panel threads.
struct AgentState {
    std::mutex mutex; // Guards token, sessionId and the pipe handles.
    std::string token;
    std::string sessionId;
    HANDLE app = INVALID_HANDLE_VALUE;
    HANDLE panel = INVALID_HANDLE_VALUE;
    std::atomic<bool> isSharing{false};
    std::atomic<bool> canControl{false};
    std::atomic<bool> wantsPanel{false};
    Native::RemoteDesktopInputState input;

    bool SendApp(Kind kind, const void *data, size_t size) {
        std::lock_guard lock(m_appWrite);
        const HANDLE pipe = ReadHandle(app);
        return pipe != INVALID_HANDLE_VALUE && WriteMessage(pipe, kind, data, size);
    }

    bool SendAppJson(std::string const &json) { return SendApp(Kind::Json, json.data(), json.size()); }

    bool SendPanelJson(std::string const &json) {
        std::lock_guard lock(m_panelWrite);
        const HANDLE pipe = ReadHandle(panel);
        return pipe != INVALID_HANDLE_VALUE && WriteJson(pipe, json);
    }

    HANDLE ReadHandle(HANDLE const &handle) {
        std::lock_guard lock(mutex);
        return handle;
    }

    // Taking the write lock first means no writer still holds a closed handle.
    void SetApp(HANDLE pipe) { Replace(m_appWrite, app, pipe); }
    void SetPanel(HANDLE pipe) { Replace(m_panelWrite, panel, pipe); }

private:
    void Replace(std::mutex &writer, HANDLE &slot, HANDLE pipe) {
        std::lock_guard writeLock(writer);
        std::lock_guard lock(mutex);
        slot = pipe;
    }

    std::mutex m_appWrite;
    std::mutex m_panelWrite;
};

AgentState &Agent();
// Stops capture, control and the panel. A non-empty event is reported to the app.
void StopSharing(const char *event);
void RunPanelLoop();
// Remote control runs on its own thread that follows the active desktop.
void QueueInput(winrt::Windows::Data::Json::JsonObject message);
void ResetInput();
void RunInputLoop();
}
