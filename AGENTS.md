# FIELD Machine — Project Rules

Read this file before planning or changing this repository. Read `CLAUDE.md`
first if it exists, and follow any applicable instructions in nested folders.
These rules apply to all future work in this repository.

- Communicate with the user in English or Roman Urdu (Latin script).
- Read [the client requirements](docs/CLIENT_REQUIREMENTS.md) before working
  on the FIELD Machine tablet app. Follow the Files acceptance checks there
  when the workflow is ready for end-to-end testing.

## Scope and delivery

- Build FIELD Machine, the earthmoving machine cab-tablet app.
- Work only in this repository. Do not modify the existing FIELD mobile app,
  Next.js portal, or NestJS backend.
- Target Windows first, then Android, using one React Native codebase.
- Before implementation, present the plan, proposed libraries with verified
  platform support, native modules, and files to create.
- Complete Phase 0 and report its results before starting later phases.
- Never report a build, test, native capability, or device check as passing
  unless it actually ran successfully. State blocked checks clearly.
- The attached setup transcript is historical context, not proof that files
  exist or that a version or platform capability is currently supported.

## File size and readability

- Every hand-written source, test, configuration, and Markdown file must stay
  at or below **200 total lines**, including comments and blank lines.
- Split a growing file by responsibility before it exceeds this limit.
- Do not compress code, remove useful spacing, or hide logic to meet the limit.
- Generated projects, lockfiles, generated bindings, and third-party files are
  exempt. Do not manually split tool-generated files; identify exceptions.
- Give each file one clear purpose and keep functions focused and easy to read.
- Prefer explicit, straightforward code over clever abstractions.
- Use arrow functions (`const name = () => { ... }`) for hand-written JavaScript
  and TypeScript functions, React components, hooks, helpers, and callbacks.
  For async functions, use `const name = async () => { ... }`. Declare functions
  before use. Declare the primary function/component as a named `const`, then
  add `export default name;` at the bottom of its file. Use default imports for
  these exports; shared types/interfaces may remain named exports. Native
  C++/Kotlin methods and generated configuration follow their own syntax.
- Use early returns where they reduce nesting. Explain non-obvious decisions
  in comments; avoid comments that merely repeat the code.
- Remove unused imports, dead code, and temporary debugging output.

## Reuse and separation of concerns

- Search for existing components, hooks, helpers, and types before adding new ones.
- Reuse repeated UI and behavior instead of copying implementations.
- Keep feature-specific reusable code inside its feature. Move it to a shared
  folder when multiple features need it.
- Extract code with a clear responsibility; avoid speculative frameworks or
  generic abstractions for a single simple use case.
- Keep screens focused on composition and user interaction.
- Put business rules in features, network transport in services, platform
  access in native adapters, and environment values in config.
- Do not call native modules or duplicate API requests throughout UI components.
- Keep dependencies flowing from screens/features to shared services and native
  interfaces. Shared code must not import screens or create circular imports.

## Folder ownership

```text
src/
  app/          Navigation, providers, application composition
  screens/      Pairing, Home, Deliveries, Files, Support, Settings, Diagnostics
  features/     pairing, connection, delivery, pull, support, history
  components/   UI components used by multiple features
  hooks/        Hooks used by multiple features
  utils/        Pure helpers used by multiple features
  types/        Types shared across features
  native/       Shared JS contracts and platform adapters
  services/     API, MQTT, S3 transfer, WebRTC transport
  config/       Brand profiles and staging/production configuration
windows/        Generated RNW project and Windows native implementations
android/        Generated Android project and Kotlin native implementations
docs/           PLAN.md, API_NEEDED.md, TEST_PLAN.md and supporting guides
```

- Create folders only when they contain needed code; do not add empty scaffolding.
- A feature may contain its own components, hooks, types, services, and tests
  when needed. Do not duplicate shared services inside features.
- Keep `App.tsx` as a small composition entry point.
- Avoid vague dumping grounds such as `misc/`, `common.ts`, or `helpers.ts`.

## Naming

- Use lowercase names for structural folders: `features`, `services`, `config`.
- Use kebab-case for multiword feature folders, such as `remote-support`.
- Use PascalCase for React component files and components: `StatusBadge.tsx`.
- Name screen files explicitly: `PairingScreen.tsx`, `DiagnosticsScreen.tsx`.
- Use camelCase and the `use` prefix for hooks: `useConnectionStatus.ts`.
- Use descriptive camelCase for helpers and services: `mapTargetFolder.ts`,
  `apiClient.ts`, `deliveryService.ts`.
