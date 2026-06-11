const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawn, exec } = require('child_process');
const { globalShortcut } = require('electron');

let cachedVeoupExecutablePath = null;

async function findVeoupExecutable() {
  if (cachedVeoupExecutablePath) {
    try {
      await fsp.access(cachedVeoupExecutablePath);
      return cachedVeoupExecutablePath;
    } catch (err) {
      cachedVeoupExecutablePath = null;
    }
  }

  // Scan drives C and D roots
  const drives = ['D:\\', 'C:\\'].filter(d => fs.existsSync(d));
  const candidates = [];

  for (const drive of drives) {
    let rootChildren = [];
    try {
      rootChildren = await fsp.readdir(drive, { withFileTypes: true });
    } catch (err) {
      continue;
    }

    const matchingDirs = rootChildren
      .filter(entry => entry.isDirectory())
      .filter(entry => /veoup/i.test(entry.name))
      .map(entry => path.join(drive, entry.name));

    for (const dir of matchingDirs) {
      const exes = await searchExesInDir(dir, 1, 3);
      candidates.push(...exes);
    }
  }

  // Fallback to standard installation paths if no candidates found on drive roots
  if (candidates.length === 0) {
    const standardPaths = [
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'VeoUp', 'VeoUp.exe'),
      path.join(process.env.ProgramFiles || '', 'VeoUp', 'VeoUp.exe'),
      path.join(process.env['ProgramFiles(x86)'] || '', 'VeoUp', 'VeoUp.exe')
    ];
    for (const p of standardPaths) {
      if (p && fs.existsSync(p)) {
        candidates.push(p);
      }
    }
  }

  if (candidates.length === 0) {
    console.error('VeoUp executable not found. Please ensure VeoUp is installed on drive C or D.');
    return null;
  }

  // Prioritize candidates:
  // 1. D:\ drive first
  // 2. Newer version number
  // 3. Shortest path length
  candidates.sort((a, b) => {
    const aOnD = a.toLowerCase().startsWith('d:');
    const bOnD = b.toLowerCase().startsWith('d:');
    if (aOnD && !bOnD) return -1;
    if (!aOnD && bOnD) return 1;

    const aVer = parseVersion(a);
    const bVer = parseVersion(b);
    if (aVer && bVer) {
      const cmp = compareVersions(bVer, aVer); // descending
      if (cmp !== 0) return cmp;
    } else if (aVer && !bVer) {
      return -1;
    } else if (!aVer && bVer) {
      return 1;
    }

    if (a.length !== b.length) {
      return a.length - b.length;
    }

    return 0;
  });

  cachedVeoupExecutablePath = candidates[0];
  return cachedVeoupExecutablePath;
}

async function searchExesInDir(dir, currentDepth, maxDepth) {
  const found = [];
  let entries = [];
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch (err) {
    return found;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isFile()) {
      if (/\.exe$/i.test(entry.name) && /VeoUp/i.test(entry.name)) {
        found.push(fullPath);
      }
    } else if (entry.isDirectory() && currentDepth < maxDepth) {
      const nested = await searchExesInDir(fullPath, currentDepth + 1, maxDepth);
      found.push(...nested);
    }
  }
  return found;
}

function parseVersion(filePath) {
  const match = filePath.match(/(\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
}

function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 !== p2) return p1 - p2;
  }
  return 0;
}

function isProcessRunning(processName) {
  return new Promise((resolve) => {
    exec('tasklist', (err, stdout) => {
      if (err) return resolve(false);
      resolve(stdout.toLowerCase().includes(processName.toLowerCase()));
    });
  });
}


const VEOUP_PROMPTS_READY_FILENAME = 'veoup_prompts_ready.txt';

