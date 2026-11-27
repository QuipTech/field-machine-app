#include <Windows.h>
#include <dpapi.h>
#include <ShlObj.h>
#include <fstream>
#include <iterator>
#include <string>
#include <vector>
#include "CompatibilityFileBridge.h"

// Stores the tablet's FIELD ID access record (FIELD ID, tablet token, device
// token and, until assignment, the password) for the whole tablet. DPAPI
// machine scope is used because the app runs for whichever Windows user is
// signed in; the folder is created by setup with access for signed-in users.
namespace FieldMachine::Compatibility {
namespace {
constexpr size_t MaxRecord = 20000;
constexpr char Entropy[] = "FIELD.Machine.TabletAccess.v1";

std::wstring RecordPath() {
    PWSTR programData = nullptr;
    winrt::check_hresult(SHGetKnownFolderPath(FOLDERID_ProgramData, 0, nullptr, &programData));
    std::wstring folder = std::wstring(programData) + L"\\FIELD Machine";
    CoTaskMemFree(programData);
    CreateDirectoryW(folder.c_str(), nullptr);
    const DWORD attributes = GetFileAttributesW(folder.c_str());
    if (attributes == INVALID_FILE_ATTRIBUTES || (attributes & FILE_ATTRIBUTE_REPARSE_POINT)) {
        throw winrt::hresult_access_denied();
    }
    return folder + L"\\tablet-access.bin";
}

DATA_BLOB Blob(const void *data, size_t size) {
    return {static_cast<DWORD>(size), static_cast<BYTE *>(const_cast<void *>(data))};
}

void Write(std::wstring const &path, std::string const &json) {
    DATA_BLOB input = Blob(json.data(), json.size());
    DATA_BLOB entropy = Blob(Entropy, sizeof(Entropy) - 1);
    DATA_BLOB output{};
    if (!CryptProtectData(&input, L"FIELD Machine tablet access", &entropy, nullptr, nullptr,
            CRYPTPROTECT_LOCAL_MACHINE | CRYPTPROTECT_UI_FORBIDDEN, &output)) {
        winrt::throw_last_error();
    }
    const std::wstring staged = path + L".tmp";
    {
        std::ofstream file(staged, std::ios::binary | std::ios::trunc);
        file.write(reinterpret_cast<const char *>(output.pbData), output.cbData);
        LocalFree(output.pbData);
        if (!file) throw winrt::hresult_error(E_FAIL);
    }
    // Replace in one step so a crash never leaves a half-written record.
    if (!MoveFileExW(staged.c_str(), path.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) {
        winrt::throw_last_error();
    }
}

JsonValue Read(std::wstring const &path) {
    std::ifstream file(path, std::ios::binary);
    if (!file) return JsonValue::CreateNullValue();
    const std::vector<char> bytes((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
    DATA_BLOB input = Blob(bytes.data(), bytes.size());
    DATA_BLOB entropy = Blob(Entropy, sizeof(Entropy) - 1);
    DATA_BLOB output{};
    if (!CryptUnprotectData(&input, nullptr, &entropy, nullptr, nullptr, CRYPTPROTECT_UI_FORBIDDEN, &output)) {
        winrt::throw_last_error();
    }
    const std::string json(reinterpret_cast<const char *>(output.pbData), output.cbData);
    SecureZeroMemory(output.pbData, output.cbData);
    LocalFree(output.pbData);
    return JsonValue::CreateStringValue(winrt::to_hstring(json));
}
}

winrt::Windows::Foundation::IAsyncOperation<IJsonValue> RunAccessOperation(JsonObject message) {
    const auto operation = message.GetNamedString(L"operation");
    co_await winrt::resume_background();
    const auto path = RecordPath();
    if (operation == L"read") co_return Read(path);
    if (operation == L"remove") {
        if (!DeleteFileW(path.c_str()) && GetLastError() != ERROR_FILE_NOT_FOUND) winrt::throw_last_error();
        co_return JsonValue::CreateNullValue();
    }
    if (operation != L"write") throw winrt::hresult_invalid_argument();
    const auto value = winrt::to_string(message.GetNamedString(L"value"));
    if (value.empty() || value.size() > MaxRecord) throw winrt::hresult_invalid_argument();
    Write(path, value);
    co_return JsonValue::CreateNullValue();
}
}
