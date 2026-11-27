#pragma once
#include <Windows.h>
#include <cstdarg>
#include <cstdio>
#include <mutex>
#include <string>

// Debug builds only (FieldMachineDebug=true): appends to
// %ProgramData%\FIELD Machine\logs\desktop.log. Callers pass fixed labels,
// numbers and Windows error codes only, never tokens, passwords or URLs.
namespace FieldMachine::Desktop {
#ifdef FIELD_MACHINE_DEBUG
inline void Log(const char *format, ...) {
    static std::mutex lock;
    std::lock_guard guard(lock);
    wchar_t folder[MAX_PATH]{};
    ExpandEnvironmentStringsW(L"%ProgramData%\\FIELD Machine\\logs", folder, MAX_PATH);
    CreateDirectoryW(folder, nullptr);
    FILE *file = nullptr;
    if (_wfopen_s(&file, (std::wstring(folder) + L"\\desktop.log").c_str(), L"a") || !file) return;
    SYSTEMTIME time{};
    GetLocalTime(&time);
    DWORD session = 0;
    ProcessIdToSessionId(GetCurrentProcessId(), &session);
    fprintf(file, "%02u:%02u:%02u.%03u pid=%lu session=%lu ", time.wHour, time.wMinute, time.wSecond,
        time.wMilliseconds, GetCurrentProcessId(), session);
    va_list args;
    va_start(args, format);
    vfprintf(file, format, args);
    va_end(args);
    fputc('\n', file);
    fclose(file);
}
#else
inline void Log(const char *, ...) {}
#endif
}
