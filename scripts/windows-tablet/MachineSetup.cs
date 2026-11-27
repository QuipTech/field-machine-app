using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Security.AccessControl;
using System.Security.Principal;
using System.ServiceProcess;
using System.Windows.Forms;
using Microsoft.Win32;

// Per-machine setup: installs FIELD Machine for every Windows user and the
// FIELD Machine Desktop service that keeps remote support across user switches.
internal static class MachineSetup
{
    private const string Title = "FIELD Machine Setup";
    private const string ServiceName = "FieldMachineDesktop";
    private const string AppName = "FieldMachine-LTSC2019-Pairing-x64.exe";
    private const string HostName = "FieldMachineDesktop.exe";
    private const string SetupName = "FieldMachine-Setup.exe";
    private const string UninstallKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\FieldMachine";

    private static string Folder
    {
        get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "FIELD Machine"); }
    }

    private static string Shortcut
    {
        get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonPrograms), "FIELD Machine.lnk"); }
    }

    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            if (args.Contains("/uninstall", StringComparer.OrdinalIgnoreCase))
            {
                Uninstall();
                MessageBox.Show("FIELD Machine was removed. Pairing details stay saved in each Windows user.", Title);
                return 0;
            }
            Install();
            var message = SetupShared.HasWebView2Runtime()
                ? "FIELD Machine is installed for all users. It starts automatically at sign-in and stays in the tray."
                : "FIELD Machine is installed. Install the x64 Microsoft Edge WebView2 Runtime before opening it.";
            MessageBox.Show(message, Title, MessageBoxButtons.OK, MessageBoxIcon.Information);
            return 0;
        }
        catch (Exception error)
        {
            // Setup holds no secrets, so the full error is safe to keep for support.
            try { File.AppendAllText(Path.Combine(Path.GetTempPath(), "FieldMachine-Setup.log"), DateTime.Now + " " + error + Environment.NewLine); }
            catch (IOException) { }
            MessageBox.Show(error.Message, Title, MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }

    private static void Install()
    {
        StopService();
        CloseApp();
        Directory.CreateDirectory(Folder);
        PrepareAccessFolder();
        SetupShared.WriteResource("FieldMachine.App", Path.Combine(Folder, AppName));
        SetupShared.WriteResource("FieldMachine.Host", Path.Combine(Folder, HostName));
        var setupCopy = Path.Combine(Folder, SetupName);
        if (!string.Equals(Application.ExecutablePath, setupCopy, StringComparison.OrdinalIgnoreCase))
            File.Copy(Application.ExecutablePath, setupCopy, true);

        var binary = "\"\\\"" + Path.Combine(Folder, HostName) + "\\\" --service\"";
        var verb = ServiceController.GetServices().Any(s => s.ServiceName == ServiceName) ? "config" : "create";
        RunSc(verb + " " + ServiceName + " binPath= " + binary + " start= auto DisplayName= \"FIELD Machine Desktop\"");
        RunSc("description " + ServiceName + " \"Keeps FIELD remote support working when Windows users switch.\"");
        RunSc("failure " + ServiceName + " reset= 86400 actions= restart/5000/restart/5000/restart/5000");
        using (var service = new ServiceController(ServiceName))
        {
            service.Start();
            service.WaitForStatus(ServiceControllerStatus.Running, TimeSpan.FromSeconds(20));
        }

        var shellType = Type.GetTypeFromProgID("WScript.Shell", true);
        dynamic shell = Activator.CreateInstance(shellType);
        dynamic shortcut = shell.CreateShortcut(Shortcut);
        shortcut.TargetPath = Path.Combine(Folder, AppName);
        shortcut.WorkingDirectory = Folder;
        shortcut.Save();

        using (var entry = Registry.LocalMachine.CreateSubKey(UninstallKey))
        {
            entry.SetValue("DisplayName", "FIELD Machine");
            entry.SetValue("DisplayVersion", "2.0.0 test");
            entry.SetValue("Publisher", "FIELD");
            entry.SetValue("DisplayIcon", Path.Combine(Folder, AppName));
            entry.SetValue("InstallLocation", Folder);
            entry.SetValue("UninstallString", "\"" + setupCopy + "\" /uninstall");
            entry.SetValue("NoModify", 1, RegistryValueKind.DWord);
            entry.SetValue("NoRepair", 1, RegistryValueKind.DWord);
        }
    }

    // One FIELD ID per tablet: the access record lives in ProgramData and is
    // used by whichever Windows user runs the app. Kept on uninstall so a
    // reinstall keeps the same FIELD ID.
    private static void PrepareAccessFolder()
    {
        var folder = Directory.CreateDirectory(Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "FIELD Machine"));
        var security = folder.GetAccessControl();
        security.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier(WellKnownSidType.BuiltinUsersSid, null),
            FileSystemRights.Modify, InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit,
            PropagationFlags.None, AccessControlType.Allow));
        folder.SetAccessControl(security);
    }

    private static void Uninstall()
    {
        StopService();
        CloseApp();
        if (ServiceController.GetServices().Any(s => s.ServiceName == ServiceName)) RunSc("delete " + ServiceName);
        File.Delete(Shortcut);
        Registry.LocalMachine.DeleteSubKeyTree(UninstallKey, false);
        foreach (var name in new[] { AppName, HostName })
        {
            var path = Path.Combine(Folder, name);
            if (File.Exists(path)) File.Delete(path);
        }
        // The running setup copy cannot delete itself, so a short-lived shell removes the folder.
        var cleanup = new ProcessStartInfo("cmd.exe", "/c timeout /t 3 /nobreak > nul & rmdir /s /q \"" + Folder + "\"");
        cleanup.CreateNoWindow = true;
        cleanup.UseShellExecute = false;
        Process.Start(cleanup);
    }

    // The app hides to the tray instead of closing, so setup ends it after the
    // service (which would restart it) has stopped. The service restarts it later.
    private static void CloseApp()
    {
        var running = Process.GetProcessesByName(Path.GetFileNameWithoutExtension(AppName));
        if (running.Length == 0) return;
        var answer = MessageBox.Show("FIELD Machine is running and will be closed during setup. Continue?",
            Title, MessageBoxButtons.OKCancel, MessageBoxIcon.Question);
        if (answer != DialogResult.OK) throw new OperationCanceledException("Setup was cancelled.");
        foreach (var process in running)
        {
            process.Kill();
            process.WaitForExit(10000);
        }
    }

    private static void StopService()
    {
        if (!ServiceController.GetServices().Any(s => s.ServiceName == ServiceName)) return;
        using (var service = new ServiceController(ServiceName))
        {
            if (service.Status == ServiceControllerStatus.Stopped) return;
            service.Stop();
            service.WaitForStatus(ServiceControllerStatus.Stopped, TimeSpan.FromSeconds(20));
        }
    }

    private static void RunSc(string arguments)
    {
        var start = new ProcessStartInfo(Path.Combine(Environment.SystemDirectory, "sc.exe"), arguments);
        start.CreateNoWindow = true;
        start.RedirectStandardOutput = true;
        start.UseShellExecute = false;
        using (var process = Process.Start(start))
        {
            var output = process.StandardOutput.ReadToEnd().Trim();
            process.WaitForExit();
            if (process.ExitCode != 0)
                throw new InvalidOperationException("Windows could not configure the FIELD Machine service (sc " + process.ExitCode + "): " + output);
        }
    }
}
