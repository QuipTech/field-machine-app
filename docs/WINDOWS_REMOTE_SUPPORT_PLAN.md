# Windows remote support implementation plan

## Prerequisites and evidence

- On November 19, 2026, a read-only request to staging `GET /build` returned
  `78995f541672447467b47962df6e6e973ff66879`. Match this SHA to the intended
  Portal release and confirm migrations 0139 and 0140 and Kinesis enablement
  from the deployment records.
- Phase 0 launch, folder access, screen capture, and the isolated SendInput
  check passed according to the owner's Windows evidence in
  [TEST_PLAN.md](TEST_PLAN.md). Streaming and live remote input need their own
  Windows validation.
- Complete the live Files acceptance checks in
  [CLIENT_REQUIREMENTS.md](CLIENT_REQUIREMENTS.md) on staging first. The
  existing workspace smoke check covers navigation and the Files screen.
- Obtain `tablet-disconnect-contract.md` and `remote-support-contract.md`.
  The handoff references them, and the repository contains summaries. Use the
  full contracts to document exact payloads, response schemas, errors, and
  retry behavior in [API_NEEDED.md](API_NEEDED.md) before adding API calls.
- Use a dedicated paired staging tablet and a Portal test user with
  `mc.remote`, contribute access to the test machine, and a session entitlement.

## Proposed changes

1. Extend `src/services/getCurrentRemoteSession.ts` and add
   `src/services/remoteSessionActions.ts`. Reuse the existing bearer REST
   transport, Zod validation, and Socket.IO client. Reconcile at startup,
   reconnect, foreground recovery, and on idle polls. Treat socket events as
   hints and validate session identity and pairing before applying a response.
2. Replace `src/features/remote-support/useRemoteRequest.ts` with a session
   controller and update `src/screens/RemoteSupportScreen.tsx`. Bind consent
   to session ID. Offer view-only by default for Request help and keep one
   UUIDv4 and request body per retry chain. Clear expired prompts and keep
   media off while waiting or whenever local consent is missing.
3. Add `src/native/RemoteSupportMedia.ts` and a Windows adapter in
   `src/native/RemoteSupportMedia.windows.ts`. Prototype a C++ peer and media
   module under `windows/FieldMachine/Native/` with Windows Graphics Capture
   as the monitor source. Verify Windows peer negotiation, screen track,
   audio, and codec interoperability with the designated viewer before
   choosing a WebRTC dependency. The existing Phase 0 capture and input
   modules establish Windows API availability for those checks.
4. Keep authorization and input lifecycle in the native session boundary.
   Enable control only for the authorized viewer and negotiated channel under
   active control consent. Validate messages against the streamed monitor's
   bounds, and release pressed input on shutdown. Stop local media and input
   immediately on End, loss of connectivity, revocation, or pairing loss.
   Retry the idempotent End request independently of local shutdown.
5. Build Debug x64 and run the handoff's acceptance matrix on the staging
   tablet. Record Windows build, API SHA, UTC times, and session IDs in
   [TEST_PLAN.md](TEST_PLAN.md), with separate evidence for Files, recording
   playback, and transcripts. Keep credentials and signed URLs out of logs.

The session layer reuses dependencies already present in the shared React
Native app. A media dependency requires a Windows build and an Android support
review before adoption. Backend deployment and Portal UI work belong to
their respective repositories.

## Windows media dependency

The AWS Kinesis Video Streams WebRTC C SDK documents a Windows build, H.264
and VP8 video, Opus audio, and data channels. It is a candidate for the
Windows C++ adapter. Its Windows build instructions include additional
native dependencies. Verify integration with RNW cpp-app, the app's packaged
runtime, and the Portal viewer before adding it to the shared app.

The existing capture module supplies the monitor frame source. The Windows
adapter will need an encoder, a peer connection, and monitor geometry tied to
the video track. The Phase 0 input module only sends a click to its diagnostic
window. Keep that check isolated. The support input implementation belongs
inside the active peer lifecycle and must release pressed keys and buttons
when the peer stops.

For integration, obtain a redacted device connection response showing the
exact field names and types for the presigned signaling URL, ICE servers,
viewer identity, control scope, and expiry. Obtain the Portal viewer's codec
requirements and representative control messages, including pointer coordinates,
keyboard and paste, scroll, and release semantics. Use these fixtures to
validate a single consent-bound peer and test rejection of a different viewer
before enabling desktop input.

