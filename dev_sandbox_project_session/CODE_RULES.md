# GROK DEV SANDBOX RULES

## Purpose
Build an isolated feature prototype for: Open Project, New Project, Save Project as a custom project file, and restore all pipeline state exactly as before.

## Strict boundary
- You may ONLY create/edit files inside this folder: dev_sandbox_project_session/
- Do NOT edit electron/, package.json, root config, or any existing source file.
- Do NOT move, delete, rename, or format files outside this folder.
- Your work must be a self-contained prototype/spec that the owner can review before integration.

## Target feature
Create a project-session system with custom extension, suggested: .grokproj
The saved file must contain enough data to reopen the app exactly like the previous run:
- project name, story, scene script
- scene list and original text
- image prompts and motion prompts
- generated image/video paths and statuses
- batch config and active batch IDs
- provider choices, video platform, PixVerse/Grok config
- output folder path
- pipeline progress, review states, retry counts
- final merged video path and timeline metadata

## Expected deliverables inside this folder
1. README.md: overview and how to review the prototype.
2. project_session_schema.md: proposed .grokproj JSON schema.
3. implementation_plan.md: integration plan and exact files/functions that would need changes later.
4. prototype/: optional isolated HTML/JS demo or pure JS modules.
5. tests/: optional sample .grokproj files and validation notes.

## Coding rules
- No production code changes outside this folder.
- Prefer plain HTML/CSS/JS if building a demo.
- Keep data migration/versioning in mind: include schemaVersion.
- Never store API keys in plaintext unless explicitly marked optional and user-approved.
- Use defensive validation when loading project files.
- Treat file paths as user-local and possibly missing.

## Definition of done
- A reviewer can inspect this folder and understand the full feature.
- A sample .grokproj can demonstrate saving/restoring state.
- Integration steps are clear but not applied to production code.