function normalizeWhitespace(value = '') {
  return String(value || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

async function pathExists(filePath) {
  if (!filePath) return false;
  try {
    await fsp.access(filePath);
    return true;
  } catch (_error) {
    return false;
  }
}

function sceneNumberFrom(value = '', fallback = 0) {
  const text = String(value || '');
  const sceneMatch = text.match(/scene[_\s-]*(\d{1,5})/i);
  if (sceneMatch) return Number(sceneMatch[1]) || fallback;
  const numberMatch = text.match(/(\d{1,5})/);
  return numberMatch ? Number(numberMatch[1]) || fallback : fallback;
}

function sortBySceneNumber(items = []) {
  return [...items].sort((a, b) => {
    const aScene = Number(a.sceneId || sceneNumberFrom(a.path || a.file || '', a.index || 0));
    const bScene = Number(b.sceneId || sceneNumberFrom(b.path || b.file || '', b.index || 0));
    if (aScene !== bScene) return aScene - bScene;
    return String(a.path || a.file || '').localeCompare(String(b.path || b.file || ''), undefined, { numeric: true });
  });
}

function sceneFileToken(sceneId) {
  return `scene_${String(sceneId || 0).padStart(3, '0')}`;
}

async function listPngFiles(folderPath) {
  if (!folderPath || !(await pathExists(folderPath))) return [];
  const entries = await fsp.readdir(folderPath, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile() && /\.png$/i.test(entry.name))
    .map((entry, index) => ({ path: path.join(folderPath, entry.name), file: entry.name, index: index + 1 }));
}

async function collectKeyframes(outputFolder = '', scenes = []) {
  const groupedDir = path.join(outputFolder, 'keyframes');
  const grouped = await listPngFiles(groupedDir);
  if (grouped.length) return sortBySceneNumber(grouped);

  const fromScenes = [];
  for (const [index, scene] of (scenes || []).entries()) {
    const sceneId = Number(scene?.id || scene?.sceneId || index + 1);
    const candidates = [
      scene?.keyframeOutputPath,
      scene?.imagePath,
      path.join(outputFolder, `scene_${String(sceneId).padStart(3, '0')}`, `scene_${String(sceneId).padStart(3, '0')}_keyframe.png`),
      path.join(outputFolder, `scene_${String(sceneId).padStart(3, '0')}`, 'scene_keyframe.png'),
      path.join(outputFolder, `scene_${String(sceneId).padStart(3, '0')}`, 'keyframe.png'),
    ].filter((item) => item && /\.png$/i.test(String(item)));

    for (const candidate of candidates) {
      if (await pathExists(candidate)) {
        fromScenes.push({ path: candidate, file: path.basename(candidate), sceneId, index: index + 1 });
        break;
      }
    }
  }

  if (fromScenes.length) return sortBySceneNumber(fromScenes);

  const sceneDirs = await fsp.readdir(outputFolder, { withFileTypes: true }).catch(() => []);
  const found = [];
  for (const entry of sceneDirs) {
    if (!entry.isDirectory() || !/^scene_\d+/i.test(entry.name)) continue;
    const sceneDir = path.join(outputFolder, entry.name);
    found.push(...(await listPngFiles(sceneDir)));
  }
  return sortBySceneNumber(found.filter((item) => /keyframe/i.test(item.file || item.path || '')));
}

async function readPromptFile(filePath) {
  if (!filePath || !(await pathExists(filePath))) return '';
  return fsp.readFile(filePath, 'utf8').catch(() => '');
}

function isSavedPromptPlaceholder(value = '') {
  return /^\[saved:\s*motion_prompt\.txt\]$/i.test(String(value || '').trim());
}

async function collectMotionPrompts(outputFolder = '', scenes = []) {
  const groupedDir = path.join(outputFolder, 'motion_prompts');
  const groupedEntries = await fsp.readdir(groupedDir, { withFileTypes: true }).catch(() => []);
  const grouped = [];
  for (const [index, entry] of groupedEntries.entries()) {
    if (!entry.isFile() || !/\.txt$/i.test(entry.name)) continue;
    const filePath = path.join(groupedDir, entry.name);
    const text = normalizeWhitespace(await readPromptFile(filePath));
    if (text) grouped.push({ sceneId: sceneNumberFrom(entry.name, index + 1), path: filePath, text, index: index + 1 });
  }
  if (grouped.length) return sortBySceneNumber(grouped);

  const prompts = [];
  for (const [index, scene] of (scenes || []).entries()) {
    const sceneId = Number(scene?.id || scene?.sceneId || index + 1);
    const candidates = [
      await readPromptFile(scene?.motionPromptOutputPath),
      await readPromptFile(scene?.motionPromptPath),
      await readPromptFile(path.join(outputFolder, `scene_${String(sceneId).padStart(3, '0')}`, 'motion_prompt.txt')),
      isSavedPromptPlaceholder(scene?.motionPrompt) ? '' : scene?.motionPrompt,
    ];
    const text = normalizeWhitespace(candidates.find((item) => normalizeWhitespace(item)) || '');
    if (text) prompts.push({ sceneId, text, index: index + 1 });
  }
  return sortBySceneNumber(prompts);
}

function quoteForFileDialog(filePath) {
  return `"${String(filePath || '').replace(/"/g, '""')}"`;
}

async function prepareVeoUpKeyframesFolder(outputFolder = '', keyframes = []) {
  const keyframesDir = path.join(outputFolder, 'keyframes');
  await fsp.mkdir(keyframesDir, { recursive: true });

  const prepared = [];
  for (const [index, item] of sortBySceneNumber(keyframes).entries()) {
    const sceneId = Number(item.sceneId || sceneNumberFrom(item.path || item.file || '', index + 1)) || index + 1;
    const sourcePath = item.path;
    const targetPath = path.join(keyframesDir, `${sceneFileToken(sceneId)}_keyframe.png`);
    if (!sourcePath || !(await pathExists(sourcePath))) continue;
    const sourceIsAlreadyInKeyframesDir = path.resolve(path.dirname(sourcePath)) === path.resolve(keyframesDir);
    const preparedPath = sourceIsAlreadyInKeyframesDir ? sourcePath : targetPath;
    if (!sourceIsAlreadyInKeyframesDir && path.resolve(sourcePath) !== path.resolve(targetPath)) {
      await fsp.copyFile(sourcePath, targetPath);
    }
    prepared.push({ ...item, sceneId, path: preparedPath, file: path.basename(preparedPath), index: index + 1 });
  }

  return { keyframesDir, keyframes: sortBySceneNumber(prepared) };
}

async function exportVeoUpPromptFile(outputFolder = '', prompts = []) {
  const promptText = sortBySceneNumber(prompts)
    .map((item) => normalizeWhitespace(item.text))
    .filter(Boolean)
    .join('\n');
  const promptFilePath = path.join(outputFolder, VEOUP_PROMPTS_READY_FILENAME);
  await fsp.writeFile(promptFilePath, promptText, 'utf8');
  return { promptFilePath, promptText, promptLineCount: promptText ? promptText.split('\n').length : 0 };
}

function buildPowerShellScript() {
  return String.raw`
param([Parameter(Mandatory=$true)][string]$PayloadPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms

# DPI Awareness Setup
try {
  Add-Type -TypeDefinition @"
  using System;
  using System.Runtime.InteropServices;
  public class DpiUtil {
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  }
"@
  [DpiUtil]::SetProcessDPIAware() | Out-Null
  Write-Host "[VeoUp] Process DPI aware enabled."
} catch {
  Write-Host "[VeoUp] DPI awareness call failed or unavailable; continuing."
}

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Collections.Generic;

public struct RECT {
  public int Left;
  public int Top;
  public int Right;
  public int Bottom;
}
public struct POINT {
  public int X;
  public int Y;
}

public class Win32Window {
  public IntPtr Handle;
  public string Title;
  public string ClassName;
  public int ProcessId;
  public RECT Rect;
}

public class VidoraNativeWin {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Auto)] public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT lpPoint);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);

  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

  public static POINT GetMousePos() {
    POINT p;
    GetCursorPos(out p);
    return p;
  }
  public static RECT GetWinRect(IntPtr hWnd) {
    RECT r;
    GetWindowRect(hWnd, out r);
    return r;
  }

  public static List<Win32Window> GetTopLevelWindows() {
    List<Win32Window> list = new List<Win32Window>();
    EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
      if (IsWindowVisible(hWnd)) {
        StringBuilder sbTitle = new StringBuilder(256);
        GetWindowText(hWnd, sbTitle, 256);
        string title = sbTitle.ToString();

        StringBuilder sbClass = new StringBuilder(256);
        GetClassName(hWnd, sbClass, 256);
        string className = sbClass.ToString();

        uint pid;
        GetWindowThreadProcessId(hWnd, out pid);

        RECT rect;
        GetWindowRect(hWnd, out rect);

        list.Add(new Win32Window {
          Handle = hWnd,
          Title = title,
          ClassName = className,
          ProcessId = (int)pid,
          Rect = rect
        });
      }
      return true;
    }, IntPtr.Zero);
    return list;
  }
}
"@

function Normalize-Text([string]$Text) {
  if ($null -eq $Text) { return '' }
  $normalized = $Text.ToString().ToLowerInvariant().Normalize([Text.NormalizationForm]::FormD)
  $builder = New-Object Text.StringBuilder
  foreach ($ch in $normalized.ToCharArray()) {
    if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -ne [Globalization.UnicodeCategory]::NonSpacingMark) { [void]$builder.Append($ch) }
  }
  return $builder.ToString().Replace([string][char]0x0111, 'd').Replace([string][char]0x0110, 'd') -replace '\s+', ' '
}

function Click-Point([double]$X, [double]$Y) {
  [VidoraNativeWin]::SetCursorPos([int]$X, [int]$Y) | Out-Null
  Start-Sleep -Milliseconds 120
  [VidoraNativeWin]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  [VidoraNativeWin]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 250
}

function Click-Element($Element) {
  if ($null -eq $Element) { return $false }
  try {
    $pattern = $Element.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
    $pattern.Invoke()
    Start-Sleep -Milliseconds 350
    return $true
  } catch {}
  $rect = $Element.Current.BoundingRectangle
  if ($rect.Width -gt 1 -and $rect.Height -gt 1) {
    Click-Point ($rect.Left + ($rect.Width / 2)) ($rect.Top + ($rect.Height / 2))
    return $true
  }
  return $false
}

function Resolve-VeoUpLauncher($Payload) {
  $candidates = @()
  if ($Payload.veoupExePath) { $candidates += [string]$Payload.veoupExePath }
  if ($env:VEOUP_EXE) { $candidates += [string]$env:VEOUP_EXE }
  $candidates += @(
    "$env:LOCALAPPDATA\Programs\VeoUp\VeoUp.exe",
    "$env:ProgramFiles\VeoUp\VeoUp.exe",
    (Join-Path ([Environment]::GetFolderPath('ProgramFilesX86')) 'VeoUp\VeoUp.exe')
  )
  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate)) { return $candidate }
  }

  $shortcutRoots = @(
    "$env:APPDATA\Microsoft\Windows\Start Menu\Programs",
    "$env:ProgramData\Microsoft\Windows\Start Menu\Programs",
    [Environment]::GetFolderPath('Desktop')
  )
  foreach ($root in $shortcutRoots) {
    if (!(Test-Path $root)) { continue }
    $shortcut = Get-ChildItem -Path $root -Filter '*VeoUp*.lnk' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($shortcut) { return $shortcut.FullName }
  }
  return ''
}

function Find-RealVeoUpWindow {
  Write-Host "[VeoUp] Enumerating visible top-level windows..."
  $windows = [VidoraNativeWin]::GetTopLevelWindows()
  
  $candidates = @()
  foreach ($win in $windows) {
    $title = $win.Title.Trim()
    $className = $win.ClassName.Trim()
    if ([string]::IsNullOrWhiteSpace($title)) { continue }
    
    # Resolve process info
    $windowProcessId = $win.ProcessId
    $procName = ""
    $exePath = ""
    try {
      $proc = Get-Process -Id $windowProcessId -ErrorAction SilentlyContinue
      if ($proc) {
        $procName = $proc.ProcessName
        $exePath = $proc.MainModule.FileName
      }
    } catch {}

    # Strict Reject List
    $rejectReason = ""
    if (($title -match 'notepad|code|visual studio|terminal|powershell|cmd|browser|explorer|electron|node') -or 
        ($procName -match 'notepad|code|powershell|cmd|conhost|chrome|msedge|firefox|explorer|terminal|electron|node') -or
        ($className -match 'notepad|code|terminal|powershell|cmd|explorer') -or
        ($exePath -match 'notepad|code|powershell|cmd|explorer|electron|node') -or
        ($title -match 'test-veoup')) {
      $rejectReason = "Blacklisted process/title/class/path"
    }

    # Calculate Score
    $score = 0
    if ($rejectReason -eq "") {
      if ($procName -match 'VeoUp') { $score += 100 }
      if ($exePath -match 'VeoUp|veoup_video') { $score += 100 }
      if ($title -match '^\s*VeoUp(\s|v|$)') { $score += 60 }
      if ($className -match '^Qt') { $score += 30 }
      if ($title -match 'v\d+\.\d+\.\d+') { $score += 20 }
    } else {
      $score = -1000
    }

    $candidates += [pscustomobject]@{
      Handle = $win.Handle
      Title = $title
      ClassName = $className
      ProcessId = $windowProcessId
      ProcessName = $procName
      ExecutablePath = $exePath
      Rect = $win.Rect
      Score = $score
      Rejected = ($rejectReason -ne "")
      RejectReason = $rejectReason
    }
  }

  Write-Host "[VeoUp] Window candidates:"
  foreach ($c in $candidates) {
    if ($c.Rejected) {
      Write-Host "  [REJECTED] Score: $($c.Score) | Title: '$($c.Title)' | Class: '$($c.ClassName)' | Process: '$($c.ProcessName)' (PID: $($c.ProcessId)) | Reason: $($c.RejectReason)"
    } else {
      Write-Host "  [CANDIDATE] Score: $($c.Score) | Title: '$($c.Title)' | Class: '$($c.ClassName)' | Process: '$($c.ProcessName)' (PID: $($c.ProcessId))"
    }
  }

  # Filter candidates
  $validCandidates = $candidates | Where-Object { !$_.Rejected -and $_.Score -ge 100 }
  if ($validCandidates.Count -eq 0) {
    return $null
  }

  # Sort descending by score
  $selected = $validCandidates | Sort-Object Score -Descending | Select-Object -First 1
  return $selected
}

function Start-Or-Focus-VeoUp($Payload) {
  $targetWin = Find-RealVeoUpWindow
  if ($null -eq $targetWin) {
    $launcher = Resolve-VeoUpLauncher $Payload
    if (!$launcher) { throw 'VeoUp executable/shortcut not found. Set VEOUP_EXE to the full VeoUp.exe path.' }
    Write-Host "[VeoUp] Launching VeoUp via launcher: $launcher"
    Start-Process -FilePath $launcher | Out-Null
  }

  $deadline = (Get-Date).AddSeconds(45)
  do {
    Start-Sleep -Milliseconds 800
    $targetWin = Find-RealVeoUpWindow
    if ($targetWin) { break }
  } while ((Get-Date) -lt $deadline)

  if (!$targetWin) { throw 'VeoUp window not found after launch/focus attempt.' }

  # Explicit assertion on Notepad / Editor
  if (($targetWin.Title -match 'test-veoup') -or ($targetWin.ClassName -eq 'Notepad') -or ($targetWin.ClassName -match 'Notepad|SlateContainerClass')) {
    Write-Host "[VeoUp] ERROR: Refusing to use editor window as VeoUp target."
    exit 1
  }

  $hwnd = $targetWin.Handle
  if ($Payload.maximizeBeforeAutomation) {
    Write-Host "[VeoUp] Maximizing VeoUp window..."
    [VidoraNativeWin]::ShowWindow($hwnd, 3) | Out-Null
    Start-Sleep -Milliseconds 800
    [VidoraNativeWin]::SetForegroundWindow($hwnd) | Out-Null
    Start-Sleep -Milliseconds 300
  } else {
    [VidoraNativeWin]::ShowWindow($hwnd, 9) | Out-Null
    [VidoraNativeWin]::SetForegroundWindow($hwnd) | Out-Null
    Start-Sleep -Milliseconds 800
  }
  Write-Host "[VeoUp] Selected real VeoUp window: $($targetWin.Title) (Class: $($targetWin.ClassName))"

  # Check if there is an active dialog covering VeoUp (like "Đã hủy")
  $activeTitle = Get-ActiveWindowTitle
  $activeClass = Get-ActiveWindowClassName
  if ($activeTitle -eq 'Đã hủy' -or $activeTitle -match 'thông báo|cảnh báo|nhắc nhở|alert|confirm|notification' -or $activeClass -eq '#32770') {
    Write-Host "[VeoUp] Detected active dialog: $activeTitle (Class: $activeClass). Sending ENTER to clear it."
    [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
    Start-Sleep -Milliseconds 800
  }

  $winElement = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
  return $winElement
}

function Get-ActiveWindowTitle {
  $hwnd = [VidoraNativeWin]::GetForegroundWindow()
  if ($hwnd -eq [IntPtr]::Zero) { return "<None>" }
  $sb = New-Object System.Text.StringBuilder 256
  $null = [VidoraNativeWin]::GetWindowText($hwnd, $sb, 256)
  return $sb.ToString()
}

function Get-ActiveWindowClassName {
  $hwnd = [VidoraNativeWin]::GetForegroundWindow()
  if ($hwnd -eq [IntPtr]::Zero) { return "<None>" }
  $sb = New-Object System.Text.StringBuilder 256
  $null = [VidoraNativeWin]::GetClassName($hwnd, $sb, 256)
  return $sb.ToString()
}

function Wait-For-FileDialog {
  $deadline = (Get-Date).AddSeconds(5)
  do {
    $title = Get-ActiveWindowTitle
    $className = Get-ActiveWindowClassName
    if (($title -match 'open|mở|chọn|select|keyframe|folder') -or ($className -eq '#32770')) {
      return $true
    }
    Start-Sleep -Milliseconds 250
  } while ((Get-Date) -lt $deadline)
  return $false
}

function Find-DescendantByName($Root, [string]$ControlTypeName, [string[]]$Patterns) {
  $all = $Root.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
  foreach ($element in $all) {
    try {
      if ($ControlTypeName -and $element.Current.ControlType.ProgrammaticName -notmatch $ControlTypeName) { continue }
      $name = Normalize-Text $element.Current.Name
      foreach ($pattern in $Patterns) {
        if ($name -match $pattern) { return $element }
      }
    } catch {}
  }
  return $null
}

function Safe-SetClipboardText([string]$Text) {
  for ($i = 1; $i -le 7; $i++) {
    try {
      [System.Windows.Forms.Clipboard]::SetText($Text)
      return
    } catch {
      Start-Sleep -Milliseconds 250
    }
  }
  throw "Clipboard operation failed permanently after 7 retries."
}

function Set-ClipboardText([string]$Text) {
  Safe-SetClipboardText $Text
}

function Count-LeftPromptRows($Window) {
  $rect = $Window.Current.BoundingRectangle
  $leftLimit = $rect.Left + ($rect.Width * 0.55)
  $topLimit = $rect.Top + 260
  $ids = New-Object System.Collections.Generic.HashSet[string]
  $all = $Window.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
  foreach ($element in $all) {
    try {
      $box = $element.Current.BoundingRectangle
      if ($box.Left -gt $leftLimit -or $box.Top -lt $topLimit) { continue }
      $name = ''
      if ($element.Current.Name) { $name = $element.Current.Name.Trim() }
      if ($name -match '^\d{1,5}$') { [void]$ids.Add($name) }
    } catch {}
  }
  return $ids.Count
}

function Click-ImageToVideo-Tab($Window) {
  $tab = Find-DescendantByName $Window '' @('image to video')
  if ($tab) { return Click-Element $tab }
  $rect = $Window.Current.BoundingRectangle
  Click-Point ($rect.Left + 160) ($rect.Top + 48)
  return $true
}

$payload = Get-Content -Path $PayloadPath -Raw -Encoding UTF8 | ConvertFrom-Json
$window = Start-Or-Focus-VeoUp $payload
[void](Click-ImageToVideo-Tab $window)
Start-Sleep -Milliseconds 600

# Get real window bounds and recalculate after maximize
$targetWin = Find-RealVeoUpWindow
if ($null -eq $targetWin) {
  Write-Host "[VeoUp] ERROR: VeoUp window not found."
  exit 1
}
$hwnd = $targetWin.Handle
$rect = [VidoraNativeWin]::GetWinRect($hwnd)
Write-Host "[VeoUp] VeoUp window rect after maximize/focus: Left=$($rect.Left), Top=$($rect.Top), Right=$($rect.Right), Bottom=$($rect.Bottom)"

$blueX = $rect.Left + [double]$payload.blueBoxOffsetX
$blueY = $rect.Top + [double]$payload.blueBoxOffsetY
$redX = $rect.Left + [double]$payload.redBoxOffsetX
$redY = $rect.Top + [double]$payload.redBoxOffsetY

function Invoke-FinalStartButton($Payload) {
  if (!$Payload.startButtonOffsetX -or !$Payload.startButtonOffsetY) {
    Write-Host "[VeoUp] ERROR: Start button coordinates are missing. Cannot start automation."
    exit 1
  }

  $targetWin = Find-RealVeoUpWindow
  if ($null -eq $targetWin) {
    Write-Host "[VeoUp] ERROR: VeoUp window not found before Start click."
    exit 1
  }

  $hwnd = $targetWin.Handle
  [VidoraNativeWin]::ShowWindow($hwnd, 3) | Out-Null
  Start-Sleep -Milliseconds 800
  [VidoraNativeWin]::SetForegroundWindow($hwnd) | Out-Null
  Start-Sleep -Milliseconds 500

  $rect = [VidoraNativeWin]::GetWinRect($hwnd)
  $startX = $rect.Left + [double]$Payload.startButtonOffsetX
  $startY = $rect.Top + [double]$Payload.startButtonOffsetY

  Write-Host "[VeoUp] Start Button offset: X=$($Payload.startButtonOffsetX), Y=$($Payload.startButtonOffsetY)"
  Write-Host "[VeoUp] Maximized VeoUp rect before Start click: Left=$($rect.Left), Top=$($rect.Top), Right=$($rect.Right), Bottom=$($rect.Bottom)"
  Write-Host "[VeoUp] Start Button absolute coordinate: X=$startX, Y=$startY"

  $activeTitle = Get-ActiveWindowTitle
  $activeClass = Get-ActiveWindowClassName
  Write-Host "[VeoUp] Active window before Start click: $activeTitle ($activeClass)"

  if ($activeClass -ne 'Qt690QWindowIcon' -or $activeTitle -notmatch '^VeoUp') {
    Write-Host "[VeoUp] Active window is not VeoUp: $activeTitle ($activeClass). Refocusing..."
    [VidoraNativeWin]::ShowWindow($hwnd, 3) | Out-Null
    Start-Sleep -Milliseconds 800
    [VidoraNativeWin]::SetForegroundWindow($hwnd) | Out-Null
    Start-Sleep -Milliseconds 500
    $activeTitle = Get-ActiveWindowTitle
    $activeClass = Get-ActiveWindowClassName
    if ($activeClass -ne 'Qt690QWindowIcon' -or $activeTitle -notmatch '^VeoUp') {
      Write-Host "[VeoUp] ERROR: Active window is still not VeoUp: $activeTitle ($activeClass). Aborting."
      exit 1
    }
  }

  $workingArea = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
  $isOutsideWorkingArea = ($startX -lt $workingArea.Left -or $startX -gt $workingArea.Right -or $startY -lt $workingArea.Top -or $startY -gt $workingArea.Bottom)
  $isOutsideWindow = ($startX -lt $rect.Left -or $startX -gt $rect.Right -or $startY -lt $rect.Top -or $startY -gt $rect.Bottom)
  $isTitleBar = ($startY -lt ($rect.Top + 80))
  $isWindowControls = ($startX -gt ($rect.Right - 220) -and $startY -lt ($rect.Top + 100))

  if ($isOutsideWorkingArea -or $isOutsideWindow -or $isTitleBar -or $isWindowControls) {
    Write-Host "[VeoUp] Start Button coordinate looks unsafe or points to window controls. Please recalibrate Start Button."
    Write-Host "[VeoUp] Debug rect: Left=$($rect.Left), Top=$($rect.Top), Right=$($rect.Right), Bottom=$($rect.Bottom)"
    Write-Host "[VeoUp] Debug coordinate: X=$startX, Y=$startY"
    Write-Host "[VeoUp] Reason: OutsideWorkingArea=$isOutsideWorkingArea, OutsideWindow=$isOutsideWindow, TitleBar=$isTitleBar, WindowControls=$isWindowControls"
    exit 1
  }

  if ($Payload.previewStartButtonOnly) {
    Write-Host "[VeoUp] Preview mode: cursor moved to Start Button coordinate, click skipped."
    [VidoraNativeWin]::SetCursorPos([int]$startX, [int]$startY) | Out-Null
    Start-Sleep -Seconds 1.5
    return
  }

  Write-Host "[VeoUp] Clicking Start Video button at absolute coordinate ($startX, $startY)..."
  Click-Point $startX $startY
  Start-Sleep -Milliseconds 700
  if ([VidoraNativeWin]::IsIconic($hwnd)) {
    Write-Host "[VeoUp] ERROR: VeoUp was minimized after Start Button click. Start coordinate is wrong."
    [VidoraNativeWin]::ShowWindow($hwnd, 3) | Out-Null
    exit 1
  }
  Start-Sleep -Milliseconds 800
  Write-Host "[VeoUp] Start confirmation sent."
  [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
  Start-Sleep -Seconds 1
}

Write-Host "[VeoUp] Importing keyframes in chunks of 3 to avoid Windows file dialog path limit..."
$keyframes = @($payload.keyframes)
$totalCount = $keyframes.Count
$chunkSize = 3
for ($batchStart = 0; $batchStart -lt $totalCount; $batchStart += $chunkSize) {
  $batchEnd = [Math]::Min($batchStart + $chunkSize - 1, $totalCount - 1)
  $currentSceneId = $batchEnd + 1
  $batchKeyframes = @()
  for ($i = $batchStart; $i -le $batchEnd; $i += 1) { $batchKeyframes += [string]$keyframes[$i] }
  $batchFileSelectionText = ($batchKeyframes | ForEach-Object { '"' + $_ + '"' }) -join ' '

  Write-Host "[VeoUp] Importing image chunk scenes $($batchStart + 1)-$currentSceneId of $totalCount..."
  Write-Host "[VeoUp] Clicking Blue Box image import area at coordinate ($blueX, $blueY)..."
  Click-Point $blueX $blueY

  Write-Host "[VeoUp] Waiting for Open File dialog..."
  if (!(Wait-For-FileDialog)) {
    $activeTitle = Get-ActiveWindowTitle
    $activeClass = Get-ActiveWindowClassName
    Write-Host "[VeoUp] Calibrated Blue Box click did not open the file dialog for chunk ending at scene $currentSceneId."
    Write-Host "[VeoUp] Current active window: $activeTitle (Class: $activeClass)"
    exit 1
  }

  Write-Host "[VeoUp] Copying $($batchKeyframes.Count) quoted PNG paths to clipboard..."
  Set-ClipboardText $batchFileSelectionText
  Start-Sleep -Milliseconds 600

  Write-Host "[VeoUp] Pasting PNG chunk into File name input..."
  [System.Windows.Forms.SendKeys]::SendWait('%n')
  Start-Sleep -Milliseconds 300
  [System.Windows.Forms.SendKeys]::SendWait('^a')
  Start-Sleep -Milliseconds 200
  [System.Windows.Forms.SendKeys]::SendWait('^v')
  Start-Sleep -Milliseconds 500
  [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')

  Start-Sleep -Milliseconds 1500
  $titleAfterOpen = Get-ActiveWindowTitle
  $classAfterOpen = Get-ActiveWindowClassName
  Write-Host "[VeoUp] Active window after dialog ENTER: $titleAfterOpen (Class: $classAfterOpen)"

  if (($titleAfterOpen -match 'open|select|keyframe|folder') -or ($classAfterOpen -eq '#32770')) {
    Write-Host "[VeoUp] ERROR: File dialog is still open for chunk ending at scene $currentSceneId. Import path or file selection failed."
    exit 1
  }

  Write-Host "[VeoUp] Waiting 2.5 seconds for VeoUp image grid to append chunk..."
  Start-Sleep -Seconds 2.5
}

Write-Host "[VeoUp] Refocusing VeoUp and clicking Red Box prompt input area at coordinate ($redX, $redY)..."
$window = Start-Or-Focus-VeoUp $payload
Start-Sleep -Milliseconds 500
Click-Point $redX $redY
Start-Sleep -Milliseconds 500

$title = Get-ActiveWindowTitle
$className = Get-ActiveWindowClassName
Write-Host "[VeoUp] Active window before prompt paste: $title (Class: $className)"
if ($title -notmatch 'VeoUp') {
  Write-Host "[VeoUp] ERROR: Active window is not VeoUp before prompt paste: $title"
  exit 1
}

$promptText = Get-Content -Path ([string]$payload.promptFilePath) -Raw -Encoding UTF8
Set-ClipboardText $promptText
Start-Sleep -Milliseconds 500

Write-Host "[VeoUp] Pasting all prompt lines into Red Box..."
[System.Windows.Forms.SendKeys]::SendWait('^a')
Start-Sleep -Milliseconds 150
[System.Windows.Forms.SendKeys]::SendWait('^v')
Start-Sleep -Milliseconds 500

Write-Host "[VeoUp Macro Progress] All keyframes and prompt lines dispatched."

Start-Sleep -Seconds 1.5
Invoke-FinalStartButton $payload
if (Get-Command Clear-Clipboard -ErrorAction SilentlyContinue) { Clear-Clipboard } else { [System.Windows.Forms.Clipboard]::Clear() }
Write-Host "[VeoUp Macro Progress] Final Start triggered and clipboard cleared."

$result = [pscustomobject]@{
  ok = $true
  expectedRows = [int]$payload.promptLineCount
  detectedRows = [int]$payload.promptLineCount
  imageCount = [int]$payload.imageCount
  promptLineCount = [int]$payload.promptLineCount
  promptFilePath = [string]$payload.promptFilePath
  keyframesFolder = [string]$payload.keyframesFolder
}

'VIDORA_VEOUP_RESULT ' + ($result | ConvertTo-Json -Depth 8 -Compress)
Write-Host "[VeoUp] Automation completed."
`;
}

function runPowerShell(scriptPath, payloadPath, timeoutMs = 120000) {
  return new Promise((resolve) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, payloadPath], {
      windowsHide: false,
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const line = stdout.split(/\r?\n/).find((item) => item.startsWith('VIDORA_VEOUP_RESULT '));
      let parsed = null;
      if (line) {
        try { parsed = JSON.parse(line.replace(/^VIDORA_VEOUP_RESULT\s+/, '')); } catch (_error) {}
      }
      resolve({ code, stdout, stderr, parsed });
    });
  });
}

