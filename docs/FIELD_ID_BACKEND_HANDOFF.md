# Backend handoff prompt: FIELD ID tablet access

Please send the final `tablet-access-contract.md` and `remote-support-contract.md`
used by the backend (not yet deployed), plus staging details. The Windows
FIELD Machine tablet app will replace 6-digit pairing with FIELD ID + password.
For every endpoint, give the method and path, headers, request JSON, every
response JSON (success and errors with status codes and `code` values),
field types and limits, rate limits, idempotency and retry behaviour.

## Registration

1. `POST /mc/device/register`
   - Request fields (password, platform, device name or hardware ID?), and the
     password rules (minimum length, allowed characters, maximum length).
   - Response: `fieldId` format and `tabletToken` (lifetime, can it expire or be
     rotated?). Is anything else returned?
   - What happens if the same tablet registers twice? Is there a hardware ID
     or other key that makes it idempotent?
   - Upgrade path: an already paired tablet calls it with
     `Authorization: Bearer <deviceToken>`. Confirm it keeps the machine and
     the deviceToken, and what the response contains in that case.
2. `GET /mc/device/registration` (polled every 5 s while unassigned)
   - Auth header (`Bearer <tabletToken>`?).
   - Response for unassigned vs assigned (machine id and label?), and for a
     tablet removed in the Portal. Recommended polling limits.
3. `PUT /mc/device/registration/password`
   - Request and response, password rules, and whether it is allowed after
     assignment.
4. `POST /mc/device/registration/session`
   - Request, and the response shape. Is it the same as today's pairing
     response `{ deviceId, deviceToken, machine: { id, label } }`?
   - Can it be called again after `DEVICE_TOKEN_REVOKED` to get a new
     deviceToken once the tablet is re-added?

## Revocation and removal

- Confirm `DEVICE_TOKEN_REVOKED` (HTTP 401 body `{ "code": ... }`) and the
  socket `session:ended` reasons still apply, and which reason means "removed
  in Portal, return to unassigned".
- Does removal also invalidate the tabletToken, or only the deviceToken?

## Unattended remote sessions

- The exact `access` field (`"unattended"` vs `"attended"`) on
  `GET /mc/device/remote-sessions/current` and on socket events.
- Is an unattended session returned with `status: "active"` immediately?
- Where `controlAllowed` comes from (current session `scope.control`, the
  `/connection` response, or both) and which one wins.
- Recording: is it automatic for unattended sessions, and how is it reported?
- The 10-minute inactivity end: still enforced by the backend for unattended?
- Any change to `/connection`, `/heartbeat`, `/end` or socket events.

## Test setup

- Staging base URL, and when it will be deployed.
- A Portal test account that can add a tablet by FIELD ID and start an
  unattended session, and sample JSON fixtures for each response above.
