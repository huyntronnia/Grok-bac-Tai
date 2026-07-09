"use strict";

const EventEmitter = require("events");
const { appendAppLog } = require("../logging");

function hashText(value = "") {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

class ChatGPTRuntimeMonitor extends EventEmitter {
  constructor() {
    super();
    this.page = null;
    this.state = "IDLE";
    this.intent = "UNKNOWN";
    this.confidence = 1.0;
    this.metricsVersion = 1;
    
    // Sessions Identities
    this.identity = {
      runId: "",
      sceneId: "",
      chatUrl: "",
      conversationId: "",
      assistantRootIndex: 0,
      latestImageUrl: "",
      latestImageHash: "",
      generationId: "",
    };

    // Diagnostic timeline log
    this.timeline = [];
    
    // Watchdog Timers
    this.watchdogs = {};
    this.watchdogRules = {
      STREAMING_TEXT: { timeout: 15 * 60 * 1000, name: "Streaming Text Timeout" },
      UPLOADING: { timeout: 3 * 60 * 1000, name: "Uploading Timeout" },
      WAITING_ASSISTANT: { timeout: 5 * 60 * 1000, name: "Waiting Assistant Timeout" },
    };

    // Observers and connections health
    this.health = {
      observersAlive: false,
      mutationObserver: false,
      resizeObserver: false,
      cdpConnected: false,
      runtimeBinding: false,
      networkEnabled: false,
    };

    // Latest extracted metrics
    this.metrics = {
      dom: {
        composerReady: false,
        composerBusy: false,
        hasUploadedFiles: false,
        attachmentsCount: 0,
        attachmentsCompleted: 0,
        composerPromptHash: "",
        attachmentNames: [],
        attachmentHashes: [],
        composerState: "READY",
        latestUserMessageHash: "",
        latestAssistantHash: "",
        assistantMessageCount: 0,
        latestAssistantText: "",
        latestAssistantTextLength: 0,
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
        loggedOut: false,
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

    // CDP handlers bound to context
    this.onResponseReceived = this.onResponseReceived.bind(this);
    this.onLoadingFinished = this.onLoadingFinished.bind(this);
    this.onBindingCalled = this.onBindingCalled.bind(this);
    this.onConsoleAPICalled = this.onConsoleAPICalled.bind(this);
    this.onExceptionThrown = this.onExceptionThrown.bind(this);
    this.onFrameNavigated = this.onFrameNavigated.bind(this);
  }

  reset() {
    this.state = "IDLE";
    this.intent = "UNKNOWN";
    this.confidence = 1.0;

    this.metrics.dom = {
      composerReady: false,
      composerBusy: false,
      hasUploadedFiles: false,
      attachmentsCount: 0,
      attachmentsCompleted: 0,
      composerPromptHash: "",
      attachmentNames: [],
      attachmentHashes: [],
      composerState: "READY",
      latestUserMessageHash: "",
      latestAssistantHash: "",
      assistantMessageCount: 0,
      latestAssistantText: "",
      latestAssistantTextLength: 0,
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
      loggedOut: false,
      lastMutationTimestamp: Date.now(),
    };

    this.metrics.network = {
      dalleUrlsCaptured: [],
      activeMediaRequests: 0,
    };

    this.metrics.runtime = {
      lastConsoleError: "",
      lastException: "",
    };

    this.metrics.navigation = {
      url: "",
      rotating: false,
    };

    this.identity = {
      chatUrl: "",
      conversationId: "",
      assistantRootIndex: 0,
      latestImageUrl: "",
    };
  }

  // --- Start & Stop Monitoring API ---
  async startMonitoring(page) {
    if (!page) {
      throw new Error("Cannot start monitor: CDP page client is missing.");
    }
    this.reset();
    this.page = page;
    this.health.cdpConnected = true;

    this.logEvent("SYSTEM", "Monitoring starting");

    try {
      // 1. Register CDP Listeners
      if (typeof page.on === "function") {
        page.on("Network.responseReceived", this.onResponseReceived);
        page.on("Network.loadingFinished", this.onLoadingFinished);
        page.on("Runtime.bindingCalled", this.onBindingCalled);
        page.on("Runtime.consoleAPICalled", this.onConsoleAPICalled);
        page.on("Runtime.exceptionThrown", this.onExceptionThrown);
        page.on("Page.frameNavigated", this.onFrameNavigated);
        this.health.networkEnabled = true;
      }

      // 2. Add Runtime Bindings
      await page.Runtime.addBinding({ name: "chatgptUiMonitorBinding" }).catch(() => null);
      this.health.runtimeBinding = true;

      // 3. Inject DOM Observer Script (on new documents and current context)
      const browserCode = `(${this.getBrowserScriptCode.toString()})()`;
      await page.Page.addScriptToEvaluateOnNewDocument({ source: browserCode }).catch(() => null);
      await page.Runtime.evaluate({
        expression: browserCode,
        awaitPromise: true,
        userGesture: true,
      }).catch(() => null);

      this.health.observersAlive = true;
      this.health.mutationObserver = true;
      this.health.resizeObserver = true;

      this.logEvent("SYSTEM", "Monitoring initialized successfully");
    } catch (err) {
      this.logEvent("ERROR", `Failed starting monitor: ${err.message}`);
      throw err;
    }
  }

  async stopMonitoring() {
    this.logEvent("SYSTEM", "Monitoring stopping");
    this.clearAllWatchdogs();

    if (this.page && typeof this.page.off === "function") {
      try {
        this.page.off("Network.responseReceived", this.onResponseReceived);
        this.page.off("Network.loadingFinished", this.onLoadingFinished);
        this.page.off("Runtime.bindingCalled", this.onBindingCalled);
        this.page.off("Runtime.consoleAPICalled", this.onConsoleAPICalled);
        this.page.off("Runtime.exceptionThrown", this.onExceptionThrown);
        this.page.off("Page.frameNavigated", this.onFrameNavigated);
      } catch (err) {
        // Suppress teardown errors
      }
    }

    this.page = null;
    this.health.cdpConnected = false;
    this.health.observersAlive = false;
    this.health.mutationObserver = false;
    this.health.resizeObserver = false;
    this.health.runtimeBinding = false;
    this.health.networkEnabled = false;

    this.clearStabilityTimer();

    this.logEvent("SYSTEM", "Monitoring stopped");
  }

  // --- API Methods ---
  getCurrentState() {
    return Object.freeze({
      state: this.state,
      intent: this.intent,
      confidence: this.confidence,
      identity: Object.freeze({ ...this.identity }),
      timestamp: Date.now(),
    });
  }

  getHealth() {
    return Object.freeze({ ...this.health });
  }

  getDiagnostics() {
    return Object.freeze([...this.timeline]);
  }

  captureSnapshot() {
    return Object.freeze({
      metricsVersion: this.metricsVersion,
      state: this.state,
      intent: this.intent,
      confidence: this.confidence,
      identity: Object.freeze({ ...this.identity }),
      metrics: Object.freeze(JSON.parse(JSON.stringify(this.metrics))),
      health: Object.freeze({ ...this.health }),
      timestamp: Date.now(),
    });
  }

  // --- State Replay Engine ---
  replay(log) {
    if (!Array.isArray(log)) {
      throw new Error("Replay expects a list of event logs.");
    }
    this.logEvent("SYSTEM", `Replay started with ${log.length} records`);
    
    // Reset internal state
    this.state = "IDLE";
    this.intent = "UNKNOWN";
    this.confidence = 1.0;
    
    for (const record of log) {
      if (!record.type) continue;
      this.logEvent("REPLAY", `Simulating event ${record.type}`, record.payload);
      this.processIncomingEvent(record);
    }
    
    this.logEvent("SYSTEM", "Replay completed");
  }

  // --- Event Subscription & Bus ---
  subscribe(listener) {
    if (typeof listener === "function") {
      this.on("event", listener);
    }
    return () => {
      this.off("event", listener);
    };
  }

  // --- Advanced Stability Waiting ---
  waitUntil({ state, confidence = 0.9, stableFor = 1000, timeout = 30000 }) {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      let stableTimer = null;

      const cleanup = () => {
        if (stableTimer) {
          clearTimeout(stableTimer);
          stableTimer = null;
        }
        this.off("event", checkCondition);
      };

      const checkCondition = (event) => {
        if (Date.now() - startedAt >= timeout) {
          cleanup();
          reject(new Error(`Timeout waiting for state ${state} with confidence >= ${confidence}`));
          return;
        }

        const isMatching = this.state === state && this.confidence >= confidence;
        
        if (isMatching) {
          if (!stableTimer) {
            stableTimer = setTimeout(() => {
              cleanup();
              resolve(this.getCurrentState());
            }, stableFor);
          }
        } else {
          if (stableTimer) {
            clearTimeout(stableTimer);
            stableTimer = null;
          }
        }
      };

      // Set global timeout safety trigger
      setTimeout(() => {
        if (stableTimer || this.listeners("event").includes(checkCondition)) {
          cleanup();
          reject(new Error(`Timeout waiting for state ${state} with confidence >= ${confidence}`));
        }
      }, timeout);

      this.on("event", checkCondition);
      
      // Check initial conditions immediately
      checkCondition();
    });
  }

  waitForTransition(fromState, toState, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      let hasBeenInFromState = false;

      const cleanup = () => {
        this.off("event", checkTransition);
      };

      const checkTransition = (event) => {
        if (Date.now() - startedAt >= timeout) {
          cleanup();
          reject(new Error(`Timeout waiting for transition from ${fromState} to ${toState}`));
          return;
        }

        if (this.state === fromState) {
          hasBeenInFromState = true;
        }

        if (hasBeenInFromState && this.state === toState) {
          cleanup();
          resolve(this.getCurrentState());
        }
      };

      setTimeout(() => {
        if (this.listeners("event").includes(checkTransition)) {
          cleanup();
          reject(new Error(`Timeout waiting for transition from ${fromState} to ${toState}`));
        }
      }, timeout);

      this.on("event", checkTransition);
      checkTransition();
    });
  }

  waitForIntent(targetIntent, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();

      const cleanup = () => {
        this.off("event", checkIntent);
      };

      const checkIntent = (event) => {
        if (Date.now() - startedAt >= timeout) {
          cleanup();
          reject(new Error(`Timeout waiting for intent ${targetIntent}`));
          return;
        }

        if (this.intent === targetIntent) {
          cleanup();
          resolve(this.getCurrentState());
        }
      };

      setTimeout(() => {
        if (this.listeners("event").includes(checkIntent)) {
          cleanup();
          reject(new Error(`Timeout waiting for intent ${targetIntent}`));
        }
      }, timeout);

      this.on("event", checkIntent);
      checkIntent();
    });
  }

  waitForSignal(predicateFn, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();

      const cleanup = () => {
        this.off("event", checkSignal);
      };

      const checkSignal = (event) => {
        if (Date.now() - startedAt >= timeout) {
          cleanup();
          reject(new Error("Timeout waiting for custom signal"));
          return;
        }

        try {
          if (predicateFn(this.captureSnapshot())) {
            cleanup();
            resolve(this.getCurrentState());
          }
        } catch (err) {
          cleanup();
          reject(err);
        }
      };

      setTimeout(() => {
        if (this.listeners("event").includes(checkSignal)) {
          cleanup();
          reject(new Error("Timeout waiting for custom signal"));
        }
      }, timeout);

      this.on("event", checkSignal);
      checkSignal();
    });
  }

  // --- Internal CDP Listeners ---
  onResponseReceived(event) {
    const response = event.response || {};
    const url = String(response.url || "");
    const mime = String(response.mimeType || "").toLowerCase();

    const isImage = mime.startsWith("image/") || /\.(png|jpe?g|webp)/i.test(url) || /oaiusercontent|openai/i.test(url);
    if (isImage) {
      this.metrics.network.activeMediaRequests += 1;
      this.metrics.network.dalleUrlsCaptured.push({
        url,
        requestId: event.requestId,
        timestamp: Date.now(),
      });
      
      this.logEvent("NETWORK_EVENT", `Image response received: ${url.slice(0, 100)}`, { url });
      this.triggerStateUpdate("Network image response");
    }
  }

  onLoadingFinished(event) {
    const requests = this.metrics.network.dalleUrlsCaptured;
    const match = requests.find((item) => item.requestId === event.requestId);
    if (match) {
      if (this.metrics.network.activeMediaRequests > 0) {
        this.metrics.network.activeMediaRequests -= 1;
      }
      this.logEvent("NETWORK_EVENT", `Image request finished: ${match.url.slice(0, 100)}`, { url: match.url });
      this.triggerStateUpdate("Network image loading finished");
    }
  }

  onBindingCalled(event) {
    if (event.name === "chatgptUiMonitorBinding") {
      try {
        const payload = JSON.parse(event.payload);
        if (payload.type === "DOM_METRICS") {
          const raw = payload.data || {};
          
          // Merge flat metrics
          this.metrics.dom.composerReady = Boolean(raw.composerReady);
          this.metrics.dom.composerBusy = Boolean(raw.composerBusy);
          this.metrics.dom.hasUploadedFiles = Boolean(raw.hasUploadedFiles);
          this.metrics.dom.attachmentsCount = Number(raw.attachmentsCount || 0);
          this.metrics.dom.attachmentsCompleted = Number(raw.attachmentsCompleted || 0);
          this.metrics.dom.assistantMessageCount = Number(raw.assistantMessageCount || 0);
          this.metrics.dom.latestAssistantTextLength = Number(raw.latestAssistantTextLength || 0);
          this.metrics.dom.textStreamingActive = Boolean(raw.textStreamingActive);
          this.metrics.dom.dalleActive = Boolean(raw.dalleActive);
          this.metrics.dom.searchBadgeVisible = Boolean(raw.searchBadgeVisible);
          this.metrics.dom.reasoningActive = Boolean(raw.reasoningActive);
          this.metrics.dom.pythonCodeInterpreterActive = Boolean(raw.pythonCodeInterpreterActive);
          this.metrics.dom.canvasActive = Boolean(raw.canvasActive);
          this.metrics.dom.placeholderVisible = Boolean(raw.placeholderVisible);
          this.metrics.dom.imageElementCount = Number(raw.imageElementCount || 0);
          this.metrics.dom.imageCompleteCount = Number(raw.imageCompleteCount || 0);
          this.metrics.dom.stoppedTextDetected = Boolean(raw.stoppedTextDetected);
          this.metrics.dom.policyRefusalDetected = Boolean(raw.policyRefusalDetected);
          this.metrics.dom.loggedOut = Boolean(raw.loggedOut);
          this.metrics.dom.lastMutationTimestamp = Number(raw.lastMutationTimestamp || Date.now());

          // Compute FNV-1a hashes in Main process
          const composerText = raw.composerText || "";
          const latestUserText = raw.latestUserText || "";
          const latestAssistantText = raw.latestAssistantText || "";
          const rawAttachments = raw.attachments || [];

          this.metrics.dom.latestAssistantText = latestAssistantText;
          this.metrics.dom.composerPromptHash = hashText(composerText);
          this.metrics.dom.latestUserMessageHash = hashText(latestUserText);
          this.metrics.dom.latestAssistantHash = hashText(latestAssistantText);
          this.metrics.dom.attachmentNames = rawAttachments.map(a => a.text);
          this.metrics.dom.attachmentHashes = rawAttachments.map(a => hashText(a.text + ":" + a.imgSrc));
          this.metrics.dom.composerState = (raw.progressBarsCount > 0) ? "ATTACHING_FILES" : "READY";
          
          // Sync navigation state
          if (raw.url) {
            this.metrics.navigation.url = raw.url;
            this.identity.chatUrl = raw.url;
            
            // Extract conversationId from url path: e.g. /c/xxxxx
            try {
              const urlObj = new URL(raw.url);
              const pathParts = urlObj.pathname.split("/");
              const cIndex = pathParts.indexOf("c");
              if (cIndex !== -1 && pathParts[cIndex + 1]) {
                this.identity.conversationId = pathParts[cIndex + 1];
              }
            } catch (err) {
              // Ignore invalid url parser fails
            }
          }

          // Sync identity variables
          this.identity.assistantRootIndex = this.metrics.dom.assistantMessageCount;
          if (raw.latestImageUrl) {
            this.identity.latestImageUrl = raw.latestImageUrl;
          }

          this.logEvent("DOM_EVENT", "DOM mutations updated metrics", raw);
          this.triggerStateUpdate("DOM mutation update");
        } else if (payload.type === "NAVIGATION") {
          this.metrics.navigation.url = payload.url;
          this.metrics.navigation.rotating = payload.rotating;
          this.logEvent("NAVIGATION_EVENT", `History state navigation: ${payload.url}`, payload);
          this.triggerStateUpdate("History state change");
        }
      } catch (err) {
        this.logEvent("ERROR", `Failed parsing browser payload: ${err.message}`);
      }
    }
  }

  onConsoleAPICalled(event) {
    if (event.type === "error") {
      const errorMsg = (event.args || []).map((arg) => arg.value || "").join(" ");
      this.metrics.runtime.lastConsoleError = errorMsg;
      this.logEvent("RUNTIME_EVENT", `Console Error: ${errorMsg}`, event);
      this.triggerStateUpdate("Console error");
    }
  }

  onExceptionThrown(event) {
    const errorDetails = event.exceptionDetails || {};
    const errorMsg = errorDetails.text || "Uncaught JS Exception";
    this.metrics.runtime.lastException = errorMsg;
    this.logEvent("RUNTIME_EVENT", `Exception Thrown: ${errorMsg}`, errorDetails);
    
    // Exceptions can transition to ERROR state
    this.triggerStateUpdate("Exception thrown");
  }

  onFrameNavigated(event) {
    const frame = event.frame || {};
    if (!frame.parentId) { // Top frame navigation
      this.metrics.navigation.url = frame.url;
      this.logEvent("NAVIGATION_EVENT", `Top frame navigated to ${frame.url}`, frame);
      this.triggerStateUpdate("Frame navigation");
    }
  }

  // --- External Feed Gateway for Replays/Simulations ---
  processIncomingEvent(record) {
    if (record.type === "DOM_EVENT") {
      Object.assign(this.metrics.dom, record.payload);
      
      // Compute FNV-1a hashes in Main process during simulation
      if (record.payload.composerText !== undefined) {
        this.metrics.dom.composerPromptHash = hashText(record.payload.composerText);
      }
      if (record.payload.latestUserText !== undefined) {
        this.metrics.dom.latestUserMessageHash = hashText(record.payload.latestUserText);
      }
      if (record.payload.latestAssistantText !== undefined) {
        this.metrics.dom.latestAssistantText = record.payload.latestAssistantText;
        this.metrics.dom.latestAssistantHash = hashText(record.payload.latestAssistantText);
      }
      if (record.payload.loggedOut !== undefined) {
        this.metrics.dom.loggedOut = Boolean(record.payload.loggedOut);
      }
      if (record.payload.attachments !== undefined) {
        const rawAttachments = record.payload.attachments || [];
        this.metrics.dom.attachmentNames = rawAttachments.map(a => a.text);
        this.metrics.dom.attachmentHashes = rawAttachments.map(a => hashText(a.text + ":" + a.imgSrc));
        this.metrics.dom.composerState = (record.payload.progressBarsCount > 0) ? "ATTACHING_FILES" : "READY";
      }
    } else if (record.type === "NETWORK_EVENT") {
      if (record.payload && record.payload.dalleCaptured) {
        this.metrics.network.dalleUrlsCaptured.push(record.payload.dalleCaptured);
      }
    } else if (record.type === "RUNTIME_EVENT") {
      if (record.payload && record.payload.exception) {
        this.metrics.runtime.lastException = record.payload.exception;
      }
    } else if (record.type === "NAVIGATION_EVENT") {
      Object.assign(this.metrics.navigation, record.payload);
    }
    
    this.triggerStateUpdate(record.type);
  }

  // --- Core Processing Loop ---
  clearStabilityTimer() {
    if (!this.stabilityTimeout) return;
    clearTimeout(this.stabilityTimeout);
    this.stabilityTimeout = null;
  }

  scheduleStateReevaluation(reason, targetIdleMs = 3100) {
    if (!this.page) return;
    
    const STABILIZABLE_STATES = new Set([
      "STREAMING_TEXT",
      "STREAMING_IMAGE",
      "IMAGE_PLACEHOLDER",
      "NETWORK_IMAGE",
      "IMAGE_DECODE",
      "WAITING_ASSISTANT",
      "IDLE"
    ]);

    if (!STABILIZABLE_STATES.has(this.state)) {
      this.clearStabilityTimer();
      return;
    }
    
    const ts = this.metrics.dom.lastMutationTimestamp;
    if (!ts) return;
    
    const idlePeriod = Date.now() - ts;
    const remainingMs = Math.max(100, targetIdleMs - idlePeriod);
    
    this.clearStabilityTimer();
    
    this.stabilityTimeout = setTimeout(() => {
      this.stabilityTimeout = null;
      this.triggerStateUpdate(`State re-evaluation: ${reason}`);
    }, remainingMs);
  }

  triggerStateUpdate(reason) {
    const oldState = this.state;
    const oldIntent = this.intent;

    this.runIntentDetector();
    this.runStateMachine();
    this.computeConfidence();

    this.manageWatchdogs();

    this.scheduleStateReevaluation("DOM idle");

    const stateChanged = oldState !== this.state || oldIntent !== this.intent;
    
    const eventObj = {
      type: stateChanged ? "STATE_CHANGED" : "METRICS_UPDATE",
      oldState,
      newState: this.state,
      oldIntent,
      newIntent: this.intent,
      confidence: this.confidence,
      identity: { ...this.identity },
      metrics: JSON.parse(JSON.stringify(this.metrics)),
      reason,
      timestamp: Date.now(),
    };

    if (stateChanged) {
      this.logEvent("STATE_CHANGED", `Transitioned to state [${this.state}] / intent [${this.intent}] (Confidence: ${this.confidence})`, { oldState, newState: this.state });
    }

    this.emit("event", eventObj);
  }

  // --- Intent Detector Engine ---
  runIntentDetector() {
    const dom = this.metrics.dom;
    const network = this.metrics.network;

    if (dom.dalleActive || network.dalleUrlsCaptured.length > 0) {
      this.intent = "IMAGE_GENERATION";
    } else if (dom.searchBadgeVisible) {
      this.intent = "SEARCH";
    } else if (dom.reasoningActive) {
      this.intent = "DEEP_RESEARCH";
    } else if (dom.pythonCodeInterpreterActive) {
      this.intent = "PYTHON_EXECUTION";
    } else if (dom.canvasActive) {
      this.intent = "CANVAS_EDIT";
    } else if (dom.hasUploadedFiles) {
      this.intent = "FILE_ANALYSIS";
    } else if (dom.textStreamingActive || dom.assistantMessageCount > 0) {
      this.intent = "TEXT_RESPONSE";
    } else {
      this.intent = "UNKNOWN";
    }
  }

  // --- State Machine transitions ---
  runStateMachine() {
    const dom = this.metrics.dom;
    const nav = this.metrics.navigation;
    const exception = this.metrics.runtime.lastException;

    // Strict state prioritization
    
    // 1. Crash/Refusal -> ERROR
    if (exception || dom.policyRefusalDetected) {
      this.state = "ERROR";
      return;
    }

    // 2. Navigation / Chat rotation -> ROTATING_CHAT
    if (nav.rotating) {
      this.state = "ROTATING_CHAT";
      return;
    }

    // 3. Hydration state
    if (!dom.composerReady && dom.assistantMessageCount === 0) {
      this.state = "HYDRATING";
      return;
    }

    // 4. File uploads active -> UPLOADING
    if (dom.attachmentsCount > 0 && dom.attachmentsCompleted < dom.attachmentsCount) {
      this.state = "UPLOADING";
      return;
    }

    // 5. WAITING_SEND
    if (dom.composerReady && (dom.attachmentsCompleted > 0 || dom.composerBusy) && !dom.textStreamingActive && this.state !== "SEND_CLICKED") {
      this.state = "WAITING_SEND";
      return;
    }

    // 6. Active typing/streaming
    if (dom.textStreamingActive) {
      if (this.intent === "IMAGE_GENERATION") {
        this.state = "STREAMING_IMAGE";
      } else {
        this.state = "STREAMING_TEXT";
      }
      return;
    }

    // 7. Image generator placeholders
    if (this.intent === "IMAGE_GENERATION") {
      if (dom.placeholderVisible) {
        this.state = "IMAGE_PLACEHOLDER";
        return;
      }
      if (this.metrics.network.activeMediaRequests > 0) {
        this.state = "NETWORK_IMAGE";
        return;
      }
      if (dom.imageElementCount > 0 && dom.imageCompleteCount < dom.imageElementCount) {
        this.state = "IMAGE_DECODE";
        return;
      }
    }

    // 8. READY state (combines finished streaming, complete images, and DOM stability)
    const idlePeriod = Date.now() - dom.lastMutationTimestamp;
    const isCompletedAndStable = !dom.textStreamingActive && !dom.placeholderVisible && (idlePeriod >= 3000 || dom.stoppedTextDetected);
    if (isCompletedAndStable && (this.state === "READY" || this.state === "STREAMING_TEXT" || this.state === "STREAMING_IMAGE" || this.state === "IMAGE_DECODE" || this.state === "NETWORK_IMAGE" || this.state === "IMAGE_PLACEHOLDER" || this.state === "IDLE")) {
      this.state = "READY";
      return;
    }

    // 10. Default fallback -> IDLE
    if (dom.composerReady && !dom.composerBusy && !dom.textStreamingActive) {
      this.state = "IDLE";
    }
  }

  // --- Confidence Score Math ---
  computeConfidence() {
    const dom = this.metrics.dom;
    const idlePeriod = Date.now() - dom.lastMutationTimestamp;
    let score = 0;

    // 1. Streaming stopped: +20
    if (!dom.textStreamingActive) {
      score += 20;
    }

    // 2. Network idle: +20
    if (this.metrics.network.activeMediaRequests === 0) {
      score += 20;
    }

    // 3. Mutation idle: +20
    if (idlePeriod >= 3000) {
      score += 20;
    } else if (idlePeriod >= 800) {
      score += 10;
    }

    // 4. Image decoded / complete: +40
    if (this.intent === "IMAGE_GENERATION") {
      const imagesFullyLoaded = dom.imageElementCount > 0 && dom.imageCompleteCount === dom.imageElementCount;
      if (imagesFullyLoaded) {
        score += 40;
      } else if (dom.imageElementCount > 0) {
        score += 20;
      }
    } else {
      score += 40;
    }

    this.confidence = score / 100;
  }

  // --- Watchdog Monitor ---
  manageWatchdogs() {
    const activeState = this.state;
    const dom = this.metrics.dom;
    const idlePeriod = Date.now() - dom.lastMutationTimestamp;
    
    // Clear other state watchdogs (excluding metrics watchdogs)
    for (const stateName of Object.keys(this.watchdogs)) {
      if (stateName !== activeState && stateName !== "METRICS_WATCHDOG_NET" && stateName !== "METRICS_WATCHDOG_DOM") {
        clearTimeout(this.watchdogs[stateName].timer);
        delete this.watchdogs[stateName];
      }
    }

    // Install state watchdog
    const rule = this.watchdogRules[activeState];
    if (rule && !this.watchdogs[activeState]) {
      const timer = setTimeout(() => {
        this.logEvent("ERROR", `Watchdog Alert: State [${activeState}] stalled for over ${rule.timeout}ms`, { name: rule.name });
        this.emit("event", {
          type: "ERROR",
          state: this.state,
          intent: this.intent,
          confidence: this.confidence,
          payload: { message: `Watchdog expired: ${rule.name}` },
          timestamp: Date.now(),
        });
      }, rule.timeout);

      this.watchdogs[activeState] = {
        timer,
        startedAt: Date.now(),
      };
    }

    // Metrics Watchdog: DOM unchanged but network is active for over 60 seconds
    const isNetActiveDomIdle = this.metrics.network.activeMediaRequests > 0 && idlePeriod >= 60000;
    if (isNetActiveDomIdle) {
      if (!this.watchdogs["METRICS_WATCHDOG_NET"]) {
        const timer = setTimeout(() => {
          this.logEvent("WARNING", "Watchdog Warning: Network active but DOM idle for > 60s");
          this.emit("event", {
            type: "WARNING",
            state: this.state,
            intent: this.intent,
            confidence: this.confidence,
            payload: { message: "Metrics Watchdog: Network active but DOM idle too long" },
            timestamp: Date.now(),
          });
        }, 1000);
        this.watchdogs["METRICS_WATCHDOG_NET"] = { timer };
      }
    } else {
      if (this.watchdogs["METRICS_WATCHDOG_NET"]) {
        clearTimeout(this.watchdogs["METRICS_WATCHDOG_NET"].timer);
        delete this.watchdogs["METRICS_WATCHDOG_NET"];
      }
    }

    // Metrics Watchdog: Network idle but DOM mutating endlessly for over 15 minutes
    const isDomMutatingNetIdle = this.metrics.network.activeMediaRequests === 0 && dom.textStreamingActive && (Date.now() - dom.lastMutationTimestamp > 15 * 60 * 1000);
    if (isDomMutatingNetIdle) {
      if (!this.watchdogs["METRICS_WATCHDOG_DOM"]) {
        const timer = setTimeout(() => {
          this.logEvent("ERROR", "Watchdog Alert: Network idle but DOM mutating endlessly for > 15m");
          this.emit("event", {
            type: "ERROR",
            state: this.state,
            intent: this.intent,
            confidence: this.confidence,
            payload: { message: "Metrics Watchdog: Network idle but DOM mutating endlessly" },
            timestamp: Date.now(),
          });
        }, 1000);
        this.watchdogs["METRICS_WATCHDOG_DOM"] = { timer };
      }
    } else {
      if (this.watchdogs["METRICS_WATCHDOG_DOM"]) {
        clearTimeout(this.watchdogs["METRICS_WATCHDOG_DOM"].timer);
        delete this.watchdogs["METRICS_WATCHDOG_DOM"];
      }
    }
  }

  clearAllWatchdogs() {
    for (const key of Object.keys(this.watchdogs)) {
      clearTimeout(this.watchdogs[key].timer);
    }
    this.watchdogs = {};
  }

  // --- Diagnostics Events Timeline Logging ---
  logEvent(source, text, payload = null) {
    const date = new Date();
    const timestampStr = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}.${String(date.getMilliseconds()).padStart(3, "0")}`;
    
    const logItem = {
      timestamp: timestampStr,
      source,
      text,
      payload,
      timeValue: date.getTime(),
    };

    this.timeline.push(logItem);
    
    // Cap diagnostics timeline to 1000 items
    if (this.timeline.length > 1000) {
      this.timeline.shift();
    }
  }

  // --- Injected Browser Observers Script ---
  getBrowserScriptCode() {
    if (window.__chatgptUiMonitorInjected) return;
    window.__chatgptUiMonitorInjected = true;

    let debounceTimer = null;
    let observer = null;
    let resizeObserver = null;
    let intersectionObserver = null;

    const emitEvent = (type, data) => {
      if (typeof window.chatgptUiMonitorBinding === "function") {
        window.chatgptUiMonitorBinding(JSON.stringify({ type, data }));
      }
    };

    const collectMetrics = () => {
      try {
        const bodyText = document.body?.innerText || "";
        const bodyTail = bodyText.slice(-3000);

        // 1. Composer & Upload Elements
        const composer = document.querySelector("#prompt-textarea, textarea, [contenteditable='true']");
        const composerText = composer ? (composer.value || composer.textContent || '').trim() : '';
        const sendBtn = document.querySelector("button[data-testid*='send'], button[aria-label*='Send'], button[aria-label*='Gửi']");
        const stopBtn = document.querySelector("button[data-testid*='stop'], button[aria-label*='Stop'], button[aria-label*='Dừng']");
        
        const attachments = Array.from(document.querySelectorAll("main form [data-testid*='attachment'], main form [class*='attachment'], main form [class*='file-preview'], main form [data-testid*='file-preview']")).filter(el => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && el.tagName !== 'INPUT';
        });
        const progressBars = Array.from(document.querySelectorAll("[role='progressbar'], [class*='progress']"));
        const attachmentsData = attachments.map(el => {
          const text = (el.innerText || el.textContent || el.getAttribute('aria-label') || '').trim();
          const img = el.querySelector('img');
          const imgSrc = img ? (img.currentSrc || img.src || '') : '';
          return { text, imgSrc };
        });

        // 2. Assistant Message Nodes
        const assistants = Array.from(document.querySelectorAll("[data-message-author-role='assistant']"));
        const latestAssistant = assistants.at(-1);
        const latestText = latestAssistant ? (latestAssistant.innerText || "").trim() : "";

        // Latest user message
        const users = Array.from(document.querySelectorAll('[data-message-author-role="user"]'));
        const latestUser = users[users.length - 1] || null;
        const latestUserText = latestUser ? latestUser.innerText.trim() : '';

        // 3. Streaming and Generating Clues
        const isStreaming = Boolean(stopBtn || document.querySelector(".result-streaming, [class*='result-streaming']"));
        
        // No regex text matching: Detect DALL-E by looking for Dall-e tool buttons, badges or widget blocks
        const toolBlocks = Array.from(document.querySelectorAll("[data-message-author-role='assistant'] [class*='tool'], [data-message-author-role='assistant'] [class*='dalle'], .dalle-tool, [data-testid*='dalle']"));
        const hasDalleTool = toolBlocks.some(block => /dall-e|dalle|image/i.test(block.innerText || block.textContent || block.className || ""));
        const isDalleActive = hasDalleTool && (isStreaming || progressBars.length > 0 || stopBtn);

        const hasSearchBadge = Boolean(document.querySelector("[class*='search'], [class*='web-search'], .search-badge"));
        const isReasoning = /\bThinking\b|Đang suy nghĩ/i.test(bodyTail);
        const isPythonActive = Boolean(document.querySelector("[class*='code-interpreter'], [class*='python']"));
        const isCanvasActive = Boolean(document.querySelector("[class*='canvas'], #canvas-panel"));

        // 4. Image Placeholders & Canvas Nodes
        const placeholders = Array.from(document.querySelectorAll("[class*='placeholder'], [class*='loading-image'], .aspect-square div div"));
        const hasLoadingCanvas = Array.from(document.querySelectorAll("canvas")).some(c => c.className.includes("dot") || c.className.includes("loading") || c.closest("[class*='loading']") || c.closest("[class*='preparing']"));
        const placeholderVisible = placeholders.some(node => node.getBoundingClientRect().width > 10) || hasLoadingCanvas;
        
        const images = latestAssistant ? Array.from(latestAssistant.querySelectorAll("img, canvas")) : [];
        const completeImages = images.filter(img => img.tagName === "CANVAS" || img.complete);

        const stoppedTextDetected = /stopped creating image|image generation stopped|creation stopped/i.test(bodyTail);
        const policyRefusalDetected = /policy|refusal|violate|tiêu chuẩn cộng đồng|chính sách/i.test(bodyTail);
        const loggedOut = /Sign in|Log in|Đăng nhập|Sign up|Đăng ký/i.test(document.title || "") || !!document.querySelector('input[type="password"]');

        const metricsPayload = {
          composerReady: Boolean(composer),
          composerBusy: Boolean(progressBars.length > 0 || stopBtn),
          hasUploadedFiles: attachments.length > 0,
          attachmentsCount: attachments.length,
          attachmentsCompleted: attachments.length - progressBars.length,
          progressBarsCount: progressBars.length,
          assistantMessageCount: assistants.length,
          latestAssistantTextLength: latestText.length,
          latestAssistantText: latestText,
          composerText: composerText,
          latestUserText: latestUserText,
          attachments: attachmentsData,
          textStreamingActive: isStreaming,
          dalleActive: isDalleActive,
          searchBadgeVisible: hasSearchBadge,
          reasoningActive: isReasoning,
          pythonCodeInterpreterActive: isPythonActive,
          canvasActive: isCanvasActive,
          placeholderVisible: placeholderVisible,
          imageElementCount: images.length,
          imageCompleteCount: completeImages.length,
          stoppedTextDetected,
          policyRefusalDetected,
          loggedOut,
          lastMutationTimestamp: Date.now(),
          url: window.location.href,
        };

        emitEvent("DOM_METRICS", metricsPayload);
      } catch (err) {
        // Fail silently
      }
    };

    const triggerDebounce = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(collectMetrics, 50);
    };

    // Initialize Observers
    observer = new MutationObserver(triggerDebounce);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "disabled", "aria-busy", "aria-valuenow"],
    });

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(triggerDebounce);
      const container = document.querySelector("main") || document.body;
      if (container) resizeObserver.observe(container);
    }

    // Intercept SPA History Navigations
    const wrapHistory = (type) => {
      const original = window.history[type];
      return function () {
        const result = original.apply(this, arguments);
        emitEvent("NAVIGATION", {
          url: window.location.href,
          rotating: true,
        });
        setTimeout(() => {
          emitEvent("NAVIGATION", {
            url: window.location.href,
            rotating: false,
          });
        }, 1500);
        return result;
      };
    };

    window.history.pushState = wrapHistory("pushState");
    window.history.replaceState = wrapHistory("replaceState");

    window.addEventListener("popstate", () => {
      emitEvent("NAVIGATION", { url: window.location.href, rotating: false });
    });
    window.addEventListener("hashchange", () => {
      emitEvent("NAVIGATION", { url: window.location.href, rotating: false });
    });

    // Run initial scan
    collectMetrics();
  }
}

// Global Single Instance Pattern
globalThis.chatGptRuntimeMonitorInstance = globalThis.chatGptRuntimeMonitorInstance || new ChatGPTRuntimeMonitor();

module.exports = globalThis.chatGptRuntimeMonitorInstance;
