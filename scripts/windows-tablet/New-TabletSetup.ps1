param(
  [Parameter(Mandatory)][string]$Package,
  [Parameter(Mandatory)][string]$CertificateThumbprint,
  [Parameter(Mandatory)][string]$SignTool,
  [ValidatePattern('^FieldMachine-Setup-x64(?:-[A-Za-z0-9]+)?\.exe$')]
  [string]$SetupFileName = 'FieldMachine-Setup-x64.exe'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$packageFile = Get-Item -LiteralPath $Package
$certificate = Get-Item -LiteralPath "Cert:\CurrentUser\My\$CertificateThumbprint"
if (!$certificate.HasPrivateKey -or $certificate.NotAfter -le (Get-Date)) {
  throw 'The signing certificate needs a valid private key.'
}

$zip = [IO.Compression.ZipFile]::OpenRead($packageFile.FullName)
try {
  $bundle = $zip.Entries | Where-Object FullName -Match '(^|/)Bundle/index\.windows\.bundle$'
  if (!$bundle -or $bundle.Length -le 0) { throw 'The MSIX does not contain its JavaScript bundle.' }
  $manifest = $zip.GetEntry('AppxManifest.xml')
  $reader = [IO.StreamReader]::new($manifest.Open())
  try { [xml]$metadata = $reader.ReadToEnd() } finally { $reader.Dispose() }
  if ($metadata.Package.Identity.ProcessorArchitecture -ne 'x64' -or
      $metadata.Package.Identity.Publisher -ne $certificate.Subject) {
    throw 'The MSIX must be x64 and its publisher must match the certificate.'
  }
} finally {
  $zip.Dispose()
}

$worktree = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$output = Join-Path $worktree 'artifacts/windows-tablet'
New-Item -ItemType Directory -Path $output -Force | Out-Null
$tempRoot = [IO.Path]::GetTempPath()
$work = Join-Path $tempRoot ("FieldMachineBuild-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $work | Out-Null
try {
  $payload = Join-Path $work 'Payload'
  $dependencies = Join-Path $payload 'Dependencies'
  New-Item -ItemType Directory -Path $dependencies | Out-Null
  $msix = Join-Path $payload 'FieldMachine.msix'
  Copy-Item -LiteralPath $packageFile.FullName -Destination $msix
  & $SignTool sign /fd SHA256 /sha1 $CertificateThumbprint $msix
  if ($LASTEXITCODE -ne 0) { throw 'MSIX signing failed.' }

  foreach ($architecture in 'x64', 'neutral') {
    $directory = Join-Path $packageFile.DirectoryName "Dependencies/$architecture"
    Get-ChildItem -LiteralPath $directory -File -ErrorAction SilentlyContinue |
      Where-Object Extension -In '.appx', '.msix', '.appxbundle', '.msixbundle' |
      ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $dependencies }
  }
  $archive = Join-Path $work 'package.zip'
  [IO.Compression.ZipFile]::CreateFromDirectory($payload, $archive)
  $csc = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
  $setup = Join-Path $work 'FieldMachine-Setup-x64.exe'
  & $csc /nologo /target:winexe "/out:$setup" "/resource:$archive,FieldMachine.Payload" `
    /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll `
    /reference:System.Windows.Forms.dll (Join-Path $PSScriptRoot 'FieldMachineSetup.cs')
  if ($LASTEXITCODE -ne 0) { throw 'The setup executable did not compile.' }
  & $SignTool sign /fd SHA256 /sha1 $CertificateThumbprint $setup
  if ($LASTEXITCODE -ne 0) { throw 'Setup executable signing failed.' }

  $publicCertificate = Join-Path $output 'FIELD-Test-Publisher.cer'
  Export-Certificate -Cert $certificate -FilePath $publicCertificate -Force | Out-Null
  $msixName = if ($metadata.Package.Identity.Name -eq 'FieldMachine.TabletPilot') {
    'FieldMachine-Pilot-Release-x64.msix'
  } else {
    'FieldMachine-Release-x64.msix'
  }
  Copy-Item -LiteralPath $msix -Destination (Join-Path $output $msixName) -Force
  Copy-Item -LiteralPath $setup -Destination (Join-Path $output $SetupFileName) -Force
  Get-ChildItem -LiteralPath $output -File | Select-Object Name, Length
} finally {
  $resolved = (Resolve-Path -LiteralPath $work).Path
  if ($resolved.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -and
      [IO.Path]::GetFileName($resolved).StartsWith('FieldMachineBuild-')) {
    Remove-Item -LiteralPath $resolved -Recurse -Force
  }
}