function readJsonFileStripBom(filePath) {
  let raw = fs.readFileSync(filePath, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) {
    raw = raw.slice(1);
    fs.writeFileSync(filePath, raw, 'utf8');
    console.log(`[VeoUp] Removed UTF-8 BOM from ${filePath}`);
  }
  return JSON.parse(raw.trim());
}

async function executeVeoUpAutomation(payload = {}) {
  const outputFolder = String(payload.outputFolder || '').trim();
  if (!outputFolder) return { ok: false, error: 'Missing output folder for VeoUp automation.' };
  if (!(await pathExists(outputFolder))) return { ok: false, error: `Output folder does not exist: ${outputFolder}` };

  const scenes = Array.isArray(payload.scenes) ? payload.scenes : [];
  const collectedKeyframes = await collectKeyframes(outputFolder, scenes);
  const prompts = await collectMotionPrompts(outputFolder, scenes);
  const exportedPrompts = await exportVeoUpPromptFile(outputFolder, prompts);
  const preparedKeyframes = await prepareVeoUpKeyframesFolder(outputFolder, collectedKeyframes);
  const keyframes = preparedKeyframes.keyframes;
  const promptLineCount = exportedPrompts.promptLineCount;

  const veoupExePath = payload.veoupExePath || await findVeoupExecutable();
  if (!veoupExePath) {
    return { ok: false, error: 'VeoUp executable not found. Please ensure VeoUp is installed on drive C or D.' };
  }
  payload.veoupExePath = veoupExePath;

  // Load calibrated coordinates config BOM-safely
  let blueBoxOffsetX = null;
  let blueBoxOffsetY = null;
  let redBoxOffsetX = null;
  let redBoxOffsetY = null;
  let startButtonOffsetX = null;
  let startButtonOffsetY = null;

  const userDataDir = payload.userDataDir || path.join(os.homedir(), 'AppData', 'Roaming', 'vidora');
  const configPaths = [
    path.join(userDataDir, 'veoup-coordinates.json'),
    path.join(__dirname, '..', 'veoup-test-coordinates.json'),
    path.join(process.cwd(), 'veoup-test-coordinates.json')
  ];

  let configFound = false;
  for (const configPath of configPaths) {
    try {
      if (fs.existsSync(configPath)) {
        console.log(`[VeoUp] Loading calibrated coordinates from ${configPath}...`);
        const savedConfig = readJsonFileStripBom(configPath);
        if (savedConfig.startButtonValidated !== true) {
          console.warn(`[VeoUp] Config at ${configPath} is invalid or lacks startButtonValidated validation.`);
          continue;
        }
        blueBoxOffsetX = savedConfig.blueBoxOffsetX;
        blueBoxOffsetY = savedConfig.blueBoxOffsetY;
        redBoxOffsetX = savedConfig.redBoxOffsetX;
        redBoxOffsetY = savedConfig.redBoxOffsetY;
        startButtonOffsetX = savedConfig.startButtonOffsetX;
        startButtonOffsetY = savedConfig.startButtonOffsetY;
        configFound = true;
        break;
      }
    } catch (err) {
      console.error(`[VeoUp] Error reading config file at ${configPath}: ${err.message}`);
    }
  }

  if (!configFound ||
      blueBoxOffsetX === undefined || blueBoxOffsetX === null ||
      blueBoxOffsetY === undefined || blueBoxOffsetY === null ||
      redBoxOffsetX === undefined || redBoxOffsetX === null ||
      redBoxOffsetY === undefined || redBoxOffsetY === null ||
      startButtonOffsetX === undefined || startButtonOffsetX === null ||
      startButtonOffsetY === undefined || startButtonOffsetY === null) {
    console.error('[VeoUp] Missing coordinate setup. Please open Vidora settings and run “Thiết lập tọa độ VeoUp”.');
    return { ok: false, error: 'Missing coordinate setup. Please open Vidora settings and run “Thiết lập tọa độ VeoUp”.' };
  }

  // Validate input paths before UI automation
  if (!fs.existsSync(preparedKeyframes.keyframesDir)) {
    return { ok: false, error: `Keyframes directory does not exist: ${preparedKeyframes.keyframesDir}` };
  }
  if (keyframes.length === 0) {
    return { ok: false, error: `Keyframes directory does not contain .png files: ${preparedKeyframes.keyframesDir}` };
  }
  if (!fs.existsSync(exportedPrompts.promptFilePath)) {
    return { ok: false, error: `Prompts ready file does not exist: ${exportedPrompts.promptFilePath}` };
  }
  if (!exportedPrompts.promptText || exportedPrompts.promptText.trim().length === 0) {
    return { ok: false, error: `Prompts ready file is empty: ${exportedPrompts.promptFilePath}` };
  }
  if (promptLineCount <= 0) {
    return { ok: false, error: `Expected scene count must be greater than 0, got: ${promptLineCount}` };
  }

  // Check if VeoUp process is already running, spawn if not
  const isRunning = await isProcessRunning('VeoUp.exe');
  if (!isRunning) {
    console.log(`[VeoUp] Launching executable: ${veoupExePath}`);
    const child = spawn(veoupExePath, [], {
      detached: true,
      stdio: 'ignore',
      windowsHide: false
    });
    child.unref();
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  if (keyframes.length !== promptLineCount) {
    return {
      ok: false,
      error: `VeoUp image/prompt count mismatch: ${keyframes.length} images, ${promptLineCount} prompt lines.`,
      outputFolder,
      keyframes: keyframes.map((item) => item.path),
      keyframesFolder: preparedKeyframes.keyframesDir,
      promptFilePath: exportedPrompts.promptFilePath,
      promptLineCount,
    };
  }

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'vidora-veoup-'));
  const payloadPath = path.join(tempDir, 'payload.json');
  const scriptPath = path.join(tempDir, 'run-veoup.ps1');
  const automationPayload = {
    projectName: payload.projectName || '',
    outputFolder,
    veoupExePath: payload.veoupExePath || process.env.VEOUP_EXE || '',
    imageCount: keyframes.length,
    promptLineCount,
    keyframesFolder: preparedKeyframes.keyframesDir,
    promptFilePath: exportedPrompts.promptFilePath,
    keyframes: keyframes.map((item) => item.path),
    fileSelectionText: keyframes.map((item) => quoteForFileDialog(item.path)).join(' '),
    promptText: exportedPrompts.promptText,
    promptBoxX: payload.promptBoxX || null,
    promptBoxY: payload.promptBoxY || null,
    blueBoxOffsetX,
    blueBoxOffsetY,
    redBoxOffsetX,
    redBoxOffsetY,
    startButtonOffsetX,
    startButtonOffsetY,
    maximizeBeforeAutomation: payload.maximizeBeforeAutomation !== false,
    autoStartVideoGeneration: Boolean(payload.autoStartVideoGeneration),
  };

  await fsp.writeFile(payloadPath, JSON.stringify(automationPayload, null, 2), 'utf8');
  await fsp.writeFile(scriptPath, buildPowerShellScript(), 'utf8');

  const result = await runPowerShell(scriptPath, payloadPath, Number(payload.timeoutMs || 120000));
  if (result.parsed) {
    return {
      ...result.parsed,
      ok: Boolean(result.parsed.ok),
      outputFolder,
      keyframes: keyframes.map((item) => item.path),
      keyframesFolder: preparedKeyframes.keyframesDir,
      promptFilePath: exportedPrompts.promptFilePath,
      promptLineCount,
      tempDir,
      powershellExitCode: result.code,
    };
  }
  return {
    ok: false,
    error: result.stderr || result.stdout || `VeoUp automation failed with exit code ${result.code}`,
    outputFolder,
    keyframes: keyframes.map((item) => item.path),
    keyframesFolder: preparedKeyframes.keyframesDir,
    promptFilePath: exportedPrompts.promptFilePath,
    promptLineCount,
    tempDir,
    powershellExitCode: result.code,
  };
}
let calibrationSession = null;

