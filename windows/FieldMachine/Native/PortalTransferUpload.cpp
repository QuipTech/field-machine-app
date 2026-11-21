#include "pch.h"
#include "PortalTransferModule.h"
#include "PortalTransferStorage.h"
#include <algorithm>
#include <cwctype>
#include <winrt/Windows.Storage.Streams.h>
#include <winrt/Windows.System.Threading.h>
#include <winrt/Windows.Web.Http.h>
#include <winrt/Windows.Web.Http.Filters.h>
#include <winrt/Windows.Web.Http.Headers.h>

namespace FieldMachine::Native {
using namespace winrt::Windows::Web::Http;

static winrt::hstring FileMimeType(fs::path const &path) {
  auto extension = path.extension().wstring();
  for (auto &character : extension) {
    character = static_cast<wchar_t>(std::towlower(character));
  }
  if (extension == L".pdf") return L"application/pdf";
  if (extension == L".doc") return L"application/msword";
  if (extension == L".docx") return L"application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (extension == L".jpg" || extension == L".jpeg") return L"image/jpeg";
  if (extension == L".png") return L"image/png";
  if (extension == L".heic") return L"image/heic";
  throw std::invalid_argument("Unsupported file extension.");
}

static winrt::fire_and_forget UploadFile(
    std::string url, std::string token, std::string pairing, std::string id,
    React::ReactContext context, React::ReactPromise<React::JSValue> promise) {
  try {
    co_await winrt::resume_background();
    winrt::Windows::Foundation::Uri uri{winrt::to_hstring(url)};
    if (uri.SchemeName() != L"https" || !std::wstring_view(uri.Path()).ends_with(L"/mc/device/files")) {
      throw std::invalid_argument("Invalid transfer endpoint.");
    }
    auto path = StagedFile(PendingTransfer(pairing, id));
    auto file = co_await winrt::Windows::Storage::StorageFile::GetFileFromPathAsync(path.wstring());
    auto stream = co_await file.OpenReadAsync();
    if (stream.Size() > MaxPortalFileSize) {
      throw std::invalid_argument("Staged file exceeds the size limit.");
    }

    HttpStreamContent fileContent{stream};
    fileContent.Headers().ContentType(Headers::HttpMediaTypeHeaderValue{FileMimeType(path)});
    HttpMultipartFormDataContent form;
    form.Add(HttpStringContent{winrt::to_hstring(id)}, L"transferId");
    form.Add(fileContent, L"file", file.Name());
    HttpRequestMessage request{HttpMethod::Post(), uri};
    request.Headers().Authorization(Headers::HttpCredentialsHeaderValue{L"Bearer", winrt::to_hstring(token)});
    request.Content(form);
    Filters::HttpBaseProtocolFilter filter;
    filter.AllowAutoRedirect(false);
    filter.AllowUI(false);
    HttpClient client{filter};
    auto operation = client.SendRequestAsync(request);
    operation.Progress([context, id, size = stream.Size(), last = -1](auto const &, HttpProgress const &progress) mutable noexcept {
      auto total = progress.TotalBytesToSend ? progress.TotalBytesToSend.Value() : size;
      if (total == 0) {
        return;
      }
      auto percent = static_cast<int>(std::min<uint64_t>(
          99, progress.BytesSent * 100 / total));
      if (percent > last) {
        last = percent;
        context.EmitJSEvent(L"RCTDeviceEventEmitter", L"fieldPortalUploadProgress", React::JSValueObject{{"id", id}, {"percent", percent}});
      }
    });
    using winrt::Windows::System::Threading::ThreadPoolTimer;
    auto timer = ThreadPoolTimer::CreateTimer(
        [operation](auto const &) noexcept { operation.Cancel(); }, std::chrono::minutes(5));
    HttpResponseMessage response{nullptr};
    try {
      response = co_await operation;
    } catch (...) {
      timer.Cancel();
      throw;
    }
    timer.Cancel();
    auto body = co_await response.Content().ReadAsStringAsync();
    promise.Resolve(React::JSValue(React::JSValueObject{
        {"status", static_cast<int>(response.StatusCode())}, {"body", winrt::to_string(body)}}));
  } catch (std::invalid_argument const &) {
    promise.Resolve(React::JSValue(React::JSValueObject{{"status", 400}, {"body", ""}}));
  } catch (...) {
    promise.Reject("The upload could not reach the Portal.");
  }
}

void PortalTransferModule::upload(
    std::string url, std::string token, std::string pairing, std::string id,
    React::ReactPromise<React::JSValue> promise) noexcept {
  UploadFile(std::move(url), std::move(token), std::move(pairing), std::move(id), m_context, promise);
}
}
