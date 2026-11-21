#include "pch.h"
#include "InputControlModule.h"
#include <stdexcept>

namespace FieldMachine::Native {
namespace {
constexpr wchar_t TARGET_CLASS[] = L"FieldMachinePhaseZeroTarget";
constexpr ULONG_PTR INPUT_MARKER = 0x4649454C;
struct TargetState {
  React::ReactPromise<void> promise;
  bool received{false};
};

LRESULT CALLBACK TargetProcedure(HWND window, UINT message, WPARAM wparam, LPARAM lparam) {
  auto state = reinterpret_cast<TargetState *>(GetWindowLongPtrW(window, GWLP_USERDATA));
  if (state && message == WM_LBUTTONUP && GetMessageExtraInfo() == INPUT_MARKER) {
    state->received = true;
    SetWindowTextW(window, L"FIELD Machine: injected click received");
    return 0;
  }
  if (state && message == WM_TIMER) {
    KillTimer(window, 1);
    if (state->received) state->promise.Resolve();
    else state->promise.Reject("Target did not receive the injected click within 1 second.");
    DestroyWindow(window);
    return 0;
  }
  if (state && message == WM_NCDESTROY) {
    state->promise.Reject("Input target closed before the check completed.");
    SetWindowLongPtrW(window, GWLP_USERDATA, 0);
    delete state;
  }
  return DefWindowProcW(window, message, wparam, lparam);
}

void RunClickCheck(React::ReactPromise<void> promise) noexcept {
  HWND target{};
  try {
    WNDCLASSW windowClass{};
    windowClass.lpfnWndProc = TargetProcedure;
    windowClass.hInstance = GetModuleHandleW(nullptr);
    windowClass.lpszClassName = TARGET_CLASS;
    windowClass.hbrBackground = reinterpret_cast<HBRUSH>(COLOR_WINDOW + 1);
    if (!RegisterClassW(&windowClass) && GetLastError() != ERROR_CLASS_ALREADY_EXISTS) {
      winrt::throw_last_error();
    }
    target = CreateWindowExW(WS_EX_TOPMOST, TARGET_CLASS,
        L"FIELD Machine: waiting for injected click", WS_OVERLAPPEDWINDOW,
        120, 120, 600, 240, nullptr, nullptr, windowClass.hInstance, nullptr);
    winrt::check_bool(target != nullptr);
    auto state = new TargetState{promise};
    SetWindowLongPtrW(target, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(state));
    ShowWindow(target, SW_SHOW);
    UpdateWindow(target);
    if (!SetForegroundWindow(target) || GetForegroundWindow() != target) {
      throw std::runtime_error("Test target could not become foreground; no click was sent.");
    }
    RECT client{};
    winrt::check_bool(GetClientRect(target, &client));
    POINT center{(client.right - client.left) / 2, (client.bottom - client.top) / 2};
    winrt::check_bool(ClientToScreen(target, &center));
    if (WindowFromPoint(center) != target) {
      throw std::runtime_error("Test target is obscured; no click was sent.");
    }
    auto width = GetSystemMetrics(SM_CXVIRTUALSCREEN);
    auto height = GetSystemMetrics(SM_CYVIRTUALSCREEN);
    if (width <= 1 || height <= 1) throw std::runtime_error("Invalid virtual desktop size.");
    INPUT events[3]{};
    for (auto &event : events) {
      event.type = INPUT_MOUSE;
      event.mi.dwExtraInfo = INPUT_MARKER;
    }
    events[0].mi.dx = MulDiv(center.x - GetSystemMetrics(SM_XVIRTUALSCREEN), 65535, width - 1);
    events[0].mi.dy = MulDiv(center.y - GetSystemMetrics(SM_YVIRTUALSCREEN), 65535, height - 1);
    events[0].mi.dwFlags = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK;
    events[1].mi.dwFlags = MOUSEEVENTF_LEFTDOWN;
    events[2].mi.dwFlags = MOUSEEVENTF_LEFTUP;
    if (SendInput(3, events, sizeof(INPUT)) != 3) {
      // Release a potentially inserted down event on partial insertion.
      SendInput(1, &events[2], sizeof(INPUT));
      throw std::runtime_error("SendInput did not insert all events; Windows may have blocked input.");
    }
    winrt::check_bool(SetTimer(target, 1, 1000, nullptr) != 0);
  } catch (winrt::hresult_error const &error) {
    promise.Reject(error.message().c_str());
    if (target) DestroyWindow(target);
  } catch (std::exception const &error) {
    promise.Reject(error.what());
    if (target) DestroyWindow(target);
  } catch (...) {
    promise.Reject("Unexpected input test error.");
    if (target) DestroyWindow(target);
  }
}
}

void InputControlModule::clickTestTarget(React::ReactPromise<void> promise) noexcept {
  m_context.UIDispatcher().Post([promise]() noexcept { RunClickCheck(promise); });
}
}
