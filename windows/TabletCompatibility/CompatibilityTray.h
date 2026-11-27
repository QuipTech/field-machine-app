#pragma once
#include <Windows.h>

namespace FieldMachine::Compatibility {
// Makes the tablet app stay reachable: one instance per tablet, a tray icon,
// closing hides to the tray, and `--background` (used by the FIELD Machine
// service at sign-in and after a crash) starts hidden. Returns the show
// command to use. Exits the process when another instance already runs.
int PrepareTabletShell(HWND window, int show);
}
