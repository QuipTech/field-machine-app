# Run FIELD Machine on Windows

## 1. Install tools

Use the Windows laptop for builds; the Mac can edit and transfer source files.
Enable Developer Mode in Windows Settings.
Install Git, Node.js 22.11 or newer, and Visual Studio Community 2026
18.6.1 or newer. VS Code is an optional editor, not the native build toolchain.
The successful laptop setup used Visual Studio 18.12 and MSVC 14.52.37025.

In Visual Studio Installer select:

- Desktop development with C++, including MSVC v145 x64/x86 tools.
- .NET desktop development.
- WinUI application development, including C++ WinUI app development tools.
- Windows SDK; the successful build used 10.0.22621.0.

If MSIX Packaging Tools is available, select it. On the tested installer it
was not searchable separately; installing WinUI tools supplied DesktopBridge.

## 2. Prepare the project

Extract the repository if downloaded as ZIP. Keep the windows folder and
package-lock.json. Do not copy node_modules from macOS.
Open the folder containing package.json in File Explorer, type powershell in
the address bar, and press Enter. Commands below use the tested laptop path;
replace it if your folder differs. Quote paths containing spaces.

```powershell
cd "C:\Users\Ethereal Gear\Downloads\FIELD-Machine-Mobile"
node --version
npm --version
npm ci
```

If npm.ps1 is blocked, use npm.cmd instead of npm.
Do not run windows:init: it can replace custom native project entries.

## 3. Check prerequisites

Close Visual Studio. In PowerShell as Administrator:

```powershell
cd "C:\Users\Ethereal Gear\Downloads\FIELD-Machine-Mobile"
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\node_modules\react-native-windows\Scripts\rnw-dependencies.ps1
```

Follow installation prompts. Reopen terminals after installation; restart if
requested. The script reporting requirements met did not guarantee packaging
support on the tested laptop. Verify the missing-file issue directly:

```powershell
Test-Path "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\DesktopBridge\Microsoft.DesktopBridge.props"
```

Expect True. If False, modify the Visual Studio installation and install the
WinUI workload with C++ tools. This addresses MSB4019 for DesktopBridge.props.

## 4. Inspect the solution and run checks

Open windows/FieldMachine.sln in Visual Studio. Allow package restore.
Select Debug / x64 for the tested Intel/AMD configuration.
NuGet restore does not require a permission popup. Manage NuGet Packages is
not the restore command; the CLI also runs restore during the build.

In normal PowerShell at the project root:

```powershell
npm run typecheck
npm run lint
npm test -- --runInBand
```

## 5. Start Metro

In the first normal PowerShell terminal:

```powershell
cd "C:\Users\Ethereal Gear\Downloads\FIELD-Machine-Mobile"
npm start
```

Leave it running. If already running for this project, reuse that terminal.

## 6. Build in a second terminal

The project must use stdcpp20 in FieldMachine.vcxproj. C++17 caused errors
at requires expressions in React Native bridging/Base.h.
The temporary coroutine compatibility option below was used during the
successful laptop build. _CL_ has underscores on both sides and appends flags.
It applies only to this terminal; it is not a global machine setting.

```powershell
cd "C:\Users\Ethereal Gear\Downloads\FIELD-Machine-Mobile"
Remove-Item Env:CL -ErrorAction SilentlyContinue
$env:_CL_ = "/await:strict"
npm run windows -- --arch x64 --no-packager --logging *> windows-build.log
Get-Content .\windows-build.log -Tail 30
```

Output is redirected, so silence is expected while building. Do not infer app
build success from the earlier restore-only Build succeeded message.

## 7. Launch if Appx lookup fails

The tested package deployed successfully, but the CLI then failed because
pwsh.exe could not load Appx/Get-AppxPackage. If deployment succeeded, keep
Metro running and search for FieldMachine in Start. Alternatively press Win+R:

```text
explorer.exe shell:AppsFolder\FieldMachine_5j9trthyx8z16!App
```

This identifier is from the tested package; it can change with publisher or
package identity. Do not use this workaround to claim a failed deployment passed.

