#include <Windows.h>
#include <string_view>
#include "DesktopHost.h"

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR command, int) {
    // Physical pixels keep capture size and pointer mapping consistent.
    SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
    const std::wstring_view mode = command ? command : L"";
    if (mode == L"--service") return FieldMachine::Desktop::RunService();
    if (mode == L"--agent") return FieldMachine::Desktop::RunAgent();
    if (mode == L"--panel") return FieldMachine::Desktop::RunPanel(instance);
    MessageBoxW(nullptr, L"FIELD Machine Desktop is started by the FIELD Machine service.",
        L"FIELD Machine", MB_OK | MB_ICONINFORMATION);
    return 2;
}
