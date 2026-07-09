"use strict";

const assert = require("assert");
const monitor = require("../electron/main/chatgpt/chatgpt_runtime_monitor");

// Mock CDP Page
const createMockPage = () => {
  const page = {
    events: {},
    on(event, cb) {
      this.events[event] = cb;
    },
    off(event, cb) {
      if (this.events[event] === cb) {
        delete this.events[event];
      }
    },
    Runtime: {
      bindings: [],
      async addBinding({ name }) {
        this.bindings.push(name);
      },
      async evaluate({ expression }) {
        return { result: { value: true } };
      }
    },
    Page: {
      scripts: [],
      async addScriptToEvaluateOnNewDocument({ source }) {
        this.scripts.push(source);
      }
    }
  };
  return page;
};

// Reset monitor state helper
const resetMonitorState = (m) => {
  m.state = "IDLE";
  m.intent = "UNKNOWN";
  m.confidence = 1.0;
  m.timeline = [];
  m.clearAllWatchdogs();
  m.identity = {
    runId: "",
    sceneId: "",
    chatUrl: "",
    conversationId: "",
    assistantRootIndex: 0,
    latestImageUrl: "",
    latestImageHash: "",
    generationId: "",
  };
  m.metrics = {
    dom: {
      composerReady: true,
      composerBusy: false,
      hasUploadedFiles: false,
      attachmentsCount: 0,
      attachmentsCompleted: 0,
      assistantMessageCount: 0,
      latestAssistantTextLength: 0,
      latestAssistantHash: "",
      textStreamingActive: false,
      dalleActive: false,
      searchBadgeVisible: false,
      reasoningActive: false,
      pythonCodeInterpreterActive: false,
      canvasActive: false,
      placeholderVisible: false,
      imageElementCount: 0,
      imageCompleteCount: 0,
      stoppedTextDetected: false,
      policyRefusalDetected: false,
      lastMutationTimestamp: Date.now(),
    },
    network: {
      dalleUrlsCaptured: [],
      activeMediaRequests: 0,
    },
    runtime: {
      lastConsoleError: "",
      lastException: "",
    },
    navigation: {
      url: "",
      rotating: false,
    },
  };
};

