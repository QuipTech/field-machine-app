#pragma once
#include <WebView2.h>

HRESULT ServeCompatibilityResource(ICoreWebView2Environment *environment,
    ICoreWebView2WebResourceRequestedEventArgs *args);

#ifdef FIELD_MACHINE_COMPATIBILITY_APP
constexpr wchar_t PageUrl[] = L"https://staging-api.quiptechfield.com.au/_field_ltsc_/app";
constexpr wchar_t BundleUrl[] = L"https://staging-api.quiptechfield.com.au/_field_ltsc_/bundle.js";
constexpr wchar_t SessionPickerUrl[] = L"https://field-machine.test/session-picker";
constexpr wchar_t WindowTitle[] = L"FIELD Machine - LTSC";
constexpr wchar_t PagePolicy[] =
    L"Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; "
    L"script-src https://staging-api.quiptechfield.com.au/_field_ltsc_/bundle.js; "
    L"connect-src https://staging-api.quiptechfield.com.au wss://staging-api.quiptechfield.com.au; "
    L"frame-src https://field-machine.test/session-picker; "
    L"img-src data:; base-uri 'none'; frame-ancestors 'none'\r\n";
constexpr wchar_t SessionPickerPolicy[] =
    L"Content-Security-Policy: frame-ancestors https://staging-api.quiptechfield.com.au; base-uri 'none'\r\n";
HRESULT RegisterCompatibilityStorage(ICoreWebView2 *view);
bool HasLoadedCompatibilityResources();
void ResetCompatibilityResources();
#else
constexpr wchar_t PageUrl[] = L"https://field-machine.test/picker";
constexpr wchar_t WindowTitle[] = L"FIELD Machine LTSC 2019 Compatibility";
constexpr wchar_t PagePolicy[] =
    L"Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'\r\n";
#endif
