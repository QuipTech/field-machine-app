#pragma once
#include "NativeHelpers.h"
#include <winrt/Windows.Storage.h>
#include <vector>

namespace FieldMachine::Native {
REACT_MODULE(PortalTransferModule, L"FieldMachinePortalTransfer")
struct PortalTransferModule {
  REACT_INIT(Initialize)
  void Initialize(React::ReactContext const &context) noexcept { m_context = context; }

  REACT_METHOD(pick)
  void pick(React::ReactPromise<React::JSValue> promise) noexcept;
  REACT_METHOD(stage)
  void stage(std::string pairing, React::ReactPromise<void> promise) noexcept;
  REACT_METHOD(list)
  void list(std::string pairing, React::ReactPromise<React::JSValue> promise) noexcept;
  REACT_METHOD(remove)
  void remove(std::string pairing, std::string id, React::ReactPromise<void> promise) noexcept;
  REACT_METHOD(upload)
  void upload(std::string url, std::string token, std::string pairing, std::string id,
              React::ReactPromise<React::JSValue> promise) noexcept;

private:
  React::ReactContext m_context;
  // Picker results are accessed only on the UI dispatcher.
  std::vector<winrt::Windows::Storage::StorageFile> m_selection;
  bool m_isPicking{false};
  winrt::fire_and_forget Pick(React::ReactPromise<React::JSValue> promise);
  static winrt::fire_and_forget Stage(
      std::string pairing, std::vector<winrt::Windows::Storage::StorageFile> files,
      React::ReactPromise<void> promise);
};
}
