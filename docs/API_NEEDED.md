# Confirmed pairing API

FIELD ID access (replaces code pairing on Windows): see [API_TABLET_ACCESS.md](API_TABLET_ACCESS.md).

## Tablet-initiated disconnect — supplied 2026-11-17

- DELETE `<apiBaseUrl>/mc/device/session`; Authorization Bearer deviceToken.
- No request body or Portal user credentials. Uses the configured staging base URL.
- Backend supplied method/path/auth only; success status/body and retry semantics
  remain unconfirmed. Client assumes 200 or 204 means completed, ignores the body,
  and treats other responses as unconfirmed except exact revoked-token 401.
- HTTP 401 with `{ "code": "DEVICE_TOKEN_REVOKED" }` means already revoked;
  local cleanup is safe using the existing revocation contract.
- A timeout, transport failure, generic 401, or other status preserves credentials
  for explicit retry. DELETE is never automatically repeated in the background.
- Stop socket/reconnect work before DELETE; delete saved credentials only after
  confirmed completion/revocation. Local secure-deletion retry must not resend DELETE.
- Actual backend disassociation, Portal notification, and deployed response still
  require live acceptance. No live-presence API is implied by this operation.

Contract supplied by the user on 2026-11-12.

- Staging API: `https://staging-api.quiptechfield.com.au`
- Staging Portal: `https://staging.quiptechfield.com.au`
- `POST /mc/device/pair`, no sign-in or Authorization header.
- Request used by this app:
  `{ "code": "123456", "platform": "windows" }`
- Android tablets send `"platform": "android"` (exact lowercase). Confirmed
  2026-11-21: `PairDeviceDto.platform` allows only `android`/`windows`, and
  migration 0121 enforces the same CHECK on `mc_devices`.
- Remove whitespace from the entered code; require exactly six ASCII digits.
- Optional serialNumber and appVersion are omitted in this step.
- Never send deviceId or notificationId; the server rejects them.
- Codes expire after 15 minutes and work once.

## Responses

201 success:

```json
{
  "deviceId": "uuid",
  "deviceToken": "base64url-string",
  "machine": { "id": "uuid", "label": "ASSET-0042" }
}
```

- 400: `"That code isn't valid or has expired."`
- 400: `["The pairing code is 6 digits."]`
- 400: `["property deviceId should not exist"]`
- 429: more than five attempts per minute from one IP.
- Handle direct string/array errors and standard message envelopes.
- Do not automatically retry a pairing POST: it consumes a one-time code.
- Network timeout can leave server outcome unknown; explain that in the UI.

## Persistence and limitations

Pairing is permanent until Portal disconnection or another tablet replaces it.
The device token is returned once. Store the complete validated response in
Windows PasswordVault, as approved by the user, behind SecureStore.
Saved pairing is scoped to the staging environment and Windows user/computer name.
Restored state is explicitly labelled saved, not server-verified or online.
Session validation and live revocation use the contract below. Token refresh
remains unspecified; do not retry pairing or refresh on generic authorization errors.
Remote access never starts as a result of pairing.
Android secure storage, notification registration, and hardware serial lookup
are deferred. No fake identifiers are generated.

## Live session contract — supplied 2026-11-17

- GET `<apiBaseUrl>/mc/device/session`, no body; Authorization Bearer deviceToken.
- HTTP 200 means valid. The success body schema is unspecified and unused.
- HTTP 401 with JSON `{ "code": "DEVICE_TOKEN_REVOKED" }` means revoke locally.
- Other statuses, malformed bodies, and transport failures retain pairing and
  never establish Connected. No undocumented refresh request is made.
- Socket.IO namespace `/machine-app`; handshake auth `{ deviceToken }`.
- `session:ended`: `{ deviceId, machineId, reason }`; known reasons:
  `portal_disconnected`, `tablet_disconnected`, `replaced`, `connection_timeout`.
- `connect_error` message `DEVICE_TOKEN_REVOKED` uses the same local cleanup.
- Validate on startup/resume, reconnect, and server disconnect; retry transient
  failures. Do not infer revocation from a disconnect alone.
- REST and socket origin derive from the same apiBaseUrl, preserving its REST
  base path. Socket.IO transport path defaults to `/socket.io`; a proxy-specific
  path must be confirmed separately. Namespace is not the transport path.
- Confirm actual Portal/backend URLs and gateway deployment in live testing.
  Current staging configuration has no API prefix. This is not evidence that
  the tested Portal uses the same environment.
- Never log headers, tokens, raw server errors, or full session response bodies.

## Portal pairing routes — supplied 2026-11-17

- GET `https://staging-api.quiptechfield.com.au/machines/{machineId}/app-connection`
  uses Portal user authentication; returns `{ connected, device }`.
- `connected` means saved backend pairing, not live socket presence. The detailed
  device schema and HTTP response statuses were not supplied.
- DELETE at the same URL removes pairing with Portal user authentication.
- Neither route is approved for Windows device-token authentication. The Windows
  client must not call them or infer such authorization from the route name.
- No confirmed Portal live-presence endpoint/event is available. Backend must
  provide initial state, exact response/event payload, Portal authentication and
  subscription, update/heartbeat timeout, and multi-session behavior.
- `/mc/device/session` validates token/pairing; it does not establish a Portal
  presence feed. `/machine-app` and `session:ended` alone do not define that feed.

