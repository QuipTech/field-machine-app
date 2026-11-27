#pragma once
#include <WebView2.h>
#include <wrl/client.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Data.Json.h>

namespace FieldMachine::Compatibility {
using winrt::Windows::Data::Json::IJsonValue;
using winrt::Windows::Data::Json::JsonObject;
using winrt::Windows::Data::Json::JsonValue;

HRESULT RegisterFileBridge(ICoreWebView2 *view, HWND window);
HRESULT RegisterInputSafety(ICoreWebView2 *view);
void StopRemoteInput() noexcept;
winrt::Windows::Foundation::IAsyncOperation<IJsonValue> RunInputOperation(JsonObject message);
winrt::Windows::Foundation::IAsyncOperation<IJsonValue> RunDesignOperation(JsonObject message);
winrt::Windows::Foundation::IAsyncOperation<IJsonValue> RunAccessOperation(JsonObject message);
winrt::Windows::Foundation::IAsyncOperation<IJsonValue> RunPortalFileOperation(
    JsonObject message, Microsoft::WRL::ComPtr<ICoreWebView2> view, HWND window);
}
