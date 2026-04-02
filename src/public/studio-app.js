/* global WebSocket, fetch */

function $(id) {
  return document.getElementById(id);
}

function setStatus(text, isError = false) {
  const el = $("status");
  el.textContent = text;
  el.style.color = isError ? "#ff8a8a" : "";
}

function setGatewayStatus(text, isError = false) {
  const el = $("gw");
  el.textContent = text;
  el.style.color = isError ? "#ff8a8a" : "";
}

async function api(path, { method = "GET", body } = {}) {
  const r = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) {
    const msg = j.error || `HTTP ${r.status}`;
    const detail = j.detail ? `\n${JSON.stringify(j.detail, null, 2)}` : "";
    throw new Error(msg + detail);
  }
  return j;
}

function parseTocToChapters(tocText) {
  const lines = String(tocText || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const chapters = [];
  let no = 1;
  for (const line of lines) {
    const m = /^(\d+)\s*[\.\-\)]\s*(.+)$/.exec(line);
    if (m) {
      chapters.push({ no: Number(m[1]), title: m[2].trim(), status: "pending", targetWords: 3500 });
      no = Number(m[1]) + 1;
    } else {
      chapters.push({ no, title: line, status: "pending", targetWords: 3500 });
      no += 1;
    }
  }
  return chapters;
}

function collectState() {
  const tocText = $("toc").value;
  const chapters = parseTocToChapters(tocText);
  return {
    docId: $("docId").value.trim(),
    language: "my-MM",
    targetWords: Number.parseInt($("targetWords").value.trim() || "80000", 10) || 80000,
    targetPages: "200-300",
    bookTitle: $("bookTitle").value.trim(),
    subtitle: $("subtitle").value.trim(),
    audience: $("audience").value.trim(),
    tone: $("tone").value.trim(),
    lessonTemplate: $("lessonTemplate").value,
    chapters,
  };
}

function fillFromProject(project) {
  $("docId").value = project?.docId || "";
  $("bookTitle").value = project?.bookTitle || "";
  $("subtitle").value = project?.subtitle || "";
  $("audience").value = project?.audience || "";
  $("tone").value = project?.tone || "";
  $("targetWords").value = String(project?.targetWords || 80000);
  $("lessonTemplate").value = project?.lessonTemplate || "";
}

function renderChapters(project) {
  const list = $("chapterList");
  const chapters = Array.isArray(project?.chapters) ? project.chapters : [];
  if (!chapters.length) {
    list.textContent = "(no chapters yet — fill TOC and Save)";
    return;
  }
  const next = chapters.find((c) => String(c?.status || "pending") !== "done");
  const lines = chapters.map((c) => {
    const status = String(c?.status || "pending");
    const marker = status === "done" ? "✅" : c?.no === next?.no ? "➡️" : "⏳";
    const title = c?.title || "";
    return `${marker} ${c.no}. ${title} [${status}]`;
  });
  list.textContent = lines.join("\n");
}

let ws = null;
let wsConnected = false;
const GATEWAY_TOKEN = "__OPENCLAW_GATEWAY_TOKEN__";

function wsUrlCandidates() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const base = `${proto}//${location.host}`;
  // Different OpenClaw builds have used different WS paths; try a short list.
  return [`${base}/ws`, `${base}/gateway`, `${base}/`];
}

