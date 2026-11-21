# FIELD Machine Phase 1 — team response document

Please return this document with answers, examples, and supporting links.
Each team should fill its section and mark unknown items as TBD with an owner.
Do not put passwords, tokens, AWS secret keys, or production credentials here.
Provide secrets separately through an agreed secure channel.

## Scope and current status

Phase 1 covers Windows machine-tablet pairing, connection, delivery, and history.
The existing FIELD Portal, Mobile app, and Backend remain separate projects.
Phase 0 passed on the user's Windows laptop by reported evidence; see
[TEST_PLAN.md](TEST_PLAN.md) for results and outstanding device/failure checks.
No Phase 1 endpoint paths or payloads have been confirmed in this repository.
No integration implementation should infer missing contracts from this form.
Remote support, chat, file browsing, and pull belong to Phase 2.

## Response details — all teams

- Team / responder:
- Technical contact:
- Response date / contract version:
- Documentation or source references:
- Existing behavior versus changes required:
- Unresolved questions, owner, and expected answer date:
- Staging readiness date:

## Backend team — environments and authentication

- Exact staging REST base URL and API version prefix:
- Exact production REST base URL and API version prefix:
- Staging access requirements (VPN, certificates, allowlists):
- How developers receive staging credentials securely:
- Device, machine, organisation, and brand identifier formats and relationships:
- How machine credentials differ from Portal/Mobile user credentials:
- Access/refresh token format, expiry units, clock tolerance, and rotation rules:
- Revocation behavior and required tablet action after revocation:
- Standard error body, error codes, request IDs, and retry/rate-limit headers:
- Timeout and retry expectations, including idempotency support:

### Fill this contract template for each allowed Phase 1 endpoint

Copy this block into a separate response attachment per endpoint if needed.
Required categories: pairing, token refresh, IoT credentials, delivery status,
and events. State whether pairing requires multiple requests within its flow.
These are categories, not approved URL paths or invented API contracts.

- Endpoint category / purpose:
- Exists today? If not, responsible owner and readiness date:
- Exact HTTP method and path:
- Required headers and authentication:
- Exact request JSON, field types, required/optional fields, and constraints:
- Exact success status and response JSON, including nullable fields:
- Failure status codes and example response JSON:
- Expiry / pagination / ordering rules where applicable:
- Idempotency key and duplicate-request behavior:
- Retryable versus terminal failures:
- Sanitised staging request/response example or OpenAPI reference:

If another endpoint is necessary, list its purpose and owner for clarification
before implementing it. Do not assume new listing, polling, or logout endpoints.

### Pairing workflow

- Who generates the pairing code, who enters/scans it, and on which device:
- Code format, case sensitivity, expiry, attempt limits, and one-time use rules:
- Exact sequence from unpaired tablet to confirmed machine association:
- How the tablet learns pairing is complete using the allowed contracts:
- How organisation/machine/brand selection is authorised:
- Credentials returned to the tablet and their secure-storage requirements:
- Device metadata required at pairing and how each value is obtained:
- Expected behavior for already-paired machines, replacement, and re-pairing:
- Revoked/expired pairing and interrupted setup recovery:

### AWS IoT connection and MQTT

- Confirm AWS region `ap-southeast-2`:
- Exact staging and production IoT hostnames:
- Confirm MQTT over secure WebSocket on port 443; exact WebSocket path:
- Authentication/signing mechanism and credential response schema:
- Temporary credential lifetime and refresh rules:
- Client ID format and permitted publish/subscribe topic patterns:
- Exact command and acknowledgement JSON examples with schema versions:
- QoS, retained-message rules, keepalive, and session expiry/clean-session rules:
- Presence/heartbeat and last-will topics, payloads, and intervals:
- Duplicate/out-of-order handling, command IDs, expiry, and acknowledgement rules:
- Reconnect behavior and how missed deliveries are recovered without new APIs:
- Authorisation scope preventing cross-machine access:

### Delivery and S3 downloads

