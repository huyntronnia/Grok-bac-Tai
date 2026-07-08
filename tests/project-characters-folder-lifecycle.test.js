const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'electron/main.js'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'electron/renderer.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'electron/index.html'), 'utf8');

function functionSource(name) {
  const start = main.indexOf(`async function ${name}(`);
  assert(start >= 0, `${name} source not found`);
  const next = main.indexOf('\n}\n\nasync function ', start);
  assert(next > start, `${name} source end not found`);
  return main.slice(start, next + 3);
}

const helperStart = main.indexOf('function resolveProjectCharactersFolder(');
const helperEnd = main.indexOf('\n\nasync function newProjectSession', helperStart);
assert(helperStart >= 0 && helperEnd > helperStart, 'project characters helper block not found');
const helperBlock = main.slice(helperStart, helperEnd);

const createProjectSource = functionSource('createProjectSessionFile');
const openProjectSource = functionSource('openProjectSessionFile');

assert(
  createProjectSource.includes('await ensureProjectCharactersFolder(projectFolder, { logCreated: true });'),
  'new project creation must create characters folder with creation log'
);
assert(
  createProjectSource.indexOf('await fs.mkdir(projectFolder, { recursive: true });') <
    createProjectSource.indexOf('await ensureProjectCharactersFolder(projectFolder, { logCreated: true });'),
  'new project must create project folder before characters folder'
);
assert(
  createProjectSource.indexOf('await fs.writeFile(filePath') <
    createProjectSource.indexOf('await ensureProjectCharactersFolder(projectFolder, { logCreated: true });'),
  'new project must create characters folder after project file is written'
);
assert(
  openProjectSource.includes('await ensureProjectCharactersFolder(projectFolder);'),
  'opening old project must repair missing characters folder'
);

assert(helperBlock.includes('shell.openPath(charactersFolderPath)'), 'Character Management must open characters folder');
assert(!helperBlock.includes('dialog.showOpenDialog'), 'Character Management must not show import dialog');
assert(!helperBlock.includes('copyFile'), 'Character Management must not copy character files');
assert(helperBlock.includes('Opened project characters folder:'), 'Character Management open log missing');

assert(
  main.includes('const charactersDir = resolveProjectCharactersFolder(outputFolder || \'\');'),
  'pipeline resolver must use shared project characters resolver'
);

assert(renderer.includes('Hãy tạo hoặc mở project trước khi mở thư mục nhân vật.'), 'renderer no-project guard missing');
assert(indexHtml.includes('Quản lý nhân vật'), 'button label missing');
assert(!indexHtml.includes('Quản lý nhân vật (Presets)'), 'obsolete Presets label still present');

async function withTempProject(run) {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vidora-project-characters-'));
  try {
    return await run(projectDir);
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
}

(async () => {
  await withTempProject(async (projectDir) => {
    const openedPaths = [];
    const sandbox = {
      console,
      fs: fs.promises,
      path,
      shell: {
        openPath: async (targetPath) => {
          openedPaths.push(targetPath);
          return '';
        },
      },
      appendAppLog: async () => null,
    };
    vm.createContext(sandbox);
    vm.runInContext(`${helperBlock}
this.resolveProjectCharactersFolder = resolveProjectCharactersFolder;
this.ensureProjectCharactersFolder = ensureProjectCharactersFolder;
this.importCharacterPresetsHandler = importCharacterPresetsHandler;`, sandbox);

    const expectedCharactersFolder = path.join(projectDir, 'characters');
    assert.strictEqual(sandbox.resolveProjectCharactersFolder(projectDir), expectedCharactersFolder);

    const ensuredPath = await sandbox.ensureProjectCharactersFolder(projectDir);
    assert.strictEqual(ensuredPath, expectedCharactersFolder);
    assert(fs.existsSync(expectedCharactersFolder), 'ensure helper must create characters folder');

    fs.rmSync(expectedCharactersFolder, { recursive: true, force: true });
    const result = await sandbox.importCharacterPresetsHandler(null, projectDir);
    assert.deepStrictEqual(openedPaths, [expectedCharactersFolder]);
    assert.strictEqual(result.charactersFolderPath, expectedCharactersFolder);
    assert(fs.existsSync(expectedCharactersFolder), 'button handler must create missing characters folder');
  });

  await withTempProject(async (projectDir) => {
    const sandbox = {
      console,
      fs: fs.promises,
      path,
      shell: { openPath: async () => '' },
      appendAppLog: async () => null,
    };
    vm.createContext(sandbox);
    vm.runInContext(`${helperBlock}
this.importCharacterPresetsHandler = importCharacterPresetsHandler;`, sandbox);

    await assert.rejects(
      () => sandbox.importCharacterPresetsHandler(null, ''),
      /Hãy tạo hoặc mở project trước khi mở thư mục nhân vật\./
    );
    assert(!fs.existsSync(path.join(projectDir, 'characters', 'unused')), 'no-project guard must not create random folders');
  });

  console.log('project characters folder lifecycle tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
