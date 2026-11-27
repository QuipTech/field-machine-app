#include <Windows.h>
#include <wrl.h>
#include <cwchar>
#include "CompatibilityFileBridge.h"
#include "CompatibilityContent.h"
#include "CompatibilityDesktop.h"
#include "../FieldMachine/Native/PortalTransferStorage.h"

namespace FieldMachine::Compatibility {
namespace {
winrt::fire_and_forget Respond(Microsoft::WRL::ComPtr<ICoreWebView2> view,
    JsonObject message, winrt::hstring type, winrt::hstring id, HWND window) {
    try {
        JsonObject response;
        response.SetNamedValue(L"type", JsonValue::CreateStringValue(type));
        response.SetNamedValue(L"id", JsonValue::CreateStringValue(id));
        try {
            auto operation = type == L"field-input" ? RunInputOperation(std::move(message))
                : type == L"field-design" ? RunDesignOperation(std::move(message))
                : type == L"field-desktop" ? RunDesktopOperation(std::move(message))
                : type == L"field-access" ? RunAccessOperation(std::move(message))
                : RunPortalFileOperation(std::move(message), view, window);
            response.SetNamedValue(L"value", co_await operation);
            response.SetNamedValue(L"ok", JsonValue::CreateBooleanValue(true));
        } catch (...) {
            response.SetNamedValue(L"value", JsonValue::CreateNullValue());
            response.SetNamedValue(L"ok", JsonValue::CreateBooleanValue(false));
        }
        if (HasLoadedCompatibilityResources()) view->PostWebMessageAsJson(response.Stringify().c_str());
    } catch (...) {
        // A closing WebView can no longer receive a reply.
    }
}

HRESULT OnMessage(ICoreWebView2 *view, ICoreWebView2WebMessageReceivedEventArgs *args, HWND window) noexcept {
    try {
        PWSTR source = nullptr;
        const auto sourceStatus = args->get_Source(&source);
        const bool trusted = SUCCEEDED(sourceStatus) && source && wcscmp(source, PageUrl) == 0;
        CoTaskMemFree(source);
        if (!trusted || !HasLoadedCompatibilityResources()) return S_OK;

        PWSTR raw = nullptr;
        const auto status = args->get_WebMessageAsJson(&raw);
        std::unique_ptr<wchar_t, decltype(&CoTaskMemFree)> payload(raw, CoTaskMemFree);
        constexpr size_t MaxPayload = 4 * 1024 * 1024;
        JsonObject message{nullptr};
        if (FAILED(status) || !raw || wcsnlen_s(raw, MaxPayload) == MaxPayload ||
            !JsonObject::TryParse(raw, message)) {
            return S_OK;
        }
        auto type = message.GetNamedString(L"type", L"");
        if (type != L"field-input" && type != L"field-design" && type != L"field-portal-files" &&
            type != L"field-desktop" && type != L"field-access") return S_OK;
        auto id = message.GetNamedString(L"id", L"");
        if (id.size() == 36 && Native::IsTransferId(winrt::to_string(id))) {
            Respond(Microsoft::WRL::ComPtr<ICoreWebView2>(view), std::move(message),
                std::move(type), std::move(id), window);
        }
    } catch (...) {
        // Malformed bridge messages cannot invoke a native operation.
    }
    return S_OK;
}
}

HRESULT RegisterFileBridge(ICoreWebView2 *view, HWND window) {
    const HRESULT safety = RegisterInputSafety(view);
    if (FAILED(safety)) return safety;
    RegisterDesktopView(Microsoft::WRL::ComPtr<ICoreWebView2>(view));
    EventRegistrationToken token{};
    auto callback = Microsoft::WRL::Callback<ICoreWebView2WebMessageReceivedEventHandler>(
        [window](ICoreWebView2 *sender, ICoreWebView2WebMessageReceivedEventArgs *args) {
            return OnMessage(sender, args, window);
        });
    return view->add_WebMessageReceived(callback.Get(), &token);
}
}
