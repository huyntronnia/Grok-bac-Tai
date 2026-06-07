const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

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
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class VidoraNativeWin {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
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

function Get-VeoUpProcess() {
  $processes = Get-Process -ErrorAction SilentlyContinue | Where-Object {
    ($_.MainWindowTitle -match 'VeoUp') -or ($_.ProcessName -match 'VeoUp')
  } | Sort-Object { if ($_.MainWindowTitle -match 'VeoUp') { 0 } else { 1 } }
  return $processes | Select-Object -First 1
}

function Get-VeoUpWindowElement($Process) {
  if ($null -eq $Process -or $Process.MainWindowHandle -eq 0) { return $null }
  try { return [System.Windows.Automation.AutomationElement]::FromHandle($Process.MainWindowHandle) } catch { return $null }
}

function Start-Or-Focus-VeoUp($Payload) {
  $proc = Get-VeoUpProcess
  if ($null -eq $proc) {
    $launcher = Resolve-VeoUpLauncher $Payload
    if (!$launcher) { throw 'VeoUp executable/shortcut not found. Set VEOUP_EXE to the full VeoUp.exe path.' }
    Start-Process -FilePath $launcher | Out-Null
  }

  $deadline = (Get-Date).AddSeconds(45)
  do {
    Start-Sleep -Milliseconds 800
    $proc = Get-VeoUpProcess
    $win = Get-VeoUpWindowElement $proc
    if ($win) { break }
  } while ((Get-Date) -lt $deadline)

  if (!$win) { throw 'VeoUp window not found after launch.' }
  [VidoraNativeWin]::ShowWindow($proc.MainWindowHandle, 9) | Out-Null
  [VidoraNativeWin]::SetForegroundWindow($proc.MainWindowHandle) | Out-Null
  Start-Sleep -Milliseconds 800
  return $win
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

function Wait-For-ForegroundDialog() {
  $deadline = (Get-Date).AddSeconds(20)
  do {
    Start-Sleep -Milliseconds 400
    $handle = [VidoraNativeWin]::GetForegroundWindow()
    if ($handle -ne [IntPtr]::Zero) {
      $element = [System.Windows.Automation.AutomationElement]::FromHandle($handle)
      if ($element -and ($element.Current.ControlType.ProgrammaticName -match 'Window')) {
        $name = Normalize-Text $element.Current.Name
        if ($name -notmatch 'veoup') { return $element }
      }
    }
  } while ((Get-Date) -lt $deadline)
  return $null
}

function Set-ClipboardText([string]$Text) {
  [System.Windows.Forms.Clipboard]::Clear()
  Start-Sleep -Milliseconds 150
  [System.Windows.Forms.Clipboard]::SetText($Text)
}

function Test-WindowStillOpen($Window) {
  if ($null -eq $Window) { return $false }
  try {
    $rect = $Window.Current.BoundingRectangle
    return ($rect.Width -gt 1 -and $rect.Height -gt 1)
  } catch {
    return $false
  }
}

function Wait-For-WindowClose($Window, [int]$TimeoutSeconds = 12) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    Start-Sleep -Milliseconds 500
    if (!(Test-WindowStillOpen $Window)) { return $true }
  } while ((Get-Date) -lt $deadline)
  return (!(Test-WindowStillOpen $Window))
}

function Find-BottomEdit($Root) {
  $edits = @()
  $all = $Root.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
  foreach ($element in $all) {
    try {
      if ($element.Current.ControlType.ProgrammaticName -match 'Edit') { $edits += $element }
    } catch {}
  }
  return $edits | Sort-Object { $_.Current.BoundingRectangle.Bottom } -Descending | Select-Object -First 1
}

function Set-EditText($Edit, [string]$Text) {
  if ($null -eq $Edit) { return $false }
  try {
    $valuePattern = $Edit.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
    $valuePattern.SetValue($Text)
    Start-Sleep -Milliseconds 250
    return $true
  } catch {}
  [void](Click-Element $Edit)
  Start-Sleep -Milliseconds 200
  Set-ClipboardText $Text
  [System.Windows.Forms.SendKeys]::SendWait('^a')
  Start-Sleep -Milliseconds 150
  [System.Windows.Forms.SendKeys]::SendWait('^v')
  Start-Sleep -Milliseconds 250
  return $true
}

function Click-OpenButton($Dialog) {
  $button = Find-DescendantByName $Dialog 'Button' @('^open$', '^mo$', '^chon$', 'select')
  if ($button) { return Click-Element $button }
  return $false
}