- Keep native contract names aligned with their modules: `FileSystem.ts`,
  `ScreenCapture.ts`, `InputControl.ts`.
- Use `.windows.ts` / `.android.ts` (or `.tsx`) for platform implementations
  when appropriate, exposing the same shared interface.
- Use PascalCase for types/interfaces, camelCase for functions/variables, and
  UPPER_SNAKE_CASE for module-level fixed constants.
- Use `is`, `has`, `can`, or `should` for boolean names.
- Name tests after the subject: `mapTargetFolder.test.ts` or `StatusBadge.test.tsx`.
- Preserve generated platform naming conventions. Do not rename generated
  files merely to match application naming rules.

## TypeScript and application state

- Use strict TypeScript. Avoid `any`, unchecked casts, and non-null assertions;
  narrow unknown values and handle missing data explicitly.
- Define clear types for native contracts, API payloads, and MQTT commands.
- Validate untrusted input at boundaries, using Zod where appropriate.
- Use Zustand for shared application state and local React state for local UI.
- Use React Hook Form with Zod for forms.
- Use a shared fetch wrapper with token refresh for REST requests.
- Keep loading, empty, error, retry, and offline states understandable.

## Platform and dependency rules

- Keep React Native and react-native-windows on the same supported minor version.
- Use the RNW new architecture `cpp-app` template. If it blocks a required native
  capability, report the evidence and propose a fix before switching architecture.
- Verify Windows and Android support before adding any library. Wrap unsupported
  platform behavior behind a shared interface and document limitations.
- Use C++ for Windows native modules and Kotlin for Android native modules.
  The user approved C++ with `cpp-app` because RNW new architecture lacks C# support.
- Shared native interfaces belong in `src/native/`: SecureStore, FileSystem,
  ScreenCapture, InputControl, BackgroundService, and DeviceInfo.
- Keep platform details behind adapters instead of spreading platform checks
  throughout screens and business logic.
- Keep credentials out of source code and logs. Store device credentials only
  through SecureStore (Windows PasswordVault / Android Keystore).

## FIELD integration and safety

- Use the existing FIELD REST API and AWS region `ap-southeast-2`.
- Use MQTT over WebSocket on port 443, S3 presigned transfers, and Kinesis Video
  Streams WebRTC as specified in the project requirements.
- Before API implementation, document exact proposed requests and responses in
  `docs/API_NEEDED.md`; identify assumptions that need backend confirmation.
- Use only the specified pairing, token refresh, IoT credentials, delivery status,
  pull upload, session accept/decline/end, KVS credentials, and events endpoints.
  If another endpoint is required, list it and stop that work for clarification.
- Restrict file access to configured brand roots. Validate resolved paths and
  reject traversal or access outside allowed folders.
- Keep brand folder mappings in config, not scattered through feature code.
- Treat unconfirmed device paths as assumptions until checked on real hardware.
- Make transfers resumable, verify SHA-256 before installation, and preserve an
  existing file as a `.bak` instead of silently overwriting it.
- Start remote viewing/control only after explicit operator acceptance.
- Show an active-session bar with an End action, allow one session at a time,
  and end control on operator request or after 10 minutes of inactivity.
- Record pairing, delivery, pull, session, and error events for machine history.

## Build order and verification

1. Phase 0: verify Windows launch, external-folder read/write, whole-screen
   capture, and a SendInput click. Report results before proceeding.
2. Phase 1: Windows pairing, connection, delivery, and history.
3. Phase 2: Windows file browsing/pull and remote support with control/chat.
4. Phase 3: Windows MSIX and workshop-tablet validation.
5. Phase 4: Android native modules, permissions, background service, and APK.
6. Phase 5: reconnect/offline hardening and large-file tests up to 500 MB.

- Test behavior and failure cases, especially SHA-256 verification, chunk resume,
  brand folder mapping, and MQTT command parsing.
- Keep a manual Windows/Android feature test plan in `docs/TEST_PLAN.md`.
- Run relevant available type, lint, and test checks after implementation changes.
- Run platform builds and device checks where the required toolchain is available.
- Before finishing, check file sizes, duplication, naming, folder placement,
  boundary validation, and relevant documentation updates.
- Report what changed, what was verified, and any remaining blockers.
