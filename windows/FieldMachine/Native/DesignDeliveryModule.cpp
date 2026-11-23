#include "pch.h"
#include "DesignDeliveryModule.h"
#include "DesignDeliveryDownload.h"
#include "DesignDeliveryStorage.h"
#include <winrt/Windows.Storage.h>
#include <winrt/Windows.System.h>

namespace FieldMachine::Native {
void DesignDeliveryModule::readJournal(std::string scope, React::ReactPromise<std::string> promise) noexcept {
  try {
    promise.Resolve(ReadDesignJournal(scope));
  } catch (...) {
    promise.Reject("Could not read saved design deliveries.");
  }
}

void DesignDeliveryModule::writeJournal(std::string scope, std::string payload,
                                        React::ReactPromise<void> promise) noexcept {
  try {
    WriteDesignJournal(scope, payload);
    promise.Resolve();
  } catch (...) {
    promise.Reject("Could not save design delivery state.");
  }
}

void DesignDeliveryModule::prepare(std::string scope, std::string delivery, std::string project,
                                   React::ReactPromise<void> promise) noexcept {
  try {
    fs::create_directories(DesignVersion(scope, project, delivery));
    promise.Resolve();
  } catch (...) {
    promise.Reject("Could not prepare the project directory.");
  }
}

void DesignDeliveryModule::stop() noexcept {
  ++*generation;
}

static winrt::fire_and_forget ResolveDesignDownload(DesignDownload job,
    React::ReactPromise<std::string> promise) {
  try {
    promise.Resolve(winrt::to_string(co_await RunDesignDownload(std::move(job))));
  } catch (...) {
    promise.Resolve("retry");
  }
}

void DesignDeliveryModule::download(std::string scope, std::string delivery, std::string project,
    std::string path, double index, double size, std::string sha256, std::string url,
    React::ReactPromise<std::string> promise) noexcept {
  if (!(index >= 0 && index <= MaxDesignInteger && size >= 0 && size <= MaxDesignInteger)) {
    promise.Resolve("permanent");
    return;
  }
  ResolveDesignDownload({std::move(scope), std::move(delivery), std::move(project), std::move(path),
      std::move(sha256), std::move(url), static_cast<uint64_t>(index), static_cast<uint64_t>(size),
      generation, generation->load()}, promise);
}

static winrt::fire_and_forget LaunchDesignFolder(std::string scope, std::string delivery,
    std::string project, React::ReactPromise<void> promise) {
  try {
    auto folder = co_await winrt::Windows::Storage::StorageFolder::GetFolderFromPathAsync(
        DesignVersion(scope, project, delivery).wstring());
    if (co_await winrt::Windows::System::Launcher::LaunchFolderAsync(folder)) {
      promise.Resolve();
    } else {
      promise.Reject("Could not open the project folder.");
    }
  } catch (...) {
    promise.Reject("Could not open the project folder.");
  }
}

void DesignDeliveryModule::openProject(std::string scope, std::string delivery, std::string project,
                                       React::ReactPromise<void> promise) noexcept {
  LaunchDesignFolder(std::move(scope), std::move(delivery), std::move(project), promise);
}
}