function Load-Keyframes-WithFileSelectionText($Dialog, [string]$FileSelectionText) {
  $edit = Find-BottomEdit $Dialog
  if (!(Set-EditText $edit $FileSelectionText)) { return $false }
  [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
  if (Wait-For-WindowClose $Dialog 8) { Start-Sleep -Seconds 3; return $true }
  [void](Click-OpenButton $Dialog)
  if (Wait-For-WindowClose $Dialog 8) { Start-Sleep -Seconds 3; return $true }
  return $false
}

function Load-Keyframes-WithKeyboard([string]$KeyframesFolder, [string]$FileSelectionText) {
  Start-Sleep -Seconds 2
  Set-ClipboardText $KeyframesFolder
  [System.Windows.Forms.SendKeys]::SendWait('^l')
  Start-Sleep -Milliseconds 250
  [System.Windows.Forms.SendKeys]::SendWait('^v')
  Start-Sleep -Milliseconds 250
  [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
  Start-Sleep -Seconds 2
  [System.Windows.Forms.SendKeys]::SendWait('%n')
  Start-Sleep -Milliseconds 300
  Set-ClipboardText $FileSelectionText
  [System.Windows.Forms.SendKeys]::SendWait('^a')
  Start-Sleep -Milliseconds 150
  [System.Windows.Forms.SendKeys]::SendWait('^v')
  Start-Sleep -Milliseconds 300
  [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
  Start-Sleep -Seconds 3
}

function Click-ImageToVideo-Tab($Window) {
  $tab = Find-DescendantByName $Window '' @('image to video')
  if ($tab) { return Click-Element $tab }
  $rect = $Window.Current.BoundingRectangle
  Click-Point ($rect.Left + 160) ($rect.Top + 48)
  return $true
}

function Click-SelectImages-Button($Window) {
  $button = Find-DescendantByName $Window 'Button' @('da chon.*anh', 'chon.*anh', 'selected.*image')
  if ($button) { return Click-Element $button }
  $rect = $Window.Current.BoundingRectangle
  Click-Point ($rect.Left + ($rect.Width * 0.82)) ($rect.Top + 92)
  return $true
}

function Click-Prompt-TextBox($Window, $Payload) {
  if ($Payload.promptBoxX -and $Payload.promptBoxY) {
    Click-Point ([double]$Payload.promptBoxX) ([double]$Payload.promptBoxY)
    return $true
  }
  $edit = Find-DescendantByName $Window 'Edit' @('dan hang loat prompt', 'prompt')
  if ($edit) { return Click-Element $edit }
  $rect = $Window.Current.BoundingRectangle
  Click-Point ($rect.Left + ($rect.Width * 0.28)) ($rect.Top + 180)
  return $true
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

$payload = Get-Content -Path $PayloadPath -Raw -Encoding UTF8 | ConvertFrom-Json
$window = Start-Or-Focus-VeoUp $payload
[void](Click-ImageToVideo-Tab $window)
Start-Sleep -Milliseconds 600
[void](Click-SelectImages-Button $window)
$dialog = Wait-For-ForegroundDialog
if (!$dialog) { throw 'File dialog did not open after clicking image selector.' }
$imageImportOk = Load-Keyframes-WithFileSelectionText $dialog ([string]$payload.fileSelectionText)
if (!$imageImportOk) {
  Load-Keyframes-WithKeyboard ([string]$payload.keyframesFolder) ([string]$payload.fileSelectionText)
  if (!(Wait-For-WindowClose $dialog 8)) { throw 'Keyframe file dialog stayed open after import attempts. Images were not submitted to VeoUp.' }
}
$window = Start-Or-Focus-VeoUp $payload

$promptText = Get-Content -Path ([string]$payload.promptFilePath) -Raw -Encoding UTF8
Set-ClipboardText $promptText
[void](Click-Prompt-TextBox $window $payload)
Start-Sleep -Milliseconds 250
[System.Windows.Forms.SendKeys]::SendWait('^a')
Start-Sleep -Milliseconds 100
[System.Windows.Forms.SendKeys]::SendWait('^v')
$expectedRows = [int]$payload.promptLineCount
$rowCount = 0
$validationAttempts = @()
for ($attempt = 1; $attempt -le 5; $attempt += 1) {
  Start-Sleep -Milliseconds 1500
  $rowCount = Count-LeftPromptRows $window
  $validationAttempts += [pscustomobject]@{ attempt = $attempt; detectedRows = $rowCount }
  if ($rowCount -eq $expectedRows) { break }
}
$result = [pscustomobject]@{
  ok = ($rowCount -eq $expectedRows)
  expectedRows = $expectedRows
  detectedRows = $rowCount
  imageCount = [int]$payload.imageCount
  promptLineCount = [int]$payload.promptLineCount
  promptFilePath = [string]$payload.promptFilePath
  keyframesFolder = [string]$payload.keyframesFolder
  validationAttempts = $validationAttempts
}
'VIDORA_VEOUP_RESULT ' + ($result | ConvertTo-Json -Depth 8 -Compress)
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
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
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

  if (!keyframes.length) return { ok: false, error: 'No .png keyframe images found for VeoUp automation.', outputFolder };
  if (!promptLineCount) {
    return {
      ok: false,
      error: 'No motion prompts found for VeoUp automation.',
      outputFolder,
      promptFilePath: exportedPrompts.promptFilePath,
    };
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

module.exports = {
  executeVeoUpAutomation,
  normalizeWhitespace,
  collectKeyframes,
  collectMotionPrompts,
  prepareVeoUpKeyframesFolder,
  exportVeoUpPromptFile,
};
