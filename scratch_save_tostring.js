const fs = require('fs');
const dom = require('./electron/main/chatgpt/chatgpt_dom');
fs.writeFileSync('scratch_tostring.js', dom.readLatestAssistantScript.toString(), 'utf8');
console.log("Saved!");
