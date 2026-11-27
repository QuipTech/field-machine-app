#include "CompatibilityDesktop.h"
#include <atomic>
#include <chrono>
#include <thread>
#include "../DesktopHost/DesktopCapture.h"

// Whole-screen capture inside the app, used when the FIELD Machine Desktop
// service is not installed. It shares only this Windows user's desktop (not
// the sign-in screen or other users), but needs no picker and no installer.
// Control then uses the app's own input bridge, as before.
namespace FieldMachine::Compatibility {
namespace {
using namespace std::chrono_literals;
std::thread worker;
std::atomic<bool> isCapturing{false};
}

void StartLocalCapture(std::function<void(std::vector<uint8_t> &&)> onFrame) {
    StopLocalCapture();
    isCapturing = true;
    worker = std::thread([onFrame = std::move(onFrame)] {
        const HRESULT com = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
        while (isCapturing) {
            const auto started = std::chrono::steady_clock::now();
            auto jpeg = Desktop::CaptureScreenJpeg();
            if (!jpeg.empty() && isCapturing) onFrame(std::move(jpeg));
            std::this_thread::sleep_until(started + 125ms);
        }
        if (SUCCEEDED(com)) CoUninitialize();
    });
}

void StopLocalCapture() noexcept {
    isCapturing = false;
    if (worker.joinable()) worker.join();
}
}
