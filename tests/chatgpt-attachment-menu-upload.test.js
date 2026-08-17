"use strict";

const assert = require("assert");
const {
  openChatGptAttachmentChooserWithPlaywright,
} = require("../electron/main/chatgpt/chatgpt_upload");

function collection(items = []) {
  return {
    count: async () => items.length,
    nth: (index) => items[index],
  };
}

(async () => {
  const events = [];
  const plus = {
    isVisible: async () => true,
    click: async () => events.push("plus-clicked"),
  };
  const menuItem = {
    isVisible: async () => true,
    click: async () => events.push("add-files-clicked"),
  };
  const chooser = {
    setFiles: async (filePath) => events.push(`set-files:${filePath}`),
  };
  const nativePage = {
    keyboard: {
      press: async (key) => events.push(`key:${key}`),
    },
    locator: (selector) =>
      selector === 'button[aria-label="Add files and more"]'
        ? collection([plus])
        : collection([]),
    getByRole: (role) =>
      role === "menuitem" ? collection([menuItem]) : collection([]),
    getByText: () => collection([]),
    waitForEvent: async (eventName) => {
      assert.strictEqual(eventName, "filechooser");
      return chooser;
    },
  };
  const result = await openChatGptAttachmentChooserWithPlaywright(
    { clientType: "playwright", page: nativePage },
    "C:/project/scene_001/scene_001_nv1_request.txt",
  );

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.mode, "chatgpt-add-files-filechooser");
  assert.deepStrictEqual(events, [
    "key:Escape",
    "plus-clicked",
    "add-files-clicked",
    "set-files:C:/project/scene_001/scene_001_nv1_request.txt",
  ]);

  console.log("ChatGPT explicit attachment-menu upload tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
