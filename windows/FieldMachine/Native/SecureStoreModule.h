#pragma once
#include "NativeHelpers.h"
#include <winrt/Windows.Security.Credentials.h>
#include <Windows.h>

namespace FieldMachine::Native {
REACT_MODULE(SecureStoreModule, L"FieldMachineSecureStore")
struct SecureStoreModule {
  // Computer name scopes the credential to this tablet, including unpackaged builds.
  static winrt::hstring Resource(std::string const &key) {
    if (key != "pairing.staging.v1") {
      throw std::invalid_argument("Unsupported secure storage key.");
    }
    wchar_t computerName[MAX_COMPUTERNAME_LENGTH + 1]{};
    DWORD nameLength = MAX_COMPUTERNAME_LENGTH + 1;
    winrt::check_bool(GetComputerNameW(computerName, &nameLength));
    return winrt::hstring(std::wstring(L"FIELD.Machine.Staging:") + computerName);
  }

  REACT_METHOD(read)
  void read(std::string key, React::ReactPromise<React::JSValue> promise) noexcept {
    try {
      winrt::Windows::Security::Credentials::PasswordVault vault;
      auto resource = Resource(key);
      winrt::Windows::Security::Credentials::PasswordCredential credential{nullptr};
      try {
        credential = vault.Retrieve(resource, winrt::to_hstring(key));
      } catch (winrt::hresult_error const &error) {
        if (error.code() == HRESULT_FROM_WIN32(ERROR_NOT_FOUND)) {
          promise.Resolve(React::JSValue{});
          return;
        }
        throw;
      }
      credential.RetrievePassword();
      promise.Resolve(React::JSValue(winrt::to_string(credential.Password())));
    } catch (...) {
      promise.Reject("Secure pairing storage could not be read.");
    }
  }

  REACT_METHOD(remove)
  void remove(std::string key, React::ReactPromise<void> promise) noexcept {
    try {
      winrt::Windows::Security::Credentials::PasswordVault vault;
      auto resource = Resource(key);
      try {
        auto credential = vault.Retrieve(resource, winrt::to_hstring(key));
        vault.Remove(credential);
      } catch (winrt::hresult_error const &error) {
        if (error.code() != HRESULT_FROM_WIN32(ERROR_NOT_FOUND)) {
          throw;
        }
      }
      promise.Resolve();
    } catch (...) {
      promise.Reject("Saved pairing could not be removed.");
    }
  }

  REACT_METHOD(write)
  void write(std::string key, std::string value,
             React::ReactPromise<void> promise) noexcept {
    try {
      if (value.empty() || value.size() > 20000) {
        throw std::invalid_argument("Invalid secure storage value size.");
      }
      winrt::Windows::Security::Credentials::PasswordVault vault;
      winrt::Windows::Security::Credentials::PasswordCredential credential{
        Resource(key), winrt::to_hstring(key), winrt::to_hstring(value)};
      vault.Add(credential);
      auto saved = vault.Retrieve(Resource(key), winrt::to_hstring(key));
      saved.RetrievePassword();
      if (saved.Password() != winrt::to_hstring(value)) {
        throw std::runtime_error("Secure storage verification failed.");
      }
      promise.Resolve();
    } catch (...) {
      promise.Reject("Secure pairing storage could not be saved.");
    }
  }
};
}
