(function (root) {
  "use strict";
  function createManualWorkflowUI({ api, document, getProjectPath, beforeStart = async () => {}, onError = () => {} }) {
    let view = null;
    let observation = null;
    let previewToken = "";
    let projectPath = "";
    let lastSavedArtifact = "";
    const actionLabels = {
      "manual-open-chrome-btn": "Mở Chrome Manual",
      "manual-resume-btn": "Kết nối workflow",
      "manual-refresh-observation-btn": "Kiểm tra trạng thái GPT",
      "manual-copy-btn": "Copy prompt",
      "manual-arm-btn": "Bắt đầu theo dõi",
      "manual-capture-btn": "Kiểm tra / Lưu phản hồi",
      "manual-cancel-btn": "Hủy lượt đang chờ",
      "manual-continue-btn": "Tiếp tục workflow",
      "manual-retry-veoup-btn": "Chạy lại VeoUp",
      "manual-cancel-veoup-btn": "Hủy gửi batch VeoUp",
      "manual-open-scene-folder-btn": "Mở thư mục scene",
      "manual-redo-btn": "Làm lại stage",
      "copy-path": "Copy đường dẫn file",
      "open-attachment-folder": "Mở thư mục file",
    };
    const node = (id) => document.querySelector(`#${id}`);
    const text = (id, value) => { if (node(id)) node(id).textContent = value || ""; };
    function readyBundle(model) {
      const bundle = model?.activeAttempt?.bundle || model?.preparedBundle;
      const sceneId = Number(model?.activeAttempt?.sceneId || model?.currentSceneId);
      const stage = model?.activeAttempt?.stage || model?.nextStage;
      return bundle && Number(bundle.sceneId) === sceneId && bundle.stage === stage &&
        String(bundle.clipboardText || "").trim() && bundle.payloadFingerprint
        ? bundle
        : null;
    }
    const live = (state, label) => {
      const indicator = node("manual-live-indicator");
      if (!indicator) return;
      indicator.dataset.state = state;
      indicator.textContent = label;
    };
    const error = (value) => {
      const failure = value instanceof Error ? value : new Error(value?.error || value?.code || "Manual workflow failed");
      text("manual-error", failure.message);
      onError(failure);
    };
    function setActionFeedback(state, message, { log = true } = {}) {
      const indicator = node("manual-action-state");
      if (indicator) indicator.dataset.state = state;
      text("manual-action-message", message);
      if (!log) return;
      const logNode = node("manual-action-log");
      if (!logNode) return;
      if (logNode.querySelector(".is-idle")) logNode.replaceChildren();
      const item = document.createElement("li");
      item.className = `is-${state}`;
      const time = document.createElement("span");
      time.className = "manual-action-time";
      time.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const detail = document.createElement("span");
      detail.textContent = message;
      item.append(time, detail);
      logNode.prepend(item);
      while (logNode.children.length > 6) logNode.lastElementChild.remove();
    }
    function completionMessage(action, result) {
      if (action === "manual-copy-btn") return "Prompt đã được copy. Dán vào ChatGPT rồi tự bấm Send.";
      if (action === "manual-arm-btn") return "Đã bật theo dõi. Vidora đang chờ đúng phản hồi của prompt này.";
      if (action === "manual-capture-btn" && result?.attempt?.artifactPath) {
        const fileName = String(result.attempt.artifactPath).split(/[\\/]/).at(-1);
        return `Đã lưu ${result.attempt.stage === "NV1" ? "keyframe" : "motion prompt"}: ${fileName}`;
      }
      if (action === "manual-open-chrome-btn") return "Chrome Manual đã sẵn sàng. Đăng nhập và chọn conversation của bạn.";
      if (action === "manual-resume-btn") {
        const current = result?.viewModel || result;
        if (readyBundle(current)) return `Scene ${current.currentSceneId} · ${current.nextStage}: prompt và file đã sẵn sàng.`;
        if (current?.activeAttempt) return "Workflow đã đồng bộ. Vidora đang theo dõi lượt ChatGPT hiện tại.";
        if (current?.audit?.complete) return "Workflow đã đồng bộ. Tất cả scene đã hoàn tất.";
        return "Workflow đã đồng bộ; stage hiện tại chưa có prompt sẵn sàng.";
      }
      if (action === "manual-redo-btn") return "Đã chuẩn bị lại stage. Bấm Theo dõi rồi gửi prompt mới trên ChatGPT.";
      if (action === "manual-refresh-observation-btn") return "Đã cập nhật dữ liệu Vidora đọc được từ ChatGPT.";
      if (action === "manual-cancel-btn") return "Đã hủy lượt theo dõi. Bấm Kết nối workflow khi muốn chuẩn bị lượt mới.";
      if (action === "manual-cancel-veoup-btn") return "Đã yêu cầu dừng thao tác gửi batch VeoUp.";
      if (action === "manual-continue-btn") return "Đã tiếp tục workflow.";
      if (action === "manual-open-scene-folder-btn") return "Đã mở thư mục của scene.";
      if (action === "copy-path") return "Đã copy đường dẫn file.";
      if (action === "open-attachment-folder") return "Đã mở thư mục chứa file.";
      return `${actionLabels[action] || "Thao tác"} đã hoàn tất.`;
    }
    async function runAction(button, action, operation) {
      if (!button || button.dataset.busy === "true") return { ok: false, error: "manual-action-in-progress" };
      button.dataset.busy = "true";
      button.classList.add("is-busy");
      button.setAttribute("aria-busy", "true");
      setActionFeedback("working", `Đang ${actionLabels[action] || "xử lý thao tác"}…`, { log: false });
      try {
        const result = await operation();
        const current = result?.viewModel || result;
        const stageNeedsBundle = ["manual-resume-btn", "manual-redo-btn", "manual-continue-btn", "manual-capture-btn", "manual-cancel-btn"].includes(action) &&
          /^SCENE_NV[12]_READY$/.test(String(current?.state || "")) && !readyBundle(current);
        const observationUnavailable = action === "manual-refresh-observation-btn" && result?.observation?.available === false;
        if (result?.ok !== true || result?.autoPrepareError || stageNeedsBundle || observationUnavailable) {
          const failure = result?.autoPrepareError || result?.error || result?.code ||
            (stageNeedsBundle ? `Scene ${current.currentSceneId} · ${current.nextStage} chưa có prompt và file hợp lệ. Hãy bấm Kết nối workflow để đồng bộ lại.` :
              observationUnavailable ? result.observation.error || "Chrome Manual chưa kết nối." : "Thao tác chưa hoàn tất.");
          setActionFeedback("error", `${actionLabels[action] || "Thao tác"}: ${failure}`);
          return result;
        }
        setActionFeedback("success", completionMessage(action, result));
        return result;
      } catch (failure) {
        const message = failure?.message || String(failure);
        setActionFeedback("error", `${actionLabels[action] || "Thao tác"}: ${message}`);
        error(failure);
        return { ok: false, error: message };
      } finally {
        button.dataset.busy = "";
        button.classList.remove("is-busy");
        button.removeAttribute("aria-busy");
      }
    }
    function showToast(message, type = "success") {
      const container = node("toast-container");
      if (!container) return;
      const toast = document.createElement("div");
      toast.className = `toast ${type}`;
      const icon = document.createElement("span");
      icon.className = "toast-icon";
      icon.textContent = type === "success" ? "✓" : "!";
      const content = document.createElement("span");
      content.className = "toast-content";
      content.textContent = message;
      toast.append(icon, content);
      container.appendChild(toast);
      setTimeout(() => {
        toast.classList.add("toast-hiding");
        setTimeout(() => toast.remove(), 260);
      }, 4200);
    }
    function notifySavedArtifact(result, { log = true } = {}) {
      const attempt = result?.attempt || result?.capture?.attempt;
      if (!attempt?.artifactPath) return;
      const key = `${attempt.attemptId || ""}:${attempt.artifactPath}`;
      if (key === lastSavedArtifact) return;
      lastSavedArtifact = key;
      const fileName = String(attempt.artifactPath).split(/[\\/]/).at(-1);
      const label = attempt.stage === "NV1" ? "keyframe" : "motion prompt";
      showToast(`Đã lưu ${label} thành công: ${fileName}`);
      if (log) setActionFeedback("success", `Đã lưu ${label}: ${fileName}`);
    }
    function renderObservation(next) {
      observation = next || null;
      if (!observation) return;
      if (observation.available === false) {
        live("offline", "Không kết nối");
        text("manual-observation-status", "Chrome Manual chưa kết nối · Vidora sẽ tự thử lại mỗi giây");
        text("manual-observation-details", `Không thể đọc ChatGPT lúc này.\n${observation.error || "Mở đúng một tab ChatGPT trong Chrome Manual."}`);
        updateCaptureButton();
        return;
      }
      live(
        observation.loggedOut ? "warning" : observation.generating ? "busy" : "live",
        observation.loggedOut ? "Cần đăng nhập" : observation.generating ? "GPT đang trả lời" : "Đang theo dõi",
      );
      const conversation = observation.conversationId || "chưa nhận diện được conversation";
      text("manual-observation-status", [
        observation.loggedOut ? "ChatGPT chưa đăng nhập trong Chrome Manual" : `Conversation: ${conversation}`,
        observation.generating ? "ChatGPT đang tạo phản hồi" : "ChatGPT đã dừng tạo phản hồi",
        `Đã thấy ${observation.messageCount || 0} lượt (${observation.userMessageCount || 0} user / ${observation.assistantMessageCount || 0} assistant)`,
        observation.checkedAt ? `đồng bộ ${new Date(observation.checkedAt).toLocaleTimeString()}` : "",
      ].join(" · "));
      const attempt = observation.activeAttempt
        ? `\nLượt Vidora đang chờ: ${observation.activeAttempt.stage} · Scene ${observation.activeAttempt.sceneId} · baseline ${observation.activeAttempt.baselineTurnCount} lượt`
        : "\nVidora sẽ tự bắt đầu theo dõi khi prompt của stage hiện tại sẵn sàng và Chrome Manual đã kết nối. Bạn chỉ cần tự đính kèm, gửi prompt trên ChatGPT.";
      const captureStatus = observation.captureStatus?.code === "RESPONSE_SETTLING"
        ? `\nĐang xác nhận phản hồi ổn định: ${observation.captureStatus.stability?.ticks || 0}/${observation.captureStatus.stability?.requiredTicks || 0} lượt quét · ${Math.round((observation.captureStatus.stability?.stableMs || 0) / 1000)}s/${Math.round((observation.captureStatus.stability?.requiredMs || 0) / 1000)}s`
        : observation.captureStatus?.code === "STILL_GENERATING"
          ? "\nĐang chờ ChatGPT hoàn tất phản hồi."
          : observation.captureStatus?.error && !["manual-owned-user-turn-not-found", "manual-owned-assistant-turn-not-found"].includes(observation.captureStatus.error)
            ? `\nChưa thể tự lưu: ${observation.captureStatus.error}`
            : "";
      const outputLabel = (output) => {
        const kind = output.kind === "image"
          ? "ẢNH KEYFRAME"
          : output.kind === "motion_prompt"
            ? "MOTION PROMPT"
            : output.kind === "ready"
              ? "READY"
              : "TEXT";
        const context = [output.stage, output.sceneId ? `Scene ${output.sceneId}` : ""].filter(Boolean).join(" · ");
        const file = output.fileName ? ` → ${output.fileName}${output.saved ? " (đã lưu)" : ""}` : "";
        return `${kind}${context ? ` · ${context}` : ""}${file}`;
      };
      const observedOutputs = (observation.observedOutputs || []).map((output) => [
        `• GPT trả về: ${outputLabel(output)}${output.settled === false ? " · đang tạo" : ""}`,
        output.text ? `  ${output.text}` : "",
      ].filter(Boolean).join("\n")).join("\n");
      const savedOutputs = (observation.savedOutputs || []).map((output) =>
        `• Vidora đã lưu: ${outputLabel(output)}`,
      ).join("\n");
      const turns = (observation.turns || []).map((turn, index) => [
        `#${index + 1} ${String(turn.role || "unknown").toUpperCase()} · id: ${turn.id || "không có"}${turn.settled === false ? " · đang tạo" : ""}${turn.hasImage ? " · có ảnh" : ""}`,
        turn.attachmentNames?.length ? `File hiển thị: ${turn.attachmentNames.join(", ")}` : "",
        turn.text || "(không đọc được nội dung chữ)",
      ].filter(Boolean).join("\n")).join("\n\n");
      text("manual-observation-details", `${attempt}${captureStatus}\n\nKết quả Vidora đã quét từ GPT:\n${observedOutputs || "(chưa thấy output assistant nào)"}\n\nFile Vidora đã lưu:\n${savedOutputs || "(chưa có output nào được lưu)"}\n\nCác lượt gần nhất Vidora đọc được:\n${turns || "(chưa thấy lượt chat nào)"}`);
      updateCaptureButton();
    }
    function updateCaptureButton() {
      const button = node("manual-capture-btn");
      if (!button || !view) return;
      const candidate = observation?.capturablePreparedResponse;
      const bundle = !view.activeAttempt ? readyBundle(view) : null;
      const canAdopt = Boolean(candidate && bundle &&
        candidate.stage === bundle.stage && Number(candidate.sceneId) === Number(bundle.sceneId));
      button.disabled = !view.activeAttempt && !canAdopt;
      button.textContent = canAdopt ? "Lưu phản hồi GPT đang thấy" : "Kiểm tra / Lưu phản hồi";
    }
    function render(next) {
      if (!next?.audit) return;
      if (view && Number(next.revision || 0) < Number(view.revision || 0)) return;
      view = next;
      text("manual-error", view.lastError);
      text("manual-stage-badge", `${view.state} · conversation: ${view.conversationId || "chat mới"}${view.activeAttempt ? ` · attempt ${view.activeAttempt.attemptId}` : ""}`);
      text("manual-project-progress", `${view.audit.readyCount} / ${view.audit.expectedCount} scenes hoàn tất`);
      text("manual-veoup-gate-status", view.state === "VEOUP_RUNNING"
        ? view.veoUpCancelling ? "ĐANG HỦY BATCH" : "ĐANG GỬI BATCH"
        : view.state === "VEOUP_COMPLETE" ? "ĐÃ GỬI BATCH" : view.audit.complete ? "READY" : "LOCKED");
      const select = node("manual-scene-select");
      if (select) {
        select.replaceChildren();
        for (const scene of view.audit.scenes) {
          const option = document.createElement("option");
          option.value = String(scene.sceneId);
          option.textContent = `Scene ${scene.sceneId} · ${scene.stage}`;
          select.appendChild(option);
        }
        select.value = String(view.viewedSceneId || view.currentSceneId);
      }
      const bundle = readyBundle(view);
      const promptText = String(bundle?.clipboardText || "").trim();
      const bundleReady = Boolean(bundle);
      const preparedOnly = Boolean(bundle && view.preparedBundle && !view.activeAttempt);
      text("manual-prompt-label", `Prompt canonical · Scene ${bundle?.sceneId || view.currentSceneId || "—"} · ${bundle?.stage || view.nextStage || "—"}`);
      if (node("manual-prompt-preview")) node("manual-prompt-preview").value = promptText;
      text(
        "manual-instructions",
        view.state === "VEOUP_RUNNING"
          ? view.veoUpCancelling
            ? "Vidora đang dừng thao tác gửi batch VeoUp. Nếu đã bấm Generate, lệnh hủy không thu hồi lượt đã gửi."
            : `Vidora đang kiểm tra và gửi batch ${view.audit.expectedCount} scene sang VeoUp. Bạn có thể hủy thao tác gửi nếu cần.`
          : view.state === "VEOUP_COMPLETE"
            ? `Đã gửi batch ${view.audit.expectedCount} scene sang VeoUp.`
            : bundleReady
          ? view.rearmRequired
            ? `${bundle.instructions}\nLượt trước đã hủy. Chờ GPT hoàn tất lượt cũ, bấm Theo dõi rồi gửi một prompt mới.`
            : bundle.instructions
          : `Prompt ${view.nextStage} chưa sẵn sàng. Vidora chưa cho phép copy hoặc bắt đầu theo dõi cho đến khi bundle của scene hiện tại được chuẩn bị xong.`,
      );
      const attachments = node("manual-attachments");
      if (attachments) {
        attachments.replaceChildren();
        for (const file of bundle?.attachments || []) {
          const item = document.createElement("li");
          const label = document.createElement("span");
          label.textContent = `${file.name} — ${file.path} `;
          const copy = document.createElement("button");
          copy.type = "button";
          copy.textContent = "Copy path";
          copy.addEventListener("click", () => runAction(copy, "copy-path", () => api.copyManualText(file.path)));
          const open = document.createElement("button");
          open.type = "button";
          open.textContent = "Mở thư mục";
          open.addEventListener("click", () => runAction(open, "open-attachment-folder", () => api.openManualFolder(file.path)));
          item.appendChild(label); item.appendChild(copy); item.appendChild(open); attachments.appendChild(item);
        }
        if (!bundle?.attachments?.length) {
          const item = document.createElement("li");
          item.textContent = "Stage này không có attachment.";
          attachments.appendChild(item);
        }
      }
      const scene = view.audit.scenes.find((entry) => entry.sceneId === Number(view.viewedSceneId || view.currentSceneId));
      text("manual-scene-audit", scene ? `Scene ${scene.sceneId}\nKeyframe: ${scene.keyframe.valid ? "VALID" : scene.keyframe.error} · ${scene.keyframe.path}\nMotion: ${scene.motionPrompt.valid ? "VALID" : scene.motionPrompt.error} · ${scene.motionPrompt.path}` : "");
      updateCaptureButton();
      for (const id of ["manual-cancel-btn", "manual-override-preview-btn"]) if (node(id)) node(id).disabled = !view.activeAttempt;
      if (node("manual-arm-btn")) node("manual-arm-btn").disabled = !preparedOnly || view.overrideHold;
      if (node("manual-copy-btn")) node("manual-copy-btn").disabled = !bundleReady || view.overrideHold;
      const recoveryDetails = node("manual-recovery-details");
      const redoStage = node("manual-redo-stage-select");
      const redoButton = node("manual-redo-btn");
      if (recoveryDetails) recoveryDetails.hidden = !scene || (!scene.keyframe.exists && !scene.motionPrompt.exists);
      if (redoStage && scene && redoStage.dataset.sceneId !== String(scene.sceneId)) {
        redoStage.dataset.sceneId = String(scene.sceneId);
        redoStage.value = scene.keyframe.valid ? "NV2" : "NV1";
      }
      if (redoButton) redoButton.disabled = !scene || view.state === "VEOUP_RUNNING" ||
        (redoStage?.value === "NV2" && !scene.keyframe.valid);
      if (node("manual-continue-btn")) {
        node("manual-continue-btn").hidden = !view.overrideHold;
        node("manual-continue-btn").disabled = Boolean(view.activeAttempt);
      }
      const retryVeoUp = node("manual-retry-veoup-btn");
      if (retryVeoUp) {
        retryVeoUp.hidden = !view.canRetryVeoUp;
        retryVeoUp.disabled = !view.canRetryVeoUp || Boolean(view.activeAttempt || view.overrideHold);
      }
      const cancelVeoUp = node("manual-cancel-veoup-btn");
      if (cancelVeoUp) {
        cancelVeoUp.hidden = !view.canCancelVeoUp;
        cancelVeoUp.disabled = !view.canCancelVeoUp || view.veoUpCancelling;
      }
      if (observation) renderObservation(observation);
    }
    async function command(method, payload = {}) {
      try {
        if (!projectPath || projectPath !== getProjectPath()) throw new Error("Mở / Tiếp tục workflow của project hiện tại trước.");
        const result = await api[method]({ projectPath, ...payload });
        if (result?.observation) renderObservation(result.observation);
        if (!result?.ok) { error(result); return result; }
        render(result.viewModel || result);
        return result;
      } catch (failure) { error(failure); return { ok: false, error: failure.message }; }
    }
    async function start() {
      try {
        await beforeStart();
        const nextProjectPath = getProjectPath();
        if (projectPath !== nextProjectPath) { view = null; observation = null; }
        projectPath = nextProjectPath;
        const mode = await api.setWorkflowMode("manual_keyframe_motion");
        if (!mode.ok) throw new Error(mode.error);
        const initialized = await api.initializeManualWorkflow({ projectPath });
        if (!initialized.ok) throw new Error(initialized.error || initialized.code);
        render(initialized);
        const resumed = await command("resumeManualWorkflow");
        if (!resumed?.ok || !api.getManualViewModel) return resumed;
        const fresh = await api.getManualViewModel({ projectPath }).catch(() => null);
        if (!fresh?.ok) return resumed;
        render(fresh);
        return { ...resumed, viewModel: fresh };
      } catch (failure) { error(failure); return { ok: false, error: failure.message }; }
    }
    function bind(id, callback) {
      node(id)?.addEventListener("click", () => runAction(node(id), id, callback));
    }
    bind("manual-open-chrome-btn", async () => {
      const result = await api.openManualChrome();
      if (!result?.ok) { error(result); return result; }
      text("manual-error", "");
      text("manual-instructions", result.message);
      return result;
    });
    bind("manual-refresh-observation-btn", async () => {
      try {
        if (!projectPath || projectPath !== getProjectPath()) throw new Error("Mở / Tiếp tục workflow của project hiện tại trước.");
        const result = await api.getManualObservation({ projectPath });
        if (!result?.ok) { error(result); return result; }
        renderObservation(result.observation);
        render(result.viewModel || view);
        return result;
      } catch (failure) { error(failure); return { ok: false, error: failure.message }; }
    });
    bind("manual-resume-btn", start);
    bind("manual-redo-btn", () => command("redoManualStage", {
      sceneId: Number(node("manual-scene-select")?.value || view?.viewedSceneId || view?.currentSceneId),
      stage: node("manual-redo-stage-select")?.value || "NV1",
    }));
    function currentPromptText() {
      return String(readyBundle(view)?.clipboardText || "").trim();
    }
    bind("manual-copy-btn", () => {
      const prompt = currentPromptText();
      if (!prompt) return { ok: false, error: "Chưa có prompt để copy. Hãy chờ Vidora chuẩn bị bundle của stage hiện tại." };
      return api.copyManualText(prompt);
    });
    bind("manual-arm-btn", async () => {
      if (!currentPromptText()) return { ok: false, error: "Chưa có prompt để theo dõi. Hãy chờ bundle của stage hiện tại sẵn sàng." };
      const result = await command("armManualStage");
      if (!result?.ok) return result;
      const copied = await api.copyManualText(result.attempt.bundle.clipboardText);
      if (!copied?.ok) return { ok: false, error: `Đã bật theo dõi nhưng không copy được prompt: ${copied?.error || "clipboard-unavailable"}` };
      return result;
    });
    bind("manual-capture-btn", async () => {
      const result = await command("captureManualStage", {
        attemptId: view?.activeAttempt?.attemptId,
        sceneId: view?.activeAttempt?.sceneId,
        stage: view?.activeAttempt?.stage,
        adoptPrepared: true,
      });
      if (result?.ok) notifySavedArtifact(result, { log: false });
      return result;
    });
    bind("manual-cancel-btn", () => command("cancelManualStage"));
    bind("manual-continue-btn", () => command("continueManualWorkflow"));
    bind("manual-retry-veoup-btn", () => command("submitManualVeoUp"));
    bind("manual-cancel-veoup-btn", () => command("cancelManualVeoUp"));
    bind("manual-open-scene-folder-btn", () => {
      const scene = view?.audit.scenes.find((item) => item.sceneId === Number(node("manual-scene-select")?.value));
      if (scene) return api.openManualFolder(scene.sceneDir);
      return { ok: false, error: "Chưa có scene để mở thư mục." };
    });
    node("manual-scene-select")?.addEventListener("change", () => command("selectManualScene", { sceneId: Number(node("manual-scene-select").value) }));
    node("manual-redo-stage-select")?.addEventListener("change", () => { if (view) render(view); });
    bind("manual-override-preview-btn", async () => {
      const result = await command("previewManualOverride");
      if (!result?.ok) return result;
      previewToken = result.token;
      node("manual-override-panel").hidden = false;
      text("manual-override-warning", `Scene ${result.sceneId} · ${result.stage}: ${result.warning}`);
      text("manual-override-text", result.candidate.text);
      const image = node("manual-override-image");
      image.hidden = !result.candidate.imageDataUrl;
      image.src = result.candidate.imageDataUrl || "";
      return result;
    });
    bind("manual-override-confirm-btn", async () => {
      const result = await command("confirmManualOverride", { token: previewToken });
      if (result?.ok) { previewToken = ""; node("manual-override-panel").hidden = true; }
      return result;
    });
    api.onManualWorkflowChanged?.((payload) => {
      if (payload.projectPath === projectPath && projectPath === getProjectPath()) {
        if (payload.observation) renderObservation(payload.observation);
        render(payload.viewModel);
        if (payload.capture?.attempt) notifySavedArtifact(payload.capture);
      }
    });
    api.onManualWorkflowObservation?.((payload) => {
      if (payload.projectPath === projectPath && projectPath === getProjectPath()) {
        renderObservation(payload.observation);
      }
    });
    return { start, command, render, getViewModel: () => view };
  }
  if (typeof module === "object" && module.exports) module.exports = { createManualWorkflowUI };
  else root.createManualWorkflowUI = createManualWorkflowUI;
})(typeof window === "object" ? window : globalThis);
