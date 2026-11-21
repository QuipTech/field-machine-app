# FIELD Machine implementation plan

## Current scope: Phase 1 pairing and live session

Phase 0 passed on the user's Windows laptop by reported evidence; see
TEST_PLAN.md. The first Phase 1 step implements staging pairing, secure Windows
credential storage, and saved pairing restore. Diagnostics remains available.
See API_NEEDED.md for the confirmed contract and PAIRING_TEST_PLAN.md for checks.
Socket.IO presence and REST session validation now implement the user-supplied
2026-11-17 contract. See SESSION_TEST_PLAN.md for evidence and remaining checks.
Windows runtime and authenticated live staging verification remain required.
The paired Windows app provides a Files section and manual document uploads.
Incoming design delivery uses the supplied polling contract. Live acceptance
and the separate machine history integration remain open.
See [the file transfer handoff](FILE_TRANSFER_HANDOFF.md) for the current gaps,
the contracts to confirm, and the acceptance checks.
Tablet-initiated disconnect now uses the supplied device-token DELETE session
route before local credential removal. Its deployed response remains unverified.

## Baseline

- React Native 0.85.3 with React Native Windows 0.85.0 (matching minor).
- Node 22 or newer; strict TypeScript.
- RNW `cpp-app`, preserving the new architecture.
- React Native core UI with React Hook Form, Zod, and Zustand for pairing.
- Android uses upstream React Native; Windows uses RNW.
- MQTT and WebRTC dependencies remain deferred.
- Socket.IO client 4.8.3 uses React Native WebSocket with no additional native
  dependency. The Windows DeviceInfo module detects foreground transitions;
  RNW 0.85's built-in AppState always returns active. Android uses AppState.

## Planned Phase 0 files

- Official React Native entry points, configuration, and Android template.
- `App.tsx`: application composition.
- `src/screens/PhaseZeroScreen.tsx`: manual capability controls.
- `src/features/phase-zero/`: state, test runner, and test cases.
- `src/native/`: typed FileSystem, ScreenCapture, InputControl contracts.
- `windows/`: rendered locally from the installed RNW 0.85.0 `cpp-app` template.
- `windows/FieldMachine/Native/`: C++ modules, capture helpers, and click target.
- `docs/TEST_PLAN.md`: evidence and manual verification procedure.

## Native implementation decision

The user approved C++ Windows native modules while preserving `cpp-app`.
Kotlin remains the Android implementation language. Shared contracts stay in
TypeScript. No architecture switch or additional native libraries are needed.

Windows build, deployment, and launch were demonstrated by user-provided laptop
logs and screenshots. Local template rendering bypassed the CLI's Windows-only tooling,
using the official installed template and its substitution values. It does not
prove that NuGet restore, MSBuild, packaging, or runtime capabilities work.
Source: https://microsoft.github.io/react-native-windows/docs/new-architecture/

## Capability checks

1. Build and launch the Windows app.
2. Select an explicit test folder outside the app sandbox; create a new test
   file, read it back, compare contents, and remove only that test file.
3. Explicitly start whole-primary-monitor capture, inspect its first-frame PNG
   and increasing frame count, then stop capture.
4. Explicitly arm input injection, click a dedicated test target, and verify the
   target received the click. Never inject automatically at app startup.

## Remaining phases

1. Windows core: pairing, connection, delivery, history.
2. Windows support: browse/pull, view/control, chat.
3. Windows release: MSIX and workshop tablet checks.
4. Android native modules and feature parity.
5. Offline/reconnect and 500 MB transfer hardening.

Before API implementation, document the specified endpoint contracts and
unconfirmed backend assumptions in `API_NEEDED.md`.

## Windows tab backlog

- Files: verify document receipts survive restart and match Portal Documents.
  Validate design delivery targeting, replacement, resume, checksum and rollback
  in staging. Confirm the pull upload contract before wiring machine exports.
- Settings: verify tablet status, diagnostics, and disconnect failure/retry on
  Windows. Add site and customer fields when the tablet API supplies them.
- Remote Support: confirm incoming request and session contracts before wiring
  approval, active-session controls, screen sharing, recording and history.
- Release: validate the MSIX on a workshop tablet before Android parity work.