async function startCoordinateSetup(payload = {}) {
  const veoupExePath = payload.veoupExePath || await findVeoupExecutable();
  if (!veoupExePath) {
    return { ok: false, error: 'VeoUp executable not found. Please ensure VeoUp is installed on drive C or D.' };
  }
  payload.veoupExePath = veoupExePath;

  // Check if VeoUp process is already running, spawn if not
  const isRunning = await isProcessRunning('VeoUp.exe');
  if (!isRunning) {
    console.log(`[VeoUp] Launching executable for setup: ${veoupExePath}`);
    const child = spawn(veoupExePath, [], {
      detached: true,
      stdio: 'ignore',
      windowsHide: false
    });
    child.unref();
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Create temp script to focus, maximize and get rect
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'vidora-veoup-setup-'));
  const setupScriptPath = path.join(tempDir, 'setup.ps1');
  const payloadPath = path.join(tempDir, 'payload.json');

  const setupScript = `
param([Parameter(Mandatory=$true)][string]$PayloadPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms

try {
  Add-Type -TypeDefinition @"
  using System;
  using System.Runtime.InteropServices;
  public class DpiUtil {
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  }
"@
  [DpiUtil]::SetProcessDPIAware() | Out-Null
} catch {}

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Collections.Generic;

public struct RECT {
  public int Left;
  public int Top;
  public int Right;
  public int Bottom;
}
public struct POINT {
  public int X;
  public int Y;
}
public class Win32Window {
  public IntPtr Handle;
  public string Title;
  public string ClassName;
  public int ProcessId;
  public RECT Rect;
}
public class VidoraNativeWin {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Auto)] public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

  public static RECT GetWinRect(IntPtr hWnd) {
    RECT r;
    GetWindowRect(hWnd, out r);
    return r;
  }

  public static List<Win32Window> GetTopLevelWindows() {
    List<Win32Window> list = new List<Win32Window>();
    EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
      if (IsWindowVisible(hWnd)) {
        StringBuilder sbTitle = new StringBuilder(256);
        GetWindowText(hWnd, sbTitle, 256);
        string title = sbTitle.ToString();

        StringBuilder sbClass = new StringBuilder(256);
        GetClassName(hWnd, sbClass, 256);
        string className = sbClass.ToString();

        uint pid;
        GetWindowThreadProcessId(hWnd, out pid);

        RECT rect;
        GetWindowRect(hWnd, out rect);

        list.Add(new Win32Window {
          Handle = hWnd,
          Title = title,
          ClassName = className,
          ProcessId = (int)pid,
          Rect = rect
        });
      }
      return true;
    }, IntPtr.Zero);
    return list;
  }
}
"@

function Find-RealVeoUpWindow {
  $windows = [VidoraNativeWin]::GetTopLevelWindows()
  $candidates = @()
  foreach ($win in $windows) {
    $title = $win.Title.Trim()
    $className = $win.ClassName.Trim()
    if ([string]::IsNullOrWhiteSpace($title)) { continue }
    
    $windowProcessId = $win.ProcessId
    $procName = ""
    $exePath = ""
    try {
      $proc = Get-Process -Id $windowProcessId -ErrorAction SilentlyContinue
      if ($proc) {
        $procName = $proc.ProcessName
        $exePath = $proc.MainModule.FileName
      }
    } catch {}

    $rejectReason = ""
    if (($title -match 'notepad|code|visual studio|terminal|powershell|cmd|browser|explorer|electron|node') -or 
        ($procName -match 'notepad|code|powershell|cmd|conhost|chrome|msedge|firefox|explorer|terminal|electron|node') -or
        ($className -match 'notepad|code|terminal|powershell|cmd|explorer') -or
        ($exePath -match 'notepad|code|powershell|cmd|explorer|electron|node') -or
        ($title -match 'test-veoup')) {
      $rejectReason = "Blacklisted"
    }

    $score = 0
    if ($rejectReason -eq "") {
      if ($procName -match 'VeoUp') { $score += 100 }
      if ($exePath -match 'VeoUp|veoup_video') { $score += 100 }
      if ($title -match '^\\s*VeoUp(\\s|v|$)') { $score += 60 }
      if ($className -match '^Qt') { $score += 30 }
    } else { $score = -1000 }

    $candidates += [pscustomobject]@{
      Handle = $win.Handle
      Title = $title
      ClassName = $className
      ProcessId = $windowProcessId
      Rect = $win.Rect
      Score = $score
      Rejected = ($rejectReason -ne "")
    }
  }

  $validCandidates = $candidates | Where-Object { !$_.Rejected -and $_.Score -ge 100 }
  if ($validCandidates.Count -eq 0) { return $null }
  return $validCandidates | Sort-Object Score -Descending | Select-Object -First 1
}

$targetWin = Find-RealVeoUpWindow
if ($null -eq $targetWin) {
  exit 1
}

# Maximize window
$hwnd = $targetWin.Handle
[VidoraNativeWin]::ShowWindow($hwnd, 3) | Out-Null
Start-Sleep -Milliseconds 800
[VidoraNativeWin]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 300

# Get fresh rect
$rect = [VidoraNativeWin]::GetWinRect($hwnd)
$result = [pscustomobject]@{
  hwnd = $hwnd.ToString()
  left = $rect.Left
  top = $rect.Top
  right = $rect.Right
  bottom = $rect.Bottom
  targetWindowClass = $targetWin.ClassName
}

'VIDORA_CALIBRATION_START ' + ($result | ConvertTo-Json -Compress)
`;

  await fsp.writeFile(payloadPath, JSON.stringify({ veoupExePath }), 'utf8');
  await fsp.writeFile(setupScriptPath, setupScript, 'utf8');

  return new Promise((resolve) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', setupScriptPath, payloadPath], {
      windowsHide: false,
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
    }, 15000);

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    child.on('close', async (code) => {
      clearTimeout(timer);
      try {
        await fsp.rm(tempDir, { recursive: true, force: true });
      } catch (_) {}

      if (code !== 0) {
        return resolve({ ok: false, error: stderr || `PowerShell exited with code ${code}` });
      }

      const line = stdout.split(/\r?\n/).find((item) => item.startsWith('VIDORA_CALIBRATION_START '));
      if (!line) {
        return resolve({ ok: false, error: 'Could not parse calibration start result.' });
      }

      try {
        const parsed = JSON.parse(line.replace(/^VIDORA_CALIBRATION_START\s+/, ''));
        calibrationSession = {
          hwnd: parsed.hwnd,
          rect: {
            left: Number(parsed.left),
            top: Number(parsed.top),
            right: Number(parsed.right),
            bottom: Number(parsed.bottom)
          },
          targetWindowClass: parsed.targetWindowClass,
          offsets: {}
        };
        resolve({ ok: true, rect: calibrationSession.rect });
      } catch (err) {
        resolve({ ok: false, error: `JSON parse failed: ${err.message}` });
      }
    });
  });
}

