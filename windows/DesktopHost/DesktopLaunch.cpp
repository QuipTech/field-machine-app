#include "DesktopLaunch.h"
#include "DesktopProtocol.h"
#include <UserEnv.h>
#include <WtsApi32.h>
#include <string>

namespace FieldMachine::Desktop {
namespace {
bool Launch(HANDLE token, const wchar_t *mode, void *environment, PROCESS_INFORMATION &process,
    const wchar_t *fileName = HostFileName) {
    const std::wstring path = SiblingPath(fileName);
    std::wstring command = L"\"" + path + L"\" " + mode;
    const std::wstring folder = path.substr(0, path.find_last_of(L'\\'));
    STARTUPINFOW startup{sizeof(startup)};
    wchar_t desktop[] = L"winsta0\\default";
    startup.lpDesktop = desktop;
    SecurityAttributes security(ProcessSecurity);
    process = {};
    return CreateProcessAsUserW(token, path.c_str(), command.data(), security.get(), nullptr, FALSE,
        CREATE_UNICODE_ENVIRONMENT | CREATE_NO_WINDOW, environment, folder.c_str(),
        &startup, &process) == TRUE;
}
}

bool LaunchAsSystem(DWORD session, const wchar_t *mode, PROCESS_INFORMATION &process) {
    HANDLE self = nullptr;
    if (!OpenProcessToken(GetCurrentProcess(), TOKEN_DUPLICATE | TOKEN_QUERY, &self)) return false;
    HANDLE token = nullptr;
    const BOOL duplicated = DuplicateTokenEx(self, MAXIMUM_ALLOWED, nullptr,
        SecurityIdentification, TokenPrimary, &token);
    CloseHandle(self);
    if (!duplicated) return false;
    // Moving a SYSTEM token into another session needs SeTcbPrivilege, which SYSTEM holds.
    const bool launched = SetTokenInformation(token, TokenSessionId, &session, sizeof(session)) &&
        Launch(token, mode, nullptr, process);
    CloseHandle(token);
    return launched;
}

bool LaunchAsUser(DWORD session, const wchar_t *mode, PROCESS_INFORMATION &process, const wchar_t *fileName) {
    HANDLE token = nullptr;
    // Fails with ERROR_NO_TOKEN while nobody is signed in to the session.
    if (!WTSQueryUserToken(session, &token)) return false;
    void *environment = nullptr;
    const BOOL hasEnvironment = CreateEnvironmentBlock(&environment, token, FALSE);
    const bool launched = Launch(token, mode, hasEnvironment ? environment : nullptr, process, fileName);
    if (hasEnvironment) DestroyEnvironmentBlock(environment);
    CloseHandle(token);
    return launched;
}

void EndProcess(PROCESS_INFORMATION &process) noexcept {
    if (process.hProcess) {
        if (WaitForSingleObject(process.hProcess, 0) == WAIT_TIMEOUT) {
            TerminateProcess(process.hProcess, 0);
            WaitForSingleObject(process.hProcess, 3000);
        }
        CloseHandle(process.hProcess);
    }
    if (process.hThread) CloseHandle(process.hThread);
    process = {};
}

bool IsRunning(PROCESS_INFORMATION const &process) noexcept {
    return process.hProcess && WaitForSingleObject(process.hProcess, 0) == WAIT_TIMEOUT;
}
}
