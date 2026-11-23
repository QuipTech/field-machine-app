$ErrorActionPreference = 'Stop'
$folder = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Programs/FieldMachineLTSC'
$programs = [Environment]::GetFolderPath('Programs')
$entry = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\FieldMachineLTSC'
$paths = @(
  (Join-Path $folder 'FieldMachine-LTSC2019-Pairing-x64.exe')
  (Join-Path $programs 'FIELD Machine LTSC.lnk')
  $entry
  (Join-Path $folder 'Uninstall.ps1')
)
foreach ($path in $paths) {
  if (Test-Path -LiteralPath $path) {
    Remove-Item -LiteralPath $path -Force
  }
}
if ((Test-Path -LiteralPath $folder) -and -not (Get-ChildItem -LiteralPath $folder -Force)) {
  Remove-Item -LiteralPath $folder -Force
}
