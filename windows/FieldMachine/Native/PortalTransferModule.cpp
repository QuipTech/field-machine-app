#include "pch.h"
#include "PortalTransferModule.h"
#include "PortalTransferStorage.h"
#include <shobjidl_core.h>
#include <winrt/Windows.Storage.FileProperties.h>
#include <winrt/Windows.Storage.Pickers.h>

namespace FieldMachine::Native {
using namespace winrt::Windows::Storage;

void PortalTransferModule::pick(React::ReactPromise<React::JSValue> promise) noexcept {
  m_context.UIDispatcher().Post([this, promise]() noexcept {
    if (m_isPicking) {
      promise.Reject("A file picker is already open.");
      return;
    }
    m_isPicking = true;
    Pick(promise);
  });
}

winrt::fire_and_forget PortalTransferModule::Pick(React::ReactPromise<React::JSValue> promise) {
  try {
    m_selection.clear();
    Pickers::FileOpenPicker picker;
    auto windowId = React::ReactCoreInjection::GetTopLevelWindowId(m_context.Properties().Handle());
    auto window = reinterpret_cast<HWND>(windowId);
    winrt::check_hresult(picker.as<IInitializeWithWindow>()->Initialize(window));
    for (auto extension : PortalExtensions) {
      picker.FileTypeFilter().Append(extension);
    }
    auto files = co_await picker.PickMultipleFilesAsync();
    React::JSValueArray names;
    std::vector<StorageFile> selection;
    for (auto const &file : files) {
      auto properties = co_await file.GetBasicPropertiesAsync();
      if (properties.Size() > MaxPortalFileSize) {
        promise.Reject("Each file must be 20 MiB or smaller. Choose the files again.");
        m_isPicking = false;
        co_return;
      }
      names.emplace_back(winrt::to_string(file.Name()));
      selection.push_back(file);
    }
    m_selection = std::move(selection);
    promise.Resolve(React::JSValue(std::move(names)));
  } catch (...) {
    promise.Reject("Could not open or read the selected files.");
  }
  m_isPicking = false;
}

void PortalTransferModule::stage(std::string pairing, React::ReactPromise<void> promise) noexcept {
  m_context.UIDispatcher().Post([this, pairing = std::move(pairing), promise]() noexcept {
    Stage(pairing, std::exchange(m_selection, {}), promise);
  });
}

winrt::fire_and_forget PortalTransferModule::Stage(
    std::string pairing, std::vector<StorageFile> files, React::ReactPromise<void> promise) {
  try {
    co_await winrt::resume_background();
    auto queue = PortalQueue(pairing);
    fs::create_directories(queue);
    for (auto const &file : files) {
      GUID guid{};
      winrt::check_hresult(CoCreateGuid(&guid));
      wchar_t formatted[39]{};
      StringFromGUID2(guid, formatted, 39);
      std::wstring id(formatted + 1, 36);
      auto draft = queue / (L"." + id);
      if (!fs::create_directory(draft)) {
        throw std::invalid_argument("Transfer draft already exists.");
      }
      try {
        auto folder = co_await StorageFolder::GetFolderFromPathAsync(draft.wstring());
        auto copy = co_await file.CopyAsync(folder);
        auto properties = co_await copy.GetBasicPropertiesAsync();
        if (properties.Size() > MaxPortalFileSize) {
          throw std::invalid_argument("Selected file exceeds the size limit.");
        }
        fs::rename(draft, queue / id);
      } catch (...) {
        std::error_code ignored;
        fs::remove_all(draft, ignored);
        throw;
      }
    }
    promise.Resolve();
  } catch (...) {
    promise.Reject("Could not save every selected file. Check the queue and select any missing files again.");
  }
}

void PortalTransferModule::list(std::string pairing,
                                React::ReactPromise<React::JSValue> promise) noexcept {
  try {
    React::JSValueArray entries;
    auto queue = PortalQueue(pairing);
    if (fs::exists(queue)) {
      for (auto const &folder : fs::directory_iterator(queue)) {
        auto id = folder.path().filename().string();
        if (IsTransferId(id)) {
          RejectReparsePoint(folder.path());
          if (!folder.is_directory() || fs::is_empty(folder.path())) {
            continue;
          }
          auto file = StagedFile(folder.path());
          entries.emplace_back(React::JSValueObject{
              {"id", id}, {"fileName", winrt::to_string(file.filename().wstring())}});
        }
      }
    }
    promise.Resolve(React::JSValue(std::move(entries)));
  } catch (...) {
    promise.Reject("Could not read the pending transfer queue.");
  }
}

void PortalTransferModule::remove(std::string pairing, std::string id,
                                  React::ReactPromise<void> promise) noexcept {
  Complete(promise, [&]() {
    fs::remove_all(PendingTransfer(pairing, id));
  });
}
}
