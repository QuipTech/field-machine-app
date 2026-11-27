param(
  [Parameter(Mandatory)][string]$App,
  [Parameter(Mandatory)][string]$DesktopHost,
  [string]$SignTool,
  [string]$CertificateThumbprint,
  [ValidatePattern('^FieldMachine-Setup-x64(?:-[A-Za-z0-9]+)?\.exe$')]
  [string]$SetupFileName = 'FieldMachine-Setup-x64-allusers.exe'
)

# Builds the per-machine setup that installs FIELD Machine for all users and
# the FIELD Machine Desktop service. Sign App and DesktopHost before running.
$ErrorActionPreference = 'Stop'
if ([bool]$SignTool -ne [bool]$CertificateThumbprint) {
  throw 'Specify both SignTool and CertificateThumbprint to sign setup.'
}
$appFile = Get-Item -LiteralPath $App
$hostFile = Get-Item -LiteralPath $DesktopHost
if ($appFile.Name -ne 'FieldMachine-LTSC2019-Pairing-x64.exe' -or $hostFile.Name -ne 'FieldMachineDesktop.exe') {
  throw 'Supply the LTSC app and FieldMachineDesktop.exe builds.'
}
$output = Join-Path $PSScriptRoot '../../artifacts/windows-tablet/compatibility'
New-Item -ItemType Directory -Path $output -Force | Out-Null
$setup = Join-Path $output $SetupFileName
$csc = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
& $csc /nologo /target:winexe /platform:x64 "/out:$setup" `
  "/win32manifest:$(Join-Path $PSScriptRoot 'MachineSetup.manifest')" `
  "/resource:$($appFile.FullName),FieldMachine.App" "/resource:$($hostFile.FullName),FieldMachine.Host" `
  /reference:System.Windows.Forms.dll /reference:System.ServiceProcess.dll /reference:Microsoft.CSharp.dll `
  /reference:System.Core.dll (Join-Path $PSScriptRoot 'MachineSetup.cs') (Join-Path $PSScriptRoot 'SetupShared.cs')
if ($LASTEXITCODE -ne 0) { throw 'Machine setup compilation failed.' }
if ($SignTool) {
  & $SignTool sign /fd SHA256 /sha1 $CertificateThumbprint $setup
  if ($LASTEXITCODE -ne 0) { throw 'Machine setup signing failed.' }
}
Get-Item -LiteralPath $setup
