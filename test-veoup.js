const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

/**
 * DEBUG / DEVELOPER TOOL ONLY:
 * Note: For production use and setup, Vidora app now exposes an in-app UI feature
 * to calibrate VeoUp coordinates. Users do not need to edit this file or manually
 * toggle CALIBRATION_MODE. Use the "Thiết lập tọa độ VeoUp" button in Vidora Settings.
 */
const CALIBRATION_MODE = false;
const CALIBRATION_CONFIG_PATH = path.join(__dirname, 'veoup-test-coordinates.json');

// Hardcoded local test paths
const outputFolder = 'D:\\TOOL VIDEO\\New folder (2)\\123';
const keyframesFolder = 'D:\\TOOL VIDEO\\New folder (2)\\123\\keyframes';
const batchPromptsFile = 'D:\\TOOL VIDEO\\New folder (2)\\123\\veoup_prompts_ready.txt';
const expectedSceneCount = 3;

// Configurable defaults (will be overwritten if veoup-test-coordinates.json exists)
let veoupClickConfig = {
  blueBoxOffsetX: 300,
  blueBoxOffsetY: 220,
  redBoxOffsetX: 420,
  redBoxOffsetY: 520,
  startButtonOffsetX: 1200,
  startButtonOffsetY: 880
};

const DEBUG_COORDINATES = true;
const CLEAR_REDBOX_BEFORE_PASTE = false;
const CLICK_START_VIDEO_BUTTON = true;
const AUTO_CONFIRM_START_DIALOG = true;

if (!CALIBRATION_MODE) {
  if (fs.existsSync(CALIBRATION_CONFIG_PATH)) {
    try {
      const configContent = fs.readFileSync(CALIBRATION_CONFIG_PATH, 'utf8');
      const savedConfig = JSON.parse(configContent);
      
      // Strict validation of the calibration structure
      if (!savedConfig.targetWindowClass || !savedConfig.targetTitlePrefix || savedConfig.targetWindowClass === 'Notepad') {
        console.error('[TEST-VEOUP] Existing calibration file was created before strict VeoUp window validation. Please recalibrate.');
        console.error('Run calibration mode first: node test-veoup.js (with CALIBRATION_MODE=true)');
        process.exit(1);
      }

      if (savedConfig.startButtonOffsetX === undefined || savedConfig.startButtonOffsetY === undefined) {
        console.error('[TEST-VEOUP] Calibration file does not include Start Button coordinates. Please run CALIBRATION_MODE=true again.');
        process.exit(1);
      }

      veoupClickConfig = {
        blueBoxOffsetX: savedConfig.blueBoxOffsetX,
        blueBoxOffsetY: savedConfig.blueBoxOffsetY,
        redBoxOffsetX: savedConfig.redBoxOffsetX,
        redBoxOffsetY: savedConfig.redBoxOffsetY,
        startButtonOffsetX: savedConfig.startButtonOffsetX,
        startButtonOffsetY: savedConfig.startButtonOffsetY
      };
      console.log('[TEST-VEOUP] Loaded calibrated coordinates from veoup-test-coordinates.json:');
      console.log(`  BlueBox offset: X=${veoupClickConfig.blueBoxOffsetX}, Y=${veoupClickConfig.blueBoxOffsetY}`);
      console.log(`  RedBox offset: X=${veoupClickConfig.redBoxOffsetX}, Y=${veoupClickConfig.redBoxOffsetY}`);
      console.log(`  StartButton offset: X=${veoupClickConfig.startButtonOffsetX}, Y=${veoupClickConfig.startButtonOffsetY}`);
    } catch (err) {
      console.error(`[ERROR] Failed to parse veoup-test-coordinates.json: ${err.message}`);
      process.exit(1);
    }
  } else {
    console.error('[TEST-VEOUP] ERROR: Missing veoup-test-coordinates.json. Please run with CALIBRATION_MODE=true first.');
    process.exit(1);
  }
}

