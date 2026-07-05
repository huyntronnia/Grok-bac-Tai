const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'electron/main.js'), 'utf8');

function extractFunction(name, isAsync = false) {
  const prefix = isAsync ? `async function ${name}(` : `function ${name}(`;
  const start = main.indexOf(prefix);
  assert(start >= 0, `${name} source not found`);
  const nextFunction = main.indexOf('\n}\n\n', start);
  assert(nextFunction > start, `${name} source end not found`);
  return main.slice(start, nextFunction + 3);
}

const sandbox = {
  fs: fs.promises,
  path,
};
vm.createContext(sandbox);
vm.runInContext(`${extractFunction('resolveProjectCharactersFolder')}
${extractFunction('resolveCharacterPresetFiles', true)}
this.resolveProjectCharactersFolder = resolveProjectCharactersFolder;
this.resolveCharacterPresetFiles = resolveCharacterPresetFiles;`, sandbox);

async function withTempProject(run) {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vidora-character-presets-'));
  try {
    return await run(projectDir);
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
}

(async () => {
  await withTempProject(async (projectDir) => {
    const charactersDir = path.join(projectDir, 'characters');
    fs.mkdirSync(charactersDir);
    fs.writeFileSync(path.join(charactersDir, 'b.webp'), 'image');
    fs.writeFileSync(path.join(charactersDir, 'a.png'), 'image');
    fs.writeFileSync(path.join(charactersDir, 'ignore.gif'), 'image');
    fs.writeFileSync(path.join(charactersDir, 'z.txt'), 'second');
    fs.writeFileSync(path.join(charactersDir, 'a.txt'), 'first');

    const result = await sandbox.resolveCharacterPresetFiles({ outputFolder: projectDir, sceneText: 'no matching names here' });
    assert.deepStrictEqual(result.imageFiles.map((file) => path.basename(file)), ['a.png', 'b.webp']);
    assert.deepStrictEqual(result.textFiles.map((file) => path.basename(file)), ['a.txt', 'z.txt']);
    assert.strictEqual(result.descriptionText, 'first\n\nsecond');
  });

  await withTempProject(async (projectDir) => {
    await assert.rejects(
      () => sandbox.resolveCharacterPresetFiles({ outputFolder: projectDir }),
      /characters folder missing:/
    );
  });

  await withTempProject(async (projectDir) => {
    const charactersDir = path.join(projectDir, 'characters');
    fs.mkdirSync(charactersDir);
    fs.writeFileSync(path.join(charactersDir, 'notes.txt'), 'optional description');

    const result = await sandbox.resolveCharacterPresetFiles({ outputFolder: projectDir });
    assert.deepStrictEqual(result.imageFiles, []);
    assert.deepStrictEqual(result.textFiles.map((file) => path.basename(file)), ['notes.txt']);
    assert.strictEqual(result.descriptionText, 'optional description');
  });

  await withTempProject(async (projectDir) => {
    const charactersDir = path.join(projectDir, 'characters');
    fs.mkdirSync(charactersDir);
    fs.writeFileSync(path.join(charactersDir, 'only-image.jpg'), 'image');

    const result = await sandbox.resolveCharacterPresetFiles({ outputFolder: projectDir });
    assert.deepStrictEqual(result.imageFiles.map((file) => path.basename(file)), ['only-image.jpg']);
    assert.deepStrictEqual(result.textFiles, []);
    assert.strictEqual(result.descriptionText, '');
  });

  const uploadOrderIndex = main.indexOf('characterResolution.imageFiles.forEach((imagePath) => filesToUpload.push(imagePath))');
  const nv1SendIndex = main.indexOf('const sentImage = await sendPromptViaCdpInput(page, finalPrompt)');
  assert(uploadOrderIndex >= 0 && nv1SendIndex > uploadOrderIndex, 'character upload queue must be built before NV1 send');
  assert(main.includes('No character images found; skipping character upload.'), 'empty characters folder must log skip');
  assert(main.includes('Sending NV1 without character images.'), 'empty characters folder must continue to NV1');
  const emptyCharacterBlock = main.slice(main.indexOf('if (isChatGptContextFresh) {'), main.indexOf('let previousSceneReferenceAttached = false;'));
  assert(!emptyCharacterBlock.includes('forceCleanChatGptNewChatRotation'), 'empty characters folder must not rotate ChatGPT');

  console.log('character presets folder tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
