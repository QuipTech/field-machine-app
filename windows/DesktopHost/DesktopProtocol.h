#pragma once
#include <Windows.h>
#include <sddl.h>
#include <cstdint>
#include <cstring>
#include <string>
#include <vector>

// Shared by FieldMachineDesktop.exe (service, agent, panel) and the LTSC app.
namespace FieldMachine::Desktop {
inline constexpr wchar_t AppPipe[] = L"\\\\.\\pipe\\FieldMachineDesktop";
inline constexpr wchar_t PanelPipePrefix[] = L"\\\\.\\pipe\\FieldMachinePanel-";
inline constexpr wchar_t AppFileName[] = L"FieldMachine-LTSC2019-Pairing-x64.exe";
inline constexpr wchar_t HostFileName[] = L"FieldMachineDesktop.exe";
inline constexpr wchar_t ServiceName[] = L"FieldMachineDesktop";
inline constexpr uint32_t MaxMessage = 24 * 1024 * 1024;
// Local users may connect; every peer is verified by its executable path.
inline constexpr wchar_t PipeSecurity[] = L"D:P(A;;GA;;;SY)(A;;GRGW;;;AU)";
// Lets non-elevated peers read the image path of the SYSTEM agent.
inline constexpr wchar_t ProcessSecurity[] = L"D:(A;;GA;;;SY)(A;;0x1000;;;AU)";

enum class Kind : uint8_t { Json = 1, Frame = 2, File = 3 };

struct Message {
    Kind kind = Kind::Json;
    std::vector<uint8_t> body;
};

// Overlapped I/O lets one thread wait for a read while another thread writes.
inline bool Transfer(HANDLE pipe, bool write, void *data, DWORD size) {
    auto bytes = static_cast<uint8_t *>(data);
    while (size) {
        OVERLAPPED overlapped{};
        overlapped.hEvent = CreateEventW(nullptr, TRUE, FALSE, nullptr);
        if (!overlapped.hEvent) return false;
        BOOL ok = write ? WriteFile(pipe, bytes, size, nullptr, &overlapped)
                        : ReadFile(pipe, bytes, size, nullptr, &overlapped);
        DWORD done = 0;
        if (ok || GetLastError() == ERROR_IO_PENDING) {
            ok = GetOverlappedResult(pipe, &overlapped, &done, TRUE);
        }
        CloseHandle(overlapped.hEvent);
        if (!ok || done == 0) return false;
        bytes += done;
        size -= done;
    }
    return true;
}

// Callers that share a pipe between threads must serialize WriteMessage.
inline bool WriteMessage(HANDLE pipe, Kind kind, const void *body, size_t size) {
    if (size + 1 > MaxMessage) return false;
    uint8_t header[5]{};
    const auto length = static_cast<uint32_t>(size + 1);
    std::memcpy(header, &length, sizeof(length));
    header[4] = static_cast<uint8_t>(kind);
    if (!Transfer(pipe, true, header, sizeof(header))) return false;
    return size == 0 || Transfer(pipe, true, const_cast<void *>(body), static_cast<DWORD>(size));
}

inline bool WriteJson(HANDLE pipe, std::string const &json) {
    return WriteMessage(pipe, Kind::Json, json.data(), json.size());
}

inline bool ReadMessage(HANDLE pipe, Message &message) {
    uint32_t length = 0;
    uint8_t kind = 0;
    if (!Transfer(pipe, false, &length, sizeof(length)) || length < 1 || length > MaxMessage) return false;
    if (!Transfer(pipe, false, &kind, 1) || kind < 1 || kind > 3) return false;
    message.kind = static_cast<Kind>(kind);
    message.body.resize(length - 1);
    return length == 1 || Transfer(pipe, false, message.body.data(), length - 1);
}

// File message: 2-byte UTF-8 name length, the name, then the file bytes.
inline std::vector<uint8_t> PackFile(std::string const &name, std::vector<uint8_t> const &bytes) {
    std::vector<uint8_t> body(2 + name.size() + bytes.size());
    const auto length = static_cast<uint16_t>(name.size());
    std::memcpy(body.data(), &length, 2);
    std::memcpy(body.data() + 2, name.data(), name.size());
    if (!bytes.empty()) std::memcpy(body.data() + 2 + name.size(), bytes.data(), bytes.size());
    return body;
}

inline bool UnpackFileName(std::vector<uint8_t> const &body, std::string &name, size_t &offset) {
    if (body.size() < 2) return false;
    uint16_t length = 0;
    std::memcpy(&length, body.data(), 2);
    if (length == 0 || length > 255 || body.size() < 2u + length) return false;
    name.assign(reinterpret_cast<const char *>(body.data() + 2), length);
    offset = 2u + length;
    return true;
}

inline std::wstring ProcessPath(DWORD processId) {
    HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, processId);
    if (!process) return {};
    wchar_t path[MAX_PATH * 2]{};
    DWORD size = static_cast<DWORD>(std::size(path));
    const BOOL ok = QueryFullProcessImageNameW(process, 0, path, &size);
    CloseHandle(process);
    return ok ? std::wstring(path, size) : std::wstring{};
}

