# Live session investigation — 2026-11-17

## Findings and evidence

- Source before this fix had no Socket.IO client, session event listeners, or
  REST session validation. It restored saved pairing locally. No Connected label
  existed in this checkout; the exact observed app build is not established.
- User confirmed Portal `https://staging.quiptechfield.com.au` and backend
  `https://staging-api.quiptechfield.com.au`, with no API prefix.
- Live unauthenticated GET `/mc/device/session` returned HTTP 401.
- Anonymous Socket.IO `/machine-app`, transport path `/socket.io`, returned
  `connect_error` with message `unauthorized`. Run the read-only probe with
  `node scripts/probeMachineGateway.cjs https://staging-api.quiptechfield.com.au`.
- These prove the deployed routes respond; they do not prove token revocation,
  authenticated device-room membership, or end-event delivery.
- Old-token REST probe blocked: the shell cannot activate the PasswordVault
  WinRT type. No token, credential value, or Authorization header was printed.
- No coordinated Portal Disconnect has been observed in the updated app yet.

## Client behavior

Tablet Disconnect now sends DELETE `/mc/device/session` using the saved token
after stopping the socket. It removes local credentials after 200/204 or exact
revoked-token 401. Failure retains credentials for explicit retry. Success status
and body are client assumptions pending backend confirmation. See API_NEEDED.md
and PAIRING_TEST_PLAN.md for the contract and new acceptance cases.

- Register all handlers before connecting with handshake auth `{ deviceToken }`.
- Validate saved pairing on startup, foreground/wake, socket recovery, and
  server disconnect. Recheck every 15 seconds to recover missed events/network.
- Show Connected only after a successful session GET and socket connection.
- A matching `session:ended`, revoked connect_error, or HTTP 401 with the exact
  revocation code invalidates in-memory auth and stops its socket immediately.
- Secure deletion is serialized after earlier writes. Re-pairing stays blocked
  until deletion succeeds. Cleanup is idempotent and callbacks are session-scoped.
- Temporary network errors, generic 401, and 5xx retain credentials and show
  reconnecting. They never consume a new pairing code automatically.
- Diagnostics retains the latest 30 redacted entries in memory and mirrors them
  to console: event name, known end/error/disconnect reason, HTTP status, code
  classification, and backend URL. It never records credentials or raw bodies.
- `session:after_end` is a read-only GET using the old token in memory, even
  after local cleanup. Its response cannot change pairing or connection state.
- Current session-specific work is only this socket and validation timer. Remote
  capture/control, MQTT, transfers, chat, and durable event history remain deferred.

## Windows resume and build

RNW's installed `Microsoft.ReactNative/Modules/AppStateModule.cpp` always returns
active and does not emit foreground changes. DeviceInfoModule uses Windows
GetForegroundWindow/GetWindowThreadProcessId for local one-second foreground
checks; timer gaps detect wake from sleep. No periodic REST call runs each second.
An older executable logs that the module is missing; rebuild is required.
Android keeps native AppState handling; Android secure storage remains deferred.

## Acceptance procedure — requires updated executable and test machine

Keep Metro running, close the old app, then build/deploy the updated Windows app.
Open Diagnostics to confirm the backend and connection timeline. Never copy a
token into a terminal command, screenshot, issue, or log.

1. Pair with a fresh staging Portal code. Confirm session validation HTTP 200,
   authenticated socket connect, then Connected. Saved token alone is insufficient.
2. Disconnect in Portal while online. Record `session:ended` reason, disconnect
   reason, and `session:after_end`. Expect return to pairing; restart stays unpaired.
3. Pair again, take tablet offline, disconnect in Portal, restore network. Expect
   revocation during recovery without requiring an end event. Restart also detects it.
4. Restart or foreground the app with revoked credentials. Expect secure removal,
   no Connected state, and code entry. Verify minimize/restore and sleep/wake.
5. Lose network with a still-valid token. Expect reconnecting, preserved pairing,
   and recovery after HTTP 200 plus socket connect without a new code.
6. Revoke and immediately pair again after cleanup. Old callbacks, timers, and
   pending responses must neither clear nor overwrite the new session.
7. Make secure deletion fail. Expect cleared in-memory auth, blocked re-pairing,
   and retry cleanup. Confirm the old credential is never treated as Connected.

## Backend interpretation

- Old-token HTTP 401 + DEVICE_TOKEN_REVOKED: revocation works. Inspect socket
  connectivity, event receipt, local cleanup, and whether the new build is running.
- Old-token HTTP 200 after Portal disconnect: possible revocation/deployment
  issue or environment mismatch. Confirm both URLs before assigning a cause.
- Revoked 401 but no end event: confirm authenticated socket connectivity; ask
  backend developer to verify machine-app gateway/listener deployment, migration
  `0128_machine_app_live_session.sql`, and PostgreSQL `mc_device_event` notifications.
- Anonymous 401 / unauthorized alone supports none of these conclusions.

## Verification status

- TypeScript and ESLint passed; Jest: 13 suites, 57 tests passed.
- Tests cover REST classifications, handler order/auth configuration, missed
  events, offline recovery, duplicate cleanup, stale responses, replacement
  pairing, storage ordering, lifecycle wiring, and Windows resume adapter logic.
- Windows Debug/x64 build passed, including DeviceInfoModule. See session-build.log.
- Metro Windows development bundle and asset generation passed; session-bundle.log.
- Deployment attempted with the built executable; failed at Enabling Developer
  Mode. See session-deploy.log. No updated-app launch or runtime pass is claimed.
  Enable Windows Developer Mode, close the old app, and rerun
  `npm run windows -- --arch x64 --no-packager` with Metro already running.
- Native runtime, authenticated old-token request, Portal event delivery, restart,
  workshop tablet, and Android device checks remain unverified.

## Changed files

- package.json / package-lock.json: Socket.IO client dependency.
- src/config/environment.ts: session endpoint, namespace, transport path.
- src/services/deviceSessionService.ts / machineSocket.ts: REST and live transport.
- src/features/connection/startDeviceSession.ts: lifecycle and revocation handling.
- src/features/connection/useDeviceConnection.ts: app-owned session orchestration.
- src/features/connection/useConnectionStore.ts / sessionDiagnostics.ts:
  connection state and bounded redacted diagnostic timeline.
- src/features/connection/probeEndedSession.ts / ConnectionDiagnostics.tsx:
  private old-token probe and visible diagnostics.
- src/features/pairing/usePairingStore.ts / pairingService.ts:
  guarded idempotent cleanup, stale-work rejection, serialized secure operations.
- src/native/DeviceInfo.ts / subscribeToAppResume.ts /
  subscribeToAppResume.windows.ts: shared resume adapters.
- windows/FieldMachine/Native/DeviceInfoModule.h / PhaseZeroModules.cpp and
  windows/FieldMachine/FieldMachine.vcxproj: Windows foreground native integration.
- src/app/MachineApp.tsx / src/screens/PairingScreen.tsx / PhaseZeroScreen.tsx:
  lifecycle ownership, verified connection labels, cleanup retry, diagnostics.
- scripts/probeMachineGateway.cjs: anonymous deployment probe.
- New tests beside connection controller, lifecycle hook, native resume adapter,
  and REST/socket services; updated pairing store/service and screen tests.
- docs/API_NEEDED.md / PLAN.md / TEST_PLAN.md / PAIRING_TEST_PLAN.md and this guide:
  approved contract, implementation decisions, evidence, and manual acceptance.
