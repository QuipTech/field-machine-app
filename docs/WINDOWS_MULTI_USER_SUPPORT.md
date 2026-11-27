# Remote support across Windows users (LTSC test build)

Lets FIELD Portal support keep viewing and controlling a tablet when the
operator switches Windows users (for example Ant → Hemi), including the
sign-in screen, without asking for approval again.

## How it works

| Part | Runs as | Job |
|---|---|---|
| FIELD Machine app (`FieldMachine-LTSC2019-Pairing-x64.exe`) | The user who opened it | Pairing, approval prompt, WebRTC to the Portal, uploads |
| Service (`FieldMachineDesktop.exe --service`) | SYSTEM, session 0 | Starts the agent in whichever session owns the screen |
| Agent (`--agent`) | SYSTEM, active session | Captures the input desktop (user or sign-in screen), injects control |
| Panel (`--panel`) | The signed-in user of that session | Drop/Browse files, Mic, Stop sharing |

1. The operator allows a Portal request in the app, as before.
2. If the service is installed, the app links to the agent instead of showing
   the screen picker. The agent confirms with the FIELD API that the session is
   active (`GET /mc/device/remote-sessions/current`) before sending frames, and
   rechecks every 30 seconds. Control needs Portal control scope plus the
   operator's **Allow with control access**.
3. The agent sends JPEG frames (about 8 per second, up to 1600 px wide). The
   app paints them on a canvas and streams it over the existing Kinesis WebRTC
   connection, so the Portal connection survives a user switch.
4. On a user switch the service starts a new agent in the new session. The app
   reconnects within about a second; the Portal sees a short pause. The new
   agent arms remote control on the first Portal input, and re-arms it when the
   screen size changes (for example on the sign-in screen). Input runs on its
   own thread attached to the active desktop.
5. Files from the panel are staged in the app's Portal transfer queue and sent
   with the existing `/mc/device/files` upload. Stop ends the Portal session.

No new FIELD API endpoints are used.

## Staying reachable

- The service starts the app (hidden, `--background`) for the user on screen
  after sign-in, and restarts it after a crash: 10 s, doubling up to 5 min if
  it keeps exiting within a minute.
- One app per tablet (global mutex). Opening it again shows the running window.
- Closing the window hides it to the tray; there is no Exit item. Sign-out
  and shutdown still end it.
- While on mains power the service keeps the tablet from sleeping. The display
  may still turn off; on battery normal sleep applies.
- Setup stops the service, then closes the app before replacing files.

## Security notes

- Pipes accept local users only, and each side checks the other's executable
  path in `C:\Program Files\FIELD Machine`, which only administrators can change.
- The device token reaches only the verified agent, and only in memory.
- Sharing continues into other users without a new prompt, as requested. The
  panel stays on top in every user with **Stop sharing**.

## Known limits

- One monitor only, as for existing control. Ctrl+Alt+Del is not sent.
- The app must stay open in the user who started the session. Switching users
  keeps it running; **signing that user out** ends sharing.
- The microphone uses the app's user. It may report unavailable while another
  user has the screen. Portal audio plays in the app's user only.
- Static screens still send frames, so expect steady local CPU use while sharing.

## Build

1. `node scripts/windows-tablet/buildCompatibilityBundle.cjs`
2. Build `windows/TabletCompatibility/CompatibilityProbe.vcxproj` Release x64
   with `FieldMachineCompatibilityApp=true` and `WebView2Sdk`.
3. Build `windows/DesktopHost/DesktopHost.vcxproj` Release x64.
4. Sign both EXEs, then run `scripts/windows-tablet/New-MachineSetup.ps1
   -App <app exe> -DesktopHost <FieldMachineDesktop.exe>` with `-SignTool` and
   `-CertificateThumbprint`.

## Tablet test

1. Close FIELD Machine in every user. Run
   `FieldMachine-Setup-x64-allusers.exe` and approve the administrator prompt.
2. In Ant, open **FIELD Machine** (new Start entry). The pairing is kept.
3. Send a Portal request with control. Choose **Allow with control access**.
   Expect no screen picker, the Portal view of the whole screen and the panel
   on the right edge.
4. From the Portal, open Start → account → **HEMI**. Expect the sign-in screen
   in the Portal, then click **Sign in**. Expect Hemi's desktop and the panel.
5. In Hemi, drag a PDF onto the panel, then use **Browse files…**. Confirm the
   panel status and the Portal receipt.
6. Press **Microphone: On** and record whether the Portal hears it.
7. Press **Stop sharing**. Expect the Portal session to end and the panel to close.
8. Record Diagnostics `remote:desktop` lines for any failed step.
9. Uninstall from **Apps & features → FIELD Machine**.
