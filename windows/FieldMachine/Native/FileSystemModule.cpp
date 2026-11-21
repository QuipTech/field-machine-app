#include "pch.h"
#include "FileSystemModule.h"
#include <algorithm>
#include <stdexcept>
#include <vector>

namespace FieldMachine::Native {
namespace {
std::wstring FinalPath(HANDLE handle) {
  auto size = GetFinalPathNameByHandleW(handle, nullptr, 0, FILE_NAME_NORMALIZED);
  winrt::check_bool(size != 0);
  std::vector<wchar_t> buffer(size + 1);
  auto written = GetFinalPathNameByHandleW(handle, buffer.data(),
      static_cast<DWORD>(buffer.size()), FILE_NAME_NORMALIZED);
  winrt::check_bool(written != 0 && written < buffer.size());
  return {buffer.data(), written};
}
void ValidateName(std::string const &name) {
  constexpr char prefix[] = "field-phase-zero-";
  if (name.size() <= 20 || name.size() > 100 || name.rfind(prefix, 0) != 0 ||
      name.substr(name.size() - 4) != ".txt") {
    throw std::invalid_argument("Invalid Phase 0 test filename.");
  }
  auto digits = name.substr(sizeof(prefix) - 1, name.size() - sizeof(prefix) - 3);
  if (digits.empty() || !std::all_of(digits.begin(), digits.end(),
      [](char c) { return c >= '0' && c <= '9'; })) {
    throw std::invalid_argument("Test filename must contain only a numeric suffix.");
  }
}
}

void FileSystemModule::setTestRoot(std::string root, React::ReactPromise<void> promise) noexcept {
  Complete(promise, [&] {
    std::scoped_lock lock(m_mutex);
    if (!m_files.empty()) throw std::runtime_error("Clean up test files before changing root.");
    auto path = winrt::to_hstring(root);
    // Reject relative paths, device paths, and network shares in this local-only spike.
    if (path.size() < 3 || path[1] != L':' || path[2] != L'\\' ||
        !((path[0] >= L'A' && path[0] <= L'Z') || (path[0] >= L'a' && path[0] <= L'z'))) {
      throw std::invalid_argument("Use an absolute local folder such as C:\\FieldMachineTest.");
    }
    auto raw = CreateFileW(path.c_str(), FILE_READ_ATTRIBUTES,
        FILE_SHARE_READ | FILE_SHARE_WRITE, nullptr, OPEN_EXISTING,
        FILE_FLAG_BACKUP_SEMANTICS, nullptr);
    winrt::check_bool(raw != INVALID_HANDLE_VALUE);
    winrt::handle handle{raw};
    BY_HANDLE_FILE_INFORMATION info{};
    winrt::check_bool(GetFileInformationByHandle(handle.get(), &info));
    if (!(info.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY)) {
      throw std::invalid_argument("Test root must be an existing directory.");
    }
    m_root = std::move(handle);
  });
}

void FileSystemModule::writeTestFile(std::string name, std::string contents,
    React::ReactPromise<void> promise) noexcept {
  Complete(promise, [&] {
    std::scoped_lock lock(m_mutex);
    ValidateName(name);
    if (!m_root) throw std::runtime_error("Set a test root first.");
    if (contents.size() > 4096) throw std::invalid_argument("Test file exceeds 4 KB.");
    auto parent = FinalPath(m_root.get());
    if (parent.back() != L'\\') parent += L'\\';
    auto path = parent + winrt::to_hstring(name).c_str();
    auto raw = CreateFileW(path.c_str(), GENERIC_READ | GENERIC_WRITE | DELETE,
        0, nullptr, CREATE_NEW, FILE_ATTRIBUTE_NORMAL | FILE_FLAG_DELETE_ON_CLOSE, nullptr);
    winrt::check_bool(raw != INVALID_HANDLE_VALUE);
    winrt::handle file{raw};
    if (FinalPath(file.get()) != path) throw std::runtime_error("Test file escaped its root.");
    DWORD written{};
    winrt::check_bool(WriteFile(file.get(), contents.data(),
        static_cast<DWORD>(contents.size()), &written, nullptr));
    if (written != contents.size()) throw std::runtime_error("Incomplete test file write.");
    winrt::check_bool(FlushFileBuffers(file.get()));
    m_files.emplace(name, std::move(file));
  });
}

void FileSystemModule::readTestFile(std::string name,
    React::ReactPromise<std::string> promise) noexcept {
  try {
    std::scoped_lock lock(m_mutex);
    ValidateName(name);
    auto file = m_files.find(name);
    if (file == m_files.end()) throw std::runtime_error("Only this run's test files can be read.");
    LARGE_INTEGER start{};
    winrt::check_bool(SetFilePointerEx(file->second.get(), start, nullptr, FILE_BEGIN));
    char buffer[4096]{};
    DWORD read{};
    winrt::check_bool(ReadFile(file->second.get(), buffer, sizeof(buffer), &read, nullptr));
    promise.Resolve(std::string(buffer, read));
  } catch (winrt::hresult_error const &error) {
    promise.Reject(error.message().c_str());
  } catch (std::exception const &error) {
    promise.Reject(error.what());
  } catch (...) {
    promise.Reject("Unexpected file read error.");
  }
}

void FileSystemModule::deleteTestFile(std::string name,
    React::ReactPromise<void> promise) noexcept {
  Complete(promise, [&] {
    std::scoped_lock lock(m_mutex);
    ValidateName(name);
    auto file = m_files.find(name);
    if (file == m_files.end()) throw std::runtime_error("Only this run's test files can be deleted.");
    // Closing the exclusive DELETE_ON_CLOSE handle removes only our own file.
    m_files.erase(file);
  });
}
}