function wsConnect() {
  if (wsConnected) return;
  const urls = wsUrlCandidates();
  let idx = 0;

  function tryNext() {
    if (idx >= urls.length) {
      setGatewayStatus("Gateway WS connect failed (all paths).", true);
      return;
    }
    const url = urls[idx++];
    setGatewayStatus(`Connecting: ${url} ...`);
    ws = new WebSocket(url);
    ws.onopen = () => {
      // Minimal connect. This works when gateway.controlUi.allowInsecureAuth=true (your template sets it).
      const msg = {
        type: "req",
        id: crypto.randomUUID(),
        method: "connect",
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: { id: "ebook-studio", version: "1.0", platform: "web", mode: "operator" },
          role: "operator",
          scopes: ["operator.read", "operator.write"],
          caps: [],
          commands: [],
          permissions: {},
          auth: { token: GATEWAY_TOKEN },
          locale: navigator.language || "en-US",
          userAgent: navigator.userAgent,
        },
      };
      ws.send(JSON.stringify(msg));
    };
    ws.onerror = () => {
      try { ws.close(); } catch {}
    };
    ws.onclose = () => {
      if (!wsConnected) tryNext();
      wsConnected = false;
    };
    ws.onmessage = (ev) => {
      const data = JSON.parse(ev.data);
      if (data.type === "res" && data.ok && data.payload?.type === "hello-ok") {
        wsConnected = true;
        setGatewayStatus("Gateway connected.");
      }
      // Some gateways send connect.challenge; in insecure mode it may be ignorable.
      if (data.type === "res" && data.ok === false) {
        setGatewayStatus(`Gateway connect error: ${JSON.stringify(data.error || data)}`, true);
      }
    };
  }

  tryNext();
}

async function draftNextChapter() {
  const slug = $("slug").value.trim();
  if (!slug) throw new Error("slug_required");
  const next = await api("/studio/api/next-chapter", { method: "POST", body: { slug } });
  $("chapterNo").value = String(next.chapter.no);
  if (!wsConnected) wsConnect();
  if (!ws || ws.readyState !== 1) {
    throw new Error("gateway_not_connected_yet");
  }

  $("draft").value = "";
  const runId = crypto.randomUUID();
  const reqId = crypto.randomUUID();
  const sessionKey = `ebook:${slug}`;
  const msg = {
    type: "req",
    id: reqId,
    method: "chat.run",
    params: {
      sessionKey,
      message: next.prompt,
      options: { stream: true },
      clientRunId: runId,
    },
  };

  const handler = (ev) => {
    const data = JSON.parse(ev.data);
    if (data.type === "event" && data.event === "chat.delta") {
      if (data.payload?.delta) $("draft").value += data.payload.delta;
    }
    if (data.type === "event" && data.event === "chat.done") {
      ws.removeEventListener("message", handler);
      setGatewayStatus("Draft complete.");
    }
  };
  ws.addEventListener("message", handler);
  ws.send(JSON.stringify(msg));
  setGatewayStatus(`Drafting chapter ${next.chapter.no}...`);
}

async function draftChapterByNo() {
  const slug = $("slug").value.trim();
  const chapterNo = Number.parseInt($("chapterNo").value.trim(), 10);
  if (!slug) throw new Error("slug_required");
  if (!Number.isFinite(chapterNo)) throw new Error("chapterNo_required");
  const next = await api("/studio/api/next-chapter", {
    method: "POST",
    body: { slug, chapterNo },
  });
  $("chapterNo").value = String(next.chapter.no);
  if (!wsConnected) wsConnect();
  if (!ws || ws.readyState !== 1) throw new Error("gateway_not_connected_yet");
  $("draft").value = "";
  const sessionKey = `ebook:${slug}`;
  const msg = {
    type: "req",
    id: crypto.randomUUID(),
    method: "chat.run",
    params: { sessionKey, message: next.prompt, options: { stream: true } },
  };
  const handler = (ev) => {
    const data = JSON.parse(ev.data);
    if (data.type === "event" && data.event === "chat.delta") {
      if (data.payload?.delta) $("draft").value += data.payload.delta;
    }
    if (data.type === "event" && data.event === "chat.done") {
      ws.removeEventListener("message", handler);
      setGatewayStatus("Draft complete.");
    }
  };
  ws.addEventListener("message", handler);
  ws.send(JSON.stringify(msg));
  setGatewayStatus(`Drafting chapter ${next.chapter.no}...`);
}

