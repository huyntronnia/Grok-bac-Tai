# .grokproj Schema Version 1

`.grokproj` files are UTF-8 JSON documents used to save and restore project/session state. Treat every loaded file as untrusted data: parse as JSON only, validate shape, never execute content, and never auto-run after opening.

## Top-level object

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `schemaVersion` | number | yes | Initial supported value is `1`. Unknown future major versions must be rejected clearly. |
| `appVersion` | string | yes | App/version label that created the file. Informational only. |
| `savedAt` | ISO string | yes | Save timestamp. |
| `project` | object | yes | Project identity and scenes. |
| `inputs` | object | yes | Story/script prompts and prompt template references. |
| `config` | object | yes | Provider/model/generation settings. |
| `router` | object | yes | Grok router metadata only; no secrets. |
| `runtime` | object | yes | Safe restore state. Must never trigger auto-run. |
| `assets` | object | yes | Relative image/video/final output references. |
| `previewTimeline` | array | yes | Ordered final preview scene/video refs. |
| `extensions` | object | no | Unknown compatible fields preserved here when possible. |

## `project`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Stable project id. |
| `name` | string | Display name. |
| `description` | string | Optional user-facing description. |
| `createdAt` | ISO string | Creation timestamp. |
| `updatedAt` | ISO string | Last project update timestamp. |
| `scenes` | array | Scene records; required and must be an array. |

## `inputs`

| Field | Type | Notes |
| --- | --- | --- |
| `storyPrompt` | string | User story/source prompt. |
| `scriptPrompt` | string | Script-generation prompt. |
| `promptTemplates` | object | Template ids/names/versions only. |
| `batchPromptRefs` | array | Batch prompt references only, not executable code. |

## `config`

| Field | Type | Notes |
| --- | --- | --- |
| `scriptProvider` | string | Provider label/id. |
| `imageProvider` | string | Provider label/id. |
| `videoProvider` | string | Provider label/id. |
| `selectedModels` | object | Non-secret model labels for script/image/video. |
| `aspectRatio` | string | Example: `16:9`. |
| `batchSize` | number | Scene batch size. |
| `sceneDurationSeconds` | number | Per-scene video duration. |
| `outputLanguage` | string | Output language label. |
| `stylePreset` | string | Style preset label. |

## `router`

Router data is non-secret metadata only.

| Field | Type | Notes |
| --- | --- | --- |
| `accountRouterEnabled` | boolean | Whether project was saved with router enabled. |
| `selectedGrokAccountId` | string/null | Stable account reference id only. |
| `routingPolicy` | string | Example: `manual`, `sticky`, `round_robin`. |
| `selectedLabels` | object | Provider/model/account display labels, redacted if needed. |
| `status` | object | Optional non-secret account status labels. |

Never store API keys, cookies, passwords, session tokens, refresh tokens, bearer tokens, raw browser storage, or full private emails in `router`.

## `project.scenes[]`

| Field | Type | Notes |
| --- | --- | --- |
| `sceneId` | string | Stable scene id. |
| `sceneIndex` | number | Ordered index. |
| `rawSceneText` | string | Scene source text. |
| `imagePrompt` | string | Image generation prompt. |
| `motionPrompt` | string | Video/motion prompt. |
| `imagePath` | string/null | Prefer relative local path. |
| `videoPath` | string/null | Prefer relative local path. |
| `status` | string | Pipeline status label. |
| `errorClassification` | string/null | Safe error class, not raw secret-bearing error text. |
| `promptVersion` | string | Prompt/template version label. |
| `updatedAt` | ISO string | Scene update timestamp. |

## `runtime`

| Field | Type | Notes |
| --- | --- | --- |
| `currentStage` | string | Safe UI/pipeline stage label. |
| `currentBatchIndex` | number | Current batch index. |
| `currentSceneId` | string/null | Current scene ref. |
| `paused` | boolean | Restored paused state. |
| `lastCheckpointRef` | string/null | Safe checkpoint id/ref only. |
| `lastErrorClassification` | string/null | Safe error class only. |
| `activePreviewTimeline` | array | Ordered preview refs. |
| `autoRun` | boolean | Must be `false` or omitted after open. |
| `waitingForUserStart` | boolean | Must be `true` after open. |

## `assets`

Use relative paths when possible. Missing files during open must produce warnings, not crashes.

| Field | Type | Notes |
| --- | --- | --- |
| `images` | array | Image refs: `{ sceneId, path }`. |
| `videos` | array | Video refs: `{ sceneId, path }`. |
| `finalOutputs` | array | Final output refs: `{ kind, path }`. |

## `previewTimeline[]`

Ordered scene/video refs for final preview, for example:

```json
{ "sceneId": "scene-001", "videoPath": "assets/videos/scene-001.mp4", "durationSeconds": 6 }
```

## `extensions`

Compatible unknown fields may be preserved in `extensions`. Loaders must not execute extension data. Incompatible future schema versions must be rejected with a clear message.
