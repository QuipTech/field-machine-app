#include "DesktopPanelLayout.h"
#include <algorithm>
#include <cwchar>

namespace FieldMachine::Desktop {
namespace {
// Sizes in device-independent pixels.
constexpr int Width = 260;
constexpr int Header = 44;
constexpr int ContentHeight = 396;
constexpr int TabWidth = 36;
constexpr int TabHeight = 120;
HWND content = nullptr;
HFONT font = nullptr;
int scrollPos = 0;
std::wstring lastActivity;

int Scale(HWND window, int value) {
    return MulDiv(value, static_cast<int>(GetDpiForWindow(window)), 96);
}

// `box` holds x, y, width and height in device-independent pixels.
void Add(HWND parent, const wchar_t *type, const wchar_t *text, DWORD style, int id, RECT box) {
    const HWND child = CreateWindowExW(0, type, text, WS_CHILD | WS_VISIBLE | style,
        Scale(parent, box.left), Scale(parent, box.top), Scale(parent, box.right), Scale(parent, box.bottom),
        parent, reinterpret_cast<HMENU>(static_cast<INT_PTR>(id)), nullptr, nullptr);
    SendMessageW(child, WM_SETFONT, reinterpret_cast<WPARAM>(font), TRUE);
}

void UpdateScrollBar() {
    RECT client{};
    GetClientRect(content, &client);
    SCROLLINFO info{sizeof(info), SIF_RANGE | SIF_PAGE | SIF_POS};
    info.nMax = Scale(content, ContentHeight) - 1;
    info.nPage = static_cast<UINT>(client.bottom);
    info.nPos = scrollPos;
    SetScrollInfo(content, SB_VERT, &info, TRUE);
}

void ScrollTo(int position) {
    RECT client{};
    GetClientRect(content, &client);
    const int limit = (std::max)(0, Scale(content, ContentHeight) - static_cast<int>(client.bottom));
    position = (std::clamp)(position, 0, limit);
    const int delta = scrollPos - position;
    if (delta == 0) return;
    scrollPos = position;
    ScrollWindowEx(content, 0, delta, nullptr, nullptr, nullptr, nullptr, SW_SCROLLCHILDREN | SW_INVALIDATE | SW_ERASE);
    UpdateScrollBar();
}

int TargetPosition(WPARAM wparam) {
    RECT client{};
    GetClientRect(content, &client);
    switch (LOWORD(wparam)) {
    case SB_LINEUP: return scrollPos - Scale(content, 24);
    case SB_LINEDOWN: return scrollPos + Scale(content, 24);
    case SB_PAGEUP: return scrollPos - client.bottom;
    case SB_PAGEDOWN: return scrollPos + client.bottom;
    case SB_TOP: return 0;
    case SB_BOTTOM: return Scale(content, ContentHeight);
    case SB_THUMBTRACK:
    case SB_THUMBPOSITION: {
        SCROLLINFO info{sizeof(info), SIF_TRACKPOS};
        GetScrollInfo(content, SB_VERT, &info);
        return info.nTrackPos;
    }
    default: return scrollPos;
    }
}

// The scrollable area owns the buttons, so it forwards their messages to the panel.
LRESULT CALLBACK ContentProc(HWND window, UINT message, WPARAM wparam, LPARAM lparam) {
    switch (message) {
    case WM_VSCROLL:
        ScrollTo(TargetPosition(wparam));
        return 0;
    case WM_MOUSEWHEEL:
        ScrollTo(scrollPos - GET_WHEEL_DELTA_WPARAM(wparam) * Scale(window, 48) / WHEEL_DELTA);
        return 0;
    case WM_SIZE:
        UpdateScrollBar();
        ScrollTo(scrollPos);
        return 0;
    case WM_COMMAND:
    case WM_CTLCOLORSTATIC:
        return SendMessageW(GetParent(window), message, wparam, lparam);
    }
    return DefWindowProcW(window, message, wparam, lparam);
}

void Place(HWND window, bool isCollapsed) {
    RECT area{};
    SystemParametersInfoW(SPI_GETWORKAREA, 0, &area, 0);
    const int areaHeight = area.bottom - area.top;
    const int width = Scale(window, isCollapsed ? TabWidth : Width);
    const int height = isCollapsed ? Scale(window, TabHeight)
                                   : (std::min)(Scale(window, Header + ContentHeight), areaHeight - 16);
    SetWindowPos(window, HWND_TOPMOST, area.right - width - (isCollapsed ? 0 : 8),
        area.top + (areaHeight - height) / 2, width, height, SWP_NOACTIVATE);
    RECT client{};
    GetClientRect(window, &client);
    MoveWindow(content, 0, Scale(window, Header), client.right, client.bottom - Scale(window, Header), TRUE);
    MoveWindow(GetDlgItem(window, Expand), 0, 0, client.right, client.bottom, TRUE);
}
}

void CreatePanelLayout(HWND window) {
    NONCLIENTMETRICSW metrics{sizeof(metrics)};
    SystemParametersInfoForDpi(SPI_GETNONCLIENTMETRICS, sizeof(metrics), &metrics, 0, GetDpiForWindow(window));
    font = CreateFontIndirectW(&metrics.lfMessageFont);
    WNDCLASSW contentClass{};
    contentClass.hInstance = GetModuleHandleW(nullptr);
    contentClass.lpfnWndProc = ContentProc;
    contentClass.lpszClassName = L"FieldMachinePanelContent";
    contentClass.hCursor = LoadCursorW(nullptr, IDC_ARROW);
    contentClass.hbrBackground = reinterpret_cast<HBRUSH>(COLOR_BTNFACE + 1);
    RegisterClassW(&contentClass);
    Add(window, L"BUTTON", L"▶", BS_PUSHBUTTON, Collapse, {6, 8, 30, 28});
    Add(window, L"STATIC", L"Remote session active", SS_CENTER | SS_CENTERIMAGE, Title, {40, 8, Width - 48, 28});
    Add(window, L"BUTTON", L"◀", BS_PUSHBUTTON, Expand, {0, 0, TabWidth, TabHeight});
    content = CreateWindowExW(0, contentClass.lpszClassName, nullptr, WS_CHILD | WS_VISIBLE | WS_VSCROLL,
        0, 0, 0, 0, window, nullptr, nullptr, nullptr);
    constexpr int Inner = Width - 44; // Leaves room for the scrollbar.
    Add(content, L"STATIC", L"Connecting…", SS_LEFT, Status, {12, 6, Inner, 52});
    Add(content, L"EDIT", L"", ES_MULTILINE | ES_READONLY | ES_AUTOVSCROLL | WS_VSCROLL | WS_BORDER,
        Activity, {12, 64, Inner, 96});
    Add(content, L"STATIC", L"Drag files here\nto send to FIELD Portal", SS_CENTER | SS_NOTIFY | WS_BORDER,
        DropZone, {12, 168, Inner, 80});
    Add(content, L"BUTTON", L"Browse files…", BS_PUSHBUTTON, Browse, {12, 256, Inner, 34});
    Add(content, L"BUTTON", L"Microphone: Off", BS_PUSHBUTTON, Microphone, {12, 298, Inner, 34});
    Add(content, L"BUTTON", L"End session", BS_PUSHBUTTON, Stop, {12, 340, Inner, 40});
    SetPanelCollapsed(window, false);
}

void SetPanelCollapsed(HWND window, bool isCollapsed) {
    for (int id : {Collapse, Title}) ShowWindow(GetDlgItem(window, id), isCollapsed ? SW_HIDE : SW_SHOW);
    ShowWindow(content, isCollapsed ? SW_HIDE : SW_SHOW);
    ShowWindow(GetDlgItem(window, Expand), isCollapsed ? SW_SHOW : SW_HIDE);
    Place(window, isCollapsed);
}

HWND PanelItem(HWND window, int id) {
    const HWND item = GetDlgItem(content, id);
    return item ? item : GetDlgItem(window, id);
}

void AddPanelActivity(HWND window, std::wstring const &text) {
    SetWindowTextW(PanelItem(window, Status), text.c_str());
    if (text == lastActivity) return; // The app repeats the session banner every 15 s.
    lastActivity = text;
    const HWND log = PanelItem(window, Activity);
    SYSTEMTIME time{};
    GetLocalTime(&time);
    wchar_t stamp[16]{};
    swprintf_s(stamp, L"%02u:%02u  ", time.wHour, time.wMinute);
    const int end = GetWindowTextLengthW(log);
    SendMessageW(log, EM_SETSEL, end, end);
    SendMessageW(log, EM_REPLACESEL, FALSE, reinterpret_cast<LPARAM>((stamp + text + L"\r\n").c_str()));
}
}
