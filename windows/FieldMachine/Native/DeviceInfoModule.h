#pragma once
#include "NativeHelpers.h"
#include <Windows.h>

namespace FieldMachine::Native {
REACT_MODULE(DeviceInfoModule, L"FieldMachineDeviceInfo")
struct DeviceInfoModule {
  REACT_METHOD(isAppForeground)
  void isAppForeground(React::ReactPromise<bool> promise) noexcept {
    DWORD foregroundProcess{};
    auto window = GetForegroundWindow();
    if (window) GetWindowThreadProcessId(window, &foregroundProcess);
    promise.Resolve(foregroundProcess == GetCurrentProcessId());
  }
};
}
