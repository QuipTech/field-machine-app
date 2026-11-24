#include <Windows.h>
#include <Shlwapi.h>
#include <WebView2.h>
#include <wrl.h>
#include <cwchar>
#include <string>
#include "CompatibilityContent.h"

using Microsoft::WRL::ComPtr;

#ifdef FIELD_MACHINE_COMPATIBILITY_APP
namespace {
bool pageServed = false;
bool bundleServed = false;
}

bool HasLoadedCompatibilityResources() {
    return pageServed && bundleServed;
}

void ResetCompatibilityResources() {
    pageServed = false;
    bundleServed = false;
}
#endif

HRESULT ServeCompatibilityResource(ICoreWebView2Environment *environment,
    ICoreWebView2WebResourceRequestedEventArgs *args) {
    ComPtr<ICoreWebView2WebResourceRequest> request;
    if (FAILED(args->get_Request(&request))) return E_FAIL;
    PWSTR uri = nullptr;
    if (FAILED(request->get_Uri(&uri)) || !uri) return E_FAIL;
    const bool isPage = wcscmp(uri, PageUrl) == 0;
    int resourceId = isPage ? 101 : 0;
    const wchar_t *policy = PagePolicy;
#ifdef FIELD_MACHINE_COMPATIBILITY_APP
    if (wcscmp(uri, BundleUrl) == 0) resourceId = 102;
    if (wcscmp(uri, SessionPickerUrl) == 0) {
        resourceId = 103;
        policy = SessionPickerPolicy;
    }
#endif
    CoTaskMemFree(uri);
    if (!resourceId) return S_OK;
    const HINSTANCE instance = GetModuleHandleW(nullptr);
    const HRSRC resource = FindResourceW(instance, MAKEINTRESOURCEW(resourceId), RT_RCDATA);
    if (!resource) return HRESULT_FROM_WIN32(GetLastError());
    const HGLOBAL data = LoadResource(instance, resource);
    const auto bytes = static_cast<const BYTE *>(data ? LockResource(data) : nullptr);
    const DWORD length = SizeofResource(instance, resource);
    if (!bytes || !length) return E_FAIL;
    ComPtr<IStream> stream;
    stream.Attach(SHCreateMemStream(bytes, length));
    if (!stream) return E_OUTOFMEMORY;
    ComPtr<ICoreWebView2WebResourceResponse> response;
    const std::wstring headers = resourceId == 102
        ? L"Content-Type: application/javascript; charset=utf-8\r\nCache-Control: no-store\r\n"
        : std::wstring(L"Content-Type: text/html; charset=utf-8\r\nCache-Control: no-store\r\n") + policy;
    const HRESULT result = environment->CreateWebResourceResponse(
        stream.Get(), 200, L"OK", headers.c_str(), &response);
    if (FAILED(result)) return result;
    const HRESULT served = args->put_Response(response.Get());
#ifdef FIELD_MACHINE_COMPATIBILITY_APP
    if (SUCCEEDED(served)) {
        if (isPage) pageServed = true;
        if (resourceId == 102 && pageServed) bundleServed = true;
    }
#endif
    return served;
}
