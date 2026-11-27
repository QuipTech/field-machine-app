#pragma once
#include <Windows.h>
#include "DesktopProtocol.h"

namespace FieldMachine::Desktop {
// Starts this executable with `mode` inside a Windows session.
// The SYSTEM launch can reach the sign-in screen; the user launch runs as the
// signed-in person so Explorer can drop files on the panel.
bool LaunchAsSystem(DWORD session, const wchar_t *mode, PROCESS_INFORMATION &process);
// `fileName` is a program installed next to this executable.
bool LaunchAsUser(DWORD session, const wchar_t *mode, PROCESS_INFORMATION &process,
    const wchar_t *fileName = HostFileName);
void EndProcess(PROCESS_INFORMATION &process) noexcept;
bool IsRunning(PROCESS_INFORMATION const &process) noexcept;
}
