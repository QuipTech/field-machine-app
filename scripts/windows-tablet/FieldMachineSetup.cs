using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Windows.Forms;
using Microsoft.Win32;

internal static class FieldMachineSetup
{
    [STAThread]
    private static int Main()
    {
        var work = Path.Combine(Path.GetTempPath(), "FieldMachineSetup-" + Guid.NewGuid().ToString("N"));
        try
        {
            CheckWindowsBuild();
            Directory.CreateDirectory(work);
            ExtractPackage(work);
            InstallPackage(work);
            MessageBox.Show("FIELD Machine is installed. Open it from the Windows Start menu.",
                "FIELD Machine Setup", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return 0;
        }
        catch (Exception error)
        {
            MessageBox.Show(error.Message, "FIELD Machine Setup", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
        finally
        {
            try
            {
                if (Directory.Exists(work)) Directory.Delete(work, true);
            }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
        }
    }

    private static void CheckWindowsBuild()
    {
        var build = Registry.GetValue(@"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion",
            "CurrentBuildNumber", null) as string;
        ValidateWindowsBuild(build);
    }

    private static void ValidateWindowsBuild(string build)
    {
        const int minimumBuild = 18362;
        int currentBuild;
        if (int.TryParse(build, out currentBuild) && currentBuild < minimumBuild)
        {
            throw new InvalidOperationException(
                string.Format("FIELD Machine requires Windows build {0} or later. This device has build {1}.",
                    minimumBuild, currentBuild));
        }
    }

    private static void ExtractPackage(string work)
    {
        var archive = Path.Combine(work, "package.zip");
        using (var resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("FieldMachine.Payload"))
        {
            if (resource == null) throw new InvalidOperationException("The installer is missing its package.");
            using (var file = File.Create(archive)) resource.CopyTo(file);
        }
        ZipFile.ExtractToDirectory(archive, work);
    }

    private static void InstallPackage(string work)
    {
        const string script = @"
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try {
    $package = Join-Path $env:FIELD_MACHINE_SETUP_ROOT 'FieldMachine.msix'
    $dependencies = @(Get-ChildItem (Join-Path $env:FIELD_MACHINE_SETUP_ROOT 'Dependencies') -File -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty FullName)
    if ($dependencies.Count -gt 0) {
        Add-AppxPackage -Path $package -DependencyPath $dependencies
    } else {
        Add-AppxPackage -Path $package
    }
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}";
        var powershell = Path.Combine(Environment.SystemDirectory, "WindowsPowerShell", "v1.0", "powershell.exe");
        var arguments = "-NoLogo -NoProfile -NonInteractive -OutputFormat Text -EncodedCommand " +
            Convert.ToBase64String(System.Text.Encoding.Unicode.GetBytes(script));
        var options = new ProcessStartInfo(powershell, arguments)
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardError = true,
        };
        options.EnvironmentVariables["FIELD_MACHINE_SETUP_ROOT"] = work;
        using (var process = Process.Start(options))
        {
            if (process == null) throw new InvalidOperationException("Windows PowerShell could not start.");
            var errors = process.StandardError.ReadToEnd();
            process.WaitForExit();
            if (process.ExitCode != 0) throw new InvalidOperationException(
                string.IsNullOrWhiteSpace(errors) ? "Windows could not install FIELD Machine." : errors.Trim());
        }
    }
}