async function draftFrontMatter() {
  const slug = $("slug").value.trim();
  if (!slug) throw new Error("slug_required");
  const fm = await api("/studio/api/front-matter", { method: "POST", body: { slug } });
  if (!wsConnected) wsConnect();
  if (!ws || ws.readyState !== 1) throw new Error("gateway_not_connected_yet");
  $("draft").value = "";
  const sessionKey = `ebook:${slug}`;
  const msg = {
    type: "req",
    id: crypto.randomUUID(),
    method: "chat.run",
    params: { sessionKey, message: fm.prompt, options: { stream: true } },
  };
  const handler = (ev) => {
    const data = JSON.parse(ev.data);
    if (data.type === "event" && data.event === "chat.delta") {
      if (data.payload?.delta) $("draft").value += data.payload.delta;
    }
    if (data.type === "event" && data.event === "chat.done") {
      ws.removeEventListener("message", handler);
      setGatewayStatus("Front matter draft complete.");
    }
  };
  ws.addEventListener("message", handler);
  ws.send(JSON.stringify(msg));
  setGatewayStatus("Drafting front matter...");
}

async function exportReplaceBody() {
  const slug = $("slug").value.trim();
  if (!slug) throw new Error("slug_required");
  const text = $("draft").value;
  const r = await api("/studio/api/export/replace-body", { method: "POST", body: { slug, text } });
  setStatus(`Replaced doc body. rev=${r.verify?.revisionId || ""}`);
  renderChapters(r.state || {});
}

async function draftRewriteSection() {
  const slug = $("slug").value.trim();
  const startHeading = $("startHeading").value.trim();
  const endHeading = $("endHeading").value.trim();
  if (!slug) throw new Error("slug_required");
  if (!startHeading) throw new Error("startHeading_required");
  if (!wsConnected) wsConnect();
  if (!ws || ws.readyState !== 1) throw new Error("gateway_not_connected_yet");

  const proj = await api(`/studio/api/project?slug=${encodeURIComponent(slug)}`);
  const state = proj.state || {};
  const prompt = [
    "Rewrite a section of a Myanmar ebook chapter.",
    "Rules:",
    "- Keep the same TOC and overall style.",
    "- Only rewrite content between the headings (do not include the end heading in the rewritten text).",
    "- Output ONLY the new section content, starting with the start heading line.",
    "",
    `Book title: ${state.bookTitle || ""}`,
    state.subtitle ? `Subtitle: ${state.subtitle}` : "",
    state.audience ? `Audience: ${state.audience}` : "",
    state.tone ? `Tone: ${state.tone}` : "",
    "",
    "Start heading:",
    startHeading,
    "",
    "End heading (if present in the doc):",
    endHeading || "(end of document)",
    "",
    "Now produce the replacement section content.",
  ]
    .filter(Boolean)
    .join("\n");

  $("rewriteDraft").value = "";
  const sessionKey = `ebook:${slug}`;
  const msg = {
    type: "req",
    id: crypto.randomUUID(),
    method: "chat.run",
    params: { sessionKey, message: prompt, options: { stream: true } },
  };

  const handler = (ev) => {
    const data = JSON.parse(ev.data);
    if (data.type === "event" && data.event === "chat.delta") {
      if (data.payload?.delta) $("rewriteDraft").value += data.payload.delta;
    }
    if (data.type === "event" && data.event === "chat.done") {
      ws.removeEventListener("message", handler);
      setGatewayStatus("Rewrite draft complete.");
    }
  };
  ws.addEventListener("message", handler);
  ws.send(JSON.stringify(msg));
  setGatewayStatus("Drafting rewrite...");
}

async function approveAppend() {
  const slug = $("slug").value.trim();
  const chapterNo = Number.parseInt($("chapterNo").value.trim(), 10);
  const chapterText = $("draft").value;
  const r = await api("/studio/api/approve-append", {
    method: "POST",
    body: { slug, chapterNo, chapterText },
  });
  setStatus(`Exported chapter ${chapterNo}. insertIndex=${r.insertIndex}`);
}

async function applySectionRewrite() {
  const slug = $("slug").value.trim();
  const startHeading = $("startHeading").value.trim();
  const endHeading = $("endHeading").value.trim();
  const newSectionText = $("rewriteDraft").value;
  const proj = await api(`/studio/api/project?slug=${encodeURIComponent(slug)}`);
  const docId = proj.state?.docId;
  if (!docId) throw new Error("docId_missing_in_project_state");
  const r = await api("/__railway/google/docs/section-rewrite", {
    method: "POST",
    body: { docId, startHeading, endHeading, newSectionText },
  });
  setStatus(`Section rewrite applied. chars=${r.charsReplaced} rev=${r.verify?.revisionId || ""}`);
}

