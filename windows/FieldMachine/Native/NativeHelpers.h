#pragma once
#include <NativeModules.h>
#include <functional>
#include <exception>
#include <stdexcept>
#include <winrt/base.h>

namespace FieldMachine::Native {
namespace React = winrt::Microsoft::ReactNative;

// Never allow a native exception to escape a React callback.
inline void Complete(React::ReactPromise<void> const &promise,
                     std::function<void()> const &action) noexcept {
  try {
    action();
    promise.Resolve();
  } catch (winrt::hresult_error const &error) {
    promise.Reject(error.message().c_str());
  } catch (std::exception const &error) {
    promise.Reject(error.what());
  } catch (...) {
    promise.Reject("Unexpected Windows native error.");
  }
}
}
