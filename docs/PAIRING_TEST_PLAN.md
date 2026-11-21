# Windows pairing verification

## Scope

Pairing, secure save/restore, Socket.IO presence, and session revocation.
Delivery, persistent history, and remote support remain unimplemented.
See SESSION_TEST_PLAN.md for live-session checks and current evidence.

## Run on Windows

1. Use Node 22.11+ and run `npm ci`.
2. Run `npm start`, then `npm run windows`; use the existing manual launch
   procedure in [Windows Run.md](<Windows Run.md>) if CLI launch fails.
3. Confirm the pairing screen opens and Diagnostics still opens Phase 0.
4. In the staging Portal generate a code for a dedicated test machine.
5. Select **Pair this tablet**, enter the code as `123 456`, and submit.
6. Confirm successful pairing shows the correct machine label.
   Confirm the code popup closes and the top **Diagnostics** button stays visible.
   Open Diagnostics, scroll to the bottom, and confirm **Back to pairing** stays
   visible. Select it; confirm the paired machine remains and Diagnostics returns.
   Check both labels are readable, including while Windows uses a dark theme.
7. Close and reopen the app. Confirm the saved pairing and machine label return.
   Repeat the Diagnostics/Back check, including with a small app window.
8. Confirm no screen capture, input control, or remote session starts.
9. Confirm no token appears in UI, logs, or ordinary application files.

## Failure checks

- Fewer/more than six digits or letters: validation error; no network request.
- Wrong/expired/used code: clear server error; no successful pairing shown.
- More than five attempts per minute: wait message; no automatic retry.
- Network loss or timeout: uncertain-outcome message; check Portal before retry.
- Secure read failure: pairing blocked; retry reading instead of overwriting data.
- Secure save failure after success: keep app open; retry saving without another
  pairing request. Closing before saving loses the in-memory one-time token.
- Restart while offline: saved pairing appears with no claim of server validation.
- Portal disconnect: validated end event or revoked-token response clears pairing.

## Storage notes

The complete pairing response is saved through the shared SecureStore contract.
Windows implements it with PasswordVault; Android currently reports unavailable.
The credential resource includes the computer name and staging environment.
Renaming the computer or changing Windows user can make the record unavailable.
PasswordVault may roam with Windows account settings; this is not a hardware
identity guarantee. Review account configuration for workshop tablets.
**Disconnect tablet** sends authenticated DELETE `/mc/device/session` first.
After confirmed success or revoked-token 401, it removes this tablet's
PasswordVault record and returns to code entry. Portal-initiated revocation
still performs local cleanup without sending another DELETE.
Verify a restart stays unpaired, a new Portal code can pair, and secure deletion
failure clears in-memory pairing, blocks new pairing, and offers secure-cleanup
retry. Restart may reread the undeleted credential, but must validate it first.

If an older installed build lacks native secure deletion, the app should show
instructions to rebuild using `npm run windows`, blocking re-pairing until cleanup.
Restarting Metro or reloading JavaScript does not update the C++ module.
After rebuilding, retry secure cleanup and verify restart stays unpaired.

## Tablet disconnect acceptance

- Pair a dedicated staging machine, select Disconnect tablet, and observe the
  DELETE HTTP status privately. Client currently assumes 200/204 means completed;
  backend supplied only method/path/auth. Confirm actual deployed response.
- Confirm Portal pairing changes to disconnected and restart stays unpaired.
- Offline/timeout/5xx/generic 401: retain saved auth and offer explicit retry.
  A lost response may mean server disconnect succeeded; next validation or a
  revoked-token DELETE response must complete cleanup without pairing again.
- Repeated clicks while disconnecting send one DELETE. The socket and validation
  timer stop before the request; no new pairing is allowed until completion.
- Secure deletion failure after server success offers cleanup retry without
  repeating DELETE. Old responses cannot overwrite a replacement pairing.
- Native storage and Portal/backend behavior require actual device testing;
  automated checks use mocks. Portal's live presence remains a separate contract.

## Portable checks

Tablet DELETE implementation checks on 2026-11-17:

- TypeScript and ESLint passed; Jest passed 17 suites / 79 tests.
- Windows Debug/x64 build passed with deployment skipped (disconnect-build.log).
- Windows Metro bundle and assets passed (disconnect-bundle.log).
- Added REST success/failure/timeout, ordered cleanup, retry, stale-response,
  pending-DELETE socket-stop, and Disconnect tablet UI tests. Requests/storage mocked.
- No live authenticated DELETE was executed. Actual response, Portal update,
  native credential deletion, and restart acceptance remain unverified.
- No native changes or new dependencies. Existing deployment blocker was Windows
  Developer Mode; this build does not establish that deployment now works.

Use `npm run typecheck`, `npm run lint`, and
`npm test -- --runInBand --watchman=false` where Watchman is unavailable.
Tests mock network and secure storage; they do not prove native behavior.
Record actual Windows results and evidence here after running the steps above.

## Error fix verification — 2026-11-17

- TypeScript and ESLint passed; Jest passed 8 suites and 33 tests.
- Added coverage for an older native module missing `remove` and for delegation
  to the updated native deletion method. Tests mock native storage.
- Windows Debug/x64 solution build passed; see `pairing-rebuild.log`.
- CLI deployment stopped with `EnableDevModeFailure: Enabling Developer Mode`.
  Installation and deletion/restart checks remain unverified for this rebuild.
- Enable Windows Developer Mode, close the running app, and rerun
  `npm run windows -- --arch x64 --no-packager`, then repeat deletion/restart.

## Implementation verification — 2026-11-12

- Jest: 7 suites, 29 tests passed with Watchman disabled.
- TypeScript and ESLint: passed.
- Windows project XML parses; hand-written files are within 200 lines.
- Windows compilation, PasswordVault runtime, actual staging pairing, and
  restart on Windows: pending; not executable on this macOS host.
- Dependencies installed: React Hook Form 7.92.0, Zustand 5.1.0, Zod 4.6.7.
  These have no native module linkage; shared React/JavaScript support was
  reviewed in their official documentation. Device execution remains unverified.