let resolveHotkey = null;

function waitForHotkey() {
  return new Promise((resolve) => {
    resolveHotkey = resolve;
    let resolved = false;

    const cleanup = () => {
      try {
        globalShortcut.unregister('Return');
        globalShortcut.unregister('Enter');
        globalShortcut.unregister('F8');
        console.log('[VeoUp Setup] Enter/F8 capture unregistered.');
      } catch (err) {
        console.error('[VeoUp Setup] Error unregistering shortcuts:', err);
      }
    };

    const trigger = (key) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolveHotkey = null;
      resolve(key);
    };

    try {
      console.log('[VeoUp Setup] Enter/F8 capture registered.');
      globalShortcut.register('Return', () => trigger('Return'));
      globalShortcut.register('Enter', () => trigger('Enter'));
      globalShortcut.register('F8', () => trigger('F8'));
    } catch (err) {
      console.error('[VeoUp Setup] Error registering shortcuts:', err);
      resolved = true;
      resolveHotkey = null;
      resolve('Error');
    }
  });
}

function cancelCoordinateSetup() {
  try {
    globalShortcut.unregister('Return');
    globalShortcut.unregister('Enter');
    globalShortcut.unregister('F8');
    console.log('[VeoUp Setup] Enter/F8 capture unregistered via cancel.');
  } catch (err) {}
  if (resolveHotkey) {
    resolveHotkey('Cancel');
    resolveHotkey = null;
  }
  calibrationSession = null;
  return { ok: true };
}

