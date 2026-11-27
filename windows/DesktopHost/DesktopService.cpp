#include <Windows.h>
#include "DesktopHost.h"
#include "DesktopKeepAlive.h"
#include "DesktopLaunch.h"
#include "DesktopLog.h"
#include "DesktopProtocol.h"

namespace FieldMachine::Desktop {
namespace {
SERVICE_STATUS_HANDLE statusHandle = nullptr;
SERVICE_STATUS status{SERVICE_WIN32_OWN_PROCESS};
HANDLE stopEvent = nullptr;
HANDLE wakeEvent = nullptr;

void Report(DWORD state) {
    status.dwCurrentState = state;
    status.dwControlsAccepted = state == SERVICE_RUNNING
        ? SERVICE_ACCEPT_STOP | SERVICE_ACCEPT_SHUTDOWN | SERVICE_ACCEPT_SESSIONCHANGE : 0;
    status.dwWin32ExitCode = NO_ERROR;
    status.dwWaitHint = state == SERVICE_RUNNING || state == SERVICE_STOPPED ? 0 : 5000;
    SetServiceStatus(statusHandle, &status);
}

DWORD WINAPI Control(DWORD control, DWORD, LPVOID, LPVOID) {
    switch (control) {
    case SERVICE_CONTROL_STOP:
    case SERVICE_CONTROL_SHUTDOWN:
        Report(SERVICE_STOP_PENDING);
        SetEvent(stopEvent);
        return NO_ERROR;
    case SERVICE_CONTROL_SESSIONCHANGE:
        SetEvent(wakeEvent);
        return NO_ERROR;
    case SERVICE_CONTROL_INTERROGATE:
        return NO_ERROR;
    default:
        return ERROR_CALL_NOT_IMPLEMENTED;
    }
}

// Keeps one agent running in whichever session owns the physical screen.
// Switching users moves the console to another session, so the old agent is
// ended and a new one starts there, including on the sign-in screen.
void Supervise() {
    PROCESS_INFORMATION agent{};
    DWORD agentSession = MAXDWORD;
    const HANDLE events[] = {stopEvent, wakeEvent};
    for (;;) {
        const DWORD session = WTSGetActiveConsoleSessionId();
        KeepAppRunning(session);
        UpdatePowerRequest();
        if (!(IsRunning(agent) && session == agentSession)) {
            EndProcess(agent);
            agentSession = MAXDWORD;
            if (session != MAXDWORD && LaunchAsSystem(session, L"--agent", agent)) {
                agentSession = session;
                Log("service: agent started for console session %lu", session);
            } else if (session != MAXDWORD) {
                Log("service: agent launch failed, session %lu, error %lu", session, GetLastError());
            }
        }
        if (WaitForMultipleObjects(2, events, FALSE, 1000) == WAIT_OBJECT_0) break;
    }
    EndProcess(agent);
}

void WINAPI ServiceMain(DWORD, LPWSTR *) {
    statusHandle = RegisterServiceCtrlHandlerExW(ServiceName, Control, nullptr);
    if (!statusHandle) return;
    stopEvent = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    wakeEvent = CreateEventW(nullptr, FALSE, FALSE, nullptr);
    if (!stopEvent || !wakeEvent) {
        Report(SERVICE_STOPPED);
        return;
    }
    Report(SERVICE_RUNNING);
    Supervise();
    Report(SERVICE_STOPPED);
}
}

int RunService() {
    wchar_t name[std::size(ServiceName)]{};
    wcscpy_s(name, ServiceName);
    SERVICE_TABLE_ENTRYW table[] = {{name, ServiceMain}, {nullptr, nullptr}};
    return StartServiceCtrlDispatcherW(table) ? 0 : 1;
}
}
