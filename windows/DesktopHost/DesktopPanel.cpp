#include <Windows.h>
#include <commdlg.h>
#include <shellapi.h>
#include <memory>
#include <thread>
#include <vector>
#include "DesktopHost.h"
#include "DesktopPanel.h"
#include "DesktopPanelLayout.h"
#include "DesktopLog.h"

namespace FieldMachine::Desktop {
namespace {
HBRUSH headerBrush = nullptr;
bool isMicrophoneOn = false;

void SendFiles(HWND window, std::vector<std::wstring> paths) {
    std::thread([window, paths = std::move(paths)] {
        for (auto const &path : paths) {
            const auto name = path.substr(path.find_last_of(L'\\') + 1);
            const auto error = SendPanelFile(path);
            PostPanelStatus(window, error.empty() ? L"Sending " + name + L" to Portal…" : error);
        }
    }).detach();
}

void BrowseFiles(HWND window) {
    wchar_t path[MAX_PATH * 2]{};
    OPENFILENAMEW dialog{sizeof(dialog)};
    dialog.hwndOwner = window;
    dialog.lpstrFilter = L"Portal documents\0*.pdf;*.doc;*.docx;*.jpg;*.jpeg;*.png;*.heic\0";
    dialog.lpstrFile = path;
    dialog.nMaxFile = static_cast<DWORD>(std::size(path));
    dialog.Flags = OFN_FILEMUSTEXIST | OFN_PATHMUSTEXIST | OFN_EXPLORER;
    if (GetOpenFileNameW(&dialog)) SendFiles(window, {path});
}

void DropFiles(HWND window, HDROP drop) {
    std::vector<std::wstring> paths;
    const UINT count = DragQueryFileW(drop, 0xFFFFFFFF, nullptr, 0);
    for (UINT index = 0; index < count && index < 10; ++index) {
        wchar_t path[MAX_PATH * 2]{};
        if (DragQueryFileW(drop, index, path, static_cast<UINT>(std::size(path)))) paths.emplace_back(path);
    }
    DragFinish(drop);
    SendFiles(window, std::move(paths));
}

void OnCommand(HWND window, int id) {
    if (id == Collapse) SetPanelCollapsed(window, true);
    if (id == Expand) SetPanelCollapsed(window, false);
    if (id == Browse) BrowseFiles(window);
    if (id == Microphone) {
        isMicrophoneOn = !isMicrophoneOn;
        SendPanelCommand(isMicrophoneOn ? R"({"op":"mic","on":true})" : R"({"op":"mic","on":false})");
        SetWindowTextW(PanelItem(window, Microphone), isMicrophoneOn ? L"Microphone: On" : L"Microphone: Off");
    }
    if (id == Stop) {
        SendPanelCommand(R"({"op":"stop"})");
        AddPanelActivity(window, L"Ending the remote session…");
        EnableWindow(PanelItem(window, Stop), FALSE);
    }
}

LRESULT CALLBACK PanelProc(HWND window, UINT message, WPARAM wparam, LPARAM lparam) {
    switch (message) {
    case WM_CREATE:
        CreatePanelLayout(window);
        DragAcceptFiles(window, TRUE);
        return 0;
    case WM_COMMAND:
        OnCommand(window, LOWORD(wparam));
        return 0;
    case WM_DROPFILES:
        DropFiles(window, reinterpret_cast<HDROP>(wparam));
        return 0;
    case WM_DISPLAYCHANGE:
    case WM_SETTINGCHANGE:
        // Keep the panel on the right edge when the screen or taskbar changes.
        SetPanelCollapsed(window, !IsWindowVisible(PanelItem(window, Title)));
        return 0;
    case PanelStatusMessage: {
        const std::unique_ptr<std::wstring> text(reinterpret_cast<std::wstring *>(lparam));
        AddPanelActivity(window, *text);
        return 0;
    }
    case PanelClosedMessage:
        DestroyWindow(window);
        return 0;
    case WM_CTLCOLORSTATIC:
        if (GetDlgCtrlID(reinterpret_cast<HWND>(lparam)) != Title) break;
        SetTextColor(reinterpret_cast<HDC>(wparam), RGB(255, 255, 255));
        SetBkColor(reinterpret_cast<HDC>(wparam), RGB(46, 31, 140));
        return reinterpret_cast<LRESULT>(headerBrush);
    case WM_DESTROY:
        PostQuitMessage(0);
        return 0;
    }
    return DefWindowProcW(window, message, wparam, lparam);
}
}

int RunPanel(HINSTANCE instance) {
    if (!ConnectPanelLink()) {
        Log("panel: could not connect to the agent");
        return 1;
    }
    Log("panel: connected");
    headerBrush = CreateSolidBrush(RGB(46, 31, 140));
    WNDCLASSW windowClass{};
    windowClass.hInstance = instance;
    windowClass.lpfnWndProc = PanelProc;
    windowClass.lpszClassName = L"FieldMachineSupportPanel";
    windowClass.hCursor = LoadCursorW(nullptr, IDC_ARROW);
    windowClass.hbrBackground = reinterpret_cast<HBRUSH>(COLOR_BTNFACE + 1);
    RegisterClassW(&windowClass);
    // The layout positions and sizes the window on the right edge in WM_CREATE.
    const HWND window = CreateWindowExW(WS_EX_TOPMOST | WS_EX_TOOLWINDOW, windowClass.lpszClassName,
        L"FIELD Remote Support", WS_POPUP | WS_BORDER, 0, 0, 1, 1, nullptr, nullptr, instance, nullptr);
    if (!window) return 1;
    ShowWindow(window, SW_SHOWNOACTIVATE);
    ListenPanelLink(window);
    MSG message{};
    while (GetMessageW(&message, nullptr, 0, 0) > 0) {
        TranslateMessage(&message);
        DispatchMessageW(&message);
    }
    return 0;
}
}
