using System;
using System.IO;
using System.Reflection;
using System.Windows.Forms;
using Microsoft.Win32;

internal static class LtscSetup
{
    private const string Title = "FIELD Machine LTSC Setup";
    private const string AppName = "FieldMachine-LTSC2019-Pairing-x64.exe";
    private const string UninstallKey =
        @"Software\Microsoft\Windows\CurrentVersion\Uninstall\FieldMachineLTSC";

    [STAThread]
    private static int Main()
    {
        try
        {
            Install();
            var hasRuntime = HasWebView2Runtime();
            var message = hasRuntime
                ? "Open FIELD Machine LTSC from the Start menu."
                : "FIELD Machine LTSC was installed. Install the x64 Microsoft Edge WebView2 Runtime before opening it.";
            MessageBox.Show(message, Title, MessageBoxButtons.OK,
                hasRuntime ? MessageBoxIcon.Information : MessageBoxIcon.Warning);
            return 0;
        }
        catch (Exception error)
        {
            MessageBox.Show(error.Message, Title, MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }

    private static void Install()
    {
        var folder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Programs", "FieldMachineLTSC");
        Directory.CreateDirectory(folder);
        var app = Path.Combine(folder, AppName);
        var uninstallScript = Path.Combine(folder, "Uninstall.ps1");
        WriteResource("FieldMachine.App", app);
        WriteResource("FieldMachine.Uninstall", uninstallScript);

        var programs = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
        var shellType = Type.GetTypeFromProgID("WScript.Shell", true);
        dynamic shell = Activator.CreateInstance(shellType);
        dynamic shortcut = shell.CreateShortcut(Path.Combine(programs, "FIELD Machine LTSC.lnk"));
        shortcut.TargetPath = app;
        shortcut.WorkingDirectory = folder;
        shortcut.Save();

        var powershell = Path.Combine(Environment.SystemDirectory, "WindowsPowerShell", "v1.0", "powershell.exe");
        using (var entry = Registry.CurrentUser.CreateSubKey(UninstallKey))
        {
            entry.SetValue("DisplayName", "FIELD Machine LTSC");
            entry.SetValue("Publisher", "FIELD");
            entry.SetValue("DisplayIcon", app);
            entry.SetValue("InstallLocation", folder);
            entry.SetValue("UninstallString", "\"" + powershell +
                "\" -NoProfile -ExecutionPolicy RemoteSigned -File \"" + uninstallScript + "\"");
            entry.SetValue("NoModify", 1, RegistryValueKind.DWord);
            entry.SetValue("NoRepair", 1, RegistryValueKind.DWord);
        }
    }

    private static bool HasWebView2Runtime()
    {
        const string client = @"Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";
        return HasRuntimeVersion(Registry.LocalMachine, client.Replace(@"Software\", @"Software\WOW6432Node\"))
            || HasRuntimeVersion(Registry.LocalMachine, client)
            || HasRuntimeVersion(Registry.CurrentUser, client);
    }

    private static bool HasRuntimeVersion(RegistryKey root, string path)
    {
        using (var key = root.OpenSubKey(path))
        {
            Version version;
            return key != null && Version.TryParse(key.GetValue("pv") as string, out version)
                && version > new Version(0, 0, 0, 0);
        }
    }

    private static void WriteResource(string resource, string destination)
    {
        var staged = destination + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            using (var input = Assembly.GetExecutingAssembly().GetManifestResourceStream(resource))
            using (var output = File.Create(staged))
            {
                input.CopyTo(output);
            }
            if (File.Exists(destination))
                File.Replace(staged, destination, null);
            else
                File.Move(staged, destination);
        }
        finally
        {
            File.Delete(staged);
        }
    }
}
