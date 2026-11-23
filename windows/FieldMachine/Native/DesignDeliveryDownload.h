#pragma once
#include <atomic>
#include <memory>
#include <string>
#include <winrt/Windows.Foundation.h>

namespace FieldMachine::Native {
inline constexpr double MaxDesignInteger = 9007199254740991.0;

struct DesignDownload {
  std::string scope, delivery, project, path, sha256, url;
  uint64_t index, size;
  std::shared_ptr<std::atomic<uint64_t>> generation;
  uint64_t activeGeneration;

  bool IsStopped() const { return generation->load() != activeGeneration; }
};

winrt::Windows::Foundation::IAsyncOperation<winrt::hstring> RunDesignDownload(DesignDownload job);
}
