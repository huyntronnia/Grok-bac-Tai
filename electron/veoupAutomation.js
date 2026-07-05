const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawn, exec } = require('child_process');
const { globalShortcut } = require('electron');

let cachedVeoupExecutablePath = null;
const DEFAULT_VEOUP_OUTPUT_DIR = 'C:\\Users\\diepp\\Desktop\\Veo3Output';

async function findRunningVeoUpExecutablePaths() {
  if (process.platform !== 'win32') return [];
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$items = @()
Get-CimInstance Win32_Process | Where-Object {
  $_.Name -match 'VeoUp' -or $_.ExecutablePath -match 'veoup'
} | ForEach-Object {
  if ($_.ExecutablePath) { $items += $_.ExecutablePath }
}
Get-Process | Where-Object { $_.ProcessName -match 'VeoUp' } | ForEach-Object {
  try { if ($_.Path) { $items += $_.Path } } catch {}
}
$items | Where-Object { $_ } | Select-Object -Unique | ForEach-Object { 'VIDORA_VEOUP_EXE ' + $_ }
`;
  return new Promise((resolve) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { windowsHide: true });
    let stdout = '';
    const timer = setTimeout(() => {
      try { child.kill(); } catch (_error) {}
      resolve([]);
    }, 5000);
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.on('close', () => {
      clearTimeout(timer);
      resolve(stdout
        .split(/\r?\n/)
        .filter((line) => line.startsWith('VIDORA_VEOUP_EXE '))
        .map((line) => line.replace(/^VIDORA_VEOUP_EXE\s+/, '').trim())
        .filter(Boolean));
    });
    child.on('error', () => {
      clearTimeout(timer);
      resolve([]);
    });
  });
}

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
  candidates.push(...(await findRunningVeoUpExecutablePaths()));

  for (const drive of drives) {
    let rootChildren = [];
    try {
      rootChildren = await fsp.readdir(drive, { withFileTypes: true });
    } catch (err) {
      continue;
    }

    const matchingDirs = rootChildren
      .filter(entry => entry.isDirectory())
      .filter(entry => /veoup|bac_tai/i.test(entry.name))
      .map(entry => path.join(drive, entry.name));

    for (const dir of matchingDirs) {
      const exes = await searchExesInDir(dir, 1, 3);
      candidates.push(...exes);
    }
  }

  // Scan standard paths/directories directly
  const directFolders = [
    'C:\\Program Files\\VeoUp',
    'C:\\Program Files (x86)\\VeoUp',
    'C:\\VeoUp',
    'D:\\VeoUp',
    'D:\\bac_tai\\veoup_video',
    path.join(process.env.ProgramFiles || '', 'VeoUp'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'VeoUp'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'VeoUp')
  ];
  for (const dir of directFolders) {
    if (fs.existsSync(dir)) {
      const exes = await searchExesInDir(dir, 1, 3);
      candidates.push(...exes);
    }
  }

  // Fallback to standard installation paths if no candidates found on drive roots
  if (candidates.length === 0) {
    const standardPaths = [
      'D:\\bac_tai\\veoup_video\\VeoUp_video_generator.exe',
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

  if (candidates.length === 0) return '';

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

async function findRunningVeoUpWindow() {
  if (process.platform !== 'win32') return { ok: false, running: false, reason: 'unsupported-platform' };
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class VidoraVeoUpWindowProbe {
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Auto)] public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
}
"@
$matches = @()
foreach ($proc in Get-Process) {
  if ($proc.MainWindowHandle -eq 0) { continue }
  $hwnd = $proc.MainWindowHandle
  if (-not [VidoraVeoUpWindowProbe]::IsWindowVisible($hwnd)) { continue }
  $titleBuilder = New-Object System.Text.StringBuilder 256
  [VidoraVeoUpWindowProbe]::GetWindowText($hwnd, $titleBuilder, 256) | Out-Null
  $classBuilder = New-Object System.Text.StringBuilder 256
  [VidoraVeoUpWindowProbe]::GetClassName($hwnd, $classBuilder, 256) | Out-Null
  $title = $titleBuilder.ToString()
  $className = $classBuilder.ToString()
  $score = 0
  if ($proc.ProcessName -match 'VeoUp') { $score += 100 }
  if ($title -match '^\\s*VeoUp(\\s|v|$)') { $score += 80 }
  if ($className -match '^Qt' -or $className -eq 'Qt690QWindowIcon') { $score += 40 }
  if ($score -ge 100) {
    $exePath = ''
    try { $exePath = $proc.Path } catch {}
    if (-not $exePath) {
      try {
        $cimProc = Get-CimInstance Win32_Process -Filter "ProcessId=$($proc.Id)"
        if ($cimProc -and $cimProc.ExecutablePath) { $exePath = $cimProc.ExecutablePath }
      } catch {}
    }
    $matches += [pscustomobject]@{ hwnd = $hwnd.ToString(); title = $title; className = $className; processName = $proc.ProcessName; processId = $proc.Id; executablePath = $exePath; score = $score }
  }
}
$selected = $matches | Sort-Object score -Descending | Select-Object -First 1
if ($selected) { 'VIDORA_VEOUP_WINDOW ' + ($selected | ConvertTo-Json -Compress) }
`;
  return new Promise((resolve) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      try { child.kill(); } catch (_error) {}
      resolve({ ok: false, running: false, reason: 'window-probe-timeout' });
    }, 8000);
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('close', () => {
      clearTimeout(timer);
      const line = stdout.split(/\r?\n/).find((item) => item.startsWith('VIDORA_VEOUP_WINDOW '));
      if (!line) return resolve({ ok: true, running: false, stderr: stderr.trim() });
      try {
        const windowInfo = JSON.parse(line.replace(/^VIDORA_VEOUP_WINDOW\s+/, ''));
        resolve({ ok: true, running: true, window: windowInfo });
      } catch (error) {
        resolve({ ok: false, running: false, reason: error.message, stdout, stderr });
      }
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ ok: false, running: false, reason: error.message });
    });
  });
}

async function findWindowsShortcutLaunchers() {
  if (process.platform !== 'win32') return [];
  const roots = [
    path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    path.join(process.env.ProgramData || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    path.join(os.homedir(), 'Desktop'),
  ].filter(Boolean);
  const found = [];
  async function walk(dir, depth = 0) {
    if (!dir || depth > 4 || found.length >= 20) return;
    const entries = await fsp.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile() && /\.lnk$/i.test(entry.name) && /veoup/i.test(entry.name)) found.push(fullPath);
      else if (entry.isDirectory()) await walk(fullPath, depth + 1);
      if (found.length >= 20) break;
    }
  }
  for (const root of roots) await walk(root, 0);
  return found;
}

