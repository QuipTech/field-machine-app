#include "DesktopCapture.h"
#include <wincodec.h>
#include <wrl/client.h>
#include <algorithm>
#include "DesktopLog.h"

namespace FieldMachine::Desktop {
namespace {
using Microsoft::WRL::ComPtr;
constexpr int MaxWidth = 1600;
constexpr float JpegQuality = 0.6f;

void DrawPointer(HDC target, int left, int top, double scale) {
    CURSORINFO cursor{sizeof(cursor)};
    if (!GetCursorInfo(&cursor) || !(cursor.flags & CURSOR_SHOWING)) return;
    ICONINFO icon{};
    if (!GetIconInfo(cursor.hCursor, &icon)) return;
    const int x = static_cast<int>((cursor.ptScreenPos.x - left - static_cast<int>(icon.xHotspot)) * scale);
    const int y = static_cast<int>((cursor.ptScreenPos.y - top - static_cast<int>(icon.yHotspot)) * scale);
    DrawIconEx(target, x, y, cursor.hCursor, 0, 0, 0, nullptr, DI_NORMAL);
    if (icon.hbmMask) DeleteObject(icon.hbmMask);
    if (icon.hbmColor) DeleteObject(icon.hbmColor);
}

std::vector<uint8_t> EncodeJpeg(HBITMAP bitmap) {
    static thread_local ComPtr<IWICImagingFactory> factory;
    if (!factory && FAILED(CoCreateInstance(CLSID_WICImagingFactory, nullptr, CLSCTX_INPROC_SERVER,
            IID_PPV_ARGS(&factory)))) return {};
    ComPtr<IWICBitmap> source;
    ComPtr<IStream> stream;
    ComPtr<IWICBitmapEncoder> encoder;
    ComPtr<IWICBitmapFrameEncode> frame;
    ComPtr<IPropertyBag2> options;
    if (FAILED(factory->CreateBitmapFromHBITMAP(bitmap, nullptr, WICBitmapIgnoreAlpha, &source)) ||
        FAILED(CreateStreamOnHGlobal(nullptr, TRUE, &stream)) ||
        FAILED(factory->CreateEncoder(GUID_ContainerFormatJpeg, nullptr, &encoder)) ||
        FAILED(encoder->Initialize(stream.Get(), WICBitmapEncoderNoCache)) ||
        FAILED(encoder->CreateNewFrame(&frame, &options))) return {};
    PROPBAG2 option{};
    wchar_t name[] = L"ImageQuality";
    option.pstrName = name;
    VARIANT quality{};
    quality.vt = VT_R4;
    quality.fltVal = JpegQuality;
    options->Write(1, &option, &quality);
    UINT width = 0;
    UINT height = 0;
    WICPixelFormatGUID format = GUID_WICPixelFormat24bppBGR;
    if (FAILED(frame->Initialize(options.Get())) || FAILED(source->GetSize(&width, &height)) ||
        FAILED(frame->SetSize(width, height)) || FAILED(frame->SetPixelFormat(&format)) ||
        FAILED(frame->WriteSource(source.Get(), nullptr)) || FAILED(frame->Commit()) ||
        FAILED(encoder->Commit())) return {};
    STATSTG stat{};
    HGLOBAL memory = nullptr;
    if (FAILED(stream->Stat(&stat, STATFLAG_NONAME)) || FAILED(GetHGlobalFromStream(stream.Get(), &memory))) return {};
    const auto size = static_cast<size_t>(stat.cbSize.QuadPart);
    const auto bytes = static_cast<const uint8_t *>(GlobalLock(memory));
    if (!bytes) return {};
    std::vector<uint8_t> jpeg(bytes, bytes + size);
    GlobalUnlock(memory);
    return jpeg;
}
}

bool FollowInputDesktop() noexcept {
    static thread_local HDESK attached = nullptr;
    HDESK input = OpenInputDesktop(0, FALSE, GENERIC_ALL);
    if (!input) {
        Log("capture: OpenInputDesktop failed, error %lu", GetLastError());
        return false;
    }
    if (!SetThreadDesktop(input)) {
        CloseDesktop(input);
        return false;
    }
    if (attached) CloseDesktop(attached);
    attached = input;
    // Logs each change, e.g. Default -> Winlogon (sign-in screen) -> Default.
    static thread_local std::wstring lastName;
    wchar_t name[64]{};
    if (GetUserObjectInformationW(input, UOI_NAME, name, sizeof(name), nullptr) && lastName != name) {
        lastName = name;
        Log("capture: input desktop is %ls", name);
    }
    return true;
}

std::vector<uint8_t> CaptureScreenJpeg() {
    if (!FollowInputDesktop()) return {};
    const int left = GetSystemMetrics(SM_XVIRTUALSCREEN);
    const int top = GetSystemMetrics(SM_YVIRTUALSCREEN);
    const int width = GetSystemMetrics(SM_CXVIRTUALSCREEN);
    const int height = GetSystemMetrics(SM_CYVIRTUALSCREEN);
    if (width < 2 || height < 2) return {};
    const double scale = (std::min)(1.0, static_cast<double>(MaxWidth) / width); // Parenthesised: windows.h min macro.
    const int targetWidth = static_cast<int>(width * scale);
    const int targetHeight = static_cast<int>(height * scale);
    HDC screen = GetDC(nullptr);
    if (!screen) return {};
    HDC memory = CreateCompatibleDC(screen);
    HBITMAP bitmap = CreateCompatibleBitmap(screen, targetWidth, targetHeight);
    std::vector<uint8_t> jpeg;
    if (memory && bitmap) {
        const HGDIOBJ previous = SelectObject(memory, bitmap);
        SetStretchBltMode(memory, HALFTONE);
        const BOOL copied = StretchBlt(memory, 0, 0, targetWidth, targetHeight,
            screen, left, top, width, height, SRCCOPY | CAPTUREBLT);
        if (copied) DrawPointer(memory, left, top, scale);
        SelectObject(memory, previous);
        if (copied) jpeg = EncodeJpeg(bitmap);
    }
    if (bitmap) DeleteObject(bitmap);
    if (memory) DeleteDC(memory);
    ReleaseDC(nullptr, screen);
    return jpeg;
}
}
