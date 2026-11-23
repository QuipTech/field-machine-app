#include <Windows.h>
#include "DesignDeliveryDownload.h"
#include "DesignDeliveryStorage.h"
#include <cctype>
#include <winrt/Windows.Security.Cryptography.h>
#include <winrt/Windows.Security.Cryptography.Core.h>
#include <winrt/Windows.Storage.Streams.h>
#include <winrt/Windows.System.Threading.h>
#include <winrt/Windows.Web.Http.h>
#include <winrt/Windows.Web.Http.Filters.h>
#include <winrt/Windows.Web.Http.Headers.h>

namespace FieldMachine::Native {
using namespace winrt::Windows::Web::Http;
using namespace winrt::Windows::Storage::Streams;
using namespace winrt::Windows::Security::Cryptography;
constexpr uint32_t ChunkSize = 65536;

static bool VerifyDesign(fs::path const &path, uint64_t size, std::string const &sha256) {
  RejectReparsePoint(path);
  if (!fs::is_regular_file(path) || fs::file_size(path) != size) return false;
  auto hasher = Core::HashAlgorithmProvider::OpenAlgorithm(L"SHA256").CreateHash();
  std::ifstream file(path, std::ios::binary);
  if (!file) throw std::runtime_error("Cannot read design file.");
  std::vector<uint8_t> bytes(ChunkSize);
  while (file.read(reinterpret_cast<char *>(bytes.data()), bytes.size()) || file.gcount()) {
    hasher.Append(CryptographicBuffer::CreateFromByteArray(
        {bytes.data(), bytes.data() + file.gcount()}));
  }
  if (!file.eof() || file.bad()) throw std::runtime_error("Cannot hash design file.");
  auto hash = winrt::to_string(CryptographicBuffer::EncodeToHexString(hasher.GetValueAndReset()));
  for (auto &character : hash) character = static_cast<char>(std::tolower(character));
  return hash == sha256;
}

static void CommitDesignFile(fs::path const &partial, fs::path const &destination) {
  auto handle = CreateFileW(partial.c_str(), GENERIC_WRITE, 0, nullptr, OPEN_EXISTING,
      FILE_ATTRIBUTE_NORMAL | FILE_FLAG_OPEN_REPARSE_POINT, nullptr);
  if (handle == INVALID_HANDLE_VALUE) winrt::throw_last_error();
  winrt::handle owner{handle};
  winrt::check_bool(FlushFileBuffers(handle));
  owner.close();
  ReplaceDesignFile(partial, destination);
}

static winrt::Windows::Foundation::IAsyncOperation<winrt::hstring> DownloadDesign(DesignDownload job) {
  auto cancellation = co_await winrt::get_cancellation_token();
  cancellation.enable_propagation();
  co_await winrt::resume_background();
  if (job.IsStopped()) co_return L"retry";
  auto version = DesignVersion(job.scope, job.project, job.delivery);
  auto destination = DesignFile(version, job.path);
  if (VerifyDesign(destination, job.size, job.sha256)) co_return L"verified";
  auto partials = DesignChild(DesignRoot(job.scope) / L"partials", job.delivery);
  RejectReparsePoint(partials.parent_path());
  fs::create_directories(partials);
  auto partial = partials / (std::to_string(job.index) + ".part");
  RejectReparsePoint(partial);
  auto offset = fs::exists(partial) ? fs::file_size(partial) : 0;
  if (fs::exists(partial) && offset >= job.size) {
    if (VerifyDesign(partial, job.size, job.sha256)) {
      if (job.IsStopped()) co_return L"retry";
      CommitDesignFile(partial, destination);
      co_return L"verified";
    }
    fs::remove(partial);
    offset = 0;
  }

  winrt::Windows::Foundation::Uri uri(winrt::to_hstring(job.url));
  if (uri.SchemeName() != L"https") co_return L"permanent";
  HttpRequestMessage request(HttpMethod::Get(), uri);
  if (offset) request.Headers().Append(L"Range", L"bytes=" + std::to_wstring(offset) + L"-");
  Filters::HttpBaseProtocolFilter filter;
  filter.AllowAutoRedirect(false);
  filter.AllowUI(false);
  filter.CacheControl().ReadBehavior(Filters::HttpCacheReadBehavior::NoCache);
  filter.CacheControl().WriteBehavior(Filters::HttpCacheWriteBehavior::NoCache);
  HttpClient client(filter);
  auto response = co_await client.SendRequestAsync(request, HttpCompletionOption::ResponseHeadersRead);
  if (job.IsStopped()) co_return L"retry";
  int status = static_cast<int>(response.StatusCode());
  if (status == 401 || status == 403) co_return L"expired";
  if (status == 416) {
    fs::remove(partial);
    co_return offset ? L"retry" : L"permanent";
  }
  if (status == 206) {
    auto range = response.Content().Headers().ContentRange();
    if (!range || !range.FirstBytePosition() || range.FirstBytePosition().Value() != offset ||
        !range.Length() || range.Length().Value() != job.size || range.Unit() != L"bytes") {
      co_return L"permanent";
    }
  } else if (status == 200) {
    offset = 0;
  } else {
    co_return status == 408 || status == 429 || status >= 500 ? L"retry" : L"permanent";
  }

  auto input = co_await response.Content().ReadAsInputStreamAsync();
  {
    RejectReparsePoint(partial);
    std::ofstream output(partial, std::ios::binary | (offset ? std::ios::app : std::ios::trunc));
    if (!output) co_return L"permanent";
    Buffer buffer(ChunkSize);
    while (!job.IsStopped()) {
      auto received = co_await input.ReadAsync(buffer, ChunkSize, InputStreamOptions::Partial);
      if (job.IsStopped() || !received.Length()) break;
      if (received.Length() > job.size - offset) {
        output.close();
        fs::remove(partial);
        co_return L"checksum";
      }
      output.write(reinterpret_cast<char const *>(received.data()), received.Length());
      if (!output) co_return L"permanent";
      offset += received.Length();
    }
    output.close();
    if (!output) co_return L"permanent";
  }
  if (job.IsStopped() || offset < job.size) co_return L"retry";
  if (!VerifyDesign(partial, job.size, job.sha256)) {
    fs::remove(partial);
    co_return L"checksum";
  }
  if (job.IsStopped()) co_return L"retry";
  CommitDesignFile(partial, destination);
  co_return L"verified";
}

winrt::Windows::Foundation::IAsyncOperation<winrt::hstring> RunDesignDownload(DesignDownload job) {
  try {
    auto operation = DownloadDesign(job);
    using winrt::Windows::System::Threading::ThreadPoolTimer;
    auto timer = ThreadPoolTimer::CreatePeriodicTimer([operation, job, elapsed = 0](auto const &self) mutable {
      if (job.IsStopped() || ++elapsed >= 900) {
        operation.Cancel();
        self.Cancel();
      }
    }, std::chrono::seconds(1));
    try {
      auto result = co_await operation;
      timer.Cancel();
      co_return result;
    } catch (...) {
      timer.Cancel();
      throw;
    }
  } catch (std::invalid_argument const &) {
    co_return L"path";
  } catch (fs::filesystem_error const &) {
    co_return L"permanent";
  } catch (...) {
    co_return L"retry";
  }
}
}
