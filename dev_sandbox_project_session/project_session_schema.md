# Project Session Schema Proposal

Suggested extension: `.grokproj`

```json
{
  "schemaVersion": 1,
  "app": "AI Scene Batch Director",
  "savedAt": "2026-05-14T00:00:00.000Z",
  "project": {
    "name": "Video live action viral",
    "story": "...",
    "batchSize": 10,
    "durationSec": 10,
    "scenes": []
  },
  "runtime": {
    "activeBatchIds": [],
    "paused": false,
    "outputFolder": "D:/Grok/test/project",
    "selectedProvider": "ninerouter",
    "selectedAccount": "Account 1",
    "selectedModel": "cx/gpt-5.5",
    "videoPlatform": "grok",
    "skipReview": true
  },
  "videoConfig": {
    "pixverse": {
      "resolution": "360P",
      "ratio": "16:9",
      "duration": "5",
      "model": "PixVerse V6",
      "previewMode": false,
      "audio": true
    },
    "grok": {}
  },
  "finalPreview": {
    "finalVideoPath": "D:/Grok/test/project/master_video.mp4",
    "finalVideoUpdatedAt": "...",
    "timeline": []
  }
}
```

## Scene object fields

Each scene should preserve:

- `id`
- `original`
- `imagePrompt`
- `motionPrompt`
- `imagePath`
- `imageDataUrl` if needed
- `videoPath`
- `videoProvider`
- `videoStatus`
- `status`
- `reviewType`
- `progressStep`
- `pipelineRetryCount`
- `error`
- `forceRegenerateImage`
- `pipeline`
- timestamps

## Load rules

- Validate `schemaVersion`.
- Reject unknown future major schema unless migrated.
- Do not require local files to exist; mark missing assets in UI.
- Never auto-run after opening unless user clicks Start.