async function validateBlueBoxCoordinate(hwnd, offsetX, offsetY) {
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'vidora-veoup-val-'));
  const scriptPath = path.join(tempDir, 'validate.ps1');

  const valScript = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public struct RECT {
  public int Left;
  public int Top;
  public int Right;
  public int Bottom;
}

public class VidoraNativeWin {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Auto)] public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

  public static RECT GetWinRect(IntPtr hWnd) {
    RECT r;
    GetWindowRect(hWnd, out r);
    return r;
  }
}
"@

function Click-Point([double]$X, [double]$Y) {
  [VidoraNativeWin]::SetCursorPos([int]$X, [int]$Y) | Out-Null
  Start-Sleep -Milliseconds 120
  [VidoraNativeWin]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  [VidoraNativeWin]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 250
}

function Get-ActiveWindowTitle {
  $hwnd = [VidoraNativeWin]::GetForegroundWindow()
  if ($hwnd -eq [IntPtr]::Zero) { return "<None>" }
  $sb = New-Object System.Text.StringBuilder 256
  $null = [VidoraNativeWin]::GetWindowText($hwnd, $sb, 256)
  return $sb.ToString()
}

function Get-ActiveWindowClassName {
  $hwnd = [VidoraNativeWin]::GetForegroundWindow()
  if ($hwnd -eq [IntPtr]::Zero) { return "<None>" }
  $sb = New-Object System.Text.StringBuilder 256
  $null = [VidoraNativeWin]::GetClassName($hwnd, $sb, 256)
  return $sb.ToString()
}

