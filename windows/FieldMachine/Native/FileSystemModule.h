#pragma once
#include "NativeHelpers.h"
#include <map>
#include <mutex>
#include <string>

namespace FieldMachine::Native {
REACT_MODULE(FileSystemModule, L"FieldMachineFileSystem")
struct FileSystemModule {
  REACT_METHOD(setTestRoot)
  void setTestRoot(std::string root, React::ReactPromise<void> promise) noexcept;
  REACT_METHOD(writeTestFile)
  void writeTestFile(std::string name, std::string contents,
                     React::ReactPromise<void> promise) noexcept;
  REACT_METHOD(readTestFile)
  void readTestFile(std::string name, React::ReactPromise<std::string> promise) noexcept;
  REACT_METHOD(deleteTestFile)
  void deleteTestFile(std::string name, React::ReactPromise<void> promise) noexcept;
private:
  std::mutex m_mutex;
  winrt::handle m_root;
  std::map<std::string, winrt::handle> m_files;
};
}
