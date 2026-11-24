#include <Windows.h>
#include <ShlObj.h>
#include <WebView2.h>
#include <roapi.h>
#include <wrl.h>
#include <cwchar>
#include <string>
#include "CompatibilityContent.h"
#ifdef FIELD_MACHINE_COMPATIBILITY_APP
#include "CompatibilityFileBridge.h"
#endif

using Microsoft::WRL::Callback;
using Microsoft::WRL::ComPtr;

namespace {
constexpr wchar_t WindowClass[] = L"FieldMachineCompatibilityProbe";
ComPtr<ICoreWebView2Controller> controller;

void ReportFailure(HWND window, const wchar_t *step, HRESULT result) {
    wchar_t message[256]{};
    swprintf_s(message, L"%ls (0x%08lX). Check that Microsoft Edge WebView2 Runtime is installed.",
        step, static_cast<unsigned long>(result));
    MessageBoxW(window, message, WindowTitle, MB_OK | MB_ICONERROR);
}

HRESULT LoadPicker(HWND window, ICoreWebView2Environment *environment) {
    RECT bounds{};
    GetClientRect(window, &bounds);
    controller->put_Bounds(bounds);
    ComPtr<ICoreWebView2> view;
    HRESULT result = controller->get_CoreWebView2(&view);
    if (FAILED(result)) return result;
    ComPtr<ICoreWebView2Settings> settings;
    if (SUCCEEDED(view->get_Settings(&settings))) {
        settings->put_AreDevToolsEnabled(FALSE);
        settings->put_AreDefaultContextMenusEnabled(FALSE);
        settings->put_AreHostObjectsAllowed(FALSE);
    }
    result = view->AddWebResourceRequestedFilter(PageUrl, COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL);
    if (FAILED(result)) return result;
#ifdef FIELD_MACHINE_COMPATIBILITY_APP
    result = view->AddWebResourceRequestedFilter(BundleUrl, COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL);
    if (FAILED(result)) return result;
    result = view->AddWebResourceRequestedFilter(SessionPickerUrl, COREWEBVIEW2_WEB_RESOURCE_CONTEXT_DOCUMENT);
    if (FAILED(result)) return result;
    result = RegisterCompatibilityStorage(view.Get());
    if (FAILED(result)) return result;
    result = FieldMachine::Compatibility::RegisterFileBridge(view.Get(), window);
    if (FAILED(result)) return result;
#endif
    EventRegistrationToken token{};
    auto resource = Callback<ICoreWebView2WebResourceRequestedEventHandler>(
        [environment = ComPtr<ICoreWebView2Environment>(environment)](
            ICoreWebView2 *, ICoreWebView2WebResourceRequestedEventArgs *args) {
            return ServeCompatibilityResource(environment.Get(), args);
        });
    result = view->add_WebResourceRequested(resource.Get(), &token);
    if (FAILED(result)) return result;
    auto navigation = Callback<ICoreWebView2NavigationStartingEventHandler>(
        [](ICoreWebView2 *, ICoreWebView2NavigationStartingEventArgs *args) {
            PWSTR uri = nullptr;
            const HRESULT status = args->get_Uri(&uri);
            const bool allowed = SUCCEEDED(status) && uri && wcscmp(uri, PageUrl) == 0;
            CoTaskMemFree(uri);
#ifdef FIELD_MACHINE_COMPATIBILITY_APP
            if (allowed) ResetCompatibilityResources();
#endif
            return args->put_Cancel(!allowed);
        });
    result = view->add_NavigationStarting(navigation.Get(), &token);
    if (FAILED(result)) return result;
#ifdef FIELD_MACHINE_COMPATIBILITY_APP
    auto frameNavigation = Callback<ICoreWebView2NavigationStartingEventHandler>(
        [](ICoreWebView2 *, ICoreWebView2NavigationStartingEventArgs *args) {
            PWSTR uri = nullptr;
            const HRESULT status = args->get_Uri(&uri);
            const bool allowed = SUCCEEDED(status) && uri && wcscmp(uri, SessionPickerUrl) == 0;
            CoTaskMemFree(uri);
            return args->put_Cancel(!allowed);
        });
    result = view->add_FrameNavigationStarting(frameNavigation.Get(), &token);
    if (FAILED(result)) return result;
#endif
    auto newWindow = Callback<ICoreWebView2NewWindowRequestedEventHandler>(
        [](ICoreWebView2 *, ICoreWebView2NewWindowRequestedEventArgs *args) {
            return args->put_Handled(TRUE);
        });
    result = view->add_NewWindowRequested(newWindow.Get(), &token);
    if (FAILED(result)) return result;
    auto titleChanged = Callback<ICoreWebView2DocumentTitleChangedEventHandler>(
        [window](ICoreWebView2 *sender, IUnknown *) {
            PWSTR title = nullptr;
            if (SUCCEEDED(sender->get_DocumentTitle(&title)) && title) {
                for (const auto label : {L"Picker ready", L"Capture unavailable", L"Capture active", L"Capture stopped"}) {
                    if (wcscmp(title, label) == 0) {
                        SetWindowTextW(window, (std::wstring(WindowTitle) + L" - " + label).c_str());
                        break;
                    }
                }
            }
            CoTaskMemFree(title);
            return S_OK;
        });
    result = view->add_DocumentTitleChanged(titleChanged.Get(), &token);
    return FAILED(result) ? result : view->Navigate(PageUrl);
}

HRESULT StartWebView(HWND window) {
    PWSTR localAppData = nullptr;
    const HRESULT pathResult = SHGetKnownFolderPath(FOLDERID_LocalAppData, 0, nullptr, &localAppData);
    if (FAILED(pathResult)) return pathResult;
#ifdef FIELD_MACHINE_COMPATIBILITY_APP
    constexpr wchar_t profileSuffix[] = L"\\FieldMachineCompatibility\\TabletWebView2";
#else
    constexpr wchar_t profileSuffix[] = L"\\FieldMachineCompatibility\\WebView2";
#endif
    const std::wstring profile = std::wstring(localAppData) + profileSuffix;
    CoTaskMemFree(localAppData);
    auto environmentCreated = Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
        [window](HRESULT result, ICoreWebView2Environment *environment) {
            if (!IsWindow(window)) return S_OK;
            if (FAILED(result) || !environment) {
                ReportFailure(window, L"Could not start WebView2", FAILED(result) ? result : E_FAIL);
                return S_OK;
            }
            auto created = Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
                [window, environment = ComPtr<ICoreWebView2Environment>(environment)](
                    HRESULT status, ICoreWebView2Controller *value) {
                    if (!IsWindow(window)) return S_OK;
                    if (SUCCEEDED(status) && value) {
                        controller = value;
                        status = LoadPicker(window, environment.Get());
                    } else if (SUCCEEDED(status)) {
                        status = E_FAIL;
                    }
                    if (FAILED(status)) ReportFailure(window, L"Could not load the screen picker", status);
                    return S_OK;
                });
            result = environment->CreateCoreWebView2Controller(window, created.Get());
            if (FAILED(result)) ReportFailure(window, L"Could not create the WebView2 window", result);
            return S_OK;
        });
    return CreateCoreWebView2EnvironmentWithOptions(nullptr, profile.c_str(), nullptr, environmentCreated.Get());
}

