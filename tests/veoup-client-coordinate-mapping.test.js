const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  convertVeoUpClientPointToScreen,
} = require('../electron/veoupAutomation');

const root = path.resolve(__dirname, '..');
const veoupSource = fs.readFileSync(path.join(root, 'electron/veoupAutomation.js'), 'utf8');

const maximizedWindow = { left: -9, top: -9, right: 1937, bottom: 1049 };
const clientScreenOrigin = { x: 0, y: 31 };
const configuredClientPoint = { x: 412, y: 238 };

for (const dpi of [96, 120, 144]) {
  const point = convertVeoUpClientPointToScreen({
    windowRect: maximizedWindow,
    clientScreenOrigin,
    configuredClientPoint,
    windowDpi: dpi,
  });
  assert.deepStrictEqual(
    point,
    { x: 412, y: 269, coordinateConvention: 'physical-client-pixels' },
    `DPI ${dpi} must not scale client coordinates twice`
  );
}

assert(veoupSource.includes('GetClientRect(IntPtr hWnd, out RECT lpRect)'), 'GetClientRect mapping missing');
assert(veoupSource.includes('ClientToScreen(IntPtr hWnd, ref POINT lpPoint)'), 'ClientToScreen mapping missing');
assert(veoupSource.includes('GetDpiForWindow(IntPtr hWnd)'), 'GetDpiForWindow logging missing');
assert(veoupSource.includes("coordinateConvention = 'physical-client-pixels'"), 'coordinate convention log missing');
assert(veoupSource.includes('activeWindowBeforeClick'), 'activeWindowBeforeClick log missing');
assert(veoupSource.includes('activeWindowAfterClick'), 'activeWindowAfterClick log missing');
assert(veoupSource.includes("Assert-VeoUpForeground $Hwnd 'after-focus'"), 'exact foreground HWND verification missing');
assert(veoupSource.includes("$className -eq '#32770'"), 'Open File dialog must be detected by #32770');
assert(veoupSource.includes('function Click-VeoUpImageImportTarget($Window)'), 'image import UIA fallback missing');
assert(veoupSource.includes("chua chon anh|chon anh|them anh|select image|choose image|add image|upload image"), 'image import fallback must find real choose-image target');
assert(veoupSource.includes('$imageImportUiClick = Click-VeoUpImageImportTarget $window'), 'image import must try UIA target before coordinate fallback');
assert(!veoupSource.includes("SendWait('%i')"), 'Alt+I fallback must not run');
assert(!veoupSource.includes("SendWait('{TAB}')"), 'Tab fallback must not run');
assert(veoupSource.includes("fileSelectionText: collectedKeyframes.map((item) => quoteForFileDialog(item.path)).join(' ')"), 'must select exact validated scene keyframe paths');
assert(!veoupSource.includes("Set-ClipboardText ([string]$payload.keyframesFolder)"), 'must not select from separate keyframes folder');
assert(veoupSource.includes('return { ok: false, error: error?.message || String(error), outputFolder: resolvedOutputFolder };'), 'VeoUp failure must return hard failure with scoped output folder');
assert(/Calibrated Blue Box click did not open the file dialog\.[\s\S]{0,240}exit 1/.test(veoupSource), 'import failure must exit before success');

console.log('veoup client coordinate mapping tests passed');
