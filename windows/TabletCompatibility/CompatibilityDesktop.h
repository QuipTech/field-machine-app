#pragma once
#include <Windows.h>
#include <cstdint>
#include <functional>
#include <string>
#include <vector>
#include "CompatibilityFileBridge.h"

// Links the LTSC app to the FIELD Machine Desktop agent, which captures and
// controls whichever Windows session is on screen (including other users).
namespace FieldMachine::Compatibility {
struct DesktopCallbacks {
    std::function<void(std::vector<uint8_t> &&)> onFrame;
    std::function<void(std::string const &)> onJson;
    std::function<void(std::vector<uint8_t> &&)> onFile;
};

// Keeps reconnecting (e.g. after a user switch) and resends `startJson` each time.
void StartDesktopLink(std::string startJson, DesktopCallbacks callbacks);
bool WaitForDesktopLink(DWORD timeoutMs);
void StopDesktopLink() noexcept;
bool SendDesktopJson(std::string const &json);
bool IsDesktopLinked() noexcept;

// Fallback without the service: capture this user's screen inside the app.
void StartLocalCapture(std::function<void(std::vector<uint8_t> &&)> onFrame);
void StopLocalCapture() noexcept;

void RegisterDesktopView(Microsoft::WRL::ComPtr<ICoreWebView2> view);
bool ForwardDesktopInput(JsonObject const &message);
winrt::Windows::Foundation::IAsyncOperation<IJsonValue> RunDesktopOperation(JsonObject message);
}
