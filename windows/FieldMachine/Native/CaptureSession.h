#pragma once
#include <atomic>
#include <memory>
#include <mutex>
#include <string>
#include <winrt/Windows.Graphics.Capture.h>
#include <winrt/Windows.Graphics.Imaging.h>

namespace FieldMachine::Native {
struct CaptureState {
  std::atomic<uint64_t> frames{0};
  std::atomic<bool> snapshotStarted{false};
  std::atomic<bool> stopped{false};
  std::mutex mutex;
  std::string snapshot;
  std::wstring snapshotPath;
  std::string error;
};

winrt::fire_and_forget SaveSnapshot(std::shared_ptr<CaptureState> state,
    winrt::Windows::Graphics::Capture::Direct3D11CaptureFrame frame);

class CaptureSession {
public:
  CaptureSession();
  ~CaptureSession();
  void Stop();
  std::string Status();
  std::string Snapshot();
private:
  std::shared_ptr<CaptureState> m_state{std::make_shared<CaptureState>()};
  winrt::Windows::Graphics::Capture::Direct3D11CaptureFramePool m_pool{nullptr};
  winrt::Windows::Graphics::Capture::GraphicsCaptureSession m_session{nullptr};
  winrt::event_token m_frameToken{};
};
}
