#pragma once
#include "PortalTransferStorage.h"
#include <algorithm>
#include <cwctype>
#include <fstream>

namespace FieldMachine::Native {
inline fs::path DesignRoot(std::string const &scope) {
  auto root = PortalQueue(scope) / L"Design delivery";
  RejectReparsePoint(root);
  fs::create_directories(root);
  return root;
}

inline fs::path DesignChild(fs::path const &parent, std::string const &id) {
  if (!IsTransferId(id)) throw std::invalid_argument("Invalid design identifier.");
  auto child = parent / id;
  RejectReparsePoint(child);
  return child;
}

inline fs::path DesignVersion(std::string const &scope, std::string const &project,
                              std::string const &delivery) {
  return DesignChild(DesignChild(DesignRoot(scope), project), delivery);
}

inline fs::path DesignFile(fs::path directory, std::string const &relative) {
  size_t start = 0;
  while (true) {
    auto end = relative.find('/', start);
    auto name = winrt::to_hstring(relative.substr(start, end - start));
    std::wstring segment{name.c_str(), name.size()};
    if (segment.empty() || segment.back() == L'.' || segment.back() == L' ' ||
        segment.find_first_of(L"<>:\"\\|?*") != std::wstring::npos ||
        std::any_of(segment.begin(), segment.end(), [](wchar_t value) { return value < 32; })) {
      throw std::invalid_argument("Invalid design file name.");
    }
    auto stem = segment.substr(0, segment.find(L'.'));
    while (!stem.empty() && stem.back() == L' ') stem.pop_back();
    for (auto &character : stem) character = static_cast<wchar_t>(std::towupper(character));
    if (stem == L"CON" || stem == L"PRN" || stem == L"AUX" || stem == L"NUL" ||
        stem == L"CONIN$" || stem == L"CONOUT$" ||
        (stem.size() == 4 && (stem.starts_with(L"COM") || stem.starts_with(L"LPT")) &&
         std::wstring_view(L"123456789\u00b9\u00b2\u00b3").find(stem.back()) != std::wstring_view::npos)) {
      throw std::invalid_argument("Reserved design file name.");
    }
    directory /= segment;
    RejectReparsePoint(directory);
    if (end == std::string::npos) return directory;
    fs::create_directory(directory);
    start = end + 1;
  }
}

inline void ReplaceDesignFile(fs::path const &from, fs::path const &to) {
  RejectReparsePoint(from);
  RejectReparsePoint(to);
  winrt::check_bool(MoveFileExW(from.c_str(), to.c_str(),
      MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH));
}

inline std::string ReadDesignJournal(std::string const &scope) {
  auto path = DesignRoot(scope) / L"journal.json";
  RejectReparsePoint(path);
  if (!fs::exists(path)) return R"({"projects":[],"pending":null})";
  std::ifstream file(path, std::ios::binary);
  if (!file) throw std::runtime_error("Cannot read design journal.");
  return {std::istreambuf_iterator<char>(file), std::istreambuf_iterator<char>()};
}

inline void WriteDesignJournal(std::string const &scope, std::string const &payload) {
  auto root = DesignRoot(scope);
  auto temporary = root / L"journal.tmp";
  RejectReparsePoint(temporary);
  auto handle = CreateFileW(temporary.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS,
      FILE_ATTRIBUTE_NORMAL | FILE_FLAG_OPEN_REPARSE_POINT, nullptr);
  if (handle == INVALID_HANDLE_VALUE) winrt::throw_last_error();
  winrt::handle owner{handle};
  DWORD written{};
  winrt::check_bool(WriteFile(handle, payload.data(), static_cast<DWORD>(payload.size()), &written, nullptr));
  if (written != payload.size()) throw std::runtime_error("Incomplete design journal.");
  winrt::check_bool(FlushFileBuffers(handle));
  owner.close();
  ReplaceDesignFile(temporary, root / L"journal.json");
}
}
