using System;
using System.Diagnostics;
using System.IO;
using System.Net.Sockets;
using System.Threading;
using System.Windows.Forms;

internal static class Program
{
    private const int Port = 4173;
    private const string Url = "http://127.0.0.1:4173";

    [STAThread]
    private static int Main(string[] args)
    {
        var root = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        Directory.SetCurrentDirectory(root);
        var windowed = Array.Exists(args, a => string.Equals(a, "windowed", StringComparison.OrdinalIgnoreCase));

        var nodeDir = FindNodeDir();
        if (nodeDir == null)
        {
            MessageBox.Show(
                "Node.js is niet gevonden. Installeer Node.js en start daarna opnieuw.",
                "Holobox Zorgsimulator",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return 1;
        }

        var dist = Path.Combine(root, "dist", "index.html");
        if (!File.Exists(dist))
        {
            var build = RunNpm(nodeDir, root, "run build", true);
            if (build != 0)
            {
                MessageBox.Show(
                    "Bouwen van de app is mislukt. Controleer Node.js en probeer het opnieuw.",
                    "Holobox Zorgsimulator",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                return build;
            }
        }

        Process server = null;
        Process browser = null;
        try
        {
            server = StartNpm(nodeDir, root, "run preview", false);
            if (!WaitForPort(Port, 60000))
            {
                MessageBox.Show(
                    "De lokale server start niet op poort 4173.",
                    "Holobox Zorgsimulator",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                return 1;
            }

            browser = StartBrowser(Url, windowed);
            if (browser == null)
            {
                MessageBox.Show(
                    "Microsoft Edge of Google Chrome is niet gevonden.",
                    "Holobox Zorgsimulator",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                return 1;
            }

            browser.WaitForExit();
        }
        finally
        {
            KillTree(browser);
            KillTree(server);
            KillListeners(Port);
        }

        return 0;
    }

    private static string FindNodeDir()
    {
        var candidates = new[]
        {
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs"),
            Path.Combine(Environment.GetEnvironmentVariable("ProgramFiles(x86)") ?? "", "nodejs"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "nodejs"),
        };
        foreach (var dir in candidates)
        {
            if (File.Exists(Path.Combine(dir, "npm.cmd")))
            {
                return dir;
            }
        }

        var path = Environment.GetEnvironmentVariable("PATH") ?? "";
        foreach (var part in path.Split(Path.PathSeparator))
        {
            try
            {
                if (File.Exists(Path.Combine(part, "npm.cmd")))
                {
                    return part;
                }
            }
            catch
            {
                // ignore invalid PATH entries
            }
        }

        return null;
    }

    private static int RunNpm(string nodeDir, string root, string npmArgs, bool visible)
    {
        using (var process = StartNpm(nodeDir, root, npmArgs, visible))
        {
            if (process == null)
            {
                return 1;
            }
            process.WaitForExit();
            return process.ExitCode;
        }
    }

    private static Process StartNpm(string nodeDir, string root, string npmArgs, bool visible)
    {
        var psi = new ProcessStartInfo
        {
            FileName = Path.Combine(nodeDir, "npm.cmd"),
            Arguments = npmArgs,
            WorkingDirectory = root,
            UseShellExecute = false,
            CreateNoWindow = !visible,
        };
        var path = Environment.GetEnvironmentVariable("PATH") ?? "";
        psi.EnvironmentVariables["PATH"] = nodeDir + Path.PathSeparator + path;
        return Process.Start(psi);
    }

    private static bool WaitForPort(int port, int timeoutMs)
    {
        var until = Environment.TickCount + timeoutMs;
        while (Environment.TickCount < until)
        {
            try
            {
                using (var client = new TcpClient())
                {
                    var result = client.BeginConnect("127.0.0.1", port, null, null);
                    var ok = result.AsyncWaitHandle.WaitOne(500);
                    if (ok && client.Connected)
                    {
                        return true;
                    }
                }
            }
            catch
            {
                // keep waiting
            }
            Thread.Sleep(400);
        }
        return false;
    }

    private static Process StartBrowser(string url, bool windowed)
    {
        var profile = Path.Combine(Path.GetTempPath(), "holobox-kiosk-profile");
        var edge86 = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft\\Edge\\Application\\msedge.exe");
        var edge64 = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft\\Edge\\Application\\msedge.exe");
        var chrome = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Google\\Chrome\\Application\\chrome.exe");

        string exe = null;
        string arguments;
        if (File.Exists(edge86))
        {
            exe = edge86;
        }
        else if (File.Exists(edge64))
        {
            exe = edge64;
        }
        else if (File.Exists(chrome))
        {
            exe = chrome;
        }

        if (exe == null)
        {
            return null;
        }

        if (windowed)
        {
            arguments = "--new-window --app=" + url + " --user-data-dir=\"" + profile + "\"";
        }
        else if (exe.IndexOf("msedge.exe", StringComparison.OrdinalIgnoreCase) >= 0)
        {
            arguments = "--kiosk " + url + " --edge-kiosk-type=fullscreen --no-first-run --disable-session-crashed-bubble --user-data-dir=\"" + profile + "\"";
        }
        else
        {
            arguments = "--kiosk --app=" + url + " --user-data-dir=\"" + profile + "\"";
        }

        return Process.Start(new ProcessStartInfo
        {
            FileName = exe,
            Arguments = arguments,
            UseShellExecute = false,
        });
    }

    private static void KillTree(Process process)
    {
        if (process == null)
        {
            return;
        }
        try
        {
            if (!process.HasExited)
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = "taskkill",
                    Arguments = "/PID " + process.Id + " /T /F",
                    CreateNoWindow = true,
                    UseShellExecute = false,
                }).WaitForExit(4000);
            }
        }
        catch
        {
            // ignore
        }
    }

    private static void KillListeners(int port)
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = "-NoProfile -Command \"Get-NetTCPConnection -LocalPort " + port + " -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }\"",
                CreateNoWindow = true,
                UseShellExecute = false,
            };
            Process.Start(psi).WaitForExit(4000);
        }
        catch
        {
            // ignore
        }
    }
}
