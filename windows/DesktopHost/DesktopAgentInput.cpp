#include <Windows.h>
#include <atomic>
#include <condition_variable>
#include <deque>
#include <mutex>
#include <string>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Data.Json.h>
#include "DesktopAgentState.h"
#include "DesktopCapture.h"
#include "DesktopLog.h"

namespace FieldMachine::Desktop {
namespace {
using winrt::Windows::Data::Json::JsonObject;
constexpr size_t MaxQueuedInput = 256;

std::mutex queueLock;
std::condition_variable queued;
std::deque<JsonObject> pending;
std::atomic<bool> isResetRequested{false};

// Owned by the input thread only.
std::string startedOwner;
RECT startedBounds{};

std::string Text(JsonObject const &message, const wchar_t *key) {
    return winrt::to_string(message.GetNamedString(key, L""));
}

RECT ScreenBounds() {
    const int left = GetSystemMetrics(SM_XVIRTUALSCREEN);
    const int top = GetSystemMetrics(SM_YVIRTUALSCREEN);
    return {left, top, left + GetSystemMetrics(SM_CXVIRTUALSCREEN), top + GetSystemMetrics(SM_CYVIRTUALSCREEN)};
}

// Each user switch starts a new agent, and the sign-in screen can use another
// resolution, so control is (re)started here on first use instead of relying on
// the single start message sent when sharing began.
bool EnsureStarted(std::string const &owner) {
    const RECT bounds = ScreenBounds();
    if (owner == startedOwner && EqualRect(&bounds, &startedBounds)) return true;
    startedOwner = Agent().input.Start(owner) ? owner : std::string{};
    Log("agent: control %s, screen %ldx%ld, monitors %d", startedOwner.empty() ? "unavailable" : "armed",
        bounds.right - bounds.left, bounds.bottom - bounds.top, GetSystemMetrics(SM_CMONITORS));
    startedBounds = bounds;
    return !startedOwner.empty();
}

void Apply(JsonObject const &message) {
    auto &input = Agent().input;
    const auto operation = message.GetNamedString(L"operation", L"");
    const auto owner = Text(message, L"owner");
    if (owner.empty()) return;
    if (operation == L"release" || operation == L"end") {
        input.Reset(owner, operation == L"end");
        if (operation == L"end" && owner == startedOwner) startedOwner.clear();
        return;
    }
    if (operation == L"start") {
        startedOwner.clear();
        EnsureStarted(owner);
        return;
    }
    if (operation != L"apply" || !EnsureStarted(owner)) return;
    const bool isApplied = input.ApplyInput(owner, Text(message, L"kind"), Text(message, L"action"),
        message.GetNamedNumber(L"x", 0), message.GetNamedNumber(L"y", 0),
        message.GetNamedNumber(L"first", 0), message.GetNamedNumber(L"second", 0), Text(message, L"value"));
    static unsigned applied = 0;
    static unsigned rejected = 0;
    (isApplied ? applied : rejected)++;
    if (!isApplied && rejected <= 20) Log("agent: input rejected (%s), error %lu", Text(message, L"kind").c_str(), GetLastError());
    if ((applied + rejected) % 200 == 0) Log("agent: input applied=%u rejected=%u", applied, rejected);
}
}

void QueueInput(JsonObject message) {
    auto &agent = Agent();
    if (!agent.isSharing || !agent.canControl) return;
    {
        std::lock_guard lock(queueLock);
        if (pending.size() >= MaxQueuedInput) return;
        pending.push_back(std::move(message));
    }
    queued.notify_one();
}

void ResetInput() {
    {
        std::lock_guard lock(queueLock);
        pending.clear();
    }
    isResetRequested = true;
    Agent().input.Stop();
    queued.notify_one();
}

// A dedicated thread that owns no windows, so it can always attach to the
// desktop receiving input: the user's desktop or the lock/sign-in screen.
void RunInputLoop() {
    winrt::init_apartment();
    auto &agent = Agent();
    for (;;) {
        JsonObject message{nullptr};
        {
            std::unique_lock lock(queueLock);
            queued.wait(lock, [] { return !pending.empty() || isResetRequested.load(); });
            if (!pending.empty()) {
                message = std::move(pending.front());
                pending.pop_front();
            }
        }
        if (isResetRequested.exchange(false)) startedOwner.clear();
        if (!message || !agent.isSharing || !agent.canControl) continue;
        FollowInputDesktop();
        Apply(message);
    }
}
}
