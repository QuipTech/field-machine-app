#include <Windows.h>
#include <WebView2.h>
#include <wrl.h>
#include <cmath>
#include <cwchar>
#include <winrt/Windows.Data.Json.h>
#include <winrt/Windows.Security.Credentials.h>
#include "CompatibilityContent.h"

namespace {
using winrt::Windows::Data::Json::JsonObject;
using winrt::Windows::Data::Json::JsonValue;
using winrt::Windows::Security::Credentials::PasswordCredential;
using winrt::Windows::Security::Credentials::PasswordVault;

constexpr wchar_t Resource[] = L"FIELD.Machine.Staging.LTSC";
constexpr wchar_t Key[] = L"pairing.staging.v1";

PasswordCredential ReadCredential(PasswordVault const &vault) {
    try {
        return vault.Retrieve(Resource, Key);
    } catch (winrt::hresult_error const &error) {
        if (error.code() != HRESULT_FROM_WIN32(ERROR_NOT_FOUND)) throw;
        return nullptr;
    }
}

JsonValue RunOperation(JsonObject const &message) {
    if (message.GetNamedString(L"key") != Key) throw winrt::hresult_invalid_argument();
    const auto operation = message.GetNamedString(L"operation");
    PasswordVault vault;
    if (operation == L"write") {
        const auto value = message.GetNamedString(L"value");
        if (value.empty() || value.size() > 20000) throw winrt::hresult_invalid_argument();
        vault.Add(PasswordCredential{Resource, Key, value});
    } else if (operation == L"read" || operation == L"remove") {
        auto credential = ReadCredential(vault);
        if (credential) {
            if (operation == L"remove") {
                vault.Remove(credential);
            } else {
                credential.RetrievePassword();
                return JsonValue::CreateStringValue(credential.Password());
            }
        }
    } else {
        throw winrt::hresult_invalid_argument();
    }
    return JsonValue::CreateNullValue();
}

HRESULT HandleMessage(ICoreWebView2 *view, ICoreWebView2WebMessageReceivedEventArgs *args) noexcept {
    try {
        PWSTR source = nullptr;
        const HRESULT sourceStatus = args->get_Source(&source);
        const bool trusted = SUCCEEDED(sourceStatus) && source && wcscmp(source, PageUrl) == 0;
        CoTaskMemFree(source);
        if (!trusted || !HasLoadedCompatibilityResources()) return S_OK;
        PWSTR raw = nullptr;
        const HRESULT status = args->get_WebMessageAsJson(&raw);
        JsonObject message{nullptr};
        bool valid = false;
        if (SUCCEEDED(status) && raw && wcsnlen_s(raw, 70000) < 70000) {
            try { valid = JsonObject::TryParse(raw, message); } catch (...) { }
        }
        CoTaskMemFree(raw);
        if (!valid || message.GetNamedString(L"type", L"") != L"field-storage") return S_OK;
        const double id = message.GetNamedNumber(L"id", 0);
        if (id <= 0 || id > 2147483647 || id != std::floor(id)) return S_OK;
        JsonObject reply;
        reply.SetNamedValue(L"type", JsonValue::CreateStringValue(L"field-storage"));
        reply.SetNamedValue(L"id", JsonValue::CreateNumberValue(id));
        try {
            reply.SetNamedValue(L"value", RunOperation(message));
            reply.SetNamedValue(L"ok", JsonValue::CreateBooleanValue(true));
        } catch (...) {
            reply.SetNamedValue(L"value", JsonValue::CreateNullValue());
            reply.SetNamedValue(L"ok", JsonValue::CreateBooleanValue(false));
        }
        return view->PostWebMessageAsJson(reply.Stringify().c_str());
    } catch (...) {
        return S_OK;
    }
}
}

HRESULT RegisterCompatibilityStorage(ICoreWebView2 *view) {
    EventRegistrationToken token{};
    auto callback = Microsoft::WRL::Callback<ICoreWebView2WebMessageReceivedEventHandler>(
        [](ICoreWebView2 *sender, ICoreWebView2WebMessageReceivedEventArgs *args) {
            return HandleMessage(sender, args);
        });
    return view->add_WebMessageReceived(callback.Get(), &token);
}