console.log('[TEST-VEOUP] Validating input files and directories...');

// Validate outputFolder
if (!fs.existsSync(outputFolder)) {
  console.error(`[ERROR] outputFolder does not exist: ${outputFolder}`);
  process.exit(1);
}

// Validate keyframesFolder
if (!fs.existsSync(keyframesFolder)) {
  console.error(`[ERROR] keyframesFolder does not exist: ${keyframesFolder}`);
  process.exit(1);
}

// Validate keyframesFolder contains correct number of .png files
let pngFiles = [];
try {
  const files = fs.readdirSync(keyframesFolder);
  pngFiles = files.filter(f => /\.png$/i.test(f));
  
  if (pngFiles.length !== expectedSceneCount) {
    console.error(`[ERROR] Found ${pngFiles.length} keyframe images, but expectedSceneCount is ${expectedSceneCount}.`);
    process.exit(1);
  }

  // Sort numerically / chronologically
  pngFiles.sort((a, b) => {
    const aMatch = a.match(/\d+/);
    const bMatch = b.match(/\d+/);
    const aNum = aMatch ? parseInt(aMatch[0], 10) : 0;
    const bNum = bMatch ? parseInt(bMatch[0], 10) : 0;
    return aNum - bNum;
  });

  console.log(`[INFO] Found and sorted ${pngFiles.length} keyframe images:`);
  pngFiles.forEach(f => console.log(`  - ${f}`));
} catch (err) {
  console.error(`[ERROR] Failed to read keyframesFolder: ${err.message}`);
  process.exit(1);
}

// Build the quoted file list
const quotedPngList = pngFiles.map(f => `"${path.join(keyframesFolder, f)}"`).join(' ');
console.log(`[INFO] Quoted file list length: ${quotedPngList.length} chars.`);