LRESULT CALLBACK ProcessWindow(HWND window, UINT message, WPARAM wparam, LPARAM lparam) {
    if (message == WM_SIZE && controller) {
        RECT bounds{};
        GetClientRect(window, &bounds);
        controller->put_Bounds(bounds);
    }
    if (message == WM_MOVE && controller) controller->NotifyParentWindowPositionChanged();
    if (message == WM_DESTROY) {
        if (controller) controller->Close();
        controller.Reset();
        PostQuitMessage(0);
        return 0;
    }
    return DefWindowProcW(window, message, wparam, lparam);
}
}

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int show) {
    if (FAILED(RoInitialize(RO_INIT_SINGLETHREADED))) return 1;
    SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
    WNDCLASSW windowClass{};
    windowClass.hInstance = instance;
    windowClass.lpfnWndProc = ProcessWindow;
    windowClass.lpszClassName = WindowClass;
    windowClass.hCursor = LoadCursorW(nullptr, IDC_ARROW);
    windowClass.hbrBackground = reinterpret_cast<HBRUSH>(COLOR_WINDOW + 1);
    RegisterClassW(&windowClass);
    const HWND window = CreateWindowExW(0, WindowClass, WindowTitle, WS_OVERLAPPEDWINDOW,
        CW_USEDEFAULT, CW_USEDEFAULT, 980, 680, nullptr, nullptr, instance, nullptr);
    int exitCode = 1;
    if (window) {
        ShowWindow(window, show);
        const HRESULT result = StartWebView(window);
        if (FAILED(result)) ReportFailure(window, L"Could not initialize the compatibility probe", result);
        MSG message{};
        while (GetMessageW(&message, nullptr, 0, 0) > 0) {
            TranslateMessage(&message);
            DispatchMessageW(&message);
        }
        exitCode = static_cast<int>(message.wParam);
    }
    RoUninitialize();
    return exitCode;
}
