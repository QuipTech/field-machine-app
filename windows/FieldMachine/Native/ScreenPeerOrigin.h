#pragma once
#include <winsock2.h>
#include <chrono>
#include <string_view>
#include <thread>
#include "NativeHelpers.h"

#pragma comment(lib, "Ws2_32.lib")

namespace FieldMachine::Native {
REACT_MODULE(ScreenPeerOrigin, L"FieldMachineScreenPeerOrigin")
struct ScreenPeerOrigin {
  REACT_METHOD(open)
  void open(std::string html, React::ReactPromise<std::string> promise) noexcept {
    try {
      if (html.empty() || html.size() > 32768) {
        promise.Reject("Invalid screen picker page.");
        return;
      }
      auto response = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n"
        "Cache-Control: no-store\r\nConnection: close\r\nContent-Length: " +
        std::to_string(html.size()) + "\r\n\r\n" + html;
      WSADATA data{};
      if (WSAStartup(MAKEWORD(2, 2), &data) != 0) {
        promise.Reject("Could not initialize the screen picker origin.");
        return;
      }
      auto listener = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
      sockaddr_in address{};
      address.sin_family = AF_INET;
      address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
      int size = sizeof(address);
      if (listener == INVALID_SOCKET ||
          bind(listener, reinterpret_cast<sockaddr*>(&address), size) != 0 ||
          getsockname(listener, reinterpret_cast<sockaddr*>(&address), &size) != 0 ||
          listen(listener, 4) != 0) {
        if (listener != INVALID_SOCKET) closesocket(listener);
        WSACleanup();
        promise.Reject("Could not open the screen picker origin.");
        return;
      }
      try {
        std::thread([listener, response = std::move(response)] { Serve(listener, response); }).detach();
      } catch (...) {
        closesocket(listener);
        WSACleanup();
        throw;
      }
      promise.Resolve("http://127.0.0.1:" + std::to_string(ntohs(address.sin_port)) + "/");
    } catch (...) {
      promise.Reject("Could not open the screen picker origin.");
    }
  }

private:
  static void Serve(SOCKET listener, std::string_view response) noexcept {
    using Clock = std::chrono::steady_clock;
    const auto deadline = Clock::now() + std::chrono::seconds(25);
    while (Clock::now() < deadline) {
      fd_set readable;
      FD_ZERO(&readable);
      FD_SET(listener, &readable);
      timeval wait{1, 0};
      const int ready = select(0, &readable, nullptr, nullptr, &wait);
      if (ready == SOCKET_ERROR) break;
      if (ready == 0) continue;
      const auto client = accept(listener, nullptr, nullptr);
      if (client == INVALID_SOCKET) continue;
      ServeClient(client, response);
      shutdown(client, SD_SEND);
      closesocket(client);
    }
    closesocket(listener);
    WSACleanup();
  }

  static void ServeClient(SOCKET client, std::string_view response) noexcept {
    DWORD timeout = 750;
    setsockopt(client, SOL_SOCKET, SO_RCVTIMEO, reinterpret_cast<const char*>(&timeout), sizeof(timeout));
    setsockopt(client, SOL_SOCKET, SO_SNDTIMEO, reinterpret_cast<const char*>(&timeout), sizeof(timeout));
    constexpr std::string_view prefix = "GET / HTTP/1.";
    char request[8192];
    size_t received = 0;
    while (received < sizeof(request)) {
      const int count = recv(client, request + received, static_cast<int>(sizeof(request) - received), 0);
      if (count <= 0) return;
      received += static_cast<size_t>(count);
      const std::string_view headers{request, received};
      if (!headers.starts_with(prefix.substr(0, (std::min)(received, prefix.size())))) return;
      if (headers.find("\r\n\r\n") != std::string_view::npos) break;
    }
    if (std::string_view{request, received}.find("\r\n\r\n") == std::string_view::npos) return;
    while (!response.empty()) {
      const int sent = send(client, response.data(), static_cast<int>(response.size()), 0);
      if (sent <= 0) return;
      response.remove_prefix(static_cast<size_t>(sent));
    }
  }
};
}