// Build a PowerShell array literal of individual file paths for per-scene import loop
const psPngArrayLiteral = '@(' + pngFiles.map(f => {
  const fullPath = path.join(keyframesFolder, f).replace(/'/g, "''");
  return `'${fullPath}'`;
}).join(', ') + ')';
console.log(`[INFO] PowerShell PNG array literal item count: ${pngFiles.length}`);

// Validate batchPromptsFile
if (!fs.existsSync(batchPromptsFile)) {
  console.error(`[ERROR] batchPromptsFile does not exist: ${batchPromptsFile}`);
  process.exit(1);
}

// Validate batchPromptsFile is not empty
const promptText = fs.readFileSync(batchPromptsFile, 'utf8');
if (!promptText.trim()) {
  console.error(`[ERROR] batchPromptsFile is empty: ${batchPromptsFile}`);
  process.exit(1);
}

// Check if prompt count matches expected
const promptLines = promptText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
if (promptLines.length !== expectedSceneCount) {
  console.error(`[ERROR] Prompt line count (${promptLines.length}) does not match expectedSceneCount (${expectedSceneCount}).`);
  process.exit(1);
} else {
  console.log(`[INFO] Prompt line count matches expectedSceneCount (${expectedSceneCount}).`);
}

function buildTestPowerShellScript() {
  const escapedQuotedPngList = quotedPngList.replace(/'/g, "''");
  const escapedPromptText = promptText.replace(/'/g, "''");
  const escapedConfigPath = CALIBRATION_CONFIG_PATH.replace(/\\/g, '\\\\').replace(/'/g, "''");
  const escapedKeyframesFolder = keyframesFolder.replace(/'/g, "''");

  return `
$ErrorActionPreference = 'Stop'
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
  Write-Host "[TEST-VEOUP] Process DPI aware enabled."
} catch {
  Write-Host "[TEST-VEOUP] DPI awareness call failed or unavailable; continuing."
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

function Click-Point([double]$X, [double]$Y) {
  [VidoraNativeWin]::SetCursorPos([int]$X, [int]$Y) | Out-Null
  Start-Sleep -Milliseconds 120
  [VidoraNativeWin]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  [VidoraNativeWin]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 250
}

function Move-Cursor([double]$X, [double]$Y) {
  [VidoraNativeWin]::SetCursorPos([int]$X, [int]$Y) | Out-Null
  Start-Sleep -Milliseconds 120
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

function Take-Screenshot([string]$Path) {
  try {
    Add-Type -AssemblyName System.Drawing
    $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
    $graphics = [System.Drawing.Graphics]::FromImage($bmp)
    $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
    $bmp.Save($Path)
    $graphics.Dispose()
    $bmp.Dispose()
    Write-Host "[TEST-VEOUP] Screenshot saved to $Path"
  } catch {
    Write-Host "[TEST-VEOUP] Warning: Failed to take screenshot: $_"
  }
}

function Find-RealVeoUpWindow {
  Write-Host "[TEST-VEOUP] Enumerate visible top-level windows..."
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
      if ($title -match '^\\s*VeoUp(\\s|v|$)') { $score += 60 }
      if ($className -match '^Qt') { $score += 30 }
      if ($title -match 'v\\d+\\.\\d+\\.\\d+') { $score += 20 }
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

  Write-Host "[TEST-VEOUP] Window candidates:"
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

# Config from node
$BlueBoxOffsetX = ${veoupClickConfig.blueBoxOffsetX}
$BlueBoxOffsetY = ${veoupClickConfig.blueBoxOffsetY}
$RedBoxOffsetX = ${veoupClickConfig.redBoxOffsetX}
$RedBoxOffsetY = ${veoupClickConfig.redBoxOffsetY}
$StartButtonOffsetX = ${veoupClickConfig.startButtonOffsetX}
$StartButtonOffsetY = ${veoupClickConfig.startButtonOffsetY}
$CalibrationMode = $${CALIBRATION_MODE ? 'true' : 'false'}
$DebugCoordinates = $${DEBUG_COORDINATES ? 'true' : 'false'}
$ClearRedBoxBeforePaste = $${CLEAR_REDBOX_BEFORE_PASTE ? 'true' : 'false'}
$ClickStartButton = $${CLICK_START_VIDEO_BUTTON ? 'true' : 'false'}
$AutoConfirmStartDialog = $${AUTO_CONFIRM_START_DIALOG ? 'true' : 'false'}

$targetWin = Find-RealVeoUpWindow
if ($null -eq $targetWin) {
  Write-Host "[TEST-VEOUP] ERROR: VeoUp window not found. Please launch VeoUp first."
  exit 1
}

# Explicit assertion on Notepad / Editor
if (($targetWin.Title -match 'test-veoup') -or ($targetWin.ClassName -eq 'Notepad') -or ($targetWin.ClassName -match 'Notepad|SlateContainerClass')) {
  Write-Host "[TEST-VEOUP] ERROR: Refusing to use editor window as VeoUp target."
  exit 1
}

$proc = $targetWin.ProcessName
$hwnd = $targetWin.Handle
$rect = $targetWin.Rect

# Bring to foreground
[VidoraNativeWin]::ShowWindow($hwnd, 9) | Out-Null
[VidoraNativeWin]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 800

$title = Get-ActiveWindowTitle
$className = Get-ActiveWindowClassName
Write-Host "[TEST-VEOUP] Focused window: $title (Class: $className)"
Write-Host "[TEST-VEOUP] Window bounds: Left=$($rect.Left), Top=$($rect.Top), Right=$($rect.Right), Bottom=$($rect.Bottom)"

# Calibration mode
if ($CalibrationMode) {
  Write-Host ""
  Write-Host "[CALIBRATION] === CALIBRATION MODE ACTIVE ==="
  Write-Host "[CALIBRATION] Using VeoUp window:"
  Write-Host "  Title: $($targetWin.Title)"
  Write-Host "  Class: $($targetWin.ClassName)"
  Write-Host "  Process: $($targetWin.ProcessName)"
  Write-Host "  Rect: Left=$($rect.Left), Top=$($rect.Top), Right=$($rect.Right), Bottom=$($rect.Bottom)"
  Write-Host ""
  Write-Host "[CALIBRATION] Step 1: Put your mouse over the center of the VeoUp image import area / 'Đã chọn 0 ảnh', then press Enter here."
  Read-Host

  $bluePoint = [VidoraNativeWin]::GetMousePos()
  $blueOffsetX = $bluePoint.X - $rect.Left
  $blueOffsetY = $bluePoint.Y - $rect.Top
  Write-Host "[CALIBRATION] BlueBox absolute mouse position: ($($bluePoint.X), $($bluePoint.Y))"
  Write-Host "[CALIBRATION] BlueBox offset relative to window: X=$blueOffsetX, Y=$blueOffsetY"
  Write-Host ""

  Write-Host "[CALIBRATION] Step 2: Put your mouse over the center of the VeoUp prompt input area, then press Enter here."
  Read-Host

  $redPoint = [VidoraNativeWin]::GetMousePos()
  $redOffsetX = $redPoint.X - $rect.Left
  $redOffsetY = $redPoint.Y - $rect.Top
  Write-Host "[CALIBRATION] RedBox absolute mouse position: ($($redPoint.X), $($redPoint.Y))"
  Write-Host "[CALIBRATION] RedBox offset relative to window: X=$redOffsetX, Y=$redOffsetY"
  Write-Host ""

  Write-Host "[CALIBRATION] Step 3: Put your mouse over the center of the 'Bắt đầu tạo video' / Start Video button, then press Enter here."
  Read-Host

  $startPoint = [VidoraNativeWin]::GetMousePos()
  $startOffsetX = $startPoint.X - $rect.Left
  $startOffsetY = $startPoint.Y - $rect.Top
  Write-Host "[CALIBRATION] StartButton absolute mouse position: ($($startPoint.X), $($startPoint.Y))"
  Write-Host "[CALIBRATION] StartButton offset relative to window: X=$startOffsetX, Y=$startOffsetY"
  Write-Host ""

  # Save to JSON
  $jsonObj = [ordered]@{
    blueBoxOffsetX = $blueOffsetX
    blueBoxOffsetY = $blueOffsetY
    redBoxOffsetX = $redOffsetX
    redBoxOffsetY = $redOffsetY
    startButtonOffsetX = $startOffsetX
    startButtonOffsetY = $startOffsetY
    targetWindowClass = $targetWin.ClassName
    targetTitlePrefix = "VeoUp"
  }
  $jsonText = $jsonObj | ConvertTo-Json
  Set-Content -Path "${escapedConfigPath}" -Value $jsonText -Encoding UTF8
  Write-Host "[CALIBRATION] Saved coordinates to: ${escapedConfigPath}"
  Write-Host "[CALIBRATION] Coordinates content: $jsonText"
  Write-Host ""
  Write-Host "Now set CALIBRATION_MODE = false inside test-veoup.js and run: node test-veoup.js"
  exit 0
}

# Normal execution mode using calibrated offsets
$blueX = $rect.Left + $BlueBoxOffsetX
$blueY = $rect.Top + $BlueBoxOffsetY
$redX = $rect.Left + $RedBoxOffsetX
$redY = $rect.Top + $RedBoxOffsetY
$startX = $rect.Left + $StartButtonOffsetX
$startY = $rect.Top + $StartButtonOffsetY

# One-Shot Folder Import Logic
Write-Host "[TEST-VEOUP] Importing all keyframes from folder: $keyframesFolder..."
Write-Host "[TEST-VEOUP] Clicking Blue Box image import area at absolute coordinate ($blueX, $blueY)..."
if ($DebugCoordinates) {
  Move-Cursor $blueX $blueY
  Start-Sleep -Seconds 1
}
Click-Point $blueX $blueY

Write-Host "[TEST-VEOUP] Waiting for Open File dialog..."
if (!(Wait-For-FileDialog)) {
  $activeTitle = Get-ActiveWindowTitle
  $activeClass = Get-ActiveWindowClassName
  Write-Host "[TEST-VEOUP] Calibrated Blue Box click did not open the file dialog."
  Write-Host "[TEST-VEOUP] Current active window: $activeTitle (Class: $activeClass)"
  exit 1
}
Start-Sleep -Milliseconds 2000

Write-Host "[TEST-VEOUP] Navigating to keyframes directory..."
[System.Windows.Forms.SendKeys]::SendWait('%d')
Start-Sleep -Milliseconds 500
Set-ClipboardText $keyframesFolder
Start-Sleep -Milliseconds 200
[System.Windows.Forms.SendKeys]::SendWait('^v')
Start-Sleep -Milliseconds 100
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')

Write-Host "[TEST-VEOUP] Waiting for Windows Explorer to render folder view..."
Start-Sleep -Milliseconds 1500

Write-Host "[TEST-VEOUP] Anchor focus in File Name box first..."
[System.Windows.Forms.SendKeys]::SendWait('%n')
Start-Sleep -Milliseconds 300
[System.Windows.Forms.SendKeys]::SendWait('scene_001_keyframe')
Start-Sleep -Milliseconds 500

Write-Host "[TEST-VEOUP] Send Shift+TAB (+{TAB}) to shift focus directly UP into the image grid view container..."
[System.Windows.Forms.SendKeys]::SendWait('+{TAB}')
Start-Sleep -Milliseconds 500

Write-Host "[TEST-VEOUP] Selecting all keyframe files..."
[System.Windows.Forms.SendKeys]::SendWait('^a')
Start-Sleep -Milliseconds 500
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')

Write-Host "[TEST-VEOUP] Waiting 5 seconds for VeoUp image grid to append assets..."
Start-Sleep -Milliseconds 5000

$titleAfterOpen = Get-ActiveWindowTitle
$classAfterOpen = Get-ActiveWindowClassName
Write-Host "[TEST-VEOUP] Active window after dialog ENTER: $titleAfterOpen (Class: $classAfterOpen)"

if (($titleAfterOpen -match 'open|select|keyframe|folder') -or ($classAfterOpen -eq '#32770')) {
  Write-Host "[TEST-VEOUP] ERROR: File dialog is still open. Import path or file selection failed."
  exit 1
}

Write-Host "[TEST-VEOUP] Refocusing VeoUp window..."
[VidoraNativeWin]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 500
$title = Get-ActiveWindowTitle
$className = Get-ActiveWindowClassName
Write-Host "[TEST-VEOUP] Active window after refocus: $title (Class: $className)"

if ($title -notmatch 'VeoUp') {
  Write-Host "[TEST-VEOUP] ERROR: Active window is not VeoUp before prompt paste: $title"
  exit 1
}

Take-Screenshot "test-veoup-before-redbox.png"
Write-Host "[TEST-VEOUP] Setting prompts text in clipboard..."
$PromptBatchText = '${escapedPromptText}'
Set-ClipboardText $PromptBatchText

Write-Host "[TEST-VEOUP] Clicking Red Box prompt input area at coordinate ($redX, $redY)..."
if ($DebugCoordinates) {
  Move-Cursor $redX $redY
  Start-Sleep -Seconds 1
}
Click-Point $redX $redY
Start-Sleep -Milliseconds 500

$title = Get-ActiveWindowTitle
$className = Get-ActiveWindowClassName
Write-Host "[TEST-VEOUP] Active window before prompt paste: $title (Class: $className)"

if ($title -notmatch 'VeoUp') {
  Write-Host "[TEST-VEOUP] ERROR: Active window is not VeoUp before prompt paste: $title"
  exit 1
}

Write-Host "[TEST-VEOUP] Pasting prompts..."
if ($ClearRedBoxBeforePaste) {
  [System.Windows.Forms.SendKeys]::SendWait('^a')
  Start-Sleep -Milliseconds 150
  [System.Windows.Forms.SendKeys]::SendWait('{BACKSPACE}')
  Start-Sleep -Milliseconds 150
}
[System.Windows.Forms.SendKeys]::SendWait('^v')
Start-Sleep -Milliseconds 500

Write-Host "[VeoUp Macro Progress] All keyframes and prompt lines dispatched."

$title = Get-ActiveWindowTitle
$className = Get-ActiveWindowClassName
Write-Host "[TEST-VEOUP] Active window after pasting prompts: $title (Class: $className)"

# Click Start Video Button
Start-Sleep -Seconds 1.5
if ($ClickStartButton) {
  Write-Host "[TEST-VEOUP] Start Button offset loaded: X=$StartButtonOffsetX, Y=$StartButtonOffsetY"
  Write-Host "[TEST-VEOUP] Refocusing VeoUp before Start button click..."
  [VidoraNativeWin]::ShowWindow($hwnd, 9) | Out-Null
  [VidoraNativeWin]::SetForegroundWindow($hwnd) | Out-Null
  Start-Sleep -Seconds 1

  Write-Host "[TEST-VEOUP] Clicking Start Video button at absolute coordinate ($startX, $startY)..."
  if ($DebugCoordinates) {
    Move-Cursor $startX $startY
    Start-Sleep -Seconds 1
  }
  Click-Point $startX $startY
  Write-Host "[TEST-VEOUP] Start Video button clicked."
  Start-Sleep -Seconds 1.5

  if ($AutoConfirmStartDialog) {
    Write-Host "[TEST-VEOUP] Waiting for possible confirmation dialog..."
    $titleAfterStart = Get-ActiveWindowTitle
    $classAfterStart = Get-ActiveWindowClassName
    Write-Host "[TEST-VEOUP] Active window after Start click: $titleAfterStart (Class: $classAfterStart)"

    Write-Host "[TEST-VEOUP] Start confirmation sent."
    [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
    Start-Sleep -Seconds 1
  }
} else {
  Write-Host "[TEST-VEOUP] CLICK_START_VIDEO_BUTTON=false, skipping final Start button click."
}

if (Get-Command Clear-Clipboard -ErrorAction SilentlyContinue) { Clear-Clipboard } else { [System.Windows.Forms.Clipboard]::Clear() }
Write-Host "[VeoUp Macro Progress] Final Start triggered and clipboard cleared."

Write-Host "[TEST-VEOUP] Row validation unavailable in standalone macro test. Please visually confirm VeoUp loaded ${expectedSceneCount} rows."
Write-Host "[TEST-VEOUP] Integration test completed successfully."
`;
}

console.log('[TEST-VEOUP] Generating PowerShell script...');
const psScript = buildTestPowerShellScript();

const ps1Path = path.join(os.tmpdir(), `vidora-test-veoup-${Date.now()}.ps1`);
console.log(`[TEST-VEOUP] Writing script to temp file: ${ps1Path}`);
fs.writeFileSync(ps1Path, psScript, 'utf8');

console.log('[TEST-VEOUP] Launching PowerShell runner...');
const child = spawn('powershell.exe', [
  '-NoProfile',
  '-ExecutionPolicy',
  'Bypass',
  '-File',
  ps1Path
], {
  windowsHide: false,
  stdio: 'inherit'
});

child.on('close', (code) => {
  console.log(`[TEST-VEOUP] PowerShell process exited with code ${code}`);
  try {
    fs.unlinkSync(ps1Path);
    console.log('[TEST-VEOUP] Temp script deleted successfully.');
  } catch (err) {
    console.warn(`[TEST-VEOUP] Failed to delete temp file ${ps1Path}: ${err.message}`);
  }
  process.exit(code);
});
