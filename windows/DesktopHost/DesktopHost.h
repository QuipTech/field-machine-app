#pragma once
#include <Windows.h>

// FieldMachineDesktop.exe runs in one of three modes.
namespace FieldMachine::Desktop {
int RunService();
int RunAgent();
int RunPanel(HINSTANCE instance);
}