- Complete delivery command example, including delivery ID and machine ID:
- Brand and target-folder mapping keys; filename and subfolder rules:
- File size, SHA-256 format, content type, and immutable file/version identity:
- How each presigned download URL is provided and its expiry is represented:
- Supported HTTP Range behavior, ETag/version checks, and resume expectations:
- How an expired URL is renewed within the allowed contracts:
- Delivery status values, valid transitions, progress units, and error codes:
- When a delivery is considered installed and how completion is acknowledged:
- Duplicate delivery, cancellation, retry, and existing-file `.bak` rules:
- Partial failure policy for deliveries containing multiple files:
- Safe behavior if the target application is using or locking a file:
- Sanitised successful and failing staging delivery fixtures:

### History and event reporting

- Required event names and exact event JSON examples:
- Required IDs, UTC timestamp format, severity, and allowed metadata:
- Event IDs/idempotency, ordering, batching, and acknowledgement behavior:
- Offline queue limits, retry expectations, retention, and redaction rules:
- Whether history is local-only or must be restored from server records:
- If server history needs another endpoint, list it for scope clarification:

## FIELD Portal team

- Current pairing screens/flow and sanitised screenshots:
- Where pairing codes originate, appear, and are confirmed:
- How authorised users choose organisation, machine, and brand:
- How deliveries are created and assigned to a machine:
- File metadata and target-folder keys sent through the backend:
- Exact delivery statuses/progress/errors the Portal expects to display:
- Meaning of online/offline and heartbeat timeout used by the Portal:
- History events the Portal expects and display/retention requirements:
- Existing interface contract references; proposed Portal changes and owner:
- Staging test organisation/machine setup and coordinated test contact:

## FIELD Mobile app team

- Does the Mobile app participate in machine-tablet pairing? Describe how:
- Relevant pairing screens and sanitised request/response examples:
- Existing identifier, brand, status, and error definitions we must match:
- Whether it can trigger deliveries or display machine connection/history:
- Shared API contract references and token lifecycle behavior:
- Existing reconnect, duplicate-command, and delivery failure expectations:
- Conflicting assumptions with Backend/Portal contracts and proposed owner:
- Staging test flow and coordinated test contact:

## Product / machine owner — required decisions

- Supported brands and exact approved Windows folder roots for each brand:
- Allowed file extensions, nested folders, filename rules, and size limits:
- Real hardware/path verification evidence; mark unverified paths explicitly:
- Whether installation needs operator confirmation or runs automatically:
- What happens if a delivery arrives while the machine is working:
- Backup retention and behavior when a `.bak` file already exists:
- History retention and permitted storage use on the tablet:
- Pairing UX preference and available tablet keyboard/scanner:
- Windows staging device, OS version, and person available for native testing:
- Secure credential-sharing method and access owner:

## Joint acceptance scenarios

For each scenario provide staging inputs, expected results, and a test owner.

1. Pair successfully; reject an invalid/expired code and incorrect machine scope.
2. Restart the tablet and restore its securely stored paired identity.
3. Refresh expired credentials; handle revoked credentials without retry loops.
4. Connect MQTT; report offline clearly and reconnect without duplicate installs.
5. Receive a delivery; validate its destination and download its file.
6. Resume an interrupted download and recover an expired presigned URL.
7. Reject SHA-256 mismatch, path traversal, and an unauthorised brand root.
8. Preserve the existing file as `.bak`; handle locks, low disk, and permissions.
9. Report delivery success/failure and retain history through an app restart.
10. Queue events offline and resend without duplicate history records.

## Implementation sequence after answers are returned

1. Resolve TBDs; record exact approved requests/responses in `API_NEEDED.md`.
2. Present the file-by-file plan and verify Windows/Android library support.
3. Add pairing UI, shared state, validated forms, and secure Windows storage.
4. Add token refresh, MQTT connection, and validated command handling.
5. Add safe resumable downloads, SHA-256 checks, backups, and persisted history.
6. Run portable checks and Windows native/integration tests with staging inputs.

Candidate libraries are Zustand, React Hook Form, Zod, and an MQTT transport.
Versions and platform compatibility are not yet verified; none is added by this
document. Planned native work is C++ Windows PasswordVault credential storage
and production file-transfer/history operations behind shared native contracts.
Android implementation remains Phase 4; shared interfaces must accommodate it.
