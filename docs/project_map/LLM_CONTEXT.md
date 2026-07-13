# Vidora LLM Context

## Project Overview
Vidora is an Electron-based desktop app designed to automate keyframe generation via ChatGPT and compile videos using VeoUp. The pipeline operates under a strict closed-loop sequential flow.

## High-Risk & High-Complexity Files
* **Most Complex**: `electron/main/chatgpt/chatgpt_pipeline.js` (LOC: 4236, Risk: **HIGH**)
* **Most Coupled**: `electron/main.js`, `electron/renderer.js`
* **Read First**: `electron/main/pipeline/pipeline_runner.js`, `electron/main/chatgpt/chatgpt_pipeline.js`, `electron/main/veoup/veoup.js`
* **Rarely Modify**: `electron/preload.js`, `electron/main/utils/utils.js`

## Startup Flow
1. `electron/main.js` boots and sets up global state.
2. `electron/main/bootstrap/bootstrap.js` initializes app configurations and directories.
3. IPC listeners in `electron/main/ipc/ipc_handlers.js` map front-end commands to actions.
4. Renderer loads UI in `electron/index.html` and executes `electron/renderer.js`.

## Core Pipeline Execution Flow
```
[Renderer Start] -> [pipeline_runner.js] -> [chatgpt_pipeline.js] (Image + Motion)
                                                   ↓
[Next Scene] <--- [Extract Continuity Frame] <--- [veoup.js] (Video Compiling)
```

## Critical Code References
* **ChatGPT Automation**: `electron/main/chatgpt/chatgpt_dom.js` contains selectors and observers; `chatgpt_send.js` handles prompt submissions.
* **VeoUp Compilation**: `electron/main/veoup/veoup.js` automates the local executable driving.
