# FIELD Machine

React Native Windows-first cab-tablet app. Current scope is the Phase 0 scaffold.
C++ Windows native sources are prepared; Windows build/runtime checks remain unverified.

Read [AGENTS.md](AGENTS.md) before making changes.
See [the plan](docs/PLAN.md) and [manual checks](docs/TEST_PLAN.md).

## Development

Use Node 22+ (`nvm use` if available), then:

```sh
npm ci
npm run typecheck
npm run lint
npm test -- --runInBand
```

On a Windows development machine with the RNW toolchain:

```sh
npm run windows
```

The Windows project is already prepared from the RNW `cpp-app` template. Do not
reinitialize it over the custom native code. Build it and run all Phase 0 checks
using [the Windows setup guide](docs/WINDOWS_PHASE_ZERO.md).

The Android template is retained for later phases. Phase 1 has not started.
