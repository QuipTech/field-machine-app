#include <Windows.h>
#include <wrl.h>
#include "CompatibilityFileBridge.h"
#include "CompatibilityDesktop.h"
#include "../FieldMachine/Native/RemoteDesktopInputState.h"

namespace FieldMachine::Compatibility {
namespace {
Native::RemoteDesktopInputState input;

std::string Text(JsonObject const &message, std::wstring_view key) {
    return winrt::to_string(message.GetNamedString(key));
}
}

void StopRemoteInput() noexcept {
    StopDesktopLink();
    StopLocalCapture();
    try {
        input.Stop();
    } catch (...) {
        // Teardown continues even if Windows rejects a release event.
    }
}

// Completes synchronously on the UI thread, so input keeps its arrival order.
winrt::Windows::Foundation::IAsyncOperation<IJsonValue> RunInputOperation(JsonObject message) {
    // While the desktop agent shares the screen, it injects input on the active session.
    if (IsDesktopLinked()) co_return JsonValue::CreateBooleanValue(ForwardDesktopInput(message));
    const auto operation = message.GetNamedString(L"operation");
    const auto owner = Text(message, L"owner");
    if (operation == L"start") {
        co_return JsonValue::CreateBooleanValue(input.Start(owner));
    }
    if (operation == L"release" || operation == L"end") {
        input.Reset(owner, operation == L"end");
        co_return JsonValue::CreateBooleanValue(true);
    }
    if (operation != L"apply") throw winrt::hresult_invalid_argument();
    co_return JsonValue::CreateBooleanValue(input.ApplyInput(owner,
        Text(message, L"kind"), Text(message, L"action"),
        message.GetNamedNumber(L"x"), message.GetNamedNumber(L"y"),
        message.GetNamedNumber(L"first"), message.GetNamedNumber(L"second"), Text(message, L"value")));
}

// A crashed page cannot send its own release, so never leave a key or button held.
HRESULT RegisterInputSafety(ICoreWebView2 *view) {
    EventRegistrationToken token{};
    auto callback = Microsoft::WRL::Callback<ICoreWebView2ProcessFailedEventHandler>(
        [](ICoreWebView2 *, ICoreWebView2ProcessFailedEventArgs *) {
            StopRemoteInput();
            return S_OK;
        });
    return view->add_ProcessFailed(callback.Get(), &token);
}
}
