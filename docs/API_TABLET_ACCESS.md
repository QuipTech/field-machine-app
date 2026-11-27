# Tablet access by FIELD ID — client use of the supplied contract

Source: `tablet-access-contract.md` and `remote-support-contract.md`, staging
build `4f8984b`, deployed 26 November 2026 (supplied 2026-11-26). Only
responses marked (staging) there were checked live; the rest come from backend
code and tests. No tablet has registered on staging yet.

## Requests this app sends

| Call | Auth | Body | Success |
| --- | --- | --- | --- |
| `POST /mc/device/register` | none, or `Bearer <deviceToken>` to upgrade | `{ password, platform: "windows", appVersion }` | `201 { fieldId, tabletToken }` |
| `GET /mc/device/registration` | `Bearer <tabletToken>` | — | `200 { fieldId, assigned, machine: { id, label } \| null }` |
| `PUT /mc/device/registration/password` | `Bearer <tabletToken>` | `{ password }` | `204` |
| `POST /mc/device/registration/session` | `Bearer <tabletToken>` | — | `200 { deviceId, deviceToken, machine }` |

- `serialNumber` is omitted (optional). Unknown fields are rejected, so no
  other keys are sent.
- `fieldId`: 9 digits, first 1–9. Tokens: 43 base64url characters (the app
  accepts 20–200 to tolerate a format change).
- Errors are branched on HTTP status and `code` only:
  `403 tablet_device_token_invalid` (upgrade with a dead token → register
  without it), `401 TABLET_TOKEN_INVALID` (register again: new FIELD ID),
  `409 tablet_password_managed_in_portal`, `409 tablet_not_assigned`.
- Network failures, `5xx` and `429` retry with 1, 2, 4, 8 … 30 s back-off.
  Other `4xx` are not retried. `429` honours `Retry-After-devicePairing`.

## Flow

1. Read the access record (DPAPI). If it is missing:
   - with a saved code pairing: register with `Bearer <deviceToken>`; keep the
     machine and deviceToken; keep the new password until the operator
     confirms it is recorded, because it cannot be changed from the tablet;
   - otherwise: generate a password (14 characters), register without auth.
   Persist the reply before anything else.
2. No `deviceToken`: poll `GET /registration` every 5 s and show FIELD ID and
   password. When `assigned`, call `…/session` once (each call revokes earlier
   tokens), store the device, delete the password, continue as paired.
3. `DEVICE_TOKEN_REVOKED`, `session:ended` or Disconnect: drop the deviceToken
   only and return to step 2. FIELD ID and tabletToken stay.

## Unattended sessions

`access: "unattended"` sessions are `active` immediately (no Allow/Decline;
`expiresAt` ignored). On `remote:accepted`, start-up, reconnect and the 10 s
idle poll the app streams at once. `controlAllowed` from `…/connection` (same
value as `scope.control`) decides control; `false` is view only. `prompt`
sessions (code-paired tablets, Request help) keep today's prompt.
**Recording** shows whenever the session is active and `scope.record` is true.

## Storage

`%ProgramData%\FIELD Machine\tablet-access.bin`: one JSON record encrypted
with DPAPI (machine scope, app-specific entropy). Machine scope is used
because the app runs for whichever Windows user is signed in, and the tablet
has one FIELD ID. Any signed-in tablet user can therefore use these tokens,
as they can already use the app.

## Open points for the backend

- The heartbeat sends `interacted: false`; local input tracking that excludes
  injected input is not implemented, so Portal input alone keeps sessions alive.
- After a tablet removes itself (Disconnect), its password is already deleted
  locally and cannot be changed on the tablet (`409`). Re-adding needs a new
  FIELD ID (**Register as a new tablet**), per the contract's known limitation.
