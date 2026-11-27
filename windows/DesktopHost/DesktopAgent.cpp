#include <Windows.h>
#include <chrono>
#include <thread>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Data.Json.h>
#include "DesktopAgentState.h"
#include "DesktopCapture.h"
#include "DesktopLog.h"
#include "DesktopHost.h"
#include "DesktopSessionCheck.h"

namespace FieldMachine::Desktop {
namespace {
using winrt::Windows::Data::Json::JsonObject;
using winrt::Windows::Data::Json::JsonValue;
constexpr auto FrameInterval = std::chrono::milliseconds(125);
constexpr auto RecheckInterval = std::chrono::seconds(30);

std::string Event(const char *name, bool flag = false, const wchar_t *flagName = nullptr) {
    JsonObject event;
    event.SetNamedValue(L"event", JsonValue::CreateStringValue(winrt::to_hstring(name)));
    if (flagName) event.SetNamedValue(flagName, JsonValue::CreateBooleanValue(flag));
    return winrt::to_string(event.Stringify());
}

std::string Text(JsonObject const &message, const wchar_t *key) {
    return winrt::to_string(message.GetNamedString(key, L""));
}

void Start(JsonObject const &message) {
    auto token = Text(message, L"token");
    auto sessionId = Text(message, L"sessionId");
    const auto grant = CheckRemoteSession(token, sessionId);
    if (!grant.isActive) {
        Log("agent: session check denied (not active or wrong session)");
        StopSharing("denied");
        return;
    }
    auto &agent = Agent();
    {
        std::lock_guard lock(agent.mutex);
        agent.token = std::move(token);
        agent.sessionId = std::move(sessionId);
    }
    agent.canControl = grant.canControl;
    agent.isSharing = true;
    agent.wantsPanel = true;
    Log("agent: sharing started, control=%d", grant.canControl ? 1 : 0);
    agent.SendAppJson(Event("started", grant.canControl, L"control"));
}

void HandleApp(Message const &message) {
    if (message.kind != Kind::Json) return;
    JsonObject json{nullptr};
    const std::string_view text(reinterpret_cast<const char *>(message.body.data()), message.body.size());
    if (!JsonObject::TryParse(winrt::to_hstring(text), json)) return;
    const auto op = json.GetNamedString(L"op", L"");
    if (op == L"start") Start(json);
    else if (op == L"stop") StopSharing(nullptr);
    else if (op == L"input") QueueInput(json);
    else if (op == L"status") Agent().SendPanelJson(winrt::to_string(json.Stringify()));
}

void CaptureLoop() {
    winrt::init_apartment();
    auto &agent = Agent();
    for (;;) {
        const auto started = std::chrono::steady_clock::now();
        if (agent.isSharing) {
            const auto jpeg = CaptureScreenJpeg();
            const bool isSent = !jpeg.empty() && agent.isSharing && agent.SendApp(Kind::Frame, jpeg.data(), jpeg.size());
            static unsigned frames = 0;
            static unsigned failures = 0;
            (isSent ? frames : failures)++;
            if ((frames + failures) % 80 == 0) Log("agent: frames sent=%u failed=%u", frames, failures);
            std::this_thread::sleep_until(started + FrameInterval);
        } else {
            std::this_thread::sleep_for(std::chrono::milliseconds(200));
        }
    }
}

// Sharing stops within one interval after the Portal ends or revokes the session.
void RecheckLoop() {
    winrt::init_apartment();
    auto &agent = Agent();
    for (;;) {
        std::this_thread::sleep_for(RecheckInterval);
        if (!agent.isSharing) continue;
        std::string token;
        std::string sessionId;
        {
            std::lock_guard lock(agent.mutex);
            token = agent.token;
            sessionId = agent.sessionId;
        }
        const auto grant = CheckRemoteSession(token, sessionId);
        if (!grant.isActive) StopSharing("ended");
        else agent.canControl = grant.canControl;
    }
}

void ServeApp(HANDLE pipe) {
    Agent().SetApp(pipe);
    Message message;
    while (ReadMessage(pipe, message)) HandleApp(message);
    StopSharing(nullptr);
    Agent().SetApp(INVALID_HANDLE_VALUE);
}
}

AgentState &Agent() {
    static AgentState state;
    return state;
}

void StopSharing(const char *event) {
    auto &agent = Agent();
    agent.isSharing = false;
    agent.canControl = false;
    agent.wantsPanel = false;
    ResetInput();
    {
        std::lock_guard lock(agent.mutex);
        agent.token.clear();
        agent.sessionId.clear();
        if (agent.panel != INVALID_HANDLE_VALUE) CancelIoEx(agent.panel, nullptr);
    }
    Log("agent: sharing stopped (%s)", event ? event : "app request");
    if (event) agent.SendAppJson(Event(event));
}

int RunAgent() {
    Log("agent: started");
    winrt::init_apartment();
    std::thread(CaptureLoop).detach();
    std::thread(RecheckLoop).detach();
    std::thread(RunPanelLoop).detach();
    std::thread(RunInputLoop).detach();
    for (;;) {
        const HANDLE pipe = CreateServerPipe(AppPipe);
        if (pipe == INVALID_HANDLE_VALUE) {
            Sleep(1000);
            continue;
        }
        if (!AcceptClient(pipe)) {
            Log("agent: accept failed, error %lu", GetLastError());
        } else if (!IsPeer(pipe, false, AppFileName)) {
            Log("agent: rejected a client that is not the installed app");
        } else {
            Log("agent: app connected");
            ServeApp(pipe);
            Log("agent: app disconnected");
        }
        DisconnectNamedPipe(pipe);
        CloseHandle(pipe);
    }
}
}
