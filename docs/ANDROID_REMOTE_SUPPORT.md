# Android remote support

Android shares the tablet screen with the Portal viewer over WebRTC and
applies Portal remote-control input through an accessibility service. It
uses the same session flow, streaming-credential API, KVS signaling rules,
and protocol v1 control messages as Windows
([WINDOWS_REMOTE_SUPPORT_PLAN.md](WINDOWS_REMOTE_SUPPORT_PLAN.md)).

## Architecture

| Concern | Windows | Android |
| --- | --- | --- |
| Peer and capture | WebView page with `getDisplayMedia` | `react-native-webrtc` 155.0.1 (MediaProjection) |
| Signaling | Page script (`screenPeerSignaling.ts`) | `startScreenPeer.android.ts` + `signalingMessages.ts` |
| UI | `ScreenPeer.windows.tsx` | `ScreenPeer.android.tsx` |
| Control input | C++ `SendInput` module | Kotlin `RemoteInputService` (AccessibilityService) |
| JS input adapter | `src/native/remoteDesktopInput.ts` (shared) | same file |
| Control hook | `useDesktopControl.ts` (shared) | same file |

- Android WebView has no `getDisplayMedia`, so the Windows page is not reused.
  Its signaling rules live inside page script, so the Android peer mirrors
  them in TypeScript: answer only `viewerClientId`, ignore malformed or
  oversized frames, queue ICE until the answer, resend the answer for a
  repeated offer, stop on `GO_AWAY`, signaling close, or viewer loss, and
  allow 5 s for a disconnected viewer to recover.
- Frame parsing and the base64 payload codec are pure and tested
  (`signalingMessages.test.ts`).
- Both native input modules are named `FieldMachineRemoteDesktopInput` and
  expose `start(owner)`, `reset(owner, end)`, and `apply(...)`, so
  `remoteDesktopInput.ts` and `useDesktopControl.ts` are platform-neutral.
  Android also has `isServiceEnabled()` and `openSettings()`, used through
  `src/native/remoteDesktopInputAccess.android.ts`.
- `RemoteSupportPackage.kt` registers the module and turns on
  react-native-webrtc's built-in `MediaProjectionService`. The library starts
  that `mediaProjection` foreground service after the operator accepts the
  system dialog, as Android 14+ requires.

## Consent and lifecycle

1. The operator approves the Portal request (`RemoteRequestPrompt`). Control
   is allowed only if the operator allows it and the session scope and the
   connection's `controlAllowed` permit it.
2. The tablet requests streaming credentials and shows **Share screen**.
   Capture never starts until the operator taps it. Android then shows its
   own screen-capture dialog. On Android 14+ the dialog only offers the
   entire screen, so control coordinates match the display.
3. Microphone sharing is an opt-in switch (off by default) and needs the
   microphone permission. Support audio from the viewer plays on the tablet.
4. Capture, the peer, and input stop on **End remote access**, **Stop
   sharing**, a dropped tablet socket, an unconfirmed heartbeat, signaling
   expiry, viewer loss, or when Android stops the projection.
5. Input is applied only while sharing, connected, control-consented, and
   the accessibility service is enabled. Held touches and modifier keys are
   released on reset, channel close, viewer disconnect, and End.
6. The 10-minute inactivity end and one-session rule are enforced by the
   existing session flow, as on Windows.

## Permissions (AndroidManifest.xml)

| Permission | Purpose |
| --- | --- |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PROJECTION` | Capture foreground service |
| `POST_NOTIFICATIONS` | Capture notification (requested at Share; capture works if declined) |
| `ACCESS_NETWORK_STATE` | WebRTC network monitoring |
| `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS` | Optional microphone, audio routing |
| `BIND_ACCESSIBILITY_SERVICE` (service guard) | Only Android can bind the input service |

## One-time tablet setup (remote control)

Viewing works without setup. For control:

1. Open **Remote Support** and tap **Open accessibility settings**.
2. Choose **FIELD Machine remote control** under Downloaded apps, turn it
   on, and accept the warning.
3. Android 13+ with a sideloaded APK: if the switch is greyed out ("Restricted
   setting"), open **Settings > Apps > FIELD Machine**, use the menu (⋮) to
   choose **Allow restricted settings**, then repeat step 2.
4. Return to FIELD Machine. The Remote Support card should say remote control
   is set up.

## Input mapping (protocol v1)

| Portal input | Android action |
| --- | --- |
| Pointer down/move/up (primary) | One continued touch stroke: tap, drag, long press |
| Pointer cancel | Touch lifted at the last point |
| Secondary button | Long press (700 ms) |
| Middle button | Rejected |
| Wheel | Short swipe in the opposite direction, held before lifting to avoid flings |
| Text | Inserted into the focused field (`ACTION_SET_TEXT`) |
| Letters, digits, punctuation, Space | Inserted as US-layout characters (Shift respected) |
| Backspace / Delete | Delete before / after the cursor or the selection |
| Enter | Newline in multi-line fields; `ACTION_IME_ENTER` on Android 11+ |
| Tab / Shift+Tab | Move input focus forward / back |
| Arrow keys, Home, End | Move the cursor (Up/Down by line) |
| Ctrl+A / C / X / V | Select all / copy / cut / paste the tablet clipboard |
| Escape | Back |
| Any Ctrl+Alt chord (e.g. Ctrl+Alt+Delete) | Blocked, as on Windows |

Normalized `x`, `y` map to the real display size, the same metrics
react-native-webrtc uses for the captured frame.

## Limitations

- Android does not allow arbitrary key injection. F-keys, Insert, PageUp/Down,
  Alt and Meta shortcuts, and keys with no focused editable field are
  rejected. Characters follow a US layout.
- Password fields may hide their text, so editing keys can misplace the cursor.
- The lock screen, system dialogs (including the capture dialog), and apps
  that set `FLAG_SECURE` may block gestures or show black video.
- Remote control requires Android 8.0+ (continued gestures).
- The accessibility service has no description text: Android requires a
  string resource for it, which belongs in `res/values` (not yet changed).
- Google Play restricts AccessibilityService use to accessibility purposes.
  Remote-support control likely needs a policy declaration or distribution
  outside Play (MDM or sideload). Confirm before a Play release.
- Automatic transport recovery is not implemented. The operator taps
  **Retry screen sharing**.

## Manual test steps

Use the paired staging tablet (Ht-667) and a Portal user with `mc.remote`.

1. Launch the app. It opens paired, and the Remote Support tab shows the
   setup card. Complete the one-time setup above.
2. Start a session from the Portal with control. Allow it on the tablet,
   including control.
3. Tap **Share screen**, confirm the Android dialog, and check that the
   Portal shows live video and the capture notification appears.
4. From the Portal: tap an icon, drag a list, long-press, scroll vertically
   and horizontally, type into a text field, paste text, press Backspace,
   Enter, Tab, and Escape (Back). Try Ctrl+Alt+Delete (no effect).
5. Repeat with view-only consent. Video works and input is ignored.
6. Tap **End remote access** during a drag. Video stops, the touch lifts, and
   the notification disappears. Also test **Stop sharing**, airplane mode,
   and cancelling the Android dialog (capture stays off).
7. Turn the accessibility service off during a control session. Input stops
   and the card links back to settings.
8. Check the session diagnostics (`[machine-session]` in logcat) for
   `remote:*` events. They hold no credentials, URLs, or input contents.