function Wait-For-FileDialog {
  $deadline = (Get-Date).AddSeconds(5)
  do {
    $title = Get-ActiveWindowTitle
    $className = Get-ActiveWindowClassName
    if (($title -match 'open|mở|chọn|select|keyframe|folder') -or ($className -eq '#32770')) {
      return $true
    }
    Start-Sleep -Milliseconds 250
  } while ((Get-Date) -lt $deadline)
  return $false
}

$hwnd = [IntPtr](${hwnd});
[VidoraNativeWin]::ShowWindow($hwnd, 3) | Out-Null
Start-Sleep -Milliseconds 800
[VidoraNativeWin]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 300

$rect = [VidoraNativeWin]::GetWinRect($hwnd)
$blueX = $rect.Left + [double]${offsetX}
$blueY = $rect.Top + [double]${offsetY}

Write-Host "[VeoUp Setup] Testing Blue Box coordinate at ($blueX, $blueY)..."
Click-Point $blueX $blueY

if (Wait-For-FileDialog) {
  Write-Host "[VeoUp Setup] Open File dialog detected, Blue Box coordinate valid."
  [System.Windows.Forms.SendKeys]::SendWait('{ESC}')
  $res = @{ valid = $true }
} else {
  Write-Host "[VeoUp Setup] Blue Box coordinate failed."
  $res = @{ valid = $false }
}

'VIDORA_BLUEBOX_VAL ' + ($res | ConvertTo-Json -Compress)
`;

  await fsp.writeFile(scriptPath, valScript, 'utf8');

  return new Promise((resolve) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
      windowsHide: false,
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
    }, 10000);

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    child.on('close', async (code) => {
      clearTimeout(timer);
      try {
        await fsp.rm(tempDir, { recursive: true, force: true });
      } catch (_) {}

      const line = stdout.split(/\r?\n/).find((item) => item.startsWith('VIDORA_BLUEBOX_VAL '));
      if (line) {
        try {
          const parsed = JSON.parse(line.replace(/^VIDORA_BLUEBOX_VAL\s+/, ''));
          resolve(parsed.valid === true);
          return;
        } catch (_) {}
      }
      resolve(false);
    });
  });
}

async function previewStartButtonCoordinate(hwnd, offsetX, offsetY) {
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'vidora-veoup-prev-'));
  const scriptPath = path.join(tempDir, 'preview.ps1');

  const prevScript = `
$ErrorActionPreference = 'Stop'
Add-Type @"
using System;
using System.Runtime.InteropServices;

public struct RECT {
  public int Left;
  public int Top;
  public int Right;
  public int Bottom;
}

public class VidoraNativeWin {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

  public static RECT GetWinRect(IntPtr hWnd) {
    RECT r;
    GetWindowRect(hWnd, out r);
    return r;
  }
}
"@

$hwnd = [IntPtr](${hwnd});
[VidoraNativeWin]::ShowWindow($hwnd, 3) | Out-Null
Start-Sleep -Milliseconds 800
[VidoraNativeWin]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 300

$rect = [VidoraNativeWin]::GetWinRect($hwnd)
$startX = $rect.Left + [double]${offsetX}
$startY = $rect.Top + [double]${offsetY}

  Write-Host "[VeoUp Setup] Previewing Start Button coordinate. The cursor should be on the “Bắt đầu tạo video” button."
[VidoraNativeWin]::SetCursorPos([int]$startX, [int]$startY) | Out-Null
Start-Sleep -Milliseconds 1500
`;

  await fsp.writeFile(scriptPath, prevScript, 'utf8');

  return new Promise((resolve) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
      windowsHide: false,
    });
    const timer = setTimeout(() => {
      child.kill();
    }, 5000);

    child.on('close', async () => {
      clearTimeout(timer);
      try {
        await fsp.rm(tempDir, { recursive: true, force: true });
      } catch (_) {}
      resolve(true);
    });
  });
}

async function captureVeoUpCoordinate(pointType, userDataDir) {
  if (!calibrationSession) {
    return { ok: false, error: 'No active calibration session. Run start-coordinate-setup first.' };
  }

  // Wait for Enter/F8 hotkey
  const key = await waitForHotkey();
  if (key === 'Cancel') {
    return { ok: false, error: 'Calibration cancelled.' };
  }
  if (key === 'Error') {
    return { ok: false, error: 'Failed to register global hotkey.' };
  }

  console.log(`[VeoUp Setup] Capturing ${pointType} coordinate from current cursor position...`);
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'vidora-veoup-capture-'));
  const scriptPath = path.join(tempDir, 'capture.ps1');

  const captureScript = `
try {
  Add-Type -TypeDefinition @"
  using System;
  using System.Runtime.InteropServices;
  public struct POINT {
    public int X;
    public int Y;
  }
  public class Win32Cursor {
    [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT lpPoint);
    public static POINT GetPos() {
      POINT p;
      GetCursorPos(out p);
      return p;
    }
  }
"@
} catch {}

$p = [Win32Cursor]::GetPos()
$result = [pscustomobject]@{
  x = $p.X
  y = $p.Y
}
'VIDORA_CURSOR_POS ' + ($result | ConvertTo-Json -Compress)
`;

  await fsp.writeFile(scriptPath, captureScript, 'utf8');

  const cursorResult = await new Promise((resolve) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
      windowsHide: false,
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
    }, 5000);

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    child.on('close', async (code) => {
      clearTimeout(timer);
      try {
        await fsp.rm(tempDir, { recursive: true, force: true });
      } catch (_) {}

      if (code !== 0) {
        return resolve({ ok: false, error: stderr || `PowerShell exited with code ${code}` });
      }

      const line = stdout.split(/\r?\n/).find((item) => item.startsWith('VIDORA_CURSOR_POS '));
      if (!line) {
        return resolve({ ok: false, error: 'Could not capture cursor position.' });
      }

      try {
        const parsed = JSON.parse(line.replace(/^VIDORA_CURSOR_POS\s+/, ''));
        resolve({ ok: true, x: Number(parsed.x), y: Number(parsed.y) });
      } catch (err) {
        resolve({ ok: false, error: `JSON parse failed: ${err.message}` });
      }
    });
  });

  if (!cursorResult.ok) {
    return cursorResult;
  }

  const cursorX = cursorResult.x;
  const cursorY = cursorResult.y;

  const rect = calibrationSession.rect;
  const offsetX = cursorX - rect.left;
  const offsetY = cursorY - rect.top;

  // Validate Blue Box
  if (pointType === 'blueBox') {
    console.log('[VeoUp Setup] Testing Blue Box coordinate...');
    const isValid = await validateBlueBoxCoordinate(calibrationSession.hwnd, offsetX, offsetY);
    if (!isValid) {
      console.warn('[VeoUp Setup] Blue Box coordinate failed validation.');
      return {
        ok: false,
        validationFailed: true,
        error: 'Tọa độ Blue Box chưa đúng, hãy đưa chuột vào đúng vùng bấm mở ảnh rồi nhấn Enter lại.'
      };
    }
    console.log('[VeoUp Setup] Open File dialog detected, Blue Box coordinate valid.');
  }

  // Sanity check for startButton before saving offset or doing preview
  if (pointType === 'startButton') {
    const isTitleBar = offsetY < 80;
    const isWindowControls = (offsetX > (rect.right - rect.left - 220)) && (offsetY < 100);
    const isOutsideWindow = offsetX < 0 || offsetX > (rect.right - rect.left) || offsetY < 0 || offsetY > (rect.bottom - rect.top);
    
    if (isTitleBar || isWindowControls || isOutsideWindow) {
      console.warn('[VeoUp Setup] Start Button coordinate failed sanity check.');
      return {
        ok: false,
        validationFailed: true,
        error: 'Tọa độ nút Start Button không hợp lệ (nằm ở thanh tiêu đề, vùng điều khiển hoặc ngoài cửa sổ VeoUp). Vui lòng di chuột đúng vị trí và nhấn Enter lại.'
      };
    }

    console.log('[VeoUp Setup] Starting Start Button cursor preview...');
    await previewStartButtonCoordinate(calibrationSession.hwnd, offsetX, offsetY);
  }

  calibrationSession.offsets[`${pointType}OffsetX`] = offsetX;
  calibrationSession.offsets[`${pointType}OffsetY`] = offsetY;

  if (pointType === 'startButton') {
    return { ok: true, offsets: calibrationSession.offsets, completed: false, needsConfirmation: true };
  }

  return { ok: true, offsets: calibrationSession ? calibrationSession.offsets : {}, completed: false };
}

async function saveVeoUpCoordinateConfig(userDataDir, config) {
  const configPath = path.join(userDataDir, 'veoup-coordinates.json');
  try {
    const finalConfig = {
      blueBoxOffsetX: config.blueBoxOffsetX,
      blueBoxOffsetY: config.blueBoxOffsetY,
      redBoxOffsetX: config.redBoxOffsetX,
      redBoxOffsetY: config.redBoxOffsetY,
      startButtonOffsetX: config.startButtonOffsetX,
      startButtonOffsetY: config.startButtonOffsetY,
      targetWindowClass: calibrationSession?.targetWindowClass || 'Qt690QWindowIcon',
      targetTitlePrefix: 'VeoUp',
      windowMode: 'maximized',
      startButtonValidated: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await fsp.mkdir(userDataDir, { recursive: true });
    await fsp.writeFile(configPath, JSON.stringify(finalConfig, null, 2), 'utf8');
    console.log(`[VeoUp] Saved coordinate config to ${configPath}:`, finalConfig);
    calibrationSession = null; // Clear session on success
    return { ok: true };
  } catch (err) {
    console.error(`[VeoUp] Error saving config at ${configPath}: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

