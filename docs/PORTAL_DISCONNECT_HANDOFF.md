# Separate tablet pairing from live presence

## User-supplied findings

Update: the backend has now supplied DELETE `/mc/device/session` with Bearer
deviceToken. Windows Disconnect tablet now calls it before local credential
removal, and suspends its socket/retry work during the request. The earlier
local-only Forget behavior below describes the original issue, not the new action.
Success statuses/body remain unspecified; the client assumes 200/204 or the
existing exact revoked-token 401. Actual deployed response needs confirmation.

- Windows Forget removes local pairing. Supplied source findings indicate it
  should also close the active socket, without revoking backend pairing.
- Portal currently derives Connected from saved backend pairing. That label can
  therefore remain Connected after the tablet socket closes.
- The inspected checkout reportedly has no `/machine-app` gateway or tablet
  presence handling. Identify which repository and commit were inspected.
- Deployed backend behavior and actual Windows socket disconnect remain unverified.

These explain the reported label semantics. They do not establish packet loss,
prove that the server received disconnect, or prove the deployed gateway is absent.

## Required Portal/backend change

Confirmed Portal-only routes on `https://staging-api.quiptechfield.com.au`:

- GET `/machines/{machineId}/app-connection` returns `{ connected, device }`;
  connected represents saved pairing. Detailed device schema/statuses unspecified.
- DELETE `/machines/{machineId}/app-connection` removes pairing.
- Both require Portal user authentication. Do not use Windows device tokens.
- Neither defines live presence. No confirmed presence endpoint/event has yet
  been shared; request the exact deployed contract from the backend owner.

Display two independent states:

| State | Values | Authoritative evidence |
| --- | --- | --- |
| Pairing | Paired / Unpaired | Backend machine-device association |
| Live presence | Online / Offline / Unknown | Authenticated session and timeout |

A saved pairing must not establish Online. Use Unknown when presence evidence
is unavailable. Local Forget can leave backend pairing Paired while live presence
becomes Offline. Permanent unpairing requires a separate approved backend operation.

## Investigation

1. Confirm staging Portal/backend URLs, API prefix, deployed build/commit, and
   actual Windows app version. Source availability is not deployment evidence.
2. Trace authenticated `/machine-app` Socket.IO connection and device-room
   membership. Register observation before reproducing Windows Forget.
3. Record server disconnect reason, UTC timestamps, device/machine/socket IDs,
   and hosting instance. Never log tokens, handshake auth, or Authorization headers.
4. Trace presence cleanup, backend state, Portal notification/refetch, client cache,
   and rendered labels. Compare a fresh response with UI before assigning fault.
5. Handle graceful socket closure and heartbeat timeout separately. Define the
   maximum delay before Offline when the app exits or loses network unexpectedly.
6. Ensure delayed disconnect from an old socket cannot mark a replacement session
   Offline. Define multiple-socket and multi-instance behavior.
7. Identify the deployed gateway/listener location. Absence from an inspected
   checkout does not establish absence from the running backend.

## Contract required from backend owner

Supply the existing or proposed exact presence contract before Windows changes:

- Initial-state source and response schema.
- Portal subscription/event or refetch mechanism and exact payloads.
- Online/offline criteria, timestamps, heartbeat interval, and expiry deadline.
- Authentication, machine/device scoping, and multiple-session rules.
- Deployment repository, commit, instance topology, and migration requirements.
- For the supplied device-token DELETE `/mc/device/session`: success response,
  disassociation guarantees, idempotency, and retry behavior still need confirmation.

Do not invent an endpoint or event name. A socket close is not token revocation,
and the end reason tablet_disconnected does not define an initiating command.

## Private token diagnostic interpretation

With an approved private diagnostic process, GET the supplied session endpoint
using the old token, without exposing it in commands, logs, screenshots, or chat.

- HTTP 200 after the old local-only Forget can be expected. After the new DELETE
  reports completed, a still-valid old token needs backend investigation.
  Neither GET result alone demonstrates live Online presence.
- HTTP 401 with DEVICE_TOKEN_REVOKED confirms revocation; inspect association and
  presence according to their separate semantics.
- Generic 401 or transport failure does not establish revocation.

Portal-initiated permanent disconnect is a different flow. Its supplied contract
emits session:ended and invalidates the token. If that flow fails, verify actual
gateway/listener deployment and, where applicable, migration
0128_machine_app_live_session.sql and PostgreSQL mc_device_event notifications.

## Acceptance and report

- Pairing and live presence are visibly separate in Portal.
- Windows Forget leaves pairing according to product semantics and updates live
  presence within the documented disconnect/heartbeat deadline, without refresh.
- Network loss eventually becomes Offline without silently revoking valid pairing.
- New pairing/session is unaffected by delayed callbacks from the old connection.
- Report observed events/responses, UTC timeline, root cause, changed files,
  deployed version, tests actually run, and any Windows-side contract changes.

This handoff records supplied findings and requested work. It does not claim
Portal/backend implementation or end-to-end verification.

## Windows Forget verification

Focused mocked integration checks in
`src/features/connection/ForgetConnection.test.tsx` passed on 2026-11-17:

- Forget disconnects the active socket, removes handlers, clears paired state,
  and cancels the controller's 15-second retry interval.
- Advancing time by 60 seconds, foreground/resume, and old socket callbacks do
  not start another validation or socket connection after Forget.
- In-flight validation is aborted; a late successful response cannot reconnect.

These checks exercise the actual store, lifecycle hook, and controller together;
native storage, socket transport, and resume notifications are mocked. Server-side
disconnect receipt still needs observation on the deployed backend and actual
Windows executable. Prior deployment failed while enabling Developer Mode.

## Design delivery backend follow-up

- Confirm staging deployment and provide a paired test machine and fixtures for
  multi-file delivery, replacement with omitted paths, and rollback by resending
  an older version. Include the Portal user and machine/site access setup.
- Confirm replay of `downloading`, `arrived`, and `failed` PATCH requests returns
  HTTP 200 with the requested status after a lost response. Specify the response
  for deliveries that were cancelled, superseded, or already terminal.
- Confirm whether `/designs/next` includes both waiting and downloading work
  after restart, and whether file URLs can always be reissued for that work.
- Confirm Range support, signed URL expiry response codes, and manifest
  constraints (maximum size and count, empty manifests, and Windows filenames).
- Confirm whether status requests use the standard revoked-token response and
  how the worker should handle a delivery cancelled during a download.
- Supply the existing pull upload contract, supported machine export formats,
  schedule trigger, resume behavior, and machine/site attribution for returns.
