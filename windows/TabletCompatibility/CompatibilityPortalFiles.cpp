#include <Windows.h>
#include <shobjidl_core.h>
#include <winrt/Windows.Foundation.Collections.h>
#include <winrt/Windows.Storage.h>
#include <winrt/Windows.Storage.FileProperties.h>
#include <winrt/Windows.Storage.Pickers.h>
#include "CompatibilityContent.h"
#include "CompatibilityFileBridge.h"
#include "../FieldMachine/Native/PortalTransferStorage.h"
#include "../FieldMachine/Native/PortalTransferUpload.h"

namespace FieldMachine::Compatibility {
namespace {
using namespace Native;
using namespace winrt::Windows::Storage;
using winrt::Windows::Data::Json::JsonArray;

std::vector<StorageFile> selection;
bool isPicking = false;
constexpr char UploadUrl[] = "https://staging-api.quiptechfield.com.au/mc/device/files";

winrt::Windows::Foundation::IAsyncOperation<JsonArray> Pick(HWND window) {
    if (isPicking) throw winrt::hresult_illegal_method_call();
    isPicking = true;
    selection.clear();
    try {
        Pickers::FileOpenPicker picker;
        winrt::check_hresult(picker.as<IInitializeWithWindow>()->Initialize(window));
        for (auto extension : PortalExtensions) picker.FileTypeFilter().Append(extension);
        auto files = co_await picker.PickMultipleFilesAsync();
        JsonArray names;
        std::vector<StorageFile> picked;
        for (auto const &file : files) {
            auto properties = co_await file.GetBasicPropertiesAsync();
            if (properties.Size() > MaxPortalFileSize) throw winrt::hresult_invalid_argument();
            names.Append(JsonValue::CreateStringValue(file.Name()));
            picked.push_back(file);
        }
        selection = std::move(picked);
        isPicking = false;
        co_return names;
    } catch (...) {
        isPicking = false;
        throw;
    }
}

winrt::Windows::Foundation::IAsyncAction Stage(std::string pairing, std::vector<StorageFile> files) {
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
        if (!fs::create_directory(draft)) throw winrt::hresult_invalid_argument();
        try {
            auto folder = co_await StorageFolder::GetFolderFromPathAsync(draft.wstring());
            auto copy = co_await file.CopyAsync(folder);
            auto properties = co_await copy.GetBasicPropertiesAsync();
            if (properties.Size() > MaxPortalFileSize) throw winrt::hresult_invalid_argument();
            fs::rename(draft, queue / id);
        } catch (...) {
            std::error_code ignored;
            fs::remove_all(draft, ignored);
            throw;
        }
    }
}

JsonArray List(std::string const &pairing) {
    JsonArray entries;
    auto queue = PortalQueue(pairing);
    if (!fs::exists(queue)) return entries;
    for (auto const &folder : fs::directory_iterator(queue)) {
        auto id = folder.path().filename().string();
        if (!IsTransferId(id)) continue;
        RejectReparsePoint(folder.path());
        if (!folder.is_directory() || fs::is_empty(folder.path())) continue;
        auto file = StagedFile(folder.path());
        JsonObject entry;
        entry.SetNamedValue(L"id", JsonValue::CreateStringValue(winrt::to_hstring(id)));
        entry.SetNamedValue(L"fileName", JsonValue::CreateStringValue(file.filename().wstring()));
        entries.Append(entry);
    }
    return entries;
}

winrt::fire_and_forget ReportProgress(winrt::apartment_context ui,
    Microsoft::WRL::ComPtr<ICoreWebView2> view, std::string id, int percent) {
    try {
        co_await ui;
        if (!HasLoadedCompatibilityResources()) co_return;
        JsonObject event;
        event.SetNamedValue(L"type", JsonValue::CreateStringValue(L"field-portal-progress"));
        event.SetNamedValue(L"id", JsonValue::CreateStringValue(winrt::to_hstring(id)));
        event.SetNamedValue(L"percent", JsonValue::CreateNumberValue(percent));
        view->PostWebMessageAsJson(event.Stringify().c_str());
    } catch (...) {
        // A closing WebView does not need upload progress.
    }
}
}

winrt::Windows::Foundation::IAsyncOperation<IJsonValue> RunPortalFileOperation(
    JsonObject message, Microsoft::WRL::ComPtr<ICoreWebView2> view, HWND window) {
    using namespace Native;
    const auto operation = message.GetNamedString(L"operation");
    if (operation == L"pick") co_return co_await Pick(window);
    auto pairing = winrt::to_string(message.GetNamedString(L"pairing"));
    if (operation == L"list") co_return List(pairing);
    if (operation == L"stage") {
        if (isPicking) throw winrt::hresult_illegal_method_call();
        co_await Stage(pairing, std::exchange(selection, {}));
        co_return JsonValue::CreateNullValue();
    }
    auto id = winrt::to_string(message.GetNamedString(L"transferId"));
    if (operation == L"remove") {
        auto folder = PendingTransfer(pairing, id);
        if (!fs::exists(folder)) co_return JsonValue::CreateNullValue();
        if (!fs::is_empty(folder)) fs::remove(StagedFile(folder));
        fs::remove(folder);
        co_return JsonValue::CreateNullValue();
    }
    if (operation != L"upload") throw winrt::hresult_invalid_argument();
    auto token = winrt::to_string(message.GetNamedString(L"token"));
    auto progress = [ui = winrt::apartment_context{}, view, id](int percent) noexcept {
        ReportProgress(ui, view, id, percent);
    };
    JsonObject result;
    try {
        auto response = co_await UploadPortalFile(UploadUrl, std::move(token),
            std::move(pairing), id, std::move(progress));
        result.SetNamedValue(L"status", JsonValue::CreateNumberValue(static_cast<int>(response.StatusCode())));
        result.SetNamedValue(L"body", JsonValue::CreateStringValue(co_await response.Content().ReadAsStringAsync()));
    } catch (std::invalid_argument const &) {
        result.SetNamedValue(L"status", JsonValue::CreateNumberValue(400));
        result.SetNamedValue(L"body", JsonValue::CreateStringValue(L""));
    }
    co_return result;
}
}
