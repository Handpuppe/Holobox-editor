using System;
using System.Diagnostics;
using System.IO;
using System.Management;
using System.Net;
using System.Text.RegularExpressions;
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
        var appBase = AppBasePath(root);
        var url = editor
            ? "http://127.0.0.1:" + port + appBase + "editor.html"
            : "http://127.0.0.1:" + port + appBase;
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

            WaitForBrowserClose(browser, BrowserProfile(editor), url);
        }
        finally
        {
            if (browser != null)
            {
                StartStopScriptOnce(root);
            }
            KillTree(browser);
            KillTree(server);
            KillListeners(4173);
            KillListeners(5173);
            KillListeners(4174);
            KillListeners(5174);
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

    private static string BrowserProfile(bool editor)
    {
        return Path.Combine(
            Path.GetTempPath(),
            editor ? "holobox-editor-profile" : "holobox-kiosk-profile");
    }

    private static Process StartBrowser(string url, bool windowed, bool editor)
    {
        var profile = BrowserProfile(editor);
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

    private static void WaitForBrowserClose(Process started, string profileDir, string url)
    {
        Process watch = null;
        var until = DateTime.UtcNow.AddSeconds(20);
        while (DateTime.UtcNow < until)
        {
            var found = FindOpenBrowser(profileDir, url);
            if (found != null)
            {
                watch = found;
                break;
            }
            Thread.Sleep(200);
        }
        if (watch == null && started != null && !started.HasExited)
        {
            watch = started;
        }
        while (watch != null)
        {
            try
            {
                if (!watch.HasExited)
                {
                    watch.WaitForExit();
                }
            }
            catch
            {
                break;
            }
            Thread.Sleep(800);
            var again = FindOpenBrowser(profileDir, url);
            if (again == null)
            {
                break;
            }
            watch = again;
        }
    }

    private static Process FindOpenBrowser(string profileDir, string url)
    {
        try
        {
            using (var searcher = new ManagementObjectSearcher(
                "SELECT ProcessId, CommandLine FROM Win32_Process WHERE Name='msedge.exe' OR Name='chrome.exe'"))
            {
                foreach (ManagementObject item in searcher.Get())
                {
                    var command = item["CommandLine"] as string;
                    if (string.IsNullOrEmpty(command))
                    {
                        continue;
                    }
                    if (command.IndexOf(profileDir, StringComparison.OrdinalIgnoreCase) < 0)
                    {
                        continue;
                    }
                    if (command.IndexOf(url, StringComparison.OrdinalIgnoreCase) < 0)
                    {
                        continue;
                    }
                    if (command.IndexOf("--type=", StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        continue;
                    }
                    var pid = Convert.ToInt32(item["ProcessId"]);
                    try
                    {
                        var process = Process.GetProcessById(pid);
                        if (!process.HasExited)
                        {
                            return process;
                        }
                    }
                    catch
                    {
                        // proces is net gestopt
                    }
                }
            }
        }
        catch
        {
            // zonder proceslijst blijft het gestarte proces de fallback
        }
        return null;
    }

    private static string AppBasePath(string root)
    {
        var vitePath = Path.Combine(root, "vite.config.ts");
        if (File.Exists(vitePath))
        {
            var text = File.ReadAllText(vitePath);
            var literal = Regex.Match(text, "base\\s*:\\s*'([^']+)'");
            if (literal.Success)
            {
                return NormalizeBase(literal.Groups[1].Value);
            }
            var constant = Regex.Match(text, "APP_BASE\\s*=\\s*'([^']+)'");
            if (constant.Success)
            {
                return NormalizeBase(constant.Groups[1].Value);
            }
        }

        var batPath = Path.Combine(root, "start-holobox.bat");
        if (File.Exists(batPath))
        {
            var text = File.ReadAllText(batPath);
            var url = Regex.Match(
                text,
                "set\\s+\"URL=http://127\\.0\\.0\\.1:%PORT%([^\"]*)\"",
                RegexOptions.IgnoreCase);
            if (url.Success)
            {
                return NormalizeBase(url.Groups[1].Value);
            }
        }

        return AppBase;
    }

    private static string NormalizeBase(string path)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return "/";
        }
        path = path.Trim();
        if (!path.StartsWith("/"))
        {
            path = "/" + path;
        }
        if (!path.EndsWith("/"))
        {
            path += "/";
        }
        return path;
    }

    private static string StopScriptPath(string root)
    {
        var local = Path.Combine(root, "Stop-Holobox.ps1");
        if (File.Exists(local))
        {
            return local;
        }
        return @"D:\GrokBuild\HoloBox2\Stop-Holobox.ps1";
    }

    private static void StartStopScriptOnce(string root)
    {
        var lockPath = Path.Combine(Path.GetTempPath(), "holobox-stop-holobox.lock");
        try
        {
            if (File.Exists(lockPath))
            {
                var age = DateTime.UtcNow - File.GetLastWriteTimeUtc(lockPath);
                if (age.TotalSeconds >= 0 && age.TotalSeconds < 20)
                {
                    return;
                }
                File.Delete(lockPath);
            }
            using (new FileStream(lockPath, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            {
            }
        }
        catch
        {
            return;
        }
        try
        {
            var script = StopScriptPath(root);
            Process.Start(new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = "-NoProfile -ExecutionPolicy Bypass -File \"" + script + "\"",
                UseShellExecute = true,
                WindowStyle = ProcessWindowStyle.Normal,
            });
        }
        catch
        {
            // Het venster is al dicht. Het script start bij de volgende poging.
        }
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
