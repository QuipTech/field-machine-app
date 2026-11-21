# Backend handoff prompt for Windows Remote Support

Please return the existing staging contracts for operator-approved remote
support for FIELD Machine. For each action provide the HTTP method and path
or authenticated event name, permissions, sample request and response JSON,
errors, expiry, and retry/idempotency behavior. Flag any missing contract
before creating a route.

- Portal Connect: create a request for one paired machine and deliver it to
  that tablet. Include session ID, requester display name, expiry, and
  whether the request includes desktop viewing, control and recording.
- Tablet Allow/Decline: authenticate with the existing device token and bind
  the decision to the session and paired machine. Treat expiry, replay and
  simultaneous requests explicitly. Issue session access only after Allow.
- Active session: provide the existing short-lived Kinesis Video Streams
  WebRTC credential contract in ap-southeast-2 and role permissions. Confirm
  signaling, authorized consent scope and expiration. Confirm how both
  sides learn about acceptance, disconnection, and session termination.
- End session: either side can end it. Support one approved session per
  tablet and termination after 10 minutes of inactivity. Define the
  inactivity signal and how access is revoked after end or lost pairing.
- Recording: automatically record approved screen-share sessions. Confirm
  the recorder owner, how the tablet learns that recording is active,
  storage location, finalization, failure/retry behavior and transcription.
  Return a machine History entry with requester, date, duration, recording
  playback and transcript. Enforce Portal access on playback and transcript.
- Events: provide the existing event contract for consent, session start/end
  and recording failures. Supply test fixtures for Allow, Decline, expiry,
  disconnect, recording completion, and a denied cross-machine request.

Please identify which parts already work in staging and provide a paired test
machine and a Portal test account through the existing secure access process.
