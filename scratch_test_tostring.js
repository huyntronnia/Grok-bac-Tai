global.window = {
  innerWidth: 1024,
  innerHeight: 768,
  getComputedStyle: () => ({}),
  location: { href: "https://chatgpt.com" }
};
global.document = {
  body: { innerText: "" },
  title: "ChatGPT",
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementsByTagName: () => []
};

console.log("Loading scratch_tostring...");
require("./scratch_tostring.js");
console.log("Loaded successfully!");
