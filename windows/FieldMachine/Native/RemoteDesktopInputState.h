#pragma once
#include <Windows.h>
#include "RemoteDesktopKeys.h"
#include <array>
#include <cmath>
#include <mutex>
#include <string>
#include <vector>
#include <winrt/base.h>

namespace FieldMachine::Native {
// Shared by the React Native module and the LTSC WebView2 host.
struct RemoteDesktopInputState {
  ~RemoteDesktopInputState() { Release(); }

  bool Start(std::string owner) {
    std::lock_guard lock(m_mutex);
    Release();
    m_owner.clear();
    if (!owner.empty() && ReadBounds(m_bounds)) m_owner = std::move(owner);
    return !m_owner.empty();
  }

  void Reset(std::string const &owner, bool end) {
    std::lock_guard lock(m_mutex);
    if (owner != m_owner) return;
    Release();
    if (end) m_owner.clear();
  }

  // Ends control regardless of owner when the host page goes away.
  void Stop() {
    std::lock_guard lock(m_mutex);
    Release();
    m_owner.clear();
  }

  bool ApplyInput(std::string const &owner, std::string_view kind, std::string_view action,
      double x, double y, double first, double second, std::string_view value) {
    std::lock_guard lock(m_mutex);
    RECT bounds{};
    if (m_owner.empty() || owner != m_owner) return false;
    if (!ReadBounds(bounds) || !EqualRect(&bounds, &m_bounds)) {
      Release();
      m_owner.clear();
      return false;
    }
    return Apply(kind, action, x, y, first, second, value);
  }

private:
  std::mutex m_mutex;
  std::string m_owner;
  RECT m_bounds{};
  std::array<bool, 256> m_keys{};
  std::array<bool, 3> m_buttons{};
  static constexpr DWORD ButtonDown[] = {MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_RIGHTDOWN};
  static constexpr DWORD ButtonUp[] = {MOUSEEVENTF_LEFTUP, MOUSEEVENTF_MIDDLEUP, MOUSEEVENTF_RIGHTUP};

  static bool ReadBounds(RECT &bounds) noexcept {
    if (GetSystemMetrics(SM_CMONITORS) != 1) return false;
    bounds.left = GetSystemMetrics(SM_XVIRTUALSCREEN);
    bounds.top = GetSystemMetrics(SM_YVIRTUALSCREEN);
    bounds.right = bounds.left + GetSystemMetrics(SM_CXVIRTUALSCREEN);
    bounds.bottom = bounds.top + GetSystemMetrics(SM_CYVIRTUALSCREEN);
    return bounds.right - bounds.left > 1 && bounds.bottom - bounds.top > 1;
  }

  static bool Mouse(DWORD flags, LONG x = 0, LONG y = 0, LONG data = 0) noexcept {
    INPUT input{};
    input.type = INPUT_MOUSE;
    input.mi.dx = x;
    input.mi.dy = y;
    input.mi.dwFlags = flags;
    input.mi.mouseData = static_cast<DWORD>(data);
    return SendInput(1, &input, sizeof(INPUT)) == 1;
  }

  static INPUT Key(WORD key, WORD scan, DWORD flags) noexcept {
    INPUT input{};
    input.type = INPUT_KEYBOARD;
    input.ki.wVk = key;
    input.ki.wScan = scan;
    input.ki.dwFlags = flags;
    return input;
  }

  static bool SendKey(WORD key, bool up) noexcept {
    auto input = Key(key, 0, RemoteKeyFlags(key) | (up ? KEYEVENTF_KEYUP : 0));
    return SendInput(1, &input, sizeof(INPUT)) == 1;
  }

  void Release() noexcept {
    for (size_t index = 0; index < m_keys.size(); ++index) {
      if (m_keys[index] && SendKey(static_cast<WORD>(index), true)) m_keys[index] = false;
    }
    for (size_t index = 0; index < m_buttons.size(); ++index) {
      if (m_buttons[index] && Mouse(ButtonUp[index])) m_buttons[index] = false;
    }
  }

  bool ApplyKey(std::string_view action, std::string_view code) noexcept {
    const WORD key = RemoteVirtualKey(code);
    if (!key || (action != "up" && action != "down")) return false;
    const bool up = action == "up";
    if (up && !m_keys[key]) return true;
    const bool ctrl = m_keys[VK_LCONTROL] || m_keys[VK_RCONTROL] || (GetAsyncKeyState(VK_CONTROL) & 0x8000);
    const bool alt = m_keys[VK_LMENU] || m_keys[VK_RMENU] || (GetAsyncKeyState(VK_MENU) & 0x8000);
    const bool del = m_keys[VK_DELETE] || (GetAsyncKeyState(VK_DELETE) & 0x8000);
    if (!up && ((key == VK_DELETE && ctrl && alt) ||
        ((key == VK_LCONTROL || key == VK_RCONTROL) && alt && del) ||
        ((key == VK_LMENU || key == VK_RMENU) && ctrl && del))) return false;
    if (!SendKey(key, up)) return false;
    m_keys[key] = !up;
    return true;
  }

  static bool TypeText(std::string_view value) {
    if (value.empty() || value.size() > 8192) return false;
    const auto text = winrt::to_hstring(value);
    if (text.empty() || text.size() > 2048) return false;
    std::vector<INPUT> inputs;
    inputs.reserve(text.size() * 2);
    for (const wchar_t unit : text) {
      inputs.push_back(Key(0, unit, KEYEVENTF_UNICODE));
      inputs.push_back(Key(0, unit, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP));
    }
    const auto count = static_cast<UINT>(inputs.size());
    const auto sent = SendInput(count, inputs.data(), sizeof(INPUT));
    if (sent < count && sent % 2 != 0) SendInput(1, &inputs[sent], sizeof(INPUT));
    return sent == count;
  }

  bool Apply(std::string_view kind, std::string_view action, double x, double y,
      double first, double second, std::string_view value) {
    if (kind == "key") return ApplyKey(action, value);
    if (kind == "text") return TypeText(value);
    if ((kind != "pointer" && kind != "wheel") ||
        !std::isfinite(x) || !std::isfinite(y) || x < 0 || x > 1 || y < 0 || y > 1 ||
        !std::isfinite(first) || !std::isfinite(second)) return false;
    if (kind == "pointer" && (first < 0 || first > 2 || first != std::floor(first) ||
        (action != "move" && action != "up" && action != "down" && action != "cancel"))) return false;
    if (kind == "wheel" && (std::abs(first) > 2400 || std::abs(second) > 2400)) return false;
    if (!Mouse(MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK,
        std::lround(x * 65535), std::lround(y * 65535))) return false;
    if (kind == "wheel") {
      const bool vertical = second == 0 || Mouse(MOUSEEVENTF_WHEEL, 0, 0, -std::lround(second));
      const bool horizontal = first == 0 || Mouse(MOUSEEVENTF_HWHEEL, 0, 0, std::lround(first));
      return vertical && horizontal;
    }
    if (action == "move") return true;
    const auto button = static_cast<size_t>(first);
    const bool down = action == "down";
    if (!down && !m_buttons[button]) return true;
    if (!Mouse(down ? ButtonDown[button] : ButtonUp[button])) return false;
    m_buttons[button] = down;
    return true;
  }
};
}
