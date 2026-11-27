#pragma once
#include <Windows.h>

namespace FieldMachine::Desktop {
// Starts the FIELD Machine app in the console user's session when it is not
// running in any session (after sign-in or a crash), with growing back-off
// if it keeps exiting. Call about once a second from the service thread.
void KeepAppRunning(DWORD consoleSession);

// Keeps the tablet awake while it is on mains power so Portal support can
// reach it; on battery, normal Windows sleep applies.
void UpdatePowerRequest();
}
