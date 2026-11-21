# Android file transfer

Android support for **Send to Portal** (tablet → Portal upload) and
**Design delivery** (Portal → tablet download). The Kotlin modules mirror the
Windows C++ modules: same JS names, method signatures, result words, and
error messages, so the shared TypeScript features run unchanged.

## What was built

| Windows (C++) | Android (Kotlin) |
| --- | --- |
| `PortalTransferModule.*`, `PortalTransferUpload.cpp` | `transfer/PortalTransferModule.kt`, `transfer/PortalUpload.kt` |
| `PortalTransferStorage.h` | `transfer/TransferStorage.kt` |
| `FileOpenPicker` | `transfer/PortalFilePicker.kt` (Storage Access Framework) |
| `DesignDeliveryModule.*` | `delivery/DesignDeliveryModule.kt` |
| `DesignDeliveryDownload.cpp` | `delivery/DesignDownload.kt` |
| `DesignDeliveryStorage.h` | `delivery/DesignStorage.kt` |

Kotlin sources live in `android/app/src/main/java/com/fieldmachine/`.
Both modules are registered in `FieldMachinePackage.kt` as legacy modules
reached through the new-architecture interop layer
(`FieldMachinePortalTransfer`, `FieldMachineDesignDelivery`).

JS changes:

- `src/native/PortalTransfer.ts` and `src/native/DesignDelivery.ts` enable
  Android alongside Windows.
- `src/app/MachineWorkspace.tsx` uses platform-neutral Files messages.
- `src/features/design-delivery/DesignProjects.tsx` shows, on Android, a
  `DesignProjectFiles` entry per project: **Show files** lists the project's
  files and **Open <file>** opens one in another app through the system
  "Open with" chooser (`listFiles` / `openFile` in
  `delivery/DesignFileOpener.kt`, FileProvider authority
  `com.fieldmachine.designfiles`, roots in `res/xml/design_file_paths.xml`).
- `src/features/pairing/pairingService.ts` sends `platform: "android"` on
  Android (backend acceptance confirmed; see `docs/API_NEEDED.md`).

### Send to Portal

- `pick()` opens `ACTION_OPEN_DOCUMENT` with multi-select, filtered to PDF,
  DOC, DOCX, JPG/JPEG, PNG, and HEIC. The operator can browse any document
  provider on the tablet (Downloads, device storage, USB, cloud providers).
- Each file must be 20 MiB or smaller and have an allowed extension.
- `stage()` copies picked files into the app-private queue
  (`.<id>` draft folder renamed to `<id>` when complete), so the queue
  survives restarts and does not depend on content-URI permissions.
- `upload()` sends the same multipart form as Windows (`transferId` + `file`)
  with a bearer token, HTTPS only, the `/mc/device/files` path check, no
  redirects, a 5-minute limit, and progress events
  (`fieldPortalUploadProgress`) capped at 99 % until the response arrives.

### Design delivery

`download()` resolves `verified`, `retry`, `expired`, `permanent`,
`checksum`, or `path`, matching `DesignDeliveryDownload.cpp`:

- Skips the request when the destination already matches size and SHA-256.
- Resumes from `partials/<delivery>/<index>.part` with `Range: bytes=N-`.
  A 206 must carry `Content-Range: bytes N-…/<size>`; a 200 restarts the file.
- 401/403 → `expired`; 416 deletes the partial (`retry` when resuming,
  otherwise `permanent`); 408/429/5xx → `retry`; other statuses → `permanent`.
- More bytes than the manifest size → partial deleted, `checksum`.
- SHA-256 is verified before the partial is synced and renamed into place.
- HTTPS only, no redirects, no response cache, identity encoding, 900-second
  call limit. `stop()` bumps a generation counter and cancels in-flight calls.
- Invalid IDs or file names (same rules as Windows, including reserved
  device names) → `path`; local storage failures → `permanent`.
- IO runs on background executors, never on the native-module thread.

## Storage location

All data is app-private (`Context.getFilesDir()`), removed on uninstall:

```text
<files>/FIELD Machine/Portal transfers/<pairing>/<transfer-id>/<file>
<files>/FIELD Machine/Portal transfers/<pairing>/Design delivery/
    journal.json
    partials/<delivery>/<index>.part
    <project>/<delivery>/<relative design path>
<files>/FIELD Machine/Portal transfers/sent-<pairing>/Design delivery/journal.json
```

Every resolved path is checked with `getCanonicalPath` against the app root,
so symbolic links or `..` segments cannot escape it.

## Limitations

- **Files open one at a time, not as a folder.** Android cannot hand an
  app-private folder to another app, so `openProject` still rejects. Each
  file is opened through "Open with" with a temporary read-only grant. Design
  formats such as DXF or LandXML have no Android MIME type, so they are sent
  as `*/*` and the chooser lists every app that accepts any file. Files are
  not exported to a shared folder (user chose "Open with" on 2026-11-21).
- The design download continues only while the app process is alive; no
  foreground service keeps it running in the background (Phase 4/5 work).
- The SAF picker can show providers whose files are not local; a slow cloud
  file is copied during staging and may take time.
- OkHttp 4.9.2 comes transitively from `react-android`; no Gradle change was
  needed.

## Manual test steps (Android tablet or emulator)

1. Install with `npx react-native run-android` and pair to a staging machine.
2. Open **Files**. Confirm **Received designs** shows "Waiting for design
   deliveries." and **Send to Portal** shows the destination machine.
3. Push a test file: `adb push sample.pdf /sdcard/Download/`.
4. Tap **Choose files**. Confirm the system picker opens, open Downloads,
   and select the PDF. Confirm its name appears with **Confirm and send**.
5. Tap **Cancel selection**; confirm nothing is queued.
6. Choose a file larger than 20 MiB; confirm the size error. Choose a
   disallowed type from another provider; confirm the type error.
7. Choose the PDF again and tap **Confirm and send**; confirm progress, then
   the file in **Sent files** and in the Portal for that machine.
8. Turn on airplane mode, send a file, confirm it stays queued with
   **Retry upload**; restore the network and retry.
9. In the Portal, deliver a design to the machine. Confirm "Downloading …",
   then "Design installed." and the project in **Received designs**. Tap
   **Show files**, then **Open** on a file; confirm the "Open with" chooser
   appears and the chosen app opens the file.
10. Interrupt a large delivery (airplane mode mid-download), restore the
    network, and confirm it resumes rather than restarting
    (`adb shell run-as com.fieldmachine ls "files/FIELD Machine/…/partials"`).
11. Deliver a package whose manifest hash is wrong; confirm the integrity
    error is reported to the Portal.
