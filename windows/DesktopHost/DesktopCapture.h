#pragma once
#include <Windows.h>
#include <cstdint>
#include <vector>

namespace FieldMachine::Desktop {
// Attaches the calling thread to the desktop that currently receives input:
// the user's desktop or the lock/sign-in screen. The thread must own no windows.
bool FollowInputDesktop() noexcept;

// Captures the whole virtual screen with the pointer as a JPEG, at most
// MaxWidth pixels wide. Returns an empty vector when capture fails.
// Call CoInitializeEx on the capturing thread first.
std::vector<uint8_t> CaptureScreenJpeg();
}
