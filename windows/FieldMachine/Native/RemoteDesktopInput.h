#pragma once
#include "NativeHelpers.h"
#include "RemoteDesktopInputState.h"

namespace FieldMachine::Native {
REACT_MODULE(RemoteDesktopInput, L"FieldMachineRemoteDesktopInput")
struct RemoteDesktopInput {
  REACT_METHOD(start)
  void start(std::string owner, React::ReactPromise<bool> promise) noexcept {
    promise.Resolve(m_state.Start(std::move(owner)));
  }

  REACT_METHOD(reset)
  void reset(std::string owner, bool end) noexcept {
    m_state.Reset(owner, end);
  }

  REACT_METHOD(apply)
  void apply(std::string owner, std::string kind, std::string action, double x, double y,
      double first, double second, std::string value, React::ReactPromise<bool> promise) noexcept {
    try {
      promise.Resolve(m_state.ApplyInput(owner, kind, action, x, y, first, second, value));
    } catch (...) {
      promise.Resolve(false);
    }
  }

private:
  RemoteDesktopInputState m_state;
};
}
