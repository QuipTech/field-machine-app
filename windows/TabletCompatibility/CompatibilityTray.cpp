#include "CompatibilityTray.h"
#include <CommCtrl.h>
#include <shellapi.h>
#include <cwchar>
#include "CompatibilityContent.h"

namespace FieldMachine::Compatibility {
namespace {
constexpr UINT TrayMessage = WM_APP + 40;
constexpr UINT TrayIconId = 1;
constexpr UINT_PTR SubclassId = 1;
constexpr int OpenCommand = 1;
const UINT TaskbarCreated = RegisterWindowMessageW(L"TaskbarCreated");
const UINT ShowRequest = RegisterWindowMessageW(L"FieldMachineShowWindow");

void AddIcon(HWND window) {
    NOTIFYICONDATAW icon{sizeof(icon)};
    icon.hWnd = window;
    icon.uID = TrayIconId;
    icon.uFlags = NIF_MESSAGE | NIF_ICON | NIF_TIP;
    icon.uCallbackMessage = TrayMessage;
    icon.hIcon = LoadIconW(nullptr, IDI_APPLICATION);
    wcscpy_s(icon.szTip, L"FIELD Machine - reachable by FIELD Portal support");
    Shell_NotifyIconW(NIM_ADD, &icon);
}

void RemoveIcon(HWND window) {
    NOTIFYICONDATAW icon{sizeof(icon)};
    icon.hWnd = window;
    icon.uID = TrayIconId;
    Shell_NotifyIconW(NIM_DELETE, &icon);
}

void Restore(HWND window) {
    ShowWindow(window, IsIconic(window) ? SW_RESTORE : SW_SHOW);
    SetForegroundWindow(window);
}

void ShowMenu(HWND window) {
    const HMENU menu = CreatePopupMenu();
    AppendMenuW(menu, MF_STRING, OpenCommand, L"Open FIELD Machine");
    POINT cursor{};
    GetCursorPos(&cursor);
    SetForegroundWindow(window);
    const int choice = TrackPopupMenu(menu, TPM_RETURNCMD | TPM_RIGHTBUTTON, cursor.x, cursor.y, 0, window, nullptr);
    DestroyMenu(menu);
    if (choice == OpenCommand) Restore(window);
}

// There is deliberately no Exit item: the app must stay reachable. Sign-out
// and shutdown still end it through WM_ENDSESSION.
LRESULT CALLBACK TrayProc(HWND window, UINT message, WPARAM wparam, LPARAM lparam, UINT_PTR, DWORD_PTR) {
    if (message == WM_CLOSE) {
        ShowWindow(window, SW_HIDE);
        return 0;
    }
    if (message == TrayMessage && (lparam == WM_LBUTTONUP || lparam == WM_LBUTTONDBLCLK)) Restore(window);
    if (message == TrayMessage && lparam == WM_RBUTTONUP) ShowMenu(window);
    if (message == ShowRequest) Restore(window);
    if (message == TaskbarCreated) AddIcon(window); // Explorer restarted.
    if (message == WM_DESTROY) {
        RemoveIcon(window);
        RemoveWindowSubclass(window, TrayProc, SubclassId);
    }
    return DefSubclassProc(window, message, wparam, lparam);
}
}

int PrepareTabletShell(HWND window, int show) {
    // Global: one app per tablet across Windows users, because one desktop
    // service link and one Portal identity serve the whole machine.
    CreateMutexW(nullptr, TRUE, L"Global\\FieldMachineTabletApp");
    if (GetLastError() == ERROR_ALREADY_EXISTS) {
        // Skip this process's own, just-created window with the same class and title.
        HWND existing = nullptr;
        do {
            existing = FindWindowExW(nullptr, existing, L"FieldMachineCompatibilityProbe", WindowTitle);
        } while (existing == window);
        if (existing) {
            PostMessageW(existing, ShowRequest, 0, 0);
        } else {
            MessageBoxW(window, L"FIELD Machine is already running for another Windows user on this tablet.",
                WindowTitle, MB_OK | MB_ICONINFORMATION);
        }
        ExitProcess(0);
    }
    // Lets the non-elevated tray message reach us even if Windows filters it.
    ChangeWindowMessageFilterEx(window, ShowRequest, MSGFLT_ALLOW, nullptr);
    // Keep screen sharing running while hidden or while another Windows user has the screen.
    SetEnvironmentVariableW(L"WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", L"--disable-renderer-backgrounding "
        L"--disable-background-timer-throttling --disable-features=CalculateNativeWinOcclusion"
#ifdef FIELD_MACHINE_DEBUG
        L" --remote-debugging-port=9222" // Chromium binds this to 127.0.0.1 only.
#endif
    );
    SetWindowSubclass(window, TrayProc, SubclassId, 0);
    AddIcon(window);
    return wcsstr(GetCommandLineW(), L"--background") ? SW_HIDE : show;
}
}
