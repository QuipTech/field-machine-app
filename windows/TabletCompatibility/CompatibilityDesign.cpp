#include <Windows.h>
#include <Shellapi.h>
#include <cmath>
#include "CompatibilityFileBridge.h"
#include "../FieldMachine/Native/DesignDeliveryDownload.h"
#include "../FieldMachine/Native/DesignDeliveryStorage.h"

namespace FieldMachine::Compatibility {
namespace {
using namespace Native;
const auto generation = std::make_shared<std::atomic<uint64_t>>(0);

std::string String(JsonObject const &message, std::wstring_view key) {
    return winrt::to_string(message.GetNamedString(key));
}

uint64_t Integer(JsonObject const &message, std::wstring_view key) {
    const double value = message.GetNamedNumber(key);
    if (!(value >= 0 && value <= MaxDesignInteger && std::floor(value) == value)) {
        throw winrt::hresult_invalid_argument();
    }
    return static_cast<uint64_t>(value);
}
}

winrt::Windows::Foundation::IAsyncOperation<IJsonValue> RunDesignOperation(JsonObject message) {
    using namespace Native;
    const auto operation = message.GetNamedString(L"operation");
    if (operation == L"stop") {
        ++*generation;
        co_return JsonValue::CreateNullValue();
    }
    auto scope = String(message, L"scope");
    if (operation == L"readJournal") {
        co_return JsonValue::CreateStringValue(winrt::to_hstring(ReadDesignJournal(scope)));
    }
    if (operation == L"writeJournal") {
        auto payload = String(message, L"payload");
        WriteDesignJournal(scope, payload);
        co_return JsonValue::CreateNullValue();
    }
    auto delivery = String(message, L"delivery");
    auto project = String(message, L"project");
    if (operation == L"download") {
        auto result = co_await RunDesignDownload({std::move(scope), std::move(delivery), std::move(project),
            String(message, L"path"), String(message, L"sha256"), String(message, L"url"),
            Integer(message, L"index"), Integer(message, L"size"), generation, generation->load()});
        co_return JsonValue::CreateStringValue(result);
    }
    const auto folder = DesignVersion(scope, project, delivery);
    if (operation == L"prepare") {
        fs::create_directories(folder);
    } else if (operation == L"openProject") {
        if (!fs::is_directory(folder) ||
            reinterpret_cast<INT_PTR>(ShellExecuteW(nullptr, L"open", folder.c_str(),
                nullptr, nullptr, SW_SHOWNORMAL)) <= 32) {
            throw winrt::hresult_error(E_FAIL);
        }
    } else {
        throw winrt::hresult_invalid_argument();
    }
    co_return JsonValue::CreateNullValue();
}
}
