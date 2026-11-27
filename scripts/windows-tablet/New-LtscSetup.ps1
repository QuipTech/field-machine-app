param(
  [Parameter(Mandatory)][string]$App,
  [string]$SignTool,
  [string]$CertificateThumbprint,
  [ValidatePattern('^FieldMachine-LTSC2019-Setup-x64(?:-[A-Za-z0-9]+)?\.exe$')]
  [string]$SetupFileName = 'FieldMachine-LTSC2019-Setup-x64.exe'
)

$ErrorActionPreference = 'Stop'
if ([bool]$SignTool -ne [bool]$CertificateThumbprint) {
  throw 'Specify both SignTool and CertificateThumbprint to sign setup.'
}
$payload = Get-Item -LiteralPath $App
if ($payload.Name -ne 'FieldMachine-LTSC2019-Pairing-x64.exe') {
  throw 'Supply the x64 LTSC pairing build.'
}
$output = Join-Path $PSScriptRoot '../../artifacts/windows-tablet/compatibility'
New-Item -ItemType Directory -Path $output -Force | Out-Null
$setup = Join-Path $output $SetupFileName
$csc = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$uninstall = Join-Path $PSScriptRoot 'Uninstall-Ltsc.ps1'
& $csc /nologo /target:winexe /platform:x64 "/out:$setup" `
  "/resource:$($payload.FullName),FieldMachine.App" "/resource:$uninstall,FieldMachine.Uninstall" `
  /reference:System.Windows.Forms.dll /reference:Microsoft.CSharp.dll (Join-Path $PSScriptRoot 'LtscSetup.cs') (Join-Path $PSScriptRoot 'SetupShared.cs')
if ($LASTEXITCODE -ne 0) { throw 'LTSC setup compilation failed.' }
if ($SignTool) {
  & $SignTool sign /fd SHA256 /sha1 $CertificateThumbprint $setup
  if ($LASTEXITCODE -ne 0) { throw 'LTSC setup signing failed.' }
}
Get-Item -LiteralPath $setup
