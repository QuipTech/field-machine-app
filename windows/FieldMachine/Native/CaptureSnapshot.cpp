#include "pch.h"
#include "CaptureSession.h"
#include <winrt/Windows.Storage.h>
#include <winrt/Windows.Storage.Streams.h>
#include <winrt/Windows.Foundation.h>

namespace FieldMachine::Native {
winrt::fire_and_forget SaveSnapshot(std::shared_ptr<CaptureState> state,
    winrt::Windows::Graphics::Capture::Direct3D11CaptureFrame frame) {
  try {
    using namespace winrt::Windows::Storage;
    using namespace winrt::Windows::Graphics::Imaging;
    auto bitmap = co_await SoftwareBitmap::CreateCopyFromSurfaceAsync(frame.Surface());
    frame.Close();
    wchar_t temporary[MAX_PATH + 1]{};
    auto length = GetTempPathW(MAX_PATH + 1, temporary);
    winrt::check_bool(length > 0 && length <= MAX_PATH);
    auto folder = co_await StorageFolder::GetFolderFromPathAsync(temporary);
    auto file = co_await folder.CreateFileAsync(L"field-phase-zero-capture.png",
        CreationCollisionOption::GenerateUniqueName);
    auto stream = co_await file.OpenAsync(FileAccessMode::ReadWrite);
    auto encoder = co_await BitmapEncoder::CreateAsync(BitmapEncoder::PngEncoderId(), stream);
    encoder.SetSoftwareBitmap(bitmap);
    co_await encoder.FlushAsync();
    stream.Close();
    bitmap.Close();
    std::scoped_lock lock(state->mutex);
    if (state->stopped) {
      DeleteFileW(file.Path().c_str());
      co_return;
    }
    state->snapshotPath = file.Path().c_str();
    auto path = winrt::to_string(file.Path());
    for (auto &character : path) if (character == '\\') character = '/';
    state->snapshot = "file:///" + path;
  } catch (winrt::hresult_error const &error) {
    std::scoped_lock lock(state->mutex);
    state->error = winrt::to_string(error.message());
  } catch (...) {
    std::scoped_lock lock(state->mutex);
    state->error = "Could not save the capture snapshot.";
  }
}
}
