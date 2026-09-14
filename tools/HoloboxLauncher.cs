using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Threading;
using System.Windows.Forms;

internal static class Program
{
    private const string AppBase = "/Holobox-editor/";
    private const int StudentPort = 4173;
    private const int EditorPort = 4174;

    [STAThread]
    private static int Main(string[] args)
    {
        var root = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        Directory.SetCurrentDirectory(root);

        var editor = IsEditorMode(args);
        var windowed = editor || Array.Exists(args, a => string.Equals(a, "windowed", StringComparison.OrdinalIgnoreCase));
        var port = editor ? EditorPort : StudentPort;
        var url = editor
            ? "http://127.0.0.1:" + port + AppBase + "editor.html"
            : "http://127.0.0.1:" + port + AppBase;
        var title = editor ? "Holobox Logopedie-scenariobewerker" : "Holobox Zorgsimulator";
        var npmPreview = editor ? "run preview:editor" : "run preview";
        var distFile = Path.Combine(root, "dist", editor ? "editor.html" : "index.html");

        var nodeDir = FindNodeDir();
        if (nodeDir == null)
        {
            MessageBox.Show(
                "Node.js is niet gevonden. Installeer Node.js en start daarna opnieuw.",
                title,
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return 1;
        }

        if (!File.Exists(distFile))
        {
            var build = RunNpm(nodeDir, root, "run build", true);
            if (build != 0)
            {
                MessageBox.Show(
                    "Bouwen van de app is mislukt. Controleer Node.js en probeer het opnieuw.",
                    title,
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                return build;
            }
        }

        if (!File.Exists(distFile))
        {
            MessageBox.Show(
                editor
                    ? "dist/editor.html ontbreekt na het bouwen."
                    : "dist/index.html ontbreekt na het bouwen.",
                title,
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return 1;
        }

        Process server = null;
        Process browser = null;
        try
        {
            server = StartNpm(nodeDir, root, npmPreview, false);
            if (!WaitForUrl(url, 60000))
            {
                MessageBox.Show(
                    "De lokale server start niet op " + url + ".",
                    title,
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                return 1;
            }

            browser = StartBrowser(url, windowed, editor);
            if (browser == null)
            {
                MessageBox.Show(
                    "Microsoft Edge of Google Chrome is niet gevonden.",
                    title,
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
            KillListeners(port);
        }

        return 0;
    }

    private static bool IsEditorMode(string[] args)
    {
        if (Array.Exists(args, a => string.Equals(a, "editor", StringComparison.OrdinalIgnoreCase)))
        {
            return true;
        }

        try
        {
            var name = Path.GetFileNameWithoutExtension(Application.ExecutablePath);
            return name.IndexOf("Editor", StringComparison.OrdinalIgnoreCase) >= 0;
        }
        catch
        {
            return false;
        }
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

    private static bool WaitForUrl(string url, int timeoutMs)
    {
        var until = Environment.TickCount + timeoutMs;
        while (Environment.TickCount < until)
        {
            try
            {
                var request = (HttpWebRequest)WebRequest.Create(url);
                request.Timeout = 1500;
                request.AllowAutoRedirect = true;
                using (var response = (HttpWebResponse)request.GetResponse())
                {
                    var code = (int)response.StatusCode;
                    if (code >= 200 && code < 400)
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

    private static Process StartBrowser(string url, bool windowed, bool editor)
    {
        var profile = Path.Combine(
            Path.GetTempPath(),
            editor ? "holobox-editor-profile" : "holobox-kiosk-profile");
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
