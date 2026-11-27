using System;
using System.IO;
using System.Reflection;
using Microsoft.Win32;

// Helpers shared by the per-user LTSC setup and the per-machine setup.
internal static class SetupShared
{
    public static bool HasWebView2Runtime()
    {
        const string client = @"Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";
        return HasRuntimeVersion(Registry.LocalMachine, client.Replace(@"Software\", @"Software\WOW6432Node\"))
            || HasRuntimeVersion(Registry.LocalMachine, client)
            || HasRuntimeVersion(Registry.CurrentUser, client);
    }

    // Writes an embedded resource through a temporary file so a failed copy
    // never leaves a half-written executable behind.
    public static void WriteResource(string resource, string destination)
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

    private static bool HasRuntimeVersion(RegistryKey root, string path)
    {
        using (var key = root.OpenSubKey(path))
        {
            Version version;
            return key != null && Version.TryParse(key.GetValue("pv") as string, out version)
                && version > new Version(0, 0, 0, 0);
        }
    }
}