async function loadProject() {
  const slug = $("slug").value.trim();
  if (!slug) throw new Error("slug_required");
  const r = await api(`/studio/api/project?slug=${encodeURIComponent(slug)}`);
  $("toc").value = r.toc || "";
  $("style").value = r.style || "";
  fillFromProject(r.state || {});
  renderChapters(r.state || {});
  setStatus(`Loaded ${slug}`);
}

async function newTemplate() {
  $("toc").value = [
    "1. မိတ်ဆက် (Introduction)",
    "2. ဘယ်သူတွေအတွက်လဲ (For Whom)",
    "3. သင်ဘာတွေသင်ယူရမလဲ (What You Will Learn)",
    "4. အခြေခံသဘောတရားများ",
    "5. လက်တွေ့အသုံးချနည်းများ",
    "6. ပြဿနာဖြေရှင်းခြင်း",
    "7. အဆင့်မြင့်အသုံးချခြင်း",
    "8. အဖြစ်များတဲ့အမှားများ",
    "9. လက်တွေ့ပရောဂျက် (Case Study)",
    "10. အကျဉ်းချုပ် (Conclusion)",
    "11. ကျေးဇူးတင်လွှာ (Acknowledgement)",
  ].join("\n");
  $("style").value = [
    "## Voice",
    "- Myanmar language, clear and professional, friendly tone.",
    "- Short paragraphs; use bullet lists for steps.",
    "",
    "## Formatting",
    "- Use headings with `အခန်း (N): ...` format exactly.",
    "- Include action checklists and summaries.",
  ].join("\n");
  $("lessonTemplate").value = [
    "### သင်ခန်းစာ (X): <ခေါင်းစဉ်>",
    "- အဓိကအယူအဆ:",
    "- ဘာကြောင့်အရေးကြီးလဲ:",
    "- လုပ်ဆောင်ရန် အဆင့်များ:",
    "- နမူနာ:",
    "- အမှားရှောင်ရန်:",
  ].join("\n");
  setStatus("Template inserted. Edit title/subtitle/TOC then Save.");
}

async function saveProject() {
  const slug = $("slug").value.trim();
  if (!slug) throw new Error("slug_required");
  const state = collectState();
  const toc = $("toc").value;
  const style = $("style").value;
  const r = await api("/studio/api/project/save", { method: "POST", body: { slug, state, toc, style } });
  setStatus(`Saved ${r.slug}`);
}

function wire() {
  $("btnLoad").addEventListener("click", () => loadProject().catch((e) => setStatus(String(e), true)));
  $("btnNew").addEventListener("click", () => newTemplate());
  $("btnSave").addEventListener("click", () => saveProject().catch((e) => setStatus(String(e), true)));
  $("btnRefresh").addEventListener("click", () => loadProject().catch((e) => setStatus(String(e), true)));
  $("btnFrontMatter").addEventListener("click", () => draftFrontMatter().catch((e) => setGatewayStatus(String(e), true)));
  $("btnExportReplace").addEventListener("click", () => exportReplaceBody().catch((e) => setStatus(String(e), true)));
  $("btnConnect").addEventListener("click", () => wsConnect());
  $("btnNext").addEventListener("click", () => draftNextChapter().catch((e) => setGatewayStatus(String(e), true)));
  $("btnDraftChapterNo").addEventListener("click", () => draftChapterByNo().catch((e) => setGatewayStatus(String(e), true)));
  $("btnClearDraft").addEventListener("click", () => { $("draft").value = ""; });
  $("btnApproveAppend").addEventListener("click", () => approveAppend().catch((e) => setStatus(String(e), true)));
  $("btnRewritePrompt").addEventListener("click", () => draftRewriteSection().catch((e) => setGatewayStatus(String(e), true)));
  $("btnApplySectionRewrite").addEventListener("click", () => applySectionRewrite().catch((e) => setStatus(String(e), true)));
}

wire();