async function getVeoUpCoordinateConfig(userDataDir) {
  const configPath = path.join(userDataDir, 'veoup-coordinates.json');
  try {
    if (fs.existsSync(configPath)) {
      const config = readJsonFileStripBom(configPath);
      if (config && config.startButtonValidated === true) {
        return config;
      }
    }
  } catch (err) {
    console.error(`[VeoUp] Error reading config at ${configPath}: ${err.message}`);
  }
  return null;
}

async function deleteVeoUpCoordinateConfig(payload) {
  let userDataDir;
  let projectDir;
  if (typeof payload === 'string') {
    userDataDir = payload;
  } else if (payload && typeof payload === 'object') {
    userDataDir = payload.userDataDir;
    projectDir = payload.projectDir;
  }
  
  userDataDir = userDataDir || path.join(os.homedir(), 'AppData', 'Roaming', 'vidora');
  const projectRootDir = path.join(__dirname, '..');
  const workingDir = process.cwd();
  
  // Set up list of candidate paths to delete
  const pathsToDelete = new Set();
  
  // AppData userData/Roaming
  pathsToDelete.add(path.join(userDataDir, 'veoup-coordinates.json'));
  pathsToDelete.add(path.join(userDataDir, 'veoup-test-coordinates.json'));
  if (process.env.APPDATA) {
    const appDataRoaming = path.join(process.env.APPDATA, 'vidora');
    pathsToDelete.add(path.join(appDataRoaming, 'veoup-coordinates.json'));
    pathsToDelete.add(path.join(appDataRoaming, 'veoup-test-coordinates.json'));
  }
  
  // Project root
  pathsToDelete.add(path.join(projectRootDir, 'veoup-coordinates.json'));
  pathsToDelete.add(path.join(projectRootDir, 'veoup-test-coordinates.json'));
  
  // Project directory from payload
  if (projectDir) {
    pathsToDelete.add(path.join(projectDir, 'veoup-coordinates.json'));
    pathsToDelete.add(path.join(projectDir, 'veoup-test-coordinates.json'));
  }
  
  // Working directory
  pathsToDelete.add(path.join(workingDir, 'veoup-coordinates.json'));
  pathsToDelete.add(path.join(workingDir, 'veoup-test-coordinates.json'));
  
  console.log('[VeoUp Setup] Deleting coordinate config...');
  const deletedResults = [];
  
  for (const filePath of pathsToDelete) {
    try {
      if (fs.existsSync(filePath)) {
        await fsp.unlink(filePath);
        console.log(`[VeoUp Setup] Deleted coordinate config: ${filePath}`);
        deletedResults.push({ path: filePath, deleted: true });
      } else {
        console.log(`[VeoUp Setup] Coordinate config missing: ${filePath}`);
        deletedResults.push({ path: filePath, deleted: false, missing: true });
      }
    } catch (error) {
      console.error(`[VeoUp Setup] Error unlinking ${filePath}: ${error.message}`);
      deletedResults.push({ path: filePath, deleted: false, error: error.message });
    }
  }
  
  console.log('[VeoUp Setup] Coordinate config delete complete.');
  return { ok: true, deleted: deletedResults };
}

async function scanProjectAndRunVeoUp(payload = {}) {
  const projectDir = String(payload.projectDir || '').trim();
  const expectedSceneCount = Number(payload.expectedSceneCount) || 0;
  const userDataDir = payload.userDataDir;

  if (!projectDir) {
    return { ok: false, error: 'Thiếu thư mục đầu ra của dự án.' };
  }
  if (expectedSceneCount <= 0) {
    return { ok: false, error: 'Số lượng scene không hợp lệ.' };
  }

  // 1. Check if coordinate config exists
  const configPath = path.join(userDataDir, 'veoup-coordinates.json');
  if (!fs.existsSync(configPath)) {
    return { ok: false, error: 'Không tìm thấy cấu hình tọa độ VeoUp. Hãy chạy Thiết lập tọa độ VeoUp trước.' };
  }

  const scenes = [];
  
  for (let i = 1; i <= expectedSceneCount; i++) {
    const sceneToken = `scene_${String(i).padStart(3, '0')}`;
    const sceneFolder = path.join(projectDir, sceneToken);
    
    // Validate scene folder exists
    if (!fs.existsSync(sceneFolder)) {
      return { ok: false, error: `Không tìm thấy thư mục ${sceneToken} cho dự án.` };
    }

    // Validate motion_prompt.txt exists
    const promptPath = path.join(sceneFolder, 'motion_prompt.txt');
    if (!fs.existsSync(promptPath)) {
      return { ok: false, error: `Không tìm thấy motion_prompt.txt cho ${sceneToken}.` };
    }

    const promptText = fs.readFileSync(promptPath, 'utf8').trim();
    if (!promptText) {
      return { ok: false, error: `File motion_prompt.txt cho ${sceneToken} bị rỗng.` };
    }

    // Validate keyframe image exists
    // Look in scene folder first, or keyframes/ if consolidated
    const keyframesDir = path.join(projectDir, 'keyframes');
    const consolidatedKeyframe = path.join(keyframesDir, `${sceneToken}_keyframe.png`);
    
    let keyframeExists = false;
    let keyframePath = '';

    if (fs.existsSync(consolidatedKeyframe)) {
      keyframeExists = true;
      keyframePath = consolidatedKeyframe;
    } else {
      // Search in scene folder
      const candidates = [
        path.join(sceneFolder, `${sceneToken}_keyframe.png`),
        path.join(sceneFolder, 'scene_keyframe.png'),
        path.join(sceneFolder, 'keyframe.png'),
      ];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          keyframeExists = true;
          keyframePath = candidate;
          break;
        }
      }
    }

    if (!keyframeExists) {
      return { ok: false, error: `Không tìm thấy ảnh keyframe cho ${sceneToken}.` };
    }

    scenes.push({
      id: i,
      sceneId: i,
      motionPromptPath: promptPath,
      imagePath: keyframePath
    });
  }

  // All validations passed! Rebuild veoup_prompts_ready.txt and copy keyframes if consolidated keyframes is missing
  // Actually, executeVeoUpAutomation does the keyframe copying and writing veoup_prompts_ready.txt itself!
  // Let's call executeVeoUpAutomation directly
  return executeVeoUpAutomation({
    outputFolder: projectDir,
    projectName: payload.projectName || '',
    scenes,
    maximizeBeforeAutomation: true,
    autoStartVideoGeneration: true,
    autoConfirmStartDialog: true,
    previewStartButtonOnly: Boolean(payload.previewStartButtonOnly),
    userDataDir
  });
}

module.exports = {
  executeVeoUpAutomation,
  normalizeWhitespace,
  collectKeyframes,
  collectMotionPrompts,
  prepareVeoUpKeyframesFolder,
  exportVeoUpPromptFile,
  findVeoupExecutable,
  startCoordinateSetup,
  captureVeoUpCoordinate,
  getVeoUpCoordinateConfig,
  saveVeoUpCoordinateConfig,
  deleteVeoUpCoordinateConfig,
  cancelCoordinateSetup,
  scanProjectAndRunVeoUp,
};