## Windows tablet document upload

- POST `/mc/device/files` on the pairing API origin with Bearer device token.
- Multipart parts: `file` (one supported file with original filename),
  `transferId` (UUID scoped to the pairing), and optional `documentType`
  (`service_report`, `inspection`, `certificate`, or default `other`).
- HTTP 201 JSON: `{ id, fileName, documentType, uploadedAt }`. The ID is the
  machine document ID and the timestamp is ISO 8601 UTC. A repeated transfer ID
  under the same pairing returns the original receipt.
- HTTP 400 asks for corrected input. HTTP 401 with `DEVICE_TOKEN_REVOKED` calls
  for checking the latest saved token and confirming revocation with the session
  endpoint. HTTP 403 signals inactive machine or unavailable Machine Control.
  HTTP 413 signals the request size limit. Network and transient HTTP failures
  retry with the original transfer ID.
- Deployment requires migration `0133_machine_document_transfers`. The tablet
  uses the pairing response machine label and keys its queue by API environment,
  machine ID, and device ID. Confirm staging has the migration and that the
  Portal refreshes open Documents tabs every 10 seconds in the smoke test.

## Design deliveries and returned machine files

The backend supplied these design-delivery routes on the pairing API origin.
Each FIELD request uses `Authorization: Bearer <deviceToken>`.

- GET `/mc/device/designs/next` returns HTTP 200 with `{ delivery: null }` or
  `{ delivery: { id, projectId, project, versionId, status, files } }`.
  Each `files` entry is `{ path, sizeBytes, sha256 }` in manifest order.
- GET `/mc/device/designs/{deliveryId}/files/{index}` returns HTTP 200 with
  `{ url, expiresAt }`. Indexes are zero-based. Request the HTTPS storage URL
  directly with optional `Range: bytes=<offset>-` and no FIELD bearer token.
- PATCH `/mc/device/designs/{deliveryId}` sends `{ status: "downloading" }`,
  `{ status: "arrived" }`, or `{ status: "failed", error }` and expects HTTP 200
  with `{ status }` matching the requested status.
- Terminal status is replayed after an unknown response. Confirm replay
  semantics and other outstanding items in
  [the disconnect handoff](PORTAL_DISCONNECT_HANDOFF.md#design-delivery-backend-follow-up).
- Returned machine files still need the existing pull upload contract.

## Remote Support workspace dependency

The Windows Remote Support screen reflects unavailable live support. Before
wiring live controls, confirm the authenticated incoming request event and its
payload, the operator-initiated request flow, and the supplied session
accept/decline/end and KVS credential request and response contracts. Confirm
how the portal reports active recording and delivers the saved session record.

## Supplied remote support contract

The November 19 handoff specifies bearer device authentication on the staging
API. The tablet request preview uses GET /mc/device/remote-sessions/current
without a body. HTTP 200 returns { session: null } or a session with id,
machineId, deviceId, status, requester.name, scope, and expiresAt. The preview
validates these fields and displays only unexpired requested sessions belonging
to the current pairing. HTTP 401 or 403 stops polling until the pairing or
connection changes.

The remaining contract specifies POST decision with decision and allowControl,
POST connection with no body for presigned KVS signaling and ICE configuration,
POST heartbeat with interacted, and POST end with no body. The attached contract
defines the remote socket events and recording status. Portal owns the recording.
The backend handoff describes migration 0139, KVS enablement and IAM as pending
staging setup. Deployment and authenticated live checks remain unverified.

Windows decline uses POST /mc/device/remote-sessions/{id}/decision with
bearer device authorization and JSON `{ "decision": "decline" }`. The tablet
uses the HTTP success status and reconciles through GET current; it consumes
no decision response body. Confirm the enum and whether the backend requires
`allowControl: false` for decline against the full contract.

Approval uses the same decision route with
`{ "decision": "allow", "allowControl": false }` for viewing only or
`allowControl: true` for requested control. End uses POST
`/mc/device/remote-sessions/{id}/end` with no body. Both use the HTTP success
status and reconcile by polling GET current. Confirm the approval enum and
decision response against the deployed contract before accepting live use.

The supplied original remote-support contract confirms `decision: "allow"`
and `allowControl`, with HTTP 200 returning the session directly. GET current
wraps it as `{ session }`. The original Portal-only response omits
`initiatedBy`; newer responses can explicitly identify tablet requests.
The existing authenticated socket receives `remote:requested`,
`remote:accepted`, `remote:declined`, `remote:ended`, and `remote:recording`
with session, device, and machine IDs. Windows uses these events to trigger
REST reconciliation.

The Windows streaming peer requests POST `/mc/device/remote-sessions/{id}/connection`
with bearer authentication and no body. Success provides `sessionId`, role
`MASTER`, `region`, `viewerClientId`, `signalingUrl`, `iceServers`,
`expiresAt`, and `controlAllowed`. It uses the presigned URL directly and
answers SDP and ICE only for the returned viewer. The Windows WebView2 adapter
requires a local screen picker selection before capture starts.
While the screen peer is mounted, POST `/mc/device/remote-sessions/{id}/heartbeat`
sends `{ "interacted": false }` every 15 seconds. The adapter stops on a failed
check or a response other than the same active session. Local input tracking
is pending.
