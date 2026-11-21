#include "pch.h"
#include "CaptureSession.h"
#include <d3d11.h>
#include <dxgi1_2.h>
#include <windows.graphics.capture.interop.h>
#include <windows.graphics.directx.direct3d11.interop.h>
#include <winrt/Windows.Graphics.DirectX.Direct3D11.h>
#include <stdexcept>

namespace FieldMachine::Native {
using namespace winrt::Windows::Graphics::Capture;

CaptureSession::CaptureSession() {
  if (!GraphicsCaptureSession::IsSupported()) {
    throw std::runtime_error("Windows Graphics Capture is unavailable on this device.");
  }
  winrt::com_ptr<ID3D11Device> device;
  winrt::check_hresult(D3D11CreateDevice(nullptr, D3D_DRIVER_TYPE_HARDWARE,
      nullptr, D3D11_CREATE_DEVICE_BGRA_SUPPORT, nullptr, 0, D3D11_SDK_VERSION,
      device.put(), nullptr, nullptr));
  auto dxgi = device.as<IDXGIDevice>();
  winrt::com_ptr<IInspectable> inspectable;
  winrt::check_hresult(CreateDirect3D11DeviceFromDXGIDevice(dxgi.get(), inspectable.put()));
  auto captureDevice = inspectable.as<
      winrt::Windows::Graphics::DirectX::Direct3D11::IDirect3DDevice>();
  // This Phase 0 action explicitly captures the whole primary monitor.
  POINT origin{};
  auto monitor = MonitorFromPoint(origin, MONITOR_DEFAULTTOPRIMARY);
  auto interop = winrt::get_activation_factory<GraphicsCaptureItem, IGraphicsCaptureItemInterop>();
  GraphicsCaptureItem item{nullptr};
  winrt::check_hresult(interop->CreateForMonitor(monitor,
      winrt::guid_of<IGraphicsCaptureItem>(), winrt::put_abi(item)));
  m_pool = Direct3D11CaptureFramePool::CreateFreeThreaded(captureDevice,
      winrt::Windows::Graphics::DirectX::DirectXPixelFormat::B8G8R8A8UIntNormalized,
      2, item.Size());
  m_frameToken = m_pool.FrameArrived([state = m_state](auto const &pool, auto const &) noexcept {
    try {
      auto frame = pool.TryGetNextFrame();
      if (!frame) return;
      ++state->frames;
      if (!state->snapshotStarted.exchange(true)) {
        SaveSnapshot(state, frame);
      } else {
        frame.Close();
      }
    } catch (winrt::hresult_error const &error) {
      std::scoped_lock lock(state->mutex);
      state->error = winrt::to_string(error.message());
    } catch (...) {
      std::scoped_lock lock(state->mutex);
      state->error = "Capture frame processing failed.";
    }
  });
  m_session = m_pool.CreateCaptureSession(item);
  m_session.StartCapture();
}

CaptureSession::~CaptureSession() {
  try { Stop(); } catch (...) { /* Destruction must not throw during app shutdown. */ }
}

void CaptureSession::Stop() {
  m_state->stopped = true;
  if (m_session) { m_session.Close(); m_session = nullptr; }
  if (m_pool) {
    m_pool.FrameArrived(m_frameToken);
    m_pool.Close();
    m_pool = nullptr;
  }
  std::scoped_lock lock(m_state->mutex);
  if (!m_state->snapshotPath.empty()) {
    DeleteFileW(m_state->snapshotPath.c_str());
    m_state->snapshotPath.clear();
    m_state->snapshot.clear();
  }
}

std::string CaptureSession::Status() {
  std::scoped_lock lock(m_state->mutex);
  if (!m_state->error.empty()) throw std::runtime_error(m_state->error);
  return "Primary monitor frames received: " + std::to_string(m_state->frames.load()) +
      ". Inspect the snapshot and confirm this count increases.";
}

std::string CaptureSession::Snapshot() {
  std::scoped_lock lock(m_state->mutex);
  if (!m_state->error.empty()) throw std::runtime_error(m_state->error);
  if (m_state->snapshot.empty()) throw std::runtime_error("First frame is not ready; try again.");
  return m_state->snapshot;
}
}