async function runTests() {
  console.log("Starting ChatGPT Runtime Monitor tests...");

  // Test 1: Start and Stop monitoring
  {
    resetMonitorState(monitor);
    const mockPage = createMockPage();
    await monitor.startMonitoring(mockPage);

    const health = monitor.getHealth();
    assert.strictEqual(health.cdpConnected, true, "CDP connected should be true");
    assert.strictEqual(health.runtimeBinding, true, "Runtime binding should be registered");
    assert.strictEqual(health.observersAlive, true, "Observers alive should be true");
    assert.strictEqual(mockPage.Runtime.bindings.includes("chatgptUiMonitorBinding"), true, "Binding added to CDP");

    await monitor.stopMonitoring();
    const stoppedHealth = monitor.getHealth();
    assert.strictEqual(stoppedHealth.cdpConnected, false, "CDP connected should be false after stop");
    assert.strictEqual(stoppedHealth.observersAlive, false, "Observers should be off after stop");
  }

  // Test 2: Basic State Transitions & Metrics
  {
    resetMonitorState(monitor);
    const mockPage = createMockPage();
    await monitor.startMonitoring(mockPage);

    // Simulated event: DOM changes indicating hydration
    monitor.processIncomingEvent({
      type: "DOM_EVENT",
      payload: {
        composerReady: false,
        assistantMessageCount: 0,
      }
    });
    assert.strictEqual(monitor.state, "HYDRATING", "Should transition to HYDRATING when composer is missing");

    // Simulated event: Composer ready -> IDLE
    monitor.processIncomingEvent({
      type: "DOM_EVENT",
      payload: {
        composerReady: true,
        assistantMessageCount: 0,
      }
    });
    assert.strictEqual(monitor.state, "IDLE", "Should transition to IDLE when composer becomes ready");

    // Simulated event: Uploading files
    monitor.processIncomingEvent({
      type: "DOM_EVENT",
      payload: {
        composerReady: true,
        attachmentsCount: 2,
        attachmentsCompleted: 1,
      }
    });
    assert.strictEqual(monitor.state, "UPLOADING", "Should transition to UPLOADING when attachments count > completed");

    // Simulated event: WAITING_SEND
    monitor.processIncomingEvent({
      type: "DOM_EVENT",
      payload: {
        composerReady: true,
        attachmentsCount: 2,
        attachmentsCompleted: 2,
        composerBusy: true,
      }
    });
    assert.strictEqual(monitor.state, "WAITING_SEND", "Should transition to WAITING_SEND when composer has completed uploads and is busy");

    // Simulated event: Text streaming active
    monitor.processIncomingEvent({
      type: "DOM_EVENT",
      payload: {
        composerReady: true,
        textStreamingActive: true,
        assistantMessageCount: 1,
      }
    });
    assert.strictEqual(monitor.state, "STREAMING_TEXT", "Should transition to STREAMING_TEXT");
    assert.strictEqual(monitor.intent, "TEXT_RESPONSE", "Intent should be TEXT_RESPONSE");

    await monitor.stopMonitoring();
  }

  // Test 3: DALL-E Image Generation Intent and States
  {
    resetMonitorState(monitor);
    const mockPage = createMockPage();
    await monitor.startMonitoring(mockPage);

    // Trigger image generation indicators
    monitor.processIncomingEvent({
      type: "DOM_EVENT",
      payload: {
        dalleActive: true,
        textStreamingActive: true,
      }
    });
    assert.strictEqual(monitor.intent, "IMAGE_GENERATION", "Intent should detect IMAGE_GENERATION");
    assert.strictEqual(monitor.state, "STREAMING_IMAGE", "State should be STREAMING_IMAGE");

    // Image placeholder visible
    monitor.processIncomingEvent({
      type: "DOM_EVENT",
      payload: {
        dalleActive: true,
        textStreamingActive: false,
        placeholderVisible: true,
      }
    });
    assert.strictEqual(monitor.state, "IMAGE_PLACEHOLDER", "State should be IMAGE_PLACEHOLDER");

    // Network loading started for image
    monitor.processIncomingEvent({
      type: "NETWORK_EVENT",
      payload: {
        dalleCaptured: { url: "https://oaiusercontent.com/abc", requestId: "req-1" }
      }
    });
    // Manually setting active network requests to simulate CDP loading
    monitor.metrics.network.activeMediaRequests = 1;
    monitor.metrics.dom.placeholderVisible = false;
    monitor.triggerStateUpdate("Simulate network image loading");
    assert.strictEqual(monitor.state, "NETWORK_IMAGE", "State should be NETWORK_IMAGE");


    // Network finished, image element decoding (complete = false)
    monitor.metrics.network.activeMediaRequests = 0;
    monitor.processIncomingEvent({
      type: "DOM_EVENT",
      payload: {
        placeholderVisible: false,
        imageElementCount: 1,
        imageCompleteCount: 0,
      }
    });
    assert.strictEqual(monitor.state, "IMAGE_DECODE", "State should be IMAGE_DECODE");

    // Decoding completed, stable period settles
    monitor.processIncomingEvent({
      type: "DOM_EVENT",
      payload: {
        placeholderVisible: false,
        imageElementCount: 1,
        imageCompleteCount: 1,
        lastMutationTimestamp: Date.now() - 4000, // 4 seconds ago
      }
    });
    assert.strictEqual(monitor.state, "READY_FOR_EXTRACTION", "State should be READY_FOR_EXTRACTION");
    assert.strictEqual(monitor.confidence, 1, "Confidence should be 1.0 since image is complete and DOM stable");

    await monitor.stopMonitoring();
  }

  // Test 4: Replay Engine
  {
    resetMonitorState(monitor);
    const mockLogs = [
      {
        type: "DOM_EVENT",
        payload: { composerReady: false, assistantMessageCount: 0 }
      },
      {
        type: "DOM_EVENT",
        payload: { composerReady: true, assistantMessageCount: 0 }
      },
      {
        type: "DOM_EVENT",
        payload: { composerReady: true, reasoningActive: true, textStreamingActive: true, assistantMessageCount: 1 }
      }
    ];

    monitor.replay(mockLogs);
    assert.strictEqual(monitor.state, "STREAMING_TEXT", "Replay should end on STREAMING_TEXT");
    assert.strictEqual(monitor.intent, "DEEP_RESEARCH", "Replay should resolve intent as DEEP_RESEARCH");
  }

  // Test 5: waitUntil Promise Resolves on Stability
  {
    resetMonitorState(monitor);
    const mockPage = createMockPage();
    await monitor.startMonitoring(mockPage);

    // Simulate active streaming first so it can transition to READY_FOR_EXTRACTION
    monitor.processIncomingEvent({
      type: "DOM_EVENT",
      payload: {
        textStreamingActive: true,
      }
    });
    assert.strictEqual(monitor.state, "STREAMING_TEXT", "State should start at STREAMING_TEXT");

    const waitPromise = monitor.waitUntil({
      state: "READY_FOR_EXTRACTION",
      stableFor: 100,
      timeout: 1000,
    });


    // Simulate transitioning to READY_FOR_EXTRACTION
    setTimeout(() => {
      monitor.processIncomingEvent({
        type: "DOM_EVENT",
        payload: {
          textStreamingActive: false,
          lastMutationTimestamp: Date.now() - 5000,
        }
      });
    }, 50);

    const resultState = await waitPromise;
    assert.strictEqual(resultState.state, "READY_FOR_EXTRACTION", "Wait should resolve to target state");
    await monitor.stopMonitoring();
  }

  // Test 6: Watchdog warnings
  {
    resetMonitorState(monitor);
    monitor.watchdogRules.STREAMING_TEXT.timeout = 50; // set short timeout for test

    let watchdogFired = false;
    monitor.subscribe((event) => {
      if (event.type === "ERROR" && event.payload.message.includes("Watchdog expired")) {
        watchdogFired = true;
      }
    });

    monitor.processIncomingEvent({
      type: "DOM_EVENT",
      payload: {
        textStreamingActive: true,
      }
    });

    assert.strictEqual(monitor.state, "STREAMING_TEXT", "Should be in STREAMING_TEXT");
    
    // Wait for watchdog to trigger
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.strictEqual(watchdogFired, true, "Watchdog should have fired event");
    
    // Restore default
    monitor.watchdogRules.STREAMING_TEXT.timeout = 15 * 60 * 1000;
  }

  // Test 7: waitForTransition, waitForIntent, waitForSignal, and metricsVersion
  {
    resetMonitorState(monitor);
    const mockPage = createMockPage();
    await monitor.startMonitoring(mockPage);

    const snapshot = monitor.captureSnapshot();
    assert.strictEqual(snapshot.metricsVersion, 1, "Snapshot metricsVersion should be 1");

    // test waitForIntent
    const intentPromise = monitor.waitForIntent("IMAGE_GENERATION", 1000);
    monitor.processIncomingEvent({
      type: "DOM_EVENT",
      payload: { dalleActive: true }
    });
    const intentState = await intentPromise;
    assert.strictEqual(intentState.intent, "IMAGE_GENERATION");

    // test waitForTransition
    const transitionPromise = monitor.waitForTransition("STREAMING_IMAGE", "IMAGE_PLACEHOLDER", 1000);
    monitor.processIncomingEvent({
      type: "DOM_EVENT",
      payload: { textStreamingActive: true, dalleActive: true }
    });
    monitor.processIncomingEvent({
      type: "DOM_EVENT",
      payload: { textStreamingActive: false, placeholderVisible: true, dalleActive: true }
    });
    const transitionState = await transitionPromise;
    assert.strictEqual(transitionState.state, "IMAGE_PLACEHOLDER");

    // test waitForSignal
    const signalPromise = monitor.waitForSignal((snap) => snap.metrics.dom.assistantMessageCount === 4, 1000);
    monitor.processIncomingEvent({
      type: "DOM_EVENT",
      payload: { assistantMessageCount: 4 }
    });
    const signalState = await signalPromise;
    assert.strictEqual(monitor.metrics.dom.assistantMessageCount, 4);

    await monitor.stopMonitoring();
  }

  // Test 8: Integration Test (MutationObserver -> Binding -> Monitor)
  {
    resetMonitorState(monitor);
    const mockPage = createMockPage();
    
    // Set up mock DOM window & document in Node
    const mockWindow = {
      location: { href: "https://chatgpt.com/c/test-chat-id" },
      history: {
        pushState: () => {},
        replaceState: () => {},
      },
      addEventListener: () => {},
    };
    
    const mockDocument = {
      documentElement: {},
      body: { innerText: "" },
      querySelectorAll: (selector) => {
        if (selector === "[data-message-author-role='assistant']") {
          return [{ innerText: "Hello there from assistant" }];
        }
        return [];
      },
      querySelector: (selector) => {
        if (selector === "#prompt-textarea, textarea, [contenteditable='true']") {
          return { tagName: "TEXTAREA" };
        }
        return null;
      }
    };
    
    class MockMutationObserver {
      constructor(cb) {
        this.cb = cb;
      }
      observe() {
        this.cb();
      }
    }
    
    // Inject mock browser environment
    global.window = mockWindow;
    global.document = mockDocument;
    global.MutationObserver = MockMutationObserver;
    
    // Create binding target
    let receivedPayload = null;
    mockWindow.chatgptUiMonitorBinding = (str) => {
      receivedPayload = JSON.parse(str);
    };

    // Run the injected script directly in Node context!
    const scriptFn = monitor.getBrowserScriptCode;
    scriptFn();

    // Start monitoring so monitor registers page binding handler
    await monitor.startMonitoring(mockPage);
    
    // Emulate CDP trigger of bindingCalled using captured browser metrics payload
    mockPage.events["Runtime.bindingCalled"]({
      name: "chatgptUiMonitorBinding",
      payload: JSON.stringify(receivedPayload)
    });
    
    // Verify monitor state is updated from the browser emulated metrics
    assert.strictEqual(monitor.metrics.dom.composerReady, true, "Composer should be detected as ready via integration flow");
    assert.strictEqual(monitor.state, "IDLE", "State should transition to IDLE");

    // Cleanup globals
    delete global.window;
    delete global.document;
    delete global.MutationObserver;
    await monitor.stopMonitoring();
  }

  console.log("All ChatGPT Runtime Monitor tests passed successfully!");
}

runTests().catch((err) => {
  console.error("Test failed:", err.stack || err);
  process.exit(1);
});
