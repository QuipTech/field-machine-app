#pragma once
#include <string_view>
#include <utility>

namespace FieldMachine::Native {
inline WORD RemoteVirtualKey(std::string_view code) noexcept {
  if (code.size() == 4 && code.starts_with("Key") && code[3] >= 'A' && code[3] <= 'Z') {
    return static_cast<WORD>(code[3]);
  }
  if (code.size() == 6 && code.starts_with("Digit") && code[5] >= '0' && code[5] <= '9') {
    return static_cast<WORD>(code[5]);
  }
  constexpr std::pair<std::string_view, WORD> keys[] = {
    {"Enter", VK_RETURN}, {"Backspace", VK_BACK}, {"Tab", VK_TAB},
    {"Escape", VK_ESCAPE}, {"Space", VK_SPACE}, {"ArrowLeft", VK_LEFT},
    {"ArrowUp", VK_UP}, {"ArrowRight", VK_RIGHT}, {"ArrowDown", VK_DOWN},
    {"Insert", VK_INSERT}, {"Delete", VK_DELETE}, {"Home", VK_HOME},
    {"End", VK_END}, {"PageUp", VK_PRIOR}, {"PageDown", VK_NEXT},
    {"ShiftLeft", VK_LSHIFT}, {"ShiftRight", VK_RSHIFT}, {"ControlLeft", VK_LCONTROL},
    {"ControlRight", VK_RCONTROL}, {"AltLeft", VK_LMENU}, {"AltRight", VK_RMENU},
    {"F1", VK_F1}, {"F2", VK_F2}, {"F3", VK_F3}, {"F4", VK_F4},
    {"F5", VK_F5}, {"F6", VK_F6}, {"F7", VK_F7}, {"F8", VK_F8},
    {"F9", VK_F9}, {"F10", VK_F10}, {"F11", VK_F11}, {"F12", VK_F12},
    {"Minus", VK_OEM_MINUS}, {"Equal", VK_OEM_PLUS}, {"Comma", VK_OEM_COMMA},
    {"Period", VK_OEM_PERIOD}, {"Slash", VK_OEM_2}, {"Backquote", VK_OEM_3},
    {"BracketLeft", VK_OEM_4}, {"Backslash", VK_OEM_5},
    {"BracketRight", VK_OEM_6}, {"Quote", VK_OEM_7}, {"Semicolon", VK_OEM_1},
  };
  for (const auto &[name, key] : keys) if (name == code) return key;
  return 0;
}

inline DWORD RemoteKeyFlags(WORD key) noexcept {
  return ((key >= VK_PRIOR && key <= VK_DOWN) || key == VK_INSERT ||
          key == VK_DELETE || key == VK_RCONTROL || key == VK_RMENU)
    ? KEYEVENTF_EXTENDEDKEY : 0;
}
}
