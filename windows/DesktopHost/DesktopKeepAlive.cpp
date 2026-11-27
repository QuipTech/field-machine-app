#include "DesktopKeepAlive.h"
#include <TlHelp32.h>
#include <algorithm>
#include "DesktopLaunch.h"
#include "DesktopLog.h"
#include "DesktopProtocol.h"

namespace FieldMachine::Desktop {
namespace {
constexpr ULONGLONG FirstDelay = 10'000;
constexpr ULONGLONG MaxDelay = 300'000;
constexpr ULONGLONG HealthyRun = 60'000;
ULONGLONG nextAttempt = 0;
ULONGLONG launchedAt = 0;
ULONGLONG delay = FirstDelay;
bool wasRunning = false;
bool isOnMainsPower = false;

// Matches by full path so a copy elsewhere (e.g. a developer build) is ignored.
bool IsAppRunning() {
    const HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (snapshot == INVALID_HANDLE_VALUE) return true; // Unknown: do not start a duplicate.
    const std::wstring expected = SiblingPath(AppFileName);
    PROCESSENTRY32W entry{sizeof(entry)};
    bool isRunning = false;
    for (BOOL more = Process32FirstW(snapshot, &entry); more && !isRunning; more = Process32NextW(snapshot, &entry)) {
        if (CompareStringOrdinal(entry.szExeFile, -1, AppFileName, -1, TRUE) == CSTR_EQUAL) {
            isRunning = IsSamePath(ProcessPath(entry.th32ProcessID), expected);
        }
    }
    CloseHandle(snapshot);
    return isRunning;
}
}

void KeepAppRunning(DWORD consoleSession) {
    const ULONGLONG now = GetTickCount64();
    const bool isRunning = IsAppRunning();
    if (wasRunning && !isRunning) {
        // An exit soon after launch counts as a crash loop; back off further.
        delay = now - launchedAt < HealthyRun ? std::min(delay * 2, MaxDelay) : FirstDelay;
        nextAttempt = now + delay;
    }
    wasRunning = isRunning;
    if (isRunning || consoleSession == MAXDWORD || now < nextAttempt) return;
    PROCESS_INFORMATION process{};
    // Fails quietly on the sign-in screen, where the session has no user yet.
    if (!LaunchAsUser(consoleSession, L"--background", process, AppFileName)) {
        Log("service: app launch failed, session %lu, error %lu", consoleSession, GetLastError());
        nextAttempt = now + 2'000;
        return;
    }
    CloseHandle(process.hThread);
    CloseHandle(process.hProcess);
    Log("service: app started in session %lu", consoleSession);
    launchedAt = now;
    wasRunning = true;
}

void UpdatePowerRequest() {
    SYSTEM_POWER_STATUS power{};
    const bool isMains = GetSystemPowerStatus(&power) && power.ACLineStatus == 1;
    if (isMains == isOnMainsPower) return;
    isOnMainsPower = isMains;
    SetThreadExecutionState(isMains ? ES_CONTINUOUS | ES_SYSTEM_REQUIRED : ES_CONTINUOUS);
}
}
