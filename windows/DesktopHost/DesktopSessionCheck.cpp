#include "DesktopSessionCheck.h"
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Data.Json.h>
#include <winrt/Windows.Web.Http.h>
#include <winrt/Windows.Web.Http.Filters.h>
#include <winrt/Windows.Web.Http.Headers.h>

namespace FieldMachine::Desktop {
namespace {
using namespace winrt::Windows::Web::Http;
using winrt::Windows::Data::Json::JsonObject;
using winrt::Windows::Data::Json::JsonValueType;

constexpr wchar_t CurrentSessionUrl[] =
    L"https://staging-api.quiptechfield.com.au/mc/device/remote-sessions/current";
}

SessionGrant CheckRemoteSession(std::string const &deviceToken, std::string const &sessionId) {
    if (deviceToken.empty() || deviceToken.size() > 16000 || sessionId.size() != 36) return {};
    try {
        Filters::HttpBaseProtocolFilter filter;
        filter.CacheControl().ReadBehavior(Filters::HttpCacheReadBehavior::MostRecent);
        HttpClient client{filter};
        HttpRequestMessage request{HttpMethod::Get(), winrt::Windows::Foundation::Uri{CurrentSessionUrl}};
        request.Headers().Authorization(
            Headers::HttpCredentialsHeaderValue{L"Bearer", winrt::to_hstring(deviceToken)});
        auto response = client.SendRequestAsync(request).get();
        if (!response.IsSuccessStatusCode()) return {};
        JsonObject root{nullptr};
        if (!JsonObject::TryParse(response.Content().ReadAsStringAsync().get(), root)) return {};
        const auto value = root.GetNamedValue(L"session", nullptr);
        if (!value || value.ValueType() != JsonValueType::Object) return {};
        const auto session = value.GetObject();
        if (session.GetNamedString(L"id", L"") != winrt::to_hstring(sessionId) ||
            session.GetNamedString(L"status", L"") != L"active") return {};
        const auto scope = session.GetNamedObject(L"scope", nullptr);
        return {true, scope && scope.GetNamedBoolean(L"control", false)};
    } catch (...) {
        // Network or format failures deny access; the agent retries later.
        return {};
    }
}
}
