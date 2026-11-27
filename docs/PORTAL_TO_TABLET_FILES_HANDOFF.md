# Backend/Portal handoff: send files to the tablet from a remote session

Goal: during a remote session, a Portal user can send any file to the tablet,
just as the tablet can already send files to the Portal (`POST /mc/device/files`).

## Proposal: reuse design delivery (no new tablet endpoint)

The tablet already receives Portal files through design delivery
([API_NEEDED.md](API_NEEDED.md#design-deliveries-and-returned-machine-files)):
`GET /mc/device/designs/next`, `GET …/{deliveryId}/files/{index}` (presigned
HTTPS URL, resumable with `Range`) and `PATCH …/{deliveryId}` status. It checks
SHA-256 before installing, keeps any existing file as `.bak`, and shows the
files in its Files tab. It polls every 10 s.

Please confirm or add on the Portal/backend side:

1. **Send to tablet** in the Portal remote-session window (drag and drop or
   browse). It creates a delivery to that one machine with any file type, for
   example project `Remote session files` and a new version per send.
2. Allowed file types and maximum size per file and per delivery.
3. The delivery shows in the machine's History (sender, files, time) and the
   Portal shows Waiting / Downloading / Arrived / Failed for it.
4. Optional, faster pickup: a socket event on the device room when a delivery
   is created (name and payload, e.g. `design:available { deliveryId, machineId }`).
   The tablet would check `…/designs/next` at once instead of within 10 s.

If the backend prefers a separate "session files" route instead of design
delivery, send its method, path, auth, request/response JSON, errors and
limits first; the tablet will not call any undocumented endpoint.

## Tablet behaviour today

- Delivered files appear in **Files** under their project and open in Explorer.
- During a remote session the on-top panel shows
  `Received from Portal: <project> (open the Files tab)` when a delivery arrives.
