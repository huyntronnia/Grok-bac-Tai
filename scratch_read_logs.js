const fs = require('fs');
const path = require('path');
const { app } = require('electron'); // wait, can't require electron in raw node, but we can do:
// Actually, let's find Roaming/Grok-bac-Tai folder.
const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config');
const logFolder = path.join(appData, 'Grok-bac-Tai');
const logFile = path.join(logFolder, 'ai-video-pipeline.log');

console.log("Checking log file path:", logFile);
if (fs.existsSync(logFile)) {
  const content = fs.readFileSync(logFile, 'utf8');
  const lines = content.trim().split('\n');
  console.log("Last 50 log lines:");
  console.log(lines.slice(-50).join('\n'));
} else {
  console.log("Log file does not exist at:", logFile);
  // Let's search standard electron app names
  const altFolder = path.join(appData, 'vidora');
  const altFile = path.join(altFolder, 'ai-video-pipeline.log');
  if (fs.existsSync(altFile)) {
    console.log("Found alt log at:", altFile);
    const content = fs.readFileSync(altFile, 'utf8');
    const lines = content.trim().split('\n');
    console.log(lines.slice(-50).join('\n'));
  }
}
