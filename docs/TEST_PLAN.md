# Phase 0 test plan

## Evidence status

Phase 0 capability checks: **passed on the user's Windows laptop**, reported
2026-11-11. Evidence comes from user-provided logs, screenshots, and reports;
the agent did not execute Windows checks on this macOS host.

| Check | Result and evidence |
| --- | --- |
| Build and launch | Passed: deployment log and rendered Phase 0 screen. |
| External folder | Passed: user reported “Folder read/write and cleanup passed.” |
| Screen capture | Passed by user report: “screen capture ... work”. |
| SendInput | Passed: target title “injected click received” and app confirmation. |

Test folder: `C:\Users\Ethereal Gear\Downloads\FieldMachineTest`.
Configuration: Debug / x64; RN 0.85.3, RNW 0.85.0, cpp-app.
Toolchain logs: Visual Studio Community 2026 18.12, MSVC 14.52.37025,
Windows SDK 10.0.22621.0. Package deployment succeeded; CLI package lookup
failed through `pwsh.exe` Appx support. Manual AppsFolder launch succeeded.
The input test window closing automatically after confirmation is expected.

Still to record: Windows edition/build, laptop model, capture frame counts,
snapshot dimensions, stop-indicator confirmation, existing-file preservation,
and invalid-path/permission failure checks. Workshop tablets and Android remain
untested. These follow-up checks are not implied by the happy-path results.

Portable verification on this macOS host:

- TypeScript: passed.
- ESLint: passed.
- Jest: 3 suites, 10 tests passed (native behavior is mocked).
- Hand-written source/configuration/Markdown/C++: all within 200 lines.
- Eight Windows XML project/config files parse; referenced source files exist.
- Dependencies installed using Node 22.23.4.
- RNW initialization attempted with Node 22; unavailable on this host because
  Windows tooling (`dotnet.exe`, `where`) is missing and `init-windows` is not
  exposed by the CLI here. The project was subsequently rendered directly from
  the installed official RNW template; Windows MSBuild later ran on the user's laptop.

The test screen must show unavailable modules as blocked, never passed.
An invocation that resolves is not sufficient evidence of actual capture or
input delivery; verify visible frames and the input target on Windows.

## Windows preparation

1. Install Node 22+ and the RNW-required Visual Studio/Windows SDK toolchain.
2. Run `npm ci`.
3. Use the checked-in `cpp-app` project; do not reinitialize over native changes.
4. Follow `WINDOWS_PHASE_ZERO.md` for toolchain and native checks.
5. Run `npm run windows` and confirm the test screen appears.

## External folder

- Use a dedicated, writable test folder outside the app sandbox.
- Configure its root explicitly in the test screen.
- Run the read/write check; verify a uniquely named test file is created,
  contents are read correctly, and that same file is cleaned up.
- Verify missing permissions and invalid paths produce actionable errors.
- Verify existing files remain unchanged.

## Capture

- Start capture only using the explicit screen action.
- The Phase 0 Start action captures the whole primary monitor.
- Inspect the first-frame PNG and verify it shows the entire primary display.
- Inspect diagnostics repeatedly and verify the frame count increases. The PNG
  is a snapshot, not a live video preview.
- Stop capture and verify capture resources and indicators stop.
- Verify unsupported capture and permission failures are reported.

## Input

- Use an isolated Windows desktop and a dedicated test target.
- Arm the test explicitly; inject only into the controlled test target.
- Confirm the target receives a single click and record the result.
- Check unsupported/elevated targets fail clearly rather than reporting success.

## Portable checks

- `npm run typecheck`
- `npm run lint`
- `npm test -- --runInBand`

Record Windows version, tablet model, build configuration, selected folder,
observed results, and relevant logs before declaring Phase 0 complete.

## Phase 1 pairing

See [PAIRING_TEST_PLAN.md](PAIRING_TEST_PLAN.md) for pairing and restart checks.
See [SESSION_TEST_PLAN.md](SESSION_TEST_PLAN.md) for the 2026-11-17 Windows build,
anonymous staging probes, and remaining authenticated runtime checks.

## Windows Send to Portal

