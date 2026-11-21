#pragma once
#include "NativeHelpers.h"

namespace FieldMachine::Native {
REACT_MODULE(InputControlModule, L"FieldMachineInputControl")
struct InputControlModule {
  REACT_INIT(Initialize)
  void Initialize(React::ReactContext const &context) noexcept { m_context = context; }
  REACT_METHOD(clickTestTarget)
  void clickTestTarget(React::ReactPromise<void> promise) noexcept;
private:
  React::ReactContext m_context;
};
}
