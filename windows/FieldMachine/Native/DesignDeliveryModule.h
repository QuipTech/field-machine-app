#pragma once
#include <NativeModules.h>
#include <atomic>

namespace FieldMachine::Native {
REACT_MODULE(DesignDeliveryModule, L"FieldMachineDesignDelivery")
struct DesignDeliveryModule {
  REACT_METHOD(readJournal)
  void readJournal(std::string scope, React::ReactPromise<std::string> promise) noexcept;
  REACT_METHOD(writeJournal)
  void writeJournal(std::string scope, std::string payload, React::ReactPromise<void> promise) noexcept;
  REACT_METHOD(prepare)
  void prepare(std::string scope, std::string delivery, std::string project,
               React::ReactPromise<void> promise) noexcept;
  REACT_METHOD(download)
  void download(std::string scope, std::string delivery, std::string project,
                std::string path, double index, double size, std::string sha256,
                std::string url, React::ReactPromise<std::string> promise) noexcept;
  REACT_METHOD(stop)
  void stop() noexcept;
  REACT_METHOD(openProject)
  void openProject(std::string scope, std::string delivery, std::string project,
                   React::ReactPromise<void> promise) noexcept;

 private:
  std::shared_ptr<std::atomic<uint64_t>> generation = std::make_shared<std::atomic<uint64_t>>(0);
};
}
