#pragma once
#include <functional>
#include <string>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Web.Http.h>

namespace FieldMachine::Native {
using PortalProgress = std::function<void(int)>;

winrt::Windows::Foundation::IAsyncOperation<winrt::Windows::Web::Http::HttpResponseMessage> UploadPortalFile(
    std::string url, std::string token, std::string pairing, std::string id, PortalProgress report);
}
