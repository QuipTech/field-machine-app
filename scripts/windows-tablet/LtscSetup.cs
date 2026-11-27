using System;
using System.IO;
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
            var hasRuntime = SetupShared.HasWebView2Runtime();
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
        SetupShared.WriteResource("FieldMachine.App", app);
        SetupShared.WriteResource("FieldMachine.Uninstall", uninstallScript);

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
}
