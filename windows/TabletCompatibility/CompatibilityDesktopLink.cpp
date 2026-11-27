#include "CompatibilityDesktop.h"
#include <atomic>
#include <chrono>
#include <condition_variable>
#include <mutex>
#include <thread>
#include "../DesktopHost/DesktopProtocol.h"
#include "../DesktopHost/DesktopLog.h"

namespace FieldMachine::Compatibility {
namespace {
using namespace FieldMachine::Desktop;
using namespace std::chrono_literals;

std::mutex stateLock;
std::condition_variable changed;
std::mutex writeLock;
std::thread worker;
std::atomic<bool> isStopping{false};
std::atomic<bool> isLinked{false};
std::atomic<bool> isFinished{true};
HANDLE pipe = INVALID_HANDLE_VALUE;
std::string startMessage;
DesktopCallbacks handlers;

void Pause() {
    std::unique_lock lock(stateLock);
    changed.wait_for(lock, 500ms, [] { return isStopping.load(); });
}

void Dispatch(Message &message) {
    if (message.kind == Kind::Frame) handlers.onFrame(std::move(message.body));
    else if (message.kind == Kind::File) handlers.onFile(std::move(message.body));
    else handlers.onJson(std::string(message.body.begin(), message.body.end()));
}

void Serve(HANDLE candidate) {
    {
        std::lock_guard lock(writeLock);
        pipe = candidate;
        if (!WriteJson(pipe, startMessage)) return;
    }
    isLinked = true;
    changed.notify_all();
    Message message;
    while (!isStopping && ReadMessage(candidate, message)) Dispatch(message);
    isLinked = false;
}

void Run() {
    while (!isStopping) {
        const HANDLE candidate = OpenClientPipe(AppPipe);
        if (candidate == INVALID_HANDLE_VALUE) {
            Pause();
            continue;
        }
        // Only the installed SYSTEM agent next to this app may receive the device token.
        if (IsPeer(candidate, true, HostFileName)) {
            Log("app: linked to agent");
            Serve(candidate);
            Log("app: agent link closed");
        } else {
            Log("app: pipe server is not the installed agent");
        }
        {
            std::lock_guard lock(writeLock);
            pipe = INVALID_HANDLE_VALUE;
        }
        CloseHandle(candidate);
        if (!isStopping) Pause();
    }
    isFinished = true;
}
}

void StartDesktopLink(std::string startJson, DesktopCallbacks callbacks) {
    StopDesktopLink();
    startMessage = std::move(startJson);
    handlers = std::move(callbacks);
    isStopping = false;
    isFinished = false;
    worker = std::thread(Run);
}

bool WaitForDesktopLink(DWORD timeoutMs) {
    std::unique_lock lock(stateLock);
    return changed.wait_for(lock, std::chrono::milliseconds(timeoutMs),
        [] { return isLinked.load() || isStopping.load(); }) && isLinked;
}

void StopDesktopLink() noexcept {
    if (!worker.joinable()) return;
    SendDesktopJson(R"({"op":"stop"})");
    isStopping = true;
    changed.notify_all();
    // Repeat the cancel: the reader may start a new wait right after one cancel.
    for (int attempt = 0; attempt < 60 && !isFinished; ++attempt) {
        {
            std::lock_guard lock(writeLock);
            if (pipe != INVALID_HANDLE_VALUE) CancelIoEx(pipe, nullptr);
        }
        std::this_thread::sleep_for(50ms);
    }
    if (isFinished) worker.join();
    else worker.detach();
    isLinked = false;
}

bool SendDesktopJson(std::string const &json) {
    std::lock_guard lock(writeLock);
    return pipe != INVALID_HANDLE_VALUE && isLinked && WriteJson(pipe, json);
}

bool IsDesktopLinked() noexcept {
    return isLinked;
}
}
