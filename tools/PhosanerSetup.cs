using System;
using System.IO;
using System.Windows.Forms;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        var quiet = false;
        string dest = null;
        foreach (var arg in args)
        {
            if (string.Equals(arg, "--quiet", StringComparison.OrdinalIgnoreCase))
            {
                quiet = true;
                continue;
            }
            if (dest == null)
            {
                dest = arg;
            }
        }
        if (string.IsNullOrWhiteSpace(dest))
        {
            dest = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Phosaner");
        }

        var setupDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(
            Path.DirectorySeparatorChar,
            Path.AltDirectorySeparatorChar);
        var source = Path.Combine(setupDir, "app");
        if (!Directory.Exists(source) || !File.Exists(Path.Combine(source, "Editor.exe")))
        {
            Show(quiet, "Phosaner Casus Editor", "Het installatiepakket is niet compleet. De map app met Editor.exe ontbreekt.");
            return 1;
        }

        try
        {
            CopyTree(source, dest);
        }
        catch (Exception ex)
        {
            Show(quiet, "Phosaner Casus Editor", "Installeren is mislukt.\r\n" + ex.Message);
            return 1;
        }

        if (!File.Exists(Path.Combine(dest, "Editor.exe")) || !File.Exists(Path.Combine(dest, "Phosaner.exe")))
        {
            Show(quiet, "Phosaner Casus Editor", "Editor.exe of Phosaner.exe ontbreekt na het installeren.");
            return 1;
        }

        Show(
            quiet,
            "Phosaner Casus Editor",
            "Phosaner is geïnstalleerd in\r\n" + dest + "\r\n\r\nStart Editor.exe of Phosaner.exe vanuit die map.");
        return 0;
    }

    private static void Show(bool quiet, string title, string message)
    {
        if (quiet)
        {
            Console.WriteLine(message);
            return;
        }
        MessageBox.Show(message, title, MessageBoxButtons.OK, MessageBoxIcon.Information);
    }

    private static void CopyTree(string source, string dest)
    {
        Directory.CreateDirectory(dest);
        foreach (var dir in Directory.GetDirectories(source, "*", SearchOption.AllDirectories))
        {
            var rel = dir.Substring(source.Length).TrimStart(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            Directory.CreateDirectory(Path.Combine(dest, rel));
        }
        foreach (var file in Directory.GetFiles(source, "*", SearchOption.AllDirectories))
        {
            var rel = file.Substring(source.Length).TrimStart(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            var target = Path.Combine(dest, rel);
            var parent = Path.GetDirectoryName(target);
            if (!string.IsNullOrEmpty(parent))
            {
                Directory.CreateDirectory(parent);
            }
            File.Copy(file, target, true);
        }
    }
}