async function resolveVeoUpLauncher(payload = {}) {
  const searchedPaths = [];
  const candidates = [
    payload.veoupExePath,
    payload.veoupExecutablePath,
    payload.veoupLauncherPath,
    payload.settings?.veoupExePath,
    process.env.VEOUP_EXE,
    cachedVeoupExecutablePath,
  ].filter(Boolean);
  candidates.push(...(await findRunningVeoUpExecutablePaths()));
  const discovered = await findVeoupExecutable().catch(() => '');
  if (discovered) candidates.push(discovered);
  candidates.push(...await findWindowsShortcutLaunchers());
  candidates.push(
    'D:\\bac_tai\\veoup_video\\VeoUp_video_generator.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'VeoUp', 'VeoUp.exe'),
    path.join(process.env.ProgramFiles || '', 'VeoUp', 'VeoUp.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'VeoUp', 'VeoUp.exe'),
    'C:\\Program Files\\VeoUp\\VeoUp.exe',
    'C:\\Program Files (x86)\\VeoUp\\VeoUp.exe'
  );
  for (const candidate of [...new Set(candidates.map((item) => String(item || '').trim()).filter(Boolean))]) {
    searchedPaths.push(candidate);
    if (fs.existsSync(candidate)) {
      cachedVeoupExecutablePath = /\.exe$/i.test(candidate) ? candidate : cachedVeoupExecutablePath;
      return { ok: true, launcherPath: candidate, searchedPaths };
    }
  }
  return { ok: false, error: 'veoup-launcher-not-found', searchedPaths };
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

  const groupedDir = path.join(outputFolder, 'keyframes');
  const grouped = await listPngFiles(groupedDir);
  if (grouped.length) return sortBySceneNumber(grouped);

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

function convertVeoUpClientPointToScreen({ clientScreenOrigin = {}, configuredClientPoint = {} } = {}) {
  const originX = Number(clientScreenOrigin.x ?? clientScreenOrigin.X ?? 0);
  const originY = Number(clientScreenOrigin.y ?? clientScreenOrigin.Y ?? 0);
  const clientX = Number(configuredClientPoint.x ?? configuredClientPoint.X ?? 0);
  const clientY = Number(configuredClientPoint.y ?? configuredClientPoint.Y ?? 0);
  return {
    x: originX + clientX,
    y: originY + clientY,
    coordinateConvention: 'physical-client-pixels',
  };
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

function buildPowerShellScript(coords = {}) {
  const blueBoxOffsetX = coords.blueBoxOffsetX !== undefined && coords.blueBoxOffsetX !== null ? coords.blueBoxOffsetX : 0;
  const blueBoxOffsetY = coords.blueBoxOffsetY !== undefined && coords.blueBoxOffsetY !== null ? coords.blueBoxOffsetY : 0;
  const redBoxOffsetX = coords.redBoxOffsetX !== undefined && coords.redBoxOffsetX !== null ? coords.redBoxOffsetX : 0;
  const redBoxOffsetY = coords.redBoxOffsetY !== undefined && coords.redBoxOffsetY !== null ? coords.redBoxOffsetY : 0;
  const startButtonOffsetX = coords.startButtonOffsetX !== undefined && coords.startButtonOffsetX !== null ? coords.startButtonOffsetX : 0;
  const startButtonOffsetY = coords.startButtonOffsetY !== undefined && coords.startButtonOffsetY !== null ? coords.startButtonOffsetY : 0;
  const clearButtonOffsetX = coords.clearButtonOffsetX !== undefined && coords.clearButtonOffsetX !== null ? coords.clearButtonOffsetX : 0;
  const clearButtonOffsetY = coords.clearButtonOffsetY !== undefined && coords.clearButtonOffsetY !== null ? coords.clearButtonOffsetY : 0;

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
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hWnd, ref POINT lpPoint);
  [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr hWnd);
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
  public static RECT GetClientAreaRect(IntPtr hWnd) {
    RECT r;
    GetClientRect(hWnd, out r);
    return r;
  }
  public static POINT GetClientScreenOrigin(IntPtr hWnd) {
    POINT p = new POINT { X = 0, Y = 0 };
    ClientToScreen(hWnd, ref p);
    return p;
  }
  public static POINT ClientPointToScreen(IntPtr hWnd, int x, int y) {
    POINT p = new POINT { X = x, Y = y };
    ClientToScreen(hWnd, ref p);
    return p;
  }
  public static uint GetWindowDpi(IntPtr hWnd) {
    try { return GetDpiForWindow(hWnd); } catch { return 96; }
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
  [Windows.Forms.Cursor]::Position = New-Object Drawing.Point($X, $Y)
  Start-Sleep -Milliseconds 120
  [VidoraNativeWin]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  [VidoraNativeWin]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 250
}

function Get-ActiveWindowInfo {
  $hwnd = [VidoraNativeWin]::GetForegroundWindow()
  if ($hwnd -eq [IntPtr]::Zero) {
    return [pscustomobject]@{ Hwnd = $hwnd; Title = '<None>'; ClassName = '<None>' }
  }
  $titleBuilder = New-Object System.Text.StringBuilder 256
  $classBuilder = New-Object System.Text.StringBuilder 256
  $null = [VidoraNativeWin]::GetWindowText($hwnd, $titleBuilder, 256)
  $null = [VidoraNativeWin]::GetClassName($hwnd, $classBuilder, 256)
  return [pscustomobject]@{ Hwnd = $hwnd; Title = $titleBuilder.ToString(); ClassName = $classBuilder.ToString() }
}

function Format-Hwnd([IntPtr]$Hwnd) {
  return ('0x{0:X}' -f $Hwnd.ToInt64())
}

function Assert-VeoUpForeground([IntPtr]$Hwnd, [string]$Stage) {
  $active = Get-ActiveWindowInfo
  if ($active.ClassName -eq 'Qt690QWindowIcon' -and $active.Title -match 'Ho.n t.t t.o|Hoan tat tao|t.o video|tao video') {
    Write-Host "[VeoUp] Completion popup is foreground at $Stage; cleanup will handle it."
    return $active
  }
  if ($active.Hwnd -ne $Hwnd -or $active.ClassName -ne 'Qt690QWindowIcon' -or $active.Title -notmatch '^VeoUp') {
    throw "VeoUp foreground verification failed at $Stage. Expected hwnd=$(Format-Hwnd $Hwnd), active=$(Format-Hwnd $active.Hwnd), title='$($active.Title)', class='$($active.ClassName)'."
  }
  return $active
}

function Focus-VeoUpHwnd([IntPtr]$Hwnd) {
  [VidoraNativeWin]::ShowWindow($Hwnd, 3) | Out-Null
  Start-Sleep -Milliseconds 500
  [VidoraNativeWin]::SetForegroundWindow($Hwnd) | Out-Null
  Start-Sleep -Milliseconds 350
  return Assert-VeoUpForeground $Hwnd 'after-focus'
}

function Resolve-ClientClickPoint([IntPtr]$Hwnd, [double]$ClientX, [double]$ClientY, [string]$Name) {
  # Saved VeoUp coordinates are physical client-area pixels. The PowerShell process is DPI aware,
  # so ClientToScreen returns physical screen pixels and no DPI multiplier is applied here.
  $windowRect = [VidoraNativeWin]::GetWinRect($Hwnd)
  $clientRect = [VidoraNativeWin]::GetClientAreaRect($Hwnd)
  $clientScreenOrigin = [VidoraNativeWin]::GetClientScreenOrigin($Hwnd)
  $windowDpi = [VidoraNativeWin]::GetWindowDpi($Hwnd)
  $configuredClientPoint = [pscustomobject]@{ X = [int][Math]::Round($ClientX); Y = [int][Math]::Round($ClientY) }
  $screenPoint = [VidoraNativeWin]::ClientPointToScreen($Hwnd, $configuredClientPoint.X, $configuredClientPoint.Y)
  $activeBefore = Get-ActiveWindowInfo
  $info = [pscustomobject]@{
    name = $Name
    windowRect = $windowRect
    clientRect = $clientRect
    clientScreenOrigin = $clientScreenOrigin
    windowDpi = $windowDpi
    coordinateConvention = 'physical-client-pixels'
    configuredClientPoint = $configuredClientPoint
    finalScreenPoint = $screenPoint
    activeWindowBeforeClick = [pscustomobject]@{ hwnd = Format-Hwnd $activeBefore.Hwnd; title = $activeBefore.Title; className = $activeBefore.ClassName }
  }
  Write-Host ("[VeoUp] Coordinate mapping {0}: {1}" -f $Name, ($info | ConvertTo-Json -Depth 6 -Compress))
  return $info
}

function Click-VeoUpClientPoint([IntPtr]$Hwnd, [double]$ClientX, [double]$ClientY, [string]$Name) {
  [void](Focus-VeoUpHwnd $Hwnd)
  $mapping = Resolve-ClientClickPoint $Hwnd $ClientX $ClientY $Name
  Click-Point $mapping.finalScreenPoint.X $mapping.finalScreenPoint.Y
  Start-Sleep -Milliseconds 300
  $activeAfter = Get-ActiveWindowInfo
  $mapping | Add-Member -NotePropertyName activeWindowAfterClick -NotePropertyValue ([pscustomobject]@{ hwnd = Format-Hwnd $activeAfter.Hwnd; title = $activeAfter.Title; className = $activeAfter.ClassName }) -Force
  Write-Host ("[VeoUp] Coordinate click result {0}: {1}" -f $Name, ($mapping | ConvertTo-Json -Depth 6 -Compress))
  return $mapping
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

function Get-VeoUpDialogWindows($VeoUpHwnd) {
  $targetPid = 0
  try {
    $targetWin = Find-RealVeoUpWindow
    if ($targetWin) { $targetPid = [int]$targetWin.ProcessId }
  } catch {}
  $dialogs = @()
  foreach ($win in [VidoraNativeWin]::GetTopLevelWindows()) {
    try {
      if ($targetPid -gt 0 -and [int]$win.ProcessId -ne $targetPid) { continue }
      $title = Normalize-Text $win.Title
      $isNativeDialog = $win.ClassName -eq '#32770'
      $isQtCompletionPopup = $win.ClassName -eq 'Qt690QWindowIcon' -and $win.Handle -ne $VeoUpHwnd -and $title -match 'hoan tat tao|tao video|xu ly video'
      if ($isNativeDialog -or $isQtCompletionPopup) { $dialogs += $win }
    } catch {}
  }
  return $dialogs
}

function Find-DialogButtonByName($DialogElement, [string[]]$Patterns) {
  if ($null -eq $DialogElement) { return $null }
  $all = $DialogElement.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
  foreach ($element in $all) {
    try {
      if ($element.Current.ControlType.ProgrammaticName -notmatch 'Button') { continue }
      $name = Normalize-Text $element.Current.Name
      foreach ($pattern in $Patterns) {
        if ($name -match $pattern) { return $element }
      }
    } catch {}
  }
  return $null
}

function Find-DialogNoButtonByPosition($DialogElement) {
  if ($null -eq $DialogElement) { return $null }
  $buttons = @()
  $all = $DialogElement.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
  foreach ($element in $all) {
    try {
      if ($element.Current.ControlType.ProgrammaticName -notmatch 'Button') { continue }
      $name = Normalize-Text $element.Current.Name
      if ($name -match '^yes$|^co$|^ok$|open') { continue }
      $box = $element.Current.BoundingRectangle
      if ($box.Width -lt 10 -or $box.Height -lt 10) { continue }
      $buttons += [pscustomobject]@{ Element = $element; Left = $box.Left; Top = $box.Top; Name = $name }
    } catch {}
  }
  if ($buttons.Count -lt 1) { return $null }
  return ($buttons | Sort-Object Left -Descending | Select-Object -First 1).Element
}

function Dismiss-VeoUpCompletionPopup($VeoUpHwnd) {
  $deadline = (Get-Date).AddSeconds(12)
  $dialogWin = $null
  do {
    $dialogs = Get-VeoUpDialogWindows $VeoUpHwnd
    if ($dialogs.Count -gt 0) {
      $dialogWin = $dialogs | Select-Object -First 1
      break
    }
    Start-Sleep -Milliseconds 300
  } while ((Get-Date) -lt $deadline)
  if ($null -eq $dialogWin) { return [pscustomobject]@{ ok = $true; detected = $false } }

  Write-Host "VeoUp completion popup detected."
  $dialogElement = [System.Windows.Automation.AutomationElement]::FromHandle($dialogWin.Handle)
  $yesButton = Find-DialogButtonByName $dialogElement @('^yes$', '^co$', '^ok$', 'open')
  $noButton = Find-DialogButtonByName $dialogElement @('^no$', '^khong$', 'cancel', 'dong')
  if ($null -eq $noButton) { $noButton = Find-DialogNoButtonByPosition $dialogElement }
  if ($null -eq $noButton) { return [pscustomobject]@{ ok = $false; detected = $true; error = 'veoup-completion-popup-no-button-not-found'; yesButtonPresent = ($null -ne $yesButton) } }
  [void](Click-Element $noButton)
  Write-Host "VeoUp completion popup: clicked No."

  $closedDeadline = (Get-Date).AddSeconds(10)
  do {
    Start-Sleep -Milliseconds 300
    $stillOpen = Get-VeoUpDialogWindows $VeoUpHwnd
    if ($stillOpen.Count -eq 0) { return [pscustomobject]@{ ok = $true; detected = $true; clickedNo = $true } }
  } while ((Get-Date) -lt $closedDeadline)
  return [pscustomobject]@{ ok = $false; detected = $true; clickedNo = $true; error = 'veoup-completion-popup-did-not-close' }
}

function Get-VeoUpInputState($Window) {
  $imageRows = 0
  $promptFields = 0
  $nonEmptyPromptFields = 0
  $promptTextLength = 0
  $inspectedElementCount = 0
  $stateText = ''
  $inspectOk = $true
  try {
    $rect = $Window.Current.BoundingRectangle
    $all = $Window.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
    foreach ($element in $all) {
      try {
        $inspectedElementCount += 1
        $box = $element.Current.BoundingRectangle
        $name = Normalize-Text $element.Current.Name
        $control = $element.Current.ControlType.ProgrammaticName
        if ($name) { $stateText += " $name" }
        $inUpperLeft = $box.Left -lt ($rect.Left + ($rect.Width * 0.58)) -and $box.Top -lt ($rect.Top + ($rect.Height * 0.65))
        $hasImageFileToken = $name -match '\.png|\.jpg|\.jpeg|\.webp|scene[_\s-]*\d+|keyframe'
        if ($inUpperLeft -and $hasImageFileToken) { $imageRows += 1 }
        if ($control -match 'Edit|Document' -or $name -match 'prompt|mo ta|noi dung') {
          $promptFields += 1
          $value = ''
          try {
            $valuePattern = $element.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
            $value = [string]$valuePattern.Current.Value
          } catch {
            $value = [string]$element.Current.Name
          }
          $normalizedValue = Normalize-Text $value
          if (![string]::IsNullOrWhiteSpace($value) -and $normalizedValue -notmatch 'prompt|mo ta|noi dung') {
            $nonEmptyPromptFields += 1
            $promptTextLength += [string]$value.Length
          }
        }
      } catch {}
    }
  } catch {
    $inspectOk = $false
  }
  return [pscustomobject]@{
    imageRows = $imageRows
    promptFields = $promptFields
    nonEmptyPromptFields = $nonEmptyPromptFields
    promptTextLength = $promptTextLength
    inspectedElementCount = $inspectedElementCount
    inspectOk = $inspectOk
    popupOpen = $false
    hasConfirmedStaleInput = [bool]($imageRows -gt 0 -or $nonEmptyPromptFields -gt 0)
    hasStaleInput = [bool]($imageRows -gt 0 -or $nonEmptyPromptFields -gt 0)
    stateText = $stateText.Trim()
  }
}

function Write-VeoUpCleanupSnapshot([string]$Label, $Snapshot, [IntPtr]$Hwnd, $ClickResult = $null) {
  $details = [pscustomobject]@{
    hwnd = Format-Hwnd $Hwnd
    imageRows = [int]$Snapshot.imageRows
    promptFields = [int]$Snapshot.promptFields
    nonEmptyPromptFields = [int]$Snapshot.nonEmptyPromptFields
    promptTextLength = [int]$Snapshot.promptTextLength
    popupOpen = [bool]$Snapshot.popupOpen
    hasConfirmedStaleInput = [bool]$Snapshot.hasConfirmedStaleInput
    inspectedElementCount = [int]$Snapshot.inspectedElementCount
    inspectOk = [bool]$Snapshot.inspectOk
    clickResult = $ClickResult
  }
  Write-Host ("$Label " + ($details | ConvertTo-Json -Depth 6 -Compress))
}

function Confirm-VeoUpClearDialogIfPresent($VeoUpHwnd) {
  $deadline = (Get-Date).AddSeconds(5)
  do {
    $dialogs = Get-VeoUpDialogWindows $VeoUpHwnd
    foreach ($dialogWin in $dialogs) {
      $dialogElement = [System.Windows.Automation.AutomationElement]::FromHandle($dialogWin.Handle)
      $confirmButton = Find-DialogButtonByName $dialogElement @('^yes$', '^co$', '^ok$', 'confirm', 'clear', 'xoa')
      if ($confirmButton) {
        [void](Click-Element $confirmButton)
        Start-Sleep -Milliseconds 500
        return $true
      }
    }
    Start-Sleep -Milliseconds 250
  } while ((Get-Date) -lt $deadline)
  return $false
}

function Find-MainVeoUpXoaButton($Window) {
  $rect = $Window.Current.BoundingRectangle
  $candidates = @()
  $all = $Window.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
  foreach ($element in $all) {
    try {
      if ($element.Current.ControlType.ProgrammaticName -notmatch 'Button') { continue }
      $name = Normalize-Text $element.Current.Name
      if ($name -notmatch '^xoa$|xoa tat ca|clear|delete all|remove all') { continue }
      $box = $element.Current.BoundingRectangle
      $inUpperLeft = $box.Left -lt ($rect.Left + ($rect.Width * 0.50)) -and $box.Top -lt ($rect.Top + ($rect.Height * 0.45))
      if (!$inUpperLeft) { continue }
      $area = [double]($box.Width * $box.Height)
      $candidates += [pscustomobject]@{ Element = $element; Top = $box.Top; Left = $box.Left; Area = $area; Name = $name }
    } catch {}
  }
  if ($candidates.Count -eq 0) { return $null }
  return ($candidates | Sort-Object @{ Expression = 'Area'; Descending = $true }, Top, Left | Select-Object -First 1).Element
}

function Clear-VeoUpPromptFieldsDirectly($Window) {
  $cleared = 0
  $all = $Window.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
  foreach ($element in $all) {
    try {
      $control = $element.Current.ControlType.ProgrammaticName
      $name = Normalize-Text $element.Current.Name
      if ($control -notmatch 'Edit|Document' -and $name -notmatch 'prompt|mo ta|noi dung') { continue }
      try {
        $valuePattern = $element.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
        if (!$valuePattern.Current.IsReadOnly) {
          $valuePattern.SetValue('')
          $cleared += 1
          continue
        }
      } catch {}
      try {
        $element.SetFocus()
        [System.Windows.Forms.SendKeys]::SendWait('^a')
        Start-Sleep -Milliseconds 80
        [System.Windows.Forms.SendKeys]::SendWait('{BACKSPACE}')
        $cleared += 1
      } catch {}
    } catch {}
  }
  return $cleared
}

function Invoke-VeoUpPerRowCleanup($Window) {
  $clicked = 0
  $rect = $Window.Current.BoundingRectangle
  $all = $Window.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
  foreach ($element in $all) {
    try {
      if ($element.Current.ControlType.ProgrammaticName -notmatch 'Button') { continue }
      $name = Normalize-Text $element.Current.Name
      $box = $element.Current.BoundingRectangle
      $inLeftRows = $box.Left -lt ($rect.Left + ($rect.Width * 0.58)) -and $box.Top -lt ($rect.Top + ($rect.Height * 0.72))
      if (!$inLeftRows) { continue }
      if ($name -notmatch '^x$|xoa|delete|remove|clear|close') { continue }
      if (Click-Element $element) {
        $clicked += 1
        Start-Sleep -Milliseconds 250
      }
    } catch {}
  }
  if ($clicked -gt 0) { Write-Host "VeoUp fallback row cleanup used." }
  return $clicked
}

function Invoke-VeoUpInputCleanup($Payload, [switch]$BeforeSubmission) {
  Write-Host "VeoUp post-generation cleanup started."
  $targetWin = Find-RealVeoUpWindow
  if ($null -eq $targetWin) { return [pscustomobject]@{ ok = $false; error = 'veoup-window-not-found-for-cleanup' } }
  $hwnd = $targetWin.Handle
  $popup = Dismiss-VeoUpCompletionPopup $hwnd
  if (!$popup.ok) { return [pscustomobject]@{ ok = $false; error = $popup.error; popup = $popup } }
  [void](Focus-VeoUpHwnd $hwnd)
  $window = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
  $before = Get-VeoUpInputState $window
  $before.popupOpen = [bool]($popup.detected -and !$popup.clickedNo)
  $before.hasConfirmedStaleInput = [bool]($before.imageRows -gt 0 -or $before.nonEmptyPromptFields -gt 0 -or $before.popupOpen)
  $before.hasStaleInput = $before.hasConfirmedStaleInput
  Write-VeoUpCleanupSnapshot "VeoUp pre-cleanup snapshot" $before $hwnd $null
  if ($BeforeSubmission -and !$before.hasConfirmedStaleInput) {
    Write-Host "VeoUp pre-submission state appears clean; continuing."
    return [pscustomobject]@{ ok = $true; skipped = $true; before = $before; popup = $popup }
  }
  Write-Host "VeoUp stale input detected."

  $button = Find-MainVeoUpXoaButton $window
  $clickResult = $null
  if ($button) {
    $clickResult = [pscustomobject]@{ method = 'uia-main-xoa'; clicked = [bool](Click-Element $button) }
  } elseif (${clearButtonOffsetX} -ne 0 -and ${clearButtonOffsetY} -ne 0) {
    $clickResult = Click-VeoUpClientPoint $hwnd ([double]${clearButtonOffsetX}) ([double]${clearButtonOffsetY}) 'clear-xoa-button'
  } else {
    $clickResult = [pscustomobject]@{ method = 'none'; clicked = $false; error = 'veoup-red-xoa-button-not-found' }
  }
  Write-Host "VeoUp red Xóa button clicked."
  Write-Host "VeoUp main Xóa clicked."
  if ($clickResult.clicked -ne $false) {
    [void](Confirm-VeoUpClearDialogIfPresent $hwnd)
    Start-Sleep -Milliseconds 1500
  }
  $window = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
  $after = Get-VeoUpInputState $window
  $after.hasConfirmedStaleInput = [bool]($after.imageRows -gt 0 -or $after.nonEmptyPromptFields -gt 0)
  $after.hasStaleInput = $after.hasConfirmedStaleInput
  if ($after.hasConfirmedStaleInput) {
    $promptCleared = Clear-VeoUpPromptFieldsDirectly $window
    $rowClicks = Invoke-VeoUpPerRowCleanup $window
    if ($promptCleared -gt 0 -or $rowClicks -gt 0) {
      Start-Sleep -Milliseconds 1500
      [void](Confirm-VeoUpClearDialogIfPresent $hwnd)
      $window = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
      $after = Get-VeoUpInputState $window
      $after.hasConfirmedStaleInput = [bool]($after.imageRows -gt 0 -or $after.nonEmptyPromptFields -gt 0)
      $after.hasStaleInput = $after.hasConfirmedStaleInput
      $clickResult = [pscustomobject]@{ mainClick = $clickResult; directPromptClears = $promptCleared; perRowDeleteClicks = $rowClicks }
    }
  }
  Write-VeoUpCleanupSnapshot "VeoUp post-cleanup snapshot" $after $hwnd $clickResult
  if ($after.hasConfirmedStaleInput) {
    return [pscustomobject]@{ ok = $false; error = 'veoup-input-state-not-cleared'; before = $before; after = $after; clickResult = $clickResult; confirmedStaleBeforeCleanup = $true }
  }
  Write-Host "VeoUp input state cleared for next scene."
  return [pscustomobject]@{ ok = $true; before = $before; after = $after; popup = $popup; clickResult = $clickResult }
}

function Invoke-VeoUpPostGenerationCleanup($Payload) {
  $targetWin = Find-RealVeoUpWindow
  if ($null -eq $targetWin) { return [pscustomobject]@{ ok = $false; error = 'veoup-window-not-found-after-video' } }
  $hwnd = $targetWin.Handle
  $popup = Dismiss-VeoUpCompletionPopup $hwnd
  if (!$popup.ok) { return [pscustomobject]@{ ok = $false; error = $popup.error; popup = $popup } }
  $cleanup = Invoke-VeoUpInputCleanup $Payload
  if (!$cleanup.ok) { return [pscustomobject]@{ ok = $false; error = $cleanup.error; popup = $popup; cleanup = $cleanup } }
  return [pscustomobject]@{ ok = $true; popup = $popup; cleanup = $cleanup }
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
    $className = Get-ActiveWindowClassName
    if ($className -eq '#32770') {
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

function Click-VeoUpImageImportTarget($Window) {
  if ($null -eq $Window) { return [pscustomobject]@{ ok = $false; method = 'uia-image-import'; error = 'missing-window' } }
  $rect = $Window.Current.BoundingRectangle
  $all = $Window.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
  $targets = @()
  foreach ($element in $all) {
    try {
      $name = Normalize-Text $element.Current.Name
      $control = $element.Current.ControlType.ProgrammaticName
      $box = $element.Current.BoundingRectangle
      $inImportBand = $box.Left -ge ($rect.Left - 5) -and $box.Left -lt ($rect.Left + ($rect.Width * 0.45)) -and $box.Top -gt ($rect.Top + 70) -and $box.Top -lt ($rect.Top + 170)
      if (!$inImportBand) { continue }
      if ($name -match 'chua chon anh|chon anh|them anh|select image|choose image|add image|upload image' -or $control -match 'Image') {
        $targets += [pscustomobject]@{ Element = $element; Name = $name; Control = $control; Box = $box; Score = $(if ($name -match 'chua chon anh|chon anh|them anh') { 100 } elseif ($control -match 'Image') { 70 } else { 40 }) }
      }
    } catch {}
  }
  if ($targets.Count -eq 0) { return [pscustomobject]@{ ok = $false; method = 'uia-image-import'; error = 'target-not-found' } }
  $target = $targets | Sort-Object Score -Descending | Select-Object -First 1
  $box = $target.Box
  $clickX = $box.Left + ($box.Width / 2)
  $clickY = $box.Top + ($box.Height / 2)
  if ($target.Name -match 'chua chon anh|chon anh|them anh' -and $box.Width -gt 20) {
    $clickX = $box.Right + 16
    $clickY = $box.Top + ($box.Height / 2)
  }
  Write-Host ("[VeoUp] UIA image import target: " + ([pscustomobject]@{ name = $target.Name; control = $target.Control; rect = $box; clickPoint = [pscustomobject]@{ X = $clickX; Y = $clickY } } | ConvertTo-Json -Depth 5 -Compress))
  Click-Point $clickX $clickY
  return [pscustomobject]@{ ok = $true; method = 'uia-image-import'; name = $target.Name; control = $target.Control; x = $clickX; y = $clickY }
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

function Find-GenerateButton($Window) {
  return Find-DescendantByName $Window 'Button' @('generate', 'start', 'create', 'render', 'tao video', 'bat dau')
}

function Get-VeoUpSubmissionState($Window) {
  $text = ''
  $generateEnabled = $false
  $generateVisible = $false
  $progressVisible = $false
  $outputCardCount = 0
  try {
    $all = $Window.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
    foreach ($element in $all) {
      try {
        $name = Normalize-Text $element.Current.Name
        $control = $element.Current.ControlType.ProgrammaticName
        if ($name) { $text += " $name" }
        if ($control -match 'Button' -and $name -match 'generate|start|create|render|tao video|bat dau') {
          $generateVisible = $true
          if ($element.Current.IsEnabled) { $generateEnabled = $true }
        }
        if ($control -match 'ProgressBar|Spinner' -or $name -match 'queued|queue|render|rendering|generat|processing|download|progress|dang tao|dang xu ly') {
          $progressVisible = $true
        }
        if ($name -match '\.mp4|download|preview|video') {
          $outputCardCount += 1
        }
      } catch {}
    }
  } catch {}
  return [pscustomobject]@{
    generateVisible = $generateVisible
    generateEnabled = $generateEnabled
    progressVisible = $progressVisible
    outputCardCount = $outputCardCount
    stateText = $text.Trim()
  }
}

function Test-VeoUpSubmissionAcknowledged($Before, $After) {
  if ($After.progressVisible) { return $true }
  if ($Before.generateEnabled -and !$After.generateEnabled) { return $true }
  if ($After.outputCardCount -gt $Before.outputCardCount) { return $true }
  if ($After.stateText -match 'queued|queue|render|rendering|generat|processing|download|progress|dang tao|dang xu ly') { return $true }
  return $false
}

function Invoke-GenerateClickAttempt($Payload, [int]$Attempt, [int]$MaxAttempts) {
  $targetWin = Find-RealVeoUpWindow
  if ($null -eq $targetWin) { throw "VeoUp window not found before Generate click." }
  $hwnd = $targetWin.Handle
  $window = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
  [void](Focus-VeoUpHwnd $hwnd)
  $beforeState = Get-VeoUpSubmissionState $window
  Write-Host "Scene $($Payload.sceneId): Generate button click attempt $Attempt/$MaxAttempts."
  $button = Find-GenerateButton $window
  if ($button) {
    Write-Host "[VeoUp] Generate button found by UI Automation; invoking control."
    [void](Click-Element $button)
  } else {
    Write-Host "[VeoUp] Generate button not discoverable by UI Automation; using configured client coordinate."
    [void](Click-VeoUpClientPoint $hwnd ([double]${startButtonOffsetX}) ([double]${startButtonOffsetY}) 'generate-button')
  }
  $deadline = (Get-Date).AddSeconds(15)
  do {
    Start-Sleep -Milliseconds 750
    $window = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
    $afterState = Get-VeoUpSubmissionState $window
    if (Test-VeoUpSubmissionAcknowledged $beforeState $afterState) {
      Write-Host "Scene $($Payload.sceneId): VeoUp generation submission acknowledged."
      return [pscustomobject]@{ ok = $true; before = $beforeState; after = $afterState }
    }
  } while ((Get-Date) -lt $deadline)
  return [pscustomobject]@{ ok = $false; before = $beforeState; after = $afterState; error = 'veoup-generate-click-not-acknowledged' }
}

function Get-VideoSearchRoots($Payload) {
  $roots = New-Object System.Collections.Generic.List[string]
  foreach ($candidate in @(
    [string]$Payload.outputFolder,
    [Environment]::GetFolderPath('UserProfile') + '\Downloads',
    [Environment]::GetFolderPath('MyVideos'),
    [Environment]::GetFolderPath('Desktop')
  )) {
    if ($candidate -and (Test-Path $candidate) -and !$roots.Contains($candidate)) { [void]$roots.Add($candidate) }
  }
  return $roots
}

function Get-VideoFileSnapshot($Payload) {
  $items = @()
  foreach ($root in (Get-VideoSearchRoots $Payload)) {
    $items += Get-ChildItem -Path $root -Filter '*.mp4' -File -Recurse -ErrorAction SilentlyContinue |
      Select-Object FullName, Length, LastWriteTimeUtc
  }
  return $items
}

function Wait-For-StableNewVideo($Payload, $BaselinePaths, [datetime]$SubmittedAtUtc) {
  $timeoutMs = 1200000
  if ($Payload.generationTimeoutMs) { $timeoutMs = [int]$Payload.generationTimeoutMs }
  if ($timeoutMs -lt 60000) { $timeoutMs = 1200000 }
  $deadline = (Get-Date).AddMilliseconds($timeoutMs)
  $stable = @{}
  do {
    $window = Start-Or-Focus-VeoUp $Payload
    $state = Get-VeoUpSubmissionState $window
    Write-Host "Scene $($Payload.sceneId): VeoUp rendering in progress..."
    $candidates = Get-VideoFileSnapshot $Payload | Where-Object {
      !$BaselinePaths.ContainsKey($_.FullName) -and $_.Length -gt 0 -and $_.LastWriteTimeUtc -ge $SubmittedAtUtc
    } | Sort-Object LastWriteTimeUtc -Descending
    foreach ($file in $candidates) {
      Write-Host "Scene $($Payload.sceneId): New video detected; waiting for file stabilization."
      $key = $file.FullName
      $signature = "$($file.Length)|$($file.LastWriteTimeUtc.Ticks)"
      if ($stable.ContainsKey($key) -and $stable[$key].signature -eq $signature) {
        $stable[$key].count += 1
      } else {
        $stable[$key] = [pscustomobject]@{ signature = $signature; count = 1; path = $key; length = $file.Length }
      }
      if ($stable[$key].count -ge 3) {
        return [pscustomobject]@{ ok = $true; path = $key; length = $file.Length; state = $state }
      }
    }
    Start-Sleep -Milliseconds 5000
  } while ((Get-Date) -lt $deadline)
  return [pscustomobject]@{ ok = $false; error = 'veoup-video-timeout'; timeoutMs = $timeoutMs }
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
Write-Host "[VeoUp] Coordinate convention: saved VeoUp points are physical client-area pixels; no DPI scaling is applied during ClientToScreen conversion."

function Invoke-FinalStartButton($Payload) {
  if (${startButtonOffsetX} -eq 0 -or ${startButtonOffsetY} -eq 0) {
    Write-Host "[VeoUp] ERROR: Generate button coordinates are missing. Cannot start automation."
    return [pscustomobject]@{ ok = $false; error = 'missing-generate-button-coordinate' }
  }

  $baselineList = Get-VideoFileSnapshot $Payload
  $baselinePaths = @{}
  foreach ($item in $baselineList) { $baselinePaths[$item.FullName] = $true }

  $ack = $null
  $maxAttempts = 2
  for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
    $ack = Invoke-GenerateClickAttempt $Payload $attempt $maxAttempts
    if ($ack.ok) { break }
    if ($attempt -lt $maxAttempts) {
      Write-Host "[VeoUp] Generate click not acknowledged; refocusing VeoUp and retrying."
      $targetWin = Find-RealVeoUpWindow
      if ($null -ne $targetWin) { [void](Focus-VeoUpHwnd $targetWin.Handle) }
    }
  }

  if (!$ack -or !$ack.ok) {
    Write-Host "[VeoUp] ERROR: Generate click not acknowledged after $maxAttempts attempts."
    return [pscustomobject]@{ ok = $false; error = 'veoup-generate-click-not-acknowledged'; acknowledgement = $ack }
  }

  $submittedAtUtc = (Get-Date).ToUniversalTime().AddSeconds(-2)
  $video = Wait-For-StableNewVideo $Payload $baselinePaths $submittedAtUtc
  if (!$video.ok) { return $video }
  $cleanup = Invoke-VeoUpPostGenerationCleanup $Payload
  if (!$cleanup.ok) {
    Write-Host "veoup-post-generation-cleanup-failed"
  }
  return [pscustomobject]@{ ok = $true; sourceDownloadPath = $video.path; videoPath = $video.path; acknowledgement = $ack; video = $video; postGenerationCleanup = $cleanup; cleanupError = $(if ($cleanup.ok) { '' } else { 'veoup-post-generation-cleanup-failed' }) }
}

Write-Host "[VeoUp] Verifying clean input state before new scene submission..."
$preCleanup = Invoke-VeoUpInputCleanup $payload -BeforeSubmission
if (!$preCleanup.ok) {
  Write-Host "[VeoUp] Pre-submission cleanup warning: $($preCleanup.error)"
  $result = [pscustomobject]@{
    ok = $false
    error = 'veoup-pre-submission-cleanup-failed'
    status = 'veoup-pre-submission-cleanup-failed'
    cleanupError = [string]$preCleanup.error
    expectedRows = [int]$payload.promptLineCount
    detectedRows = 0
    imageCount = [int]$payload.imageCount
    promptLineCount = [int]$payload.promptLineCount
    promptFilePath = [string]$payload.promptFilePath
    keyframesFolder = [string]$payload.keyframesFolder
    runId = [string]$payload.runId
    sceneId = [int]$payload.sceneId
  }
  'VIDORA_VEOUP_RESULT ' + ($result | ConvertTo-Json -Depth 8 -Compress)
  exit 0
}

Write-Host "[VeoUp] Importing exact keyframe files: $($payload.fileSelectionText)"
Write-Host "[VeoUp] Clicking Blue Box image import area at configured client coordinate (${blueBoxOffsetX}, ${blueBoxOffsetY})..."
$window = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
$imageImportUiClick = Click-VeoUpImageImportTarget $window
if (!$imageImportUiClick.ok) {
  Write-Host "[VeoUp] UIA image import target not found; using configured client coordinate."
  [void](Click-VeoUpClientPoint $hwnd ([double]${blueBoxOffsetX}) ([double]${blueBoxOffsetY}) 'image-import')
}

# Automated Keystroke Fallback Guard
Write-Host "[VeoUp] Checking if Open File dialog appeared..."
$dialogOpened = $false
for ($i = 0; $i -lt 6; $i++) {
  $className = Get-ActiveWindowClassName
  if ($className -eq '#32770') {
    $dialogOpened = $true
    break
  }
  Start-Sleep -Milliseconds 250
}

if (!$dialogOpened) {
  Write-Host "[VeoUp] File dialog not detected after first click. Refocusing VeoUp and retrying same converted client coordinate."
  [void](Click-VeoUpClientPoint $hwnd ([double]${blueBoxOffsetX}) ([double]${blueBoxOffsetY}) 'image-import-retry')
  Start-Sleep -Milliseconds 800
  $className = Get-ActiveWindowClassName
  if ($className -eq '#32770') { $dialogOpened = $true }
}

Write-Host "[VeoUp] Waiting for Open File dialog..."
if (!(Wait-For-FileDialog)) {
  $activeTitle = Get-ActiveWindowTitle
  $activeClass = Get-ActiveWindowClassName
  Write-Host "[VeoUp] Calibrated Blue Box click did not open the file dialog."
  Write-Host "[VeoUp] Current active window: $activeTitle (Class: $activeClass)"
  exit 1
}
Start-Sleep -Milliseconds 2000

Write-Host "[VeoUp] Selecting exact validated keyframe path(s) in File Name box..."
[System.Windows.Forms.SendKeys]::SendWait('%n')
Start-Sleep -Milliseconds 300
Set-ClipboardText ([string]$payload.fileSelectionText)
Start-Sleep -Milliseconds 200
[System.Windows.Forms.SendKeys]::SendWait('^v')
Start-Sleep -Milliseconds 300
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')

Write-Host "[VeoUp] Waiting 5 seconds for VeoUp image grid to append assets..."
Start-Sleep -Milliseconds 5000

$titleAfterOpen = Get-ActiveWindowTitle
$classAfterOpen = Get-ActiveWindowClassName
Write-Host "[VeoUp] Active window after dialog ENTER: $titleAfterOpen (Class: $classAfterOpen)"

if (($titleAfterOpen -match 'open|select|keyframe|folder') -or ($classAfterOpen -eq '#32770')) {
  Write-Host "[VeoUp] ERROR: File dialog is still open. Import path or file selection failed."
  exit 1
}

Write-Host "[VeoUp] Refocusing VeoUp and clicking Red Box prompt input area at configured client coordinate (${redBoxOffsetX}, ${redBoxOffsetY})..."
$window = Start-Or-Focus-VeoUp $payload
Start-Sleep -Milliseconds 500
$targetWin = Find-RealVeoUpWindow
if ($null -eq $targetWin) {
  Write-Host "[VeoUp] ERROR: VeoUp window not found before prompt click."
  exit 1
}
$hwnd = $targetWin.Handle
[void](Click-VeoUpClientPoint $hwnd ([double]${redBoxOffsetX}) ([double]${redBoxOffsetY}) 'prompt-input')
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
$generateResult = Invoke-FinalStartButton $payload
if (Get-Command Clear-Clipboard -ErrorAction SilentlyContinue) { Clear-Clipboard } else { [System.Windows.Forms.Clipboard]::Clear() }
if (!$generateResult.ok) {
  $result = [pscustomobject]@{
    ok = $false
    error = [string]$generateResult.error
    status = [string]$generateResult.error
    expectedRows = [int]$payload.promptLineCount
    detectedRows = [int]$payload.promptLineCount
    imageCount = [int]$payload.imageCount
    promptLineCount = [int]$payload.promptLineCount
    promptFilePath = [string]$payload.promptFilePath
    keyframesFolder = [string]$payload.keyframesFolder
    runId = [string]$payload.runId
    sceneId = [int]$payload.sceneId
  }
  'VIDORA_VEOUP_RESULT ' + ($result | ConvertTo-Json -Depth 8 -Compress)
  exit 0
}
Write-Host "[VeoUp Macro Progress] Final Start acknowledged, video found, and clipboard cleared."

$result = [pscustomobject]@{
  ok = $true
  sourceDownloadPath = [string]$generateResult.sourceDownloadPath
  videoPath = [string]$generateResult.videoPath
  generateAcknowledged = $true
  postGenerationCleanupOk = [bool]$generateResult.postGenerationCleanup.ok
  postGenerationCleanupError = [string]$generateResult.cleanupError
  runId = [string]$payload.runId
  sceneId = [int]$payload.sceneId
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

function runPowerShell(scriptPath, payloadPath, timeoutMs = 120000, options = {}) {
  return new Promise((resolve, reject) => {
    let finished = false;
    const child = spawn('powershell.exe', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, payloadPath], {
      windowsHide: false,
    });
    if (typeof options.registerChildProcess === 'function') options.registerChildProcess(child);
    let stdout = '';
    let stderr = '';
    const cancelTimer = setInterval(() => {
      if (finished) return;
      if (typeof options.isCancelled === 'function' && options.isCancelled()) {
        finished = true;
        clearTimeout(timer);
        clearInterval(cancelTimer);
        try { child.kill(); } catch (_error) {}
        const error = new Error(`PIPELINE_CANCELLED:${options.runId || 'veoup'}`);
        error.code = 'PIPELINE_CANCELLED';
        reject(error);
      }
    }, 250);
    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        clearInterval(cancelTimer);
        child.kill();
        reject(new Error(`PowerShell execution timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });
    const handleExit = (code, signal) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      clearInterval(cancelTimer);
      const line = stdout.split(/\r?\n/).find((item) => item.startsWith('VIDORA_VEOUP_RESULT '));
      let parsed = null;
      if (line) {
        try { parsed = JSON.parse(line.replace(/^VIDORA_VEOUP_RESULT\s+/, '')); } catch (_error) {}
      }
      if (code !== 0) {
        const errMsg = stderr.trim() || stdout.trim() || `PowerShell process exited with code ${code}${signal ? ` and signal ${signal}` : ''}`;
        reject(new Error(errMsg));
      } else {
        resolve({ code, stdout, stderr, parsed });
      }
    };
    child.on('close', (code, signal) => handleExit(code, signal));
    child.on('exit', (code, signal) => handleExit(code, signal));
    child.on('error', (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      reject(err);
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
  let resolvedOutputFolder = '';
  try {
    const throwIfCancelled = () => {
      if (typeof payload.isCancelled === 'function' && payload.isCancelled()) {
        const error = new Error(`PIPELINE_CANCELLED:${payload.runId || 'veoup'}`);
        error.code = 'PIPELINE_CANCELLED';
        throw error;
      }
    };
    throwIfCancelled();
    resolvedOutputFolder = String(payload.outputFolder || payload.videoOutputFolder || process.env.VEOUP_OUTPUT_DIR || DEFAULT_VEOUP_OUTPUT_DIR).trim();
    await fsp.mkdir(resolvedOutputFolder, { recursive: true });
    if (!(await pathExists(resolvedOutputFolder))) return { ok: false, error: `Output folder does not exist: ${resolvedOutputFolder}`, outputFolder: resolvedOutputFolder };

    const scenes = Array.isArray(payload.scenes) ? payload.scenes : [];
    throwIfCancelled();
    const collectedKeyframes = await collectKeyframes(resolvedOutputFolder, scenes);
    const prompts = await collectMotionPrompts(resolvedOutputFolder, scenes);
    const exportedPrompts = await exportVeoUpPromptFile(resolvedOutputFolder, prompts);
    const preparedKeyframes = await prepareVeoUpKeyframesFolder(resolvedOutputFolder, collectedKeyframes);
    throwIfCancelled();
    const keyframes = preparedKeyframes.keyframes;
    const promptLineCount = exportedPrompts.promptLineCount;

    const runningVeoUpWindow = await findRunningVeoUpWindow();
    let resolvedLauncher = { ok: true, launcherPath: '', searchedPaths: [], attachedToRunningWindow: Boolean(runningVeoUpWindow?.running), runningWindow: runningVeoUpWindow?.window || null };
    if (runningVeoUpWindow?.running) {
      if (runningVeoUpWindow.window?.executablePath && fs.existsSync(runningVeoUpWindow.window.executablePath)) {
        payload.veoupExePath = runningVeoUpWindow.window.executablePath;
        cachedVeoupExecutablePath = runningVeoUpWindow.window.executablePath;
      }
      console.log(`[VeoUp] Attached to running VeoUp window: ${runningVeoUpWindow.window?.title || runningVeoUpWindow.window?.hwnd || 'unknown'}`);
    } else {
      resolvedLauncher = await resolveVeoUpLauncher(payload);
      if (!resolvedLauncher.ok) {
        return { ok: false, error: 'veoup-launcher-not-found', status: 'veoup-launcher-not-found', outputFolder: resolvedOutputFolder, searchedPaths: resolvedLauncher.searchedPaths || [] };
      }
      payload.veoupExePath = resolvedLauncher.launcherPath;
    }

    // Load calibrated coordinates config BOM-safely
    let blueBoxOffsetX = null;
    let blueBoxOffsetY = null;
    let redBoxOffsetX = null;
    let redBoxOffsetY = null;
    let startButtonOffsetX = null;
    let startButtonOffsetY = null;
    let clearButtonOffsetX = null;
    let clearButtonOffsetY = null;

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
          clearButtonOffsetX = savedConfig.clearButtonOffsetX ?? savedConfig.xoaButtonOffsetX ?? null;
          clearButtonOffsetY = savedConfig.clearButtonOffsetY ?? savedConfig.xoaButtonOffsetY ?? null;
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

    if (!resolvedLauncher.attachedToRunningWindow && resolvedLauncher.launcherPath) {
      console.log(`[VeoUp] Launching executable: ${resolvedLauncher.launcherPath}`);
      const child = spawn(resolvedLauncher.launcherPath, [], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false
      });
      child.unref();
      await new Promise(resolve => setTimeout(resolve, 3000));
      throwIfCancelled();
    }

    if (keyframes.length !== promptLineCount) {
      return {
        ok: false,
        error: `VeoUp image/prompt count mismatch: ${keyframes.length} images, ${promptLineCount} prompt lines.`,
        outputFolder: resolvedOutputFolder,
        keyframes: keyframes.map((item) => item.path),
        keyframesFolder: preparedKeyframes.keyframesDir,
        promptFilePath: exportedPrompts.promptFilePath,
        promptLineCount,
      };
    }

    const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'vidora-veoup-'));
    const payloadPath = path.join(tempDir, 'payload.json');
    const scriptPath = path.join(resolvedOutputFolder, 'run_veoup_temp.ps1');
    const generationTimeoutMs = Number(payload.generationTimeoutMs || payload.timeoutMs || 1200000);
    const automationPayload = {
      projectName: payload.projectName || '',
      outputFolder: resolvedOutputFolder,
      veoupExePath: payload.veoupExePath || '',
      attachedToRunningWindow: Boolean(resolvedLauncher.attachedToRunningWindow),
      runningWindow: resolvedLauncher.runningWindow || null,
      searchedLauncherPaths: resolvedLauncher.searchedPaths || [],
      runId: payload.runId || '',
      sceneId: scenes.length === 1 ? Number(scenes[0]?.id || scenes[0]?.sceneId || 1) : 0,
      imageCount: keyframes.length,
      promptLineCount,
      keyframesFolder: preparedKeyframes.keyframesDir,
      promptFilePath: exportedPrompts.promptFilePath,
      keyframes: keyframes.map((item) => item.path),
      firstKeyframeName: keyframes.length > 0 ? path.basename(keyframes[0].path, '.png') : 'scene_001_keyframe',
      fileSelectionText: collectedKeyframes.map((item) => quoteForFileDialog(item.path)).join(' '),
      promptText: exportedPrompts.promptText,
      promptBoxX: payload.promptBoxX || null,
      promptBoxY: payload.promptBoxY || null,
      blueBoxOffsetX,
      blueBoxOffsetY,
      redBoxOffsetX,
      redBoxOffsetY,
      startButtonOffsetX,
      startButtonOffsetY,
      clearButtonOffsetX,
      clearButtonOffsetY,
      maximizeBeforeAutomation: payload.maximizeBeforeAutomation !== false,
      autoStartVideoGeneration: Boolean(payload.autoStartVideoGeneration),
      generationTimeoutMs,
    };

    await fsp.writeFile(payloadPath, JSON.stringify(automationPayload, null, 2), 'utf8');
    throwIfCancelled();
    
    const powerShellScriptContent = buildPowerShellScript(automationPayload);
    fs.writeFileSync(scriptPath, powerShellScriptContent, 'utf-8');

    let result;
    try {
      result = await runPowerShell(scriptPath, payloadPath, Math.max(Number(payload.timeoutMs || 0), generationTimeoutMs + 60000), {
        runId: payload.runId || '',
        isCancelled: payload.isCancelled,
        registerChildProcess: payload.registerChildProcess,
      });
      throwIfCancelled();
    } finally {
      try {
        if (fs.existsSync(scriptPath)) {
          fs.unlinkSync(scriptPath);
        }
      } catch (err) {
        console.error(`[VeoUp Setup] Error cleaning up temporary script ${scriptPath}: ${err.message}`);
      }
      try {
        if (fs.existsSync(payloadPath)) {
          fs.unlinkSync(payloadPath);
        }
      } catch (err) {}
      try {
        await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => null);
      } catch (err) {}
    }

    if (result.parsed) {
      return {
        ...result.parsed,
        ok: Boolean(result.parsed.ok),
        outputFolder: resolvedOutputFolder,
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
      outputFolder: resolvedOutputFolder,
      keyframes: keyframes.map((item) => item.path),
      keyframesFolder: preparedKeyframes.keyframesDir,
      promptFilePath: exportedPrompts.promptFilePath,
      promptLineCount,
      tempDir,
      powershellExitCode: result.code,
    };
  } catch (error) {
    console.error('[VeoUp Automation] Exception occurred:', error);
    const logger = typeof appendAppLog === 'function' ? appendAppLog : (typeof global.appendAppLog === 'function' ? global.appendAppLog : null);
    if (logger) {
      await logger(
        globalThis.__vidoraCurrentActiveSceneId || 0,
        'error',
        'VeoUp automation sequence encountered a runtime exception',
        {
          errorMessage: error?.message || String(error),
          errorStack: error?.stack || ''
        }
      ).catch(() => null);
    }
    if (error?.code === 'PIPELINE_CANCELLED' || /^PIPELINE_CANCELLED:/i.test(String(error?.message || error))) throw error;
    return { ok: false, error: error?.message || String(error), outputFolder: resolvedOutputFolder };
  }
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
public struct POINT {
  public int X;
  public int Y;
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
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hWnd, ref POINT lpPoint);

  public static RECT GetWinRect(IntPtr hWnd) {
    RECT r;
    GetWindowRect(hWnd, out r);
    return r;
  }
  public static POINT ClientPointToScreen(IntPtr hWnd, int x, int y) {
    POINT p = new POINT { X = x, Y = y };
    ClientToScreen(hWnd, ref p);
    return p;
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

$bluePoint = [VidoraNativeWin]::ClientPointToScreen($hwnd, [int][Math]::Round([double]${offsetX}), [int][Math]::Round([double]${offsetY}))
$blueX = $bluePoint.X
$blueY = $bluePoint.Y

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
public struct POINT {
  public int X;
  public int Y;
}

public class VidoraNativeWin {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hWnd, ref POINT lpPoint);

  public static RECT GetWinRect(IntPtr hWnd) {
    RECT r;
    GetWindowRect(hWnd, out r);
    return r;
  }
  public static POINT ClientPointToScreen(IntPtr hWnd, int x, int y) {
    POINT p = new POINT { X = x, Y = y };
    ClientToScreen(hWnd, ref p);
    return p;
  }
}
"@

$hwnd = [IntPtr](${hwnd});
[VidoraNativeWin]::ShowWindow($hwnd, 3) | Out-Null
Start-Sleep -Milliseconds 800
[VidoraNativeWin]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 300

$startPoint = [VidoraNativeWin]::ClientPointToScreen($hwnd, [int][Math]::Round([double]${offsetX}), [int][Math]::Round([double]${offsetY}))
$startX = $startPoint.X
$startY = $startPoint.Y

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
    [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hWnd, ref POINT lpPoint);
    public static POINT GetPos() {
      POINT p;
      GetCursorPos(out p);
      return p;
    }
    public static POINT GetClientOrigin(IntPtr hWnd) {
      POINT p = new POINT { X = 0, Y = 0 };
      ClientToScreen(hWnd, ref p);
      return p;
    }
  }
"@
} catch {}

$p = [Win32Cursor]::GetPos()
$origin = [Win32Cursor]::GetClientOrigin([IntPtr](${calibrationSession.hwnd}))
$result = [pscustomobject]@{
  x = ($p.X - $origin.X)
  y = ($p.Y - $origin.Y)
  screenX = $p.X
  screenY = $p.Y
  clientScreenOriginX = $origin.X
  clientScreenOriginY = $origin.Y
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

  const rect = calibrationSession.rect;
  const offsetX = cursorResult.x;
  const offsetY = cursorResult.y;

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
      coordinateConvention: 'physical-client-pixels',
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
  try {
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
        if (typeof global.appendAppLog === 'function') {
          global.appendAppLog(i, 'warn', `Scene folder ${sceneToken} incomplete or missing, skipping gracefully`, { sceneId: i });
        } else {
          console.warn(`Scene folder ${sceneToken} incomplete or missing, skipping gracefully`);
        }
        continue;
      }

      // Validate motion_prompt.txt exists
      const promptPath = path.join(sceneFolder, 'motion_prompt.txt');
      if (!fs.existsSync(promptPath)) {
        if (typeof global.appendAppLog === 'function') {
          global.appendAppLog(i, 'warn', `Scene folder ${sceneToken} incomplete: missing motion_prompt.txt, skipping gracefully`, { sceneId: i });
        } else {
          console.warn(`Scene folder ${sceneToken} incomplete: missing motion_prompt.txt, skipping gracefully`);
        }
        continue;
      }

      const promptText = fs.readFileSync(promptPath, 'utf8').trim();
      if (!promptText) {
        if (typeof global.appendAppLog === 'function') {
          global.appendAppLog(i, 'warn', `Scene folder ${sceneToken} incomplete: motion_prompt.txt is empty, skipping gracefully`, { sceneId: i });
        } else {
          console.warn(`Scene folder ${sceneToken} incomplete: motion_prompt.txt is empty, skipping gracefully`);
        }
        continue;
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
        if (typeof global.appendAppLog === 'function') {
          global.appendAppLog(i, 'warn', `Scene folder ${sceneToken} incomplete: missing keyframe image, skipping gracefully`, { sceneId: i });
        } else {
          console.warn(`Scene folder ${sceneToken} incomplete: missing keyframe image, skipping gracefully`);
        }
        continue;
      }

      scenes.push({
        id: i,
        sceneId: i,
        motionPromptPath: promptPath,
        imagePath: keyframePath
      });
    }

    if (scenes.length === 0) {
      return { ok: false, error: 'Không tìm thấy bất kỳ scene nào có đủ cặp ảnh + prompt để nạp.' };
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
  } catch (error) {
    console.error('[VeoUp Scan] Exception occurred:', error);
    const logger = typeof appendAppLog === 'function' ? appendAppLog : (typeof global.appendAppLog === 'function' ? global.appendAppLog : null);
    if (logger) {
      await logger(
        globalThis.__vidoraCurrentActiveSceneId || 0,
        'error',
        'VeoUp automation sequence encountered a runtime exception',
        {
          errorMessage: error?.message || String(error),
          errorStack: error?.stack || ''
        }
      ).catch(() => null);
    }
    return { ok: false, error: error?.message || String(error) };
  }
}

module.exports = {
  executeVeoUpAutomation,
  normalizeWhitespace,
  collectKeyframes,
  collectMotionPrompts,
  convertVeoUpClientPointToScreen,
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