- [AWS Kinesis WebRTC C SDK](https://github.com/awslabs/amazon-kinesis-video-streams-webrtc-sdk-c)

## Windows video implementation

The supplied Portal contract uses a presigned WebSocket and requires no AWS
SDK on the tablet. The current implementation uses React Native WebView
16.0.0 on Windows for WebRTC. The native picker origin serves the picker page
on a short-lived loopback listener. The page starts with capture disabled.
Once it reports that it has loaded and the tablet socket is connected, the app
supplies the session configuration directly to that WebView. The operator then
selects the monitor in the picker.

Verify on a Windows tablet that the picker opens, the Portal receives a live
monitor track, cancelling the picker leaves capture off, and ending or losing
the session stops capture. The tablet now offers opt-in microphone capture,
support audio playback, and an operator-triggered reconnect with fresh
signaling credentials. Verify these on Windows hardware. Desktop input and
automatic transport recovery remain pending. The heartbeat currently reports
no local interaction.

The WebView project defaults to toolset v143. The repository's
`npm run windows` command selects the app's v145 toolset for the solution.

On November 19, 2026, Windows Debug x64 built successfully with v145.
TypeScript, lint, and 94 Jest tests passed. A separate mocked peer check
passed for viewer filtering, queued ICE, SDP answer, and capture teardown.
Deployment, the screen picker, and live Portal playback still need tablet
verification.

### Ht-667 staging connection investigation

The tablet displayed an active Portal session followed by the generic
streaming connection error, while the Portal viewer remained connecting.
The failure occurred before the screen picker. That error also covered
an unavailable Windows picker module and a failed session heartbeat.
The tablet now distinguishes those from network timeouts, HTTP failures,
invalid connection responses, and expired credentials.

Correlate the next attempt by session ID and UTC time. If the tablet
reports an HTTP error or response mismatch, check the staging backend trace
for POST /mc/device/remote-sessions/{id}/connection and inspect the returned
status, documented error code, or field shape. A 503 with
`remote_support_unavailable` warrants checking Kinesis enablement and the
backend's AWS call result. Keep all credential values out of the handoff.

The Ht-667 diagnostics screenshot on November 19 shows
`remote:picker: local_origin_ready` at 17:43:03.900 UTC and a Socket.IO
`transport close` at 17:43:03.985 UTC. The authenticated socket reconnected
at 17:43:06.538 UTC. Before the tablet-side fix, reconnect remounted the
screen peer and started another credential request. The tablet now pauses
sharing and offers a manual retry after reconnect. Use the gateway trace
around 17:43:03.985 UTC to determine who closed the transport.

On November 20, two Ht-667 attempts returned HTTP 200 and validated the
streaming credentials. The loopback listener started at 10:44:59.674 and
10:45:59.345 UTC. Both attempts reached `webview_ready_timeout` without a
picker navigation or readiness confirmation in the console. Socket.IO
reconnected before both picker timeouts. The remaining failure is between
opening the local listener and loading the Windows WebView picker. The
console alone does not establish which of those components failed.

The backend trace for those attempts confirms that the Portal sent offers
and received no answer or media. The tablet now sends heartbeats throughout
the approved session, including picker startup and retry. Windows reads the
connection response as text without the fetch Blob conversion path and logs
elapsed time to validation. Diagnostics also log picker navigation, signaling
open, and authorized SDP offer and answer milestones without message contents.
Retest the picker and record where the new flow first stops.

The November 20 Ht-667 trace reached `peer_connected` at 11:49:23.186
UTC, followed by `negotiation_failed` at 11:49:23.687 UTC while the session
heartbeats continued. Windows now ignores malformed signaling frames, resends
its answer to an identical offer from the designated viewer, and sends local
ICE after the answer. During staging acceptance, verify the Portal receives
video continuously across multiple sessions and that End remote access still
stops the track. Record the viewer's connection state if video stops again.

## Windows remote input acceptance

The in-app WebView forwards protocol v1 input from the designated viewer's
ordered `control` channel to a Windows C++ module. Local control consent,
the active session's scope, and `controlAllowed` from the connection response
must all permit input. The WebView picker cannot identify a selected Windows
monitor, so native input is enabled for a single-monitor desktop and is
revoked if its bounds change. Video can still be shared with multiple displays.

- Use ordinary Windows apps on a dedicated test tablet. Select and double-click
  an icon, type into Notepad, scroll vertically and horizontally, and paste
  Unicode text. Verify clicks at 100% and 150% scaling.
- Test view-only, a closed control channel, a disconnected tablet, and End
  remote access during a drag or a held key. Input must stop and held keys and
  buttons must be released. Test an attempted Ctrl+Alt+Delete chord.
- Compare Portal send logs with the Debug console's `[remote-control]` input
  types and injection outcomes. These logs omit coordinates, keys, and text.
- Windows can block injection into elevated applications when FIELD Machine
  is running at ordinary integrity.
