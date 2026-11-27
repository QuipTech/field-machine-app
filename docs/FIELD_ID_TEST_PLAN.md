# FIELD ID access — Windows tablet test plan

Build: `FieldMachine-Setup-x64-fieldid.exe` (staging). Contract:
[API_TABLET_ACCESS.md](API_TABLET_ACCESS.md). Needs the Portal test account
(Owner or Organisation Admin) and an active machine with no tablet.

Record for each case: pass/fail, time, and **Settings → Diagnostics** lines
(`access`, `remote:check`, `remote:desktop`, `session:*`). Diagnostics never
show passwords, tokens, signed URLs or ICE credentials.

| # | Case | Steps | Expected |
| --- | --- | --- | --- |
| 1 | Fresh install | On a tablet with no FIELD Machine data (`%ProgramData%\FIELD Machine` absent), run setup | App starts hidden in the tray; open it: FIELD ID (`### ### ###`), password, "Waiting to be added" |
| 2 | Change password | While waiting, change the password | "Password changed"; the new one is shown |
| 3 | Add in Portal | Machine app tab → add tablet with FIELD ID + password | Within ~5 s: machine name shown, password gone, header Connected |
| 4 | Reboot, connect untouched | Reboot, sign in, touch nothing; connect from Portal with control | App starts by itself; streaming starts with no prompt; panel shows "Remote session active · Recording"; Portal can click and type |
| 5 | View only | Connect with View only | Picture streams; Portal input has no effect |
| 6 | User switch | During a session, switch to another Windows user from the Portal | Sign-in screen then the other desktop are visible and controllable |
| 7 | End session | Press **End session** on the panel, then repeat from the Portal | Session ends on both sides; panel closes |
| 8 | Network loss | Unplug network for 2 min during idle, then during a session | Header Reconnecting; after reconnect, Connected; a new Portal connect works |
| 9 | Remove and re-add | Portal: remove the tablet | Tablet returns to "Waiting to be added" with the same FIELD ID and no password; **Register as a new tablet** is offered; re-add needs the password (or a new FIELD ID) |
| 10 | Upgrade a paired tablet | Install over a build paired with a 6-digit code | Same machine stays connected; FIELD ID and password shown in Settings until **I have recorded the password** |
| 11 | Crash restart | End the app in Task Manager | Back within ~10 s, still connected |
| 12 | Sleep on power | Leave on mains overnight | Still reachable in the morning |

Known limits: local touch is not reported as `interacted`, so 10 minutes
without Portal input ends a session; one monitor only; Ctrl+Alt+Del is never sent.
