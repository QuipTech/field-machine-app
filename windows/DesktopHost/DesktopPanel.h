#pragma once
#include <Windows.h>
#include <string>

namespace FieldMachine::Desktop {
inline constexpr UINT PanelStatusMessage = WM_APP + 1; // lParam: heap std::wstring*.
inline constexpr UINT PanelClosedMessage = WM_APP + 2;

// Connection from the panel (running as the signed-in user) to the agent.
bool ConnectPanelLink();
void ListenPanelLink(HWND window);
bool SendPanelCommand(std::string const &json);
// Reads and sends one file. Returns an error message, or empty on success.
std::wstring SendPanelFile(std::wstring const &path);
void PostPanelStatus(HWND window, std::wstring text);
}