// Path of a file installed next to the running executable.
inline std::wstring SiblingPath(const wchar_t *fileName) {
    wchar_t path[MAX_PATH * 2]{};
    const DWORD size = GetModuleFileNameW(nullptr, path, static_cast<DWORD>(std::size(path)));
    std::wstring self(path, size);
    const auto slash = self.find_last_of(L'\\');
    return slash == std::wstring::npos ? std::wstring{} : self.substr(0, slash + 1) + fileName;
}

inline bool IsSamePath(std::wstring const &left, std::wstring const &right) {
    return !left.empty() && CompareStringOrdinal(left.c_str(), -1, right.c_str(), -1, TRUE) == CSTR_EQUAL;
}

inline bool IsPeer(HANDLE pipe, bool peerIsServer, const wchar_t *expectedFile) {
    ULONG processId = 0;
    const BOOL ok = peerIsServer ? GetNamedPipeServerProcessId(pipe, &processId)
                                 : GetNamedPipeClientProcessId(pipe, &processId);
    return ok && IsSamePath(ProcessPath(processId), SiblingPath(expectedFile));
}

struct SecurityAttributes {
    SECURITY_ATTRIBUTES value{sizeof(SECURITY_ATTRIBUTES)};
    explicit SecurityAttributes(const wchar_t *sddl) {
        ConvertStringSecurityDescriptorToSecurityDescriptorW(
            sddl, SDDL_REVISION_1, &value.lpSecurityDescriptor, nullptr);
    }
    ~SecurityAttributes() { LocalFree(value.lpSecurityDescriptor); }
    SecurityAttributes(SecurityAttributes const &) = delete;
    SecurityAttributes &operator=(SecurityAttributes const &) = delete;
    SECURITY_ATTRIBUTES *get() { return value.lpSecurityDescriptor ? &value : nullptr; }
};

inline HANDLE CreateServerPipe(std::wstring const &name) {
    SecurityAttributes security(PipeSecurity);
    if (!security.get()) return INVALID_HANDLE_VALUE;
    return CreateNamedPipeW(name.c_str(),
        PIPE_ACCESS_DUPLEX | FILE_FLAG_OVERLAPPED | FILE_FLAG_FIRST_PIPE_INSTANCE,
        PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS,
        1, 1 << 20, 1 << 20, 0, security.get());
}

inline bool AcceptClient(HANDLE pipe, DWORD timeoutMs = INFINITE) {
    OVERLAPPED overlapped{};
    overlapped.hEvent = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    if (!overlapped.hEvent) return false;
    BOOL ok = ConnectNamedPipe(pipe, &overlapped);
    const DWORD error = ok ? ERROR_SUCCESS : GetLastError();
    if (error == ERROR_PIPE_CONNECTED) {
        ok = TRUE;
    } else if (error == ERROR_IO_PENDING) {
        if (WaitForSingleObject(overlapped.hEvent, timeoutMs) != WAIT_OBJECT_0) CancelIoEx(pipe, &overlapped);
        DWORD ignored = 0;
        ok = GetOverlappedResult(pipe, &overlapped, &ignored, TRUE);
    }
    CloseHandle(overlapped.hEvent);
    return ok == TRUE;
}

// Identification-level QoS stops a squatting server from impersonating us.
inline HANDLE OpenClientPipe(std::wstring const &name) {
    HANDLE pipe = CreateFileW(name.c_str(), GENERIC_READ | GENERIC_WRITE, 0, nullptr, OPEN_EXISTING,
        FILE_FLAG_OVERLAPPED | SECURITY_SQOS_PRESENT | SECURITY_IDENTIFICATION, nullptr);
    if (pipe == INVALID_HANDLE_VALUE && GetLastError() == ERROR_PIPE_BUSY) WaitNamedPipeW(name.c_str(), 500);
    return pipe;
}
}