## 8. Run Phase 0 checks

Create a dedicated folder such as Downloads/FieldMachineTest, containing
keep.txt with known contents. Enter the folder path, not the file path:

```text
C:\Users\Ethereal Gear\Downloads\FieldMachineTest
```

1. Test folder read/write. Expect Folder read/write and cleanup passed.
   Check keep.txt is unchanged and temporary test files are gone.
2. Start screen capture explicitly. Inspect the whole-primary-display snapshot,
   inspect again for increasing frame count, then stop and check the indicator.
3. Send one click to test target on an isolated desktop. Expect the dedicated
   target to confirm receipt. Its automatic closing afterward is expected.

Record results and outstanding negative checks in TEST_PLAN.md.

## 9. Known source fixes and troubleshooting

- FieldMachine.h contains only pragma once and the resource.h include.
  Resource-script LANGUAGE and ICON statements belong in FieldMachine.rc.
- FieldMachine.rc is now plain UTF-8 text with windows.h, resource.h, LANGUAGE,
  and the small.ico resource. Keep small.ico beside it. This fixes the resource
  compiler failures seen during setup. Do not paste this code into the header.
- STL1011 was encountered before the C++20/coroutine correction. The earlier
  deprecation-suppression macro was temporary and is not part of this run flow.
- Native rejection messages now display in the diagnostics result panel.
- Explicit Pressable/Text buttons replace labels that disappeared after clicks.
- Free disk space for native outputs and package downloads. 20–30 GB is a
  practical buffer, not a measured project minimum. Compiler errors shown during
  setup were not evidence of disk exhaustion.

Extract failures without reinstalling tools blindly:

```powershell
Select-String -Path .\windows-build.log -Pattern "error C|error RC|error MSB|error LNK" -Context 3,2 | Select-Object -First 5
```

## 10. Transfer changes from Mac

Copy updated source files to matching paths in the Windows repository.
JavaScript/TypeScript changes normally refresh through Metro; reopen the app
if needed. Native C++, resource, and project changes require rebuilding.
Do not overwrite working Windows files with an older Mac copy.
Windows compilation cannot run on this macOS development host.

## References

- [RNW setup](https://microsoft.github.io/react-native-windows/docs/rnw-dependencies)
- [MSVC coroutine options](https://learn.microsoft.com/en-us/cpp/build/reference/await-enable-coroutine-support)
## Windows x64 tablet installer

The staging pilot installer is generated in `artifacts/windows-tablet/`
by `scripts/windows-tablet/New-TabletSetup.ps1`. Build the solution in
Release x64 with bundling enabled and packaging set to `AppxBundle=Never`.
Pass the resulting MSIX, the Windows SDK SignTool path, and a code-signing
certificate thumbprint from CurrentUser/My to the packaging script.
The certificate subject must match the MSIX publisher.

Copy the setup EXE and public test certificate to the x64 test tablet.
If approved by its administrator, import the public certificate into
Local Computer > Trusted People. Run the EXE and open FIELD Machine from
Start. Confirm it starts with Metro stopped. The EXE includes the MSIX,
Windows App Runtime, and Visual C++ dependencies. WebView2 is required for
remote support. The current installer points at staging.

For side-by-side installation with the registered Debug app, pass
`FieldMachineTabletPilot=true` in the MSBuild properties. This builds
`FieldMachine.TabletPilot` with the Start menu name **FIELD Machine Pilot**.
Use `-SetupFileName FieldMachine-Setup-x64-pilot.exe` when wrapping the
pilot MSIX. The separate identity avoids the Windows package conflict
`0x80073CFB` without removing the Debug registration.

Local verification on November 22, 2026 confirmed both registrations and
the Pilot pairing screen with Metro offline. Open **FIELD Machine Pilot**
from Start to run the installed Release package.

Pilot 1.0.1.0 requires Windows build 18362 or later. The client tablet on
Windows 10 Enterprise LTSC build 17763 installed 1.0.0.0 but crashed at
startup. Its OS must be upgraded before testing this package.