Use a test pairing and staging deployment with migration
`0133_machine_document_transfers`. Keep the Portal closed during the first send,
then open the paired machine's Documents tab and confirm a single document.
With that tab visible, send another file and verify it appears within the
10-second polling cycle.

- Pair the tablet and confirm the destination uses the returned machine label.
  Cancel the picker, then select a PDF and a JPEG. Verify there is no upload
  before confirmation and that each file reports progress and a receipt.
- Test all supported extensions, 20,971,520 bytes, and one byte over the limit.
  Try unsupported content renamed with an allowed extension to verify HTTP 400.
- Interrupt connectivity during upload, restore it, and retry. Repeat with the
  app closed and reopened before retry. Confirm each attempt uses the original
  UUID and only one document is created. Re-pair and verify the old queue is
  unavailable, even when the new pairing targets the same machine.
- Test a rotated token and then a revoked pairing. Verify a revoked upload
  clears pairing only when validation of the latest saved token confirms it.
  Exercise HTTP 403 and 413 and check the operator messages.

Set `FIELD_DEVICE_TOKEN` in the test shell using the token from pairing. Run
the following command twice with the same `$transferId`. Both receipts should
have the same document ID. In Portal, use **Machine app → View machine
documents** to verify that exactly one document appears.

```powershell
$api = 'https://staging-api.quiptechfield.com.au'
$file = 'C:\Temp\report.pdf'
$transferId = [guid]::NewGuid().ToString()

curl.exe --fail-with-body --silent --show-error "$api/mc/device/files" `
  -H "Authorization: Bearer $env:FIELD_DEVICE_TOKEN" `
  -F "transferId=$transferId" `
  -F "documentType=service_report" `
  -F "file=@$file"
```

## Windows design delivery acceptance

Local verification on 2026-11-18: Windows Debug x64 build, TypeScript, lint,
and 91 Jest tests passed. Delivery tests mock the Windows storage and network
interfaces. The following live staging and device checks are pending.

- Pair a Windows tablet to staging. Send a project from the Portal to one
  machine, several machines, and a whole site. Verify relative paths and project
  labels in Files and compare Portal status against the actual active version.
- Cut 4G mid-file and restart the app. Verify the saved offset is used, a fresh
  signed URL is requested if needed, and the old project stays visible until
  every new file verifies. Exercise HTTP 200 fallback, 206 and 416 responses.
- Send an invalid path and a file with an incorrect SHA-256. Confirm both fail
  without replacing the active version. Exercise redirected staging paths.
- Simulate a lost terminal PATCH response and restart the app. Confirm the
  installed project remains visible and the status is replayed before new work.
- Drop a path from a replacement manifest and then resend the old version to
  roll back. Each active folder should contain only that delivery's files.
- Disconnect or replace the pairing mid-transfer. Verify the old partial and
  journal are isolated from the new pairing and the old worker stops.

## Windows workspace redesign

- Pair or reopen a paired tablet. Check Home shows the paired machine and
  connection state. Switch among all four bottom tabs using touch and keyboard.
- Under Files, send a supported demo document. Check the upload indicator,
  percentage, server success message, and timestamp in Sent files. Switch tabs
  mid-upload. Restart the app and verify the receipt remains for that pairing.
- Open the paired machine in the staging portal and verify the matching receipt
  appears under Documents. Confirm received designs appear separately in Files.
- Verify Settings exposes diagnostics and tablet disconnect. Check that Remote
  Support shows availability accurately and cannot start sharing in this build.
- When the live remote integration is available, test incoming approval and
  decline, single-session enforcement, the active-session End action, the
  recording indicator, and the 10-minute inactivity timeout.

### Windows smoke check

On November 19, 2026, the existing Windows app loaded the redesigned JavaScript
through Metro for staging machine Ht-667. Home showed Connected. Clicking the
bottom tabs opened Remote Support, Settings, and Files. Files showed Received
designs, Send to Portal, and the Sent files empty state. Remote Support showed
connection unavailable. A fresh staging upload, persistence across Windows app
restart, and the matching portal Documents entry still require live verification.
