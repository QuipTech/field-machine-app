#pragma once
#include <filesystem>
#include <regex>
#include <shlobj.h>

namespace FieldMachine::Native {
namespace fs = std::filesystem;
inline constexpr uint64_t MaxPortalFileSize = 20971520;
inline constexpr wchar_t const *PortalExtensions[] = {
    L".pdf", L".doc", L".docx", L".jpg", L".jpeg", L".png", L".heic"};

inline bool IsTransferId(std::string const &id) {
  static const std::regex pattern(
      "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");
  return std::regex_match(id, pattern);
}

inline void RejectReparsePoint(fs::path const &path) {
  auto attributes = GetFileAttributesW(path.c_str());
  if (attributes != INVALID_FILE_ATTRIBUTES && (attributes & FILE_ATTRIBUTE_REPARSE_POINT)) {
    throw std::invalid_argument("Transfer storage contains a redirected path.");
  }
}

inline fs::path PortalQueue(std::string const &pairing) {
  static const std::regex pattern("[a-z0-9-]+_[0-9a-fA-F-]{36}_[0-9a-fA-F-]{36}");
  if (!std::regex_match(pairing, pattern)) {
    throw std::invalid_argument("Invalid transfer pairing.");
  }
  wchar_t *localPath{};
  winrt::check_hresult(SHGetKnownFolderPath(FOLDERID_LocalAppData, 0, nullptr, &localPath));
  std::unique_ptr<wchar_t, decltype(&CoTaskMemFree)> owner(localPath, CoTaskMemFree);
  auto app = fs::path(owner.get()) / L"FIELD Machine";
  auto transfers = app / L"Portal transfers";
  auto queue = transfers / pairing;
  RejectReparsePoint(app);
  RejectReparsePoint(transfers);
  RejectReparsePoint(queue);
  return queue;
}

inline fs::path PendingTransfer(std::string const &pairing, std::string const &id) {
  if (!IsTransferId(id)) {
    throw std::invalid_argument("Invalid transfer ID.");
  }
  auto directory = PortalQueue(pairing) / id;
  RejectReparsePoint(directory);
  return directory;
}

inline fs::path StagedFile(fs::path const &directory) {
  RejectReparsePoint(directory);
  if (!fs::is_directory(directory)) {
    throw std::invalid_argument("Missing staged transfer.");
  }
  for (auto const &item : fs::directory_iterator(directory)) {
    if (!item.is_symlink() && item.is_regular_file()) {
      RejectReparsePoint(item.path());
      return item.path();
    }
  }
  throw std::invalid_argument("Missing staged file.");
}
}
