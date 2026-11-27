#include "CompatibilityDesktop.h"
#include <wincrypt.h>
#include <wrl.h>
#include <winrt/Windows.Foundation.Collections.h>
#include <atomic>
#include <fstream>
#include <optional>
#include "CompatibilityContent.h"
#include "../DesktopHost/DesktopProtocol.h"
#include "../DesktopHost/DesktopLog.h"
#include "../FieldMachine/Native/PortalTransferStorage.h"

namespace FieldMachine::Compatibility {
namespace {
using Microsoft::WRL::ComPtr;
using winrt::Windows::Data::Json::JsonValueType;
ComPtr<ICoreWebView2> desktopView;
std::optional<winrt::apartment_context> uiContext;
std::string transferPairing;
std::atomic<int> queuedFrames{0};

winrt::fire_and_forget Post(std::wstring json, bool isFrame) {
    const auto context = *uiContext;
    const auto view = desktopView;
    co_await context;
    if (view && HasLoadedCompatibilityResources()) view->PostWebMessageAsJson(json.c_str());
    if (isFrame) --queuedFrames;
}

void PostEvent(JsonObject event) {
    event.SetNamedValue(L"type", JsonValue::CreateStringValue(L"field-desktop-event"));
    Post(std::wstring(event.Stringify()), false);
}

// Drops frames while the page is behind, so the Portal always gets the latest screen.
void PostFrame(std::vector<uint8_t> &&jpeg) {
    if (queuedFrames >= 2 || jpeg.empty()) return;
    DWORD length = 0;
    const DWORD flags = CRYPT_STRING_BASE64 | CRYPT_STRING_NOCRLF;
    if (!CryptBinaryToStringW(jpeg.data(), static_cast<DWORD>(jpeg.size()), flags, nullptr, &length)) return;
    std::wstring encoded(length, L'\0');
    if (!CryptBinaryToStringW(jpeg.data(), static_cast<DWORD>(jpeg.size()), flags, encoded.data(), &length)) return;
    encoded.resize(length);
    ++queuedFrames;
    Post(L"{\"type\":\"field-desktop-frame\",\"data\":\"" + encoded + L"\"}", true);
}

void ForwardAgentEvent(std::string const &text) {
    JsonObject message{nullptr};
    if (!JsonObject::TryParse(winrt::to_hstring(text), message)) return;
    const auto name = message.GetNamedString(L"event", L"");
    if (name != L"started" && name != L"denied" && name != L"ended" && name != L"stop" && name != L"mic") return;
    JsonObject event;
    event.SetNamedValue(L"event", JsonValue::CreateStringValue(name));
    for (auto key : {L"control", L"on"}) {
        const auto value = message.GetNamedValue(key, nullptr);
        if (value && value.ValueType() == JsonValueType::Boolean) event.SetNamedValue(key, value);
    }
    PostEvent(event);
}

bool IsSafeFileName(std::wstring const &name) {
    if (name.empty() || name.size() > 200 || name.find_first_of(L"\\/:*?\"<>|") != std::wstring::npos) return false;
    for (auto character : name) {
        if (character < 32) return false;
    }
    auto extension = Native::fs::path(name).extension().wstring();
    CharLowerW(extension.data());
    for (auto allowed : Native::PortalExtensions) {
        if (extension == allowed) return true;
    }
    return false;
}

// Stages a file dropped on the support panel exactly like a picked Portal file.
std::wstring StageFile(std::wstring const &name, const uint8_t *data, size_t size) {
    if (!IsSafeFileName(name) || size == 0 || size > Native::MaxPortalFileSize) {
        throw std::invalid_argument("Unsupported file.");
    }
    const auto queue = Native::PortalQueue(transferPairing);
    Native::fs::create_directories(queue);
    GUID guid{};
    winrt::check_hresult(CoCreateGuid(&guid));
    wchar_t formatted[39]{};
    StringFromGUID2(guid, formatted, 39);
    const std::wstring id(formatted + 1, 36);
    const auto draft = queue / (L"." + id);
    if (!Native::fs::create_directory(draft)) throw std::invalid_argument("Transfer exists.");
    try {
        std::ofstream output(draft / name, std::ios::binary);
        output.write(reinterpret_cast<const char *>(data), static_cast<std::streamsize>(size));
        output.close();
        if (!output) throw std::invalid_argument("Write failed.");
        Native::fs::rename(draft, queue / id);
    } catch (...) {
        std::error_code ignored;
        Native::fs::remove_all(draft, ignored);
        throw;
    }
    return id;
}

void ReceiveFile(std::vector<uint8_t> &&body) {
    std::string utf8Name;
    size_t offset = 0;
    if (!Desktop::UnpackFileName(body, utf8Name, offset)) return;
    const std::wstring name(winrt::to_hstring(utf8Name));
    JsonObject event;
    event.SetNamedValue(L"fileName", JsonValue::CreateStringValue(name));
    try {
        const auto id = StageFile(name, body.data() + offset, body.size() - offset);
        event.SetNamedValue(L"event", JsonValue::CreateStringValue(L"file-staged"));
        event.SetNamedValue(L"transferId", JsonValue::CreateStringValue(id));
    } catch (...) {
        event.SetNamedValue(L"event", JsonValue::CreateStringValue(L"file-rejected"));
    }
    PostEvent(event);
}

std::string Text(JsonObject const &message, const wchar_t *key) {
    return winrt::to_string(message.GetNamedString(key));
}
}

void RegisterDesktopView(ComPtr<ICoreWebView2> view) {
    // The operator turns the microphone on from the support panel, possibly in
    // another Windows user where this app's own permission prompt is not visible.
    EventRegistrationToken token{};
    view->add_PermissionRequested(Microsoft::WRL::Callback<ICoreWebView2PermissionRequestedEventHandler>(
        [](ICoreWebView2 *, ICoreWebView2PermissionRequestedEventArgs *args) {
            COREWEBVIEW2_PERMISSION_KIND kind{};
            PWSTR uri = nullptr;
            const bool isPicker = SUCCEEDED(args->get_Uri(&uri)) && uri &&
                std::wstring_view(uri).starts_with(L"https://field-machine.test/");
            CoTaskMemFree(uri);
            if (isPicker && IsDesktopLinked() && SUCCEEDED(args->get_PermissionKind(&kind)) &&
                kind == COREWEBVIEW2_PERMISSION_KIND_MICROPHONE) {
                args->put_State(COREWEBVIEW2_PERMISSION_STATE_ALLOW);
            }
            return S_OK;
        }).Get(), &token);
    desktopView = std::move(view);
    uiContext.emplace();
}

bool ForwardDesktopInput(JsonObject const &message) {
    JsonObject input;
    input.SetNamedValue(L"op", JsonValue::CreateStringValue(L"input"));
    for (auto key : {L"operation", L"owner", L"kind", L"action", L"value", L"x", L"y", L"first", L"second"}) {
        if (message.HasKey(key)) input.SetNamedValue(key, message.GetNamedValue(key));
    }
    return SendDesktopJson(winrt::to_string(input.Stringify()));
}

winrt::Windows::Foundation::IAsyncOperation<IJsonValue> RunDesktopOperation(JsonObject message) {
    const auto operation = message.GetNamedString(L"operation");
    if (operation == L"start") {
        auto pairing = Text(message, L"pairing");
        Native::PortalQueue(pairing); // Validates the pairing format before use.
        JsonObject start;
        start.SetNamedValue(L"op", JsonValue::CreateStringValue(L"start"));
        start.SetNamedValue(L"token", message.GetNamedValue(L"token"));
        start.SetNamedValue(L"sessionId", message.GetNamedValue(L"sessionId"));
        co_await winrt::resume_background();
        StopLocalCapture();
        transferPairing = std::move(pairing);
        // Without the installed service there is no agent pipe: share this user's screen directly.
        const bool hasService = WaitNamedPipeW(Desktop::AppPipe, 200) || GetLastError() != ERROR_FILE_NOT_FOUND;
        if (hasService) {
            StartDesktopLink(winrt::to_string(start.Stringify()), {PostFrame, ForwardAgentEvent, ReceiveFile});
            if (WaitForDesktopLink(3000)) co_return JsonValue::CreateStringValue(L"service");
            StopDesktopLink();
        }
        Desktop::Log("app: no agent, sharing this user only (service %s)", hasService ? "did not link" : "not installed");
        StartLocalCapture(PostFrame);
        co_return JsonValue::CreateStringValue(L"local");
    }
    if (operation == L"stop") {
        co_await winrt::resume_background();
        StopDesktopLink();
        StopLocalCapture();
        co_return JsonValue::CreateNullValue();
    }
    if (operation != L"notify") throw winrt::hresult_invalid_argument();
    JsonObject status;
    status.SetNamedValue(L"op", JsonValue::CreateStringValue(L"status"));
    status.SetNamedValue(L"text", JsonValue::CreateStringValue(
        std::wstring(message.GetNamedString(L"text")).substr(0, 300)));
    co_return JsonValue::CreateBooleanValue(SendDesktopJson(winrt::to_string(status.Stringify())));
}
}
