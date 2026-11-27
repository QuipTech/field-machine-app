#pragma once
#include <Windows.h>
#include <string>

// Layout of the on-top support panel: a fixed header with a collapse arrow,
// a scrollable content area, and a thin tab shown while collapsed.
namespace FieldMachine::Desktop {
enum PanelControl { Title = 1, Collapse, Expand, Status = 10, Activity, DropZone, Browse, Microphone, Stop };

void CreatePanelLayout(HWND window);
// Collapsed: only a narrow tab on the right edge; expanded: the full panel.
void SetPanelCollapsed(HWND window, bool isCollapsed);
HWND PanelItem(HWND window, int id);
// Shows the latest status and adds it to the scrolling activity list.
void AddPanelActivity(HWND window, std::wstring const &text);
}
