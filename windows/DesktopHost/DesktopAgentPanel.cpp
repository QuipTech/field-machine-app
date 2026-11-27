#include <Windows.h>
#include <string>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Data.Json.h>
#include "DesktopAgentState.h"
#include "DesktopLaunch.h"
#include "DesktopLog.h"

namespace FieldMachine::Desktop {
namespace {
using winrt::Windows::Data::Json::JsonObject;
using winrt::Windows::Data::Json::JsonValue;

void RelayToApp(Message const &message) {
    auto &agent = Agent();
    if (!agent.isSharing) return;
    if (message.kind == Kind::File) {
        agent.SendApp(Kind::File, message.body.data(), message.body.size());
        return;
    }
    if (message.kind != Kind::Json) return;
    JsonObject json{nullptr};
    const std::string_view text(reinterpret_cast<const char *>(message.body.data()), message.body.size());
    if (!JsonObject::TryParse(winrt::to_hstring(text), json)) return;
    const auto op = json.GetNamedString(L"op", L"");
    if (op == L"stop") {
        // Stop capture here first so sharing ends even if the app is slow to react.
        StopSharing("stop");
    } else if (op == L"mic") {
        JsonObject event;
        event.SetNamedValue(L"event", JsonValue::CreateStringValue(L"mic"));
        event.SetNamedValue(L"on", JsonValue::CreateBooleanValue(json.GetNamedBoolean(L"on", false)));
        agent.SendAppJson(winrt::to_string(event.Stringify()));
    }
}

void ServePanel(HANDLE pipe) {
    auto &agent = Agent();
    agent.SetPanel(pipe);
    agent.SendPanelJson(R"({"op":"status","text":"Sharing this screen with FIELD Portal support."})");
    Message message;
    while (agent.wantsPanel && ReadMessage(pipe, message)) RelayToApp(message);
    agent.SetPanel(INVALID_HANDLE_VALUE);
}
}

// Shows the support panel to whoever is signed in to this session while
// sharing is active. Retries until a user signs in on the sign-in screen.
void RunPanelLoop() {
    winrt::init_apartment();
    auto &agent = Agent();
    DWORD session = 0;
    ProcessIdToSessionId(GetCurrentProcessId(), &session);
    const std::wstring name = PanelPipePrefix + std::to_wstring(session);
    for (;;) {
        if (!agent.wantsPanel) {
            Sleep(300);
            continue;
        }
        const HANDLE pipe = CreateServerPipe(name);
        PROCESS_INFORMATION panel{};
        if (pipe == INVALID_HANDLE_VALUE || !LaunchAsUser(session, L"--panel", panel)) {
            Log("agent: panel not started (no signed-in user yet?), error %lu", GetLastError());
            if (pipe != INVALID_HANDLE_VALUE) CloseHandle(pipe);
            Sleep(2000);
            continue;
        }
        if (AcceptClient(pipe, 15000) && IsPeer(pipe, false, HostFileName)) {
            Log("agent: panel connected");
            ServePanel(pipe);
        } else {
            Log("agent: panel did not connect");
        }
        DisconnectNamedPipe(pipe);
        CloseHandle(pipe);
        EndProcess(panel);
        if (agent.wantsPanel) Sleep(1000);
    }
}
}
