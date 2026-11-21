#pragma once
#include "NativeHelpers.h"
#include "CaptureSession.h"

namespace FieldMachine::Native {
REACT_MODULE(ScreenCaptureModule, L"FieldMachineScreenCapture")
struct ScreenCaptureModule {
  REACT_METHOD(start)
  void start(React::ReactPromise<void> promise) noexcept {
    Complete(promise, [&] {
      if (m_capture) throw std::runtime_error("Capture is already active.");
      m_capture = std::make_unique<CaptureSession>();
    });
  }
  REACT_METHOD(stop)
  void stop(React::ReactPromise<void> promise) noexcept {
    Complete(promise, [&] {
      if (m_capture) m_capture->Stop();
      m_capture.reset();
    });
  }
  REACT_METHOD(getStatus)
  void getStatus(React::ReactPromise<std::string> promise) noexcept {
    Read(promise, false);
  }
  REACT_METHOD(getSnapshot)
  void getSnapshot(React::ReactPromise<std::string> promise) noexcept {
    Read(promise, true);
  }
private:
  void Read(React::ReactPromise<std::string> const &promise, bool snapshot) noexcept {
    try {
      if (!m_capture) throw std::runtime_error("Start screen capture first.");
      promise.Resolve(snapshot ? m_capture->Snapshot() : m_capture->Status());
    } catch (std::exception const &error) {
      promise.Reject(error.what());
    } catch (...) {
      promise.Reject("Could not read capture diagnostics.");
    }
  }
  std::unique_ptr<CaptureSession> m_capture;
};
}
