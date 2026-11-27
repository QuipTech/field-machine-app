#include "DesktopPanel.h"
#include "DesktopProtocol.h"
#include <fstream>
#include <mutex>
#include <thread>
#include <winrt/base.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Data.Json.h>
#include "../FieldMachine/Native/PortalTransferStorage.h"

namespace FieldMachine::Desktop {
namespace {
using winrt::Windows::Data::Json::JsonObject;
HANDLE pipe = INVALID_HANDLE_VALUE;
std::mutex writeLock;

std::string Utf8(std::wstring const &text) {
    const int size = WideCharToMultiByte(CP_UTF8, 0, text.c_str(), -1, nullptr, 0, nullptr, nullptr);
    std::string result(size > 0 ? size - 1 : 0, '\0');
    if (size > 1) WideCharToMultiByte(CP_UTF8, 0, text.c_str(), -1, result.data(), size, nullptr, nullptr);
    return result;
}

bool IsAllowedFile(Native::fs::path const &path) {
    auto extension = path.extension().wstring();
    CharLowerW(extension.data());
    for (auto allowed : Native::PortalExtensions) {
        if (extension == allowed) return true;
    }
    return false;
}

void HandleMessage(HWND window, Message const &message) {
    if (message.kind != Kind::Json) return;
    JsonObject json{nullptr};
    const std::string_view text(reinterpret_cast<const char *>(message.body.data()), message.body.size());
    if (!JsonObject::TryParse(winrt::to_hstring(text), json)) return;
    if (json.GetNamedString(L"op", L"") == L"status") {
        PostPanelStatus(window, std::wstring(json.GetNamedString(L"text", L"")).substr(0, 300));
    }
}
}

bool ConnectPanelLink() {
    DWORD session = 0;
    ProcessIdToSessionId(GetCurrentProcessId(), &session);
    const std::wstring name = PanelPipePrefix + std::to_wstring(session);
    for (int attempt = 0; attempt < 20 && pipe == INVALID_HANDLE_VALUE; ++attempt) {
        pipe = OpenClientPipe(name);
        if (pipe == INVALID_HANDLE_VALUE) Sleep(250);
    }
    if (pipe != INVALID_HANDLE_VALUE && !IsPeer(pipe, true, HostFileName)) {
        CloseHandle(pipe);
        pipe = INVALID_HANDLE_VALUE;
    }
    return pipe != INVALID_HANDLE_VALUE;
}

void ListenPanelLink(HWND window) {
    std::thread([window] {
        winrt::init_apartment();
        Message message;
        while (ReadMessage(pipe, message)) HandleMessage(window, message);
        PostMessageW(window, PanelClosedMessage, 0, 0);
    }).detach();
}

bool SendPanelCommand(std::string const &json) {
    std::lock_guard lock(writeLock);
    return WriteJson(pipe, json);
}

std::wstring SendPanelFile(std::wstring const &path) {
    const Native::fs::path file(path);
    const auto name = file.filename().wstring();
    if (!IsAllowedFile(file)) return name + L" is not supported. Use PDF, DOC, DOCX, JPG, PNG or HEIC.";
    std::error_code error;
    const auto size = Native::fs::file_size(file, error);
    if (error || size == 0 || size > Native::MaxPortalFileSize) return name + L" must be between 1 byte and 20 MiB.";
    std::ifstream input(file, std::ios::binary);
    std::vector<uint8_t> bytes(static_cast<size_t>(size));
    if (!input.read(reinterpret_cast<char *>(bytes.data()), static_cast<std::streamsize>(size))) {
        return L"Could not read " + name + L".";
    }
    const auto body = PackFile(Utf8(name), bytes);
    std::lock_guard lock(writeLock);
    return WriteMessage(pipe, Kind::File, body.data(), body.size()) ? L"" : L"The support session has ended.";
}

void PostPanelStatus(HWND window, std::wstring text) {
    auto message = new std::wstring(std::move(text));
    if (!PostMessageW(window, PanelStatusMessage, 0, reinterpret_cast<LPARAM>(message))) delete message;
}
}
