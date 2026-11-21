# FIELD Machine file transfer handoff

Use the [client requirements](CLIENT_REQUIREMENTS.md) for acceptance. The
Windows tablet currently has a Files section and manual **Send to Portal**
document uploads. The Windows delivery worker uses the backend-supplied polling,
signed file URLs, and status contracts. Live acceptance requires staging access.

## Existing tablet upload

- The paired Windows tablet can select, confirm, and queue PDF, DOC, DOCX,
  JPG, JPEG, PNG, and HEIC files up to 20 MiB each. It shows progress and retries
  the whole file with the same transfer ID.
- The tablet uses the documented `POST /mc/device/files` contract. Confirm that
  staging has the required migration, that replaying a transfer ID returns the
  original receipt, and that the uploaded file appears under the paired machine
  and site in the portal. See [API_NEEDED.md](API_NEEDED.md).

## Backend and portal follow-up

The supplied delivery contract is in [API_NEEDED.md](API_NEEDED.md). The
[disconnect handoff](PORTAL_DISCONNECT_HANDOFF.md#design-delivery-backend-follow-up)
records the remaining staging, replay, and returned-file questions.

## Tablet behavior

1. Poll after session validation, upon reconnect, and every 10 seconds while
   idle. Resume partial files, renew signed URLs, and verify length and SHA-256.
2. Keep deliveries inside app-managed project storage. Commit the active project
   pointer and its pending status together. Keep the previous version directory
   intact. Resending a version from the Portal activates that delivery's manifest.
3. Show active project folders and delivery status in Files. Replay an outstanding
   terminal status after restart before polling for more work.
4. Operator-triggered machine export uploads and scheduled returns await the
   existing pull upload contract.

## Joint acceptance

Use a paired Windows tablet and a staging portal. Send DXF, LandXML,
localisation, and configuration files to one machine, several machines, and
a site. Compare the replacement preview and status with the actual result on
each tablet. Interrupt 4G mid-download and verify resume, then try a file with
a bad checksum and verify it never replaces the installed version. Roll back
one machine and check both versions in the portal. Return an as-built or export
manually and on schedule and check its machine and site association.
