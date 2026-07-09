"use strict";

class ChatGptPipelineAdapter {
  constructor(monitor) {
    if (!monitor) {
      throw new Error("Pipeline Adapter requires ChatGPTRuntimeMonitor instance");
    }
    this.monitor = monitor;
  }

  async waitForImageReady(timeoutMs = 900000, stableFor = 4000) {
    // 1. Wait for READY state
    const result = await this.monitor.waitUntil({
      state: "READY",
      confidence: 1.0, // Full score stability
      stableFor,
      timeout: timeoutMs,
    });

    // 2. Enforce strict Policy assertions
    if (result.intent !== "IMAGE_GENERATION") {
      throw new Error(`Pipeline Policy Violation: Expected IMAGE_GENERATION intent, but got ${result.intent}`);
    }

    if (result.confidence < 1.0) {
      throw new Error(`Pipeline Policy Violation: Image extracted with low confidence score: ${result.confidence}`);
    }

    return result;
  }

  async waitForResponseReady(timeoutMs = 45000, stableFor = 3000) {
    // 1. Wait for READY state
    const result = await this.monitor.waitUntil({
      state: "READY",
      confidence: 1.0, // Full score stability
      stableFor,
      timeout: timeoutMs,
    });

    // 2. Enforce strict Policy assertions
    const validIntents = ["TEXT_RESPONSE", "SEARCH", "DEEP_RESEARCH", "PYTHON_EXECUTION", "CANVAS_EDIT", "FILE_ANALYSIS"];
    if (!validIntents.includes(result.intent)) {
      throw new Error(`Pipeline Policy Violation: Expected response intent, but got ${result.intent}`);
    }

    if (result.confidence < 1.0) {
      throw new Error(`Pipeline Policy Violation: Text response settled with low confidence score: ${result.confidence}`);
    }

    return result;
  }

  isDraftRecovered(snapshot, expectedPromptHash) {
    if (!snapshot || !snapshot.metrics || !snapshot.metrics.dom) {
      return false;
    }
    const dom = snapshot.metrics.dom;
    return dom.composerReady && dom.composerPromptHash === expectedPromptHash;
  }
}

module.exports = ChatGptPipelineAdapter;
