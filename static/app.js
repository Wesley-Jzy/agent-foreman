const state = {
  hosts: new Set(),
  search: "",
  snapshot: null,
  managedHosts: [],
  drawerAgentId: null,
};

const toolOrder = ["codex", "claude"];
const laneGroups = [
  { key: "working", label: "开工", statuses: ["busy", "active"] },
  { key: "slacking", label: "摸鱼", statuses: ["idle", "stale"] },
  { key: "needs-input", label: "等回话", statuses: ["needs-input"] },
];

function $(id) {
  return document.getElementById(id);
}

function fmtAge(sec) {
  if (sec === null || sec === undefined) return "n/a";
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h`;
  return `${Math.round(sec / 86400)}d`;
}

function fmtTs(ts) {
  if (!ts) return "-";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function truncateStr(s, n) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || data.result?.error || `HTTP ${res.status}`);
  }
  return data;
}

async function getJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

function avatarCaption(status) {
  const labels = {
    "needs-input": "等回话",
    "busy": "开工",
    "active": "开工",
    "idle": "摸鱼",
    "stale": "摸鱼",
  };
  return labels[status] || "开工";
}

function avatarMarkup(status, agentType) {
  // 安全帽颜色：agentType × status 双维度
  // 安全帽颜色：三状态 × agentType
  const hatPalette = {
    claude: {
      "needs-input": { h: "#f0b0a0", h2: "#c87060" },  // 珊瑚红——等回话
      "busy":        { h: "#f5d060", h2: "#c8a020" },  // 金黄——开工
      "active":      { h: "#f5d060", h2: "#c8a020" },  // 金黄——开工
      "idle":        { h: "#d0d0d0", h2: "#a8a8a8" },  // 浅灰——摸鱼
      "stale":       { h: "#c0c0c0", h2: "#989898" },  // 银灰——失联
    },
    codex: {
      "needs-input": { h: "#f5a050", h2: "#c87020" },  // 橙帽——等回话
      "busy":        { h: "#7bc67e", h2: "#4a9a5a" },  // 品牌绿——开工
      "active":      { h: "#7bc67e", h2: "#4a9a5a" },  // 品牌绿——开工
      "idle":        { h: "#a0b8a0", h2: "#708870" },  // 灰绿——摸鱼
      "stale":       { h: "#b0b8b0", h2: "#808880" },  // 灰——失联
    },
  };
  const hat = (hatPalette[agentType] || hatPalette.codex)[status] || { h: "#d0d0d0", h2: "#a0a0a0" };
  const hardhat  = hat.h;
  const hardhat2 = hat.h2;
  const palette = {
    // 牛身统一暖棕/黄褐系，帽子承担品牌色区分
    "needs-input": { stroke: "#943020", cow: "#b84030", muzzle: "#e8a888", whip: "#1a0c04", whip2: "#0a0401" },
    "busy":        { stroke: "#a07020", cow: "#c8922a", muzzle: "#e8d090", whip: "#1a0c04", whip2: "#0a0401" },
    "active":      { stroke: "#a07020", cow: "#c8922a", muzzle: "#e8d090", whip: "#1a0c04", whip2: "#0a0401" },
    "idle":        { stroke: "#6a5a48", cow: "#8a7860", muzzle: "#c8b898", whip: "#1a0c04", whip2: "#0a0401" },
    "stale":       { stroke: "#787060", cow: "#a89888", muzzle: "#ccc0b0", whip: "#1a0c04", whip2: "#0a0401" },
  }[status] || { stroke: "#7a7060", cow: "#9e8e7a", muzzle: "#d4c4b0", whip: "#8e8e8e", whip2: "#666666" };
  const shortType = agentType === "claude" ? "CL" : "CX";
  return `
    <svg class="avatar-glyph" viewBox="0 0 220 220" aria-hidden="true">
      <g transform="translate(36 38) scale(4.2)">
        <path fill="${palette.cow}" d="M33.912 14.37C33.588 12.602 31.976 11 30 11H9c-1 0-5.325.035-6 2L.691 19.305C.016 21.27 1 24.087 3.027 24.087c1.15 0 2.596-.028 3.998-.052C10.016 28.046 12.898 36 14 36c.849 0 1.572-3.414 1.862-6h11.25c.234 2.528.843 6 1.888 6 .954 0 2.977-4.301 4.136-10.917.431-1.901.726-4.418.824-7.647.024.172.04.356.04.564v9c0 .553.447 1 1 1s1-.447 1-1v-9c0-1.807-.749-3.053-2.088-3.63z"/>
        <path fill="${palette.muzzle}" d="M10 12c-2 2-4.791-1-7-1-2.209 0-3-.434-3-.969 0-.535 1.791-.969 4-.969S12 10 10 12z"/>
        <circle fill="#292F33" cx="6" cy="16" r="1"/>
      </g>
      <g transform="translate(30 43) scale(0.65) rotate(45, 54, 32)">
        <path d="M12 32 Q18 10 54 10 Q90 10 96 32" fill="${hardhat}" stroke="#2d2219" stroke-width="4"/>
        <path d="M6 32 H102 Q104 32 104 36 Q104 40 100 40 H8 Q4 40 4 36 Q4 32 6 32 Z" fill="${hardhat}" stroke="#2d2219" stroke-width="4"/>
        <path d="M50 14 H58 V31 H50 Z" fill="${hardhat2}" stroke="#2d2219" stroke-width="3"/>
      </g>
      <g class="whip-anim whip-${status}" style="transform-origin: 214px 210px; transform-box: fill-box;">
        <path d="M222 220 L206 200" fill="none" stroke="${palette.whip}" stroke-width="4" stroke-linecap="round"/>
        <path d="M206 200 Q192 180 178 160 Q168 144 162 128" fill="none" stroke="${palette.whip}" stroke-width="2" stroke-linecap="round"/>
        <path d="M162 128 Q157 116 154 104 Q152 94 156 86" fill="none" stroke="${palette.whip2}" stroke-width="1.2" stroke-linecap="round"/>
        <path d="M156 86 Q157 71 165 68" fill="none" stroke="${palette.whip2}" stroke-width="0.6" stroke-linecap="round"/>
      </g>
    </svg>
  `;
}

let _activeFilter = null;

function summaryCard(label, value, slug, filterStatuses) {
  const div = document.createElement("div");
  const isActive = _activeFilter === slug;
  div.className = `summary-card ${slug}${filterStatuses ? " clickable" : ""}${isActive ? " active-filter" : ""}`;
  div.innerHTML = `<div class="k">${label}</div><div class="v">${value}</div>`;
  if (filterStatuses) {
    div.title = "点击筛选";
    div.onclick = () => {
      _activeFilter = _activeFilter === slug ? null : slug;
      if (state.snapshot) render(state.snapshot);
    };
  }
  return div;
}

function renderSummary(snapshot) {
  const el = $("summary");
  el.innerHTML = "";
  el.appendChild(summaryCard("牛马总数", snapshot.agent_count ?? 0, "agents", ["needs-input","busy","active","idle","stale"]));
  el.appendChild(summaryCard("等回话", snapshot.totals?.["needs-input"] ?? 0, "needs-input", ["needs-input"]));
  el.appendChild(summaryCard("开工", (snapshot.totals?.busy ?? 0) + (snapshot.totals?.active ?? 0), "busy", ["busy","active"]));
  el.appendChild(summaryCard("摸鱼", (snapshot.totals?.idle ?? 0) + (snapshot.totals?.stale ?? 0), "idle", ["idle","stale"]));
}

function _saveHostFilter() {
  try { localStorage.setItem("af_hosts", JSON.stringify([...state.hosts])); } catch {}
}

function _loadHostFilter(hostNames) {
  try {
    const saved = JSON.parse(localStorage.getItem("af_hosts") || "null");
    if (saved && Array.isArray(saved)) {
      // keep only hosts that still exist
      const valid = saved.filter((h) => hostNames.includes(h));
      if (valid.length) { state.hosts = new Set(valid); return; }
    }
  } catch {}
  // default: all hosts selected
  hostNames.forEach((h) => state.hosts.add(h));
}

function renderHostFilters(snapshot) {
  const hostNames = snapshot.hosts.map((h) => h.host);
  if (!state.hosts.size) _loadHostFilter(hostNames);
  const wrap = $("hostFilters");
  wrap.innerHTML = "";
  hostNames.forEach((host) => {
    const chip = document.createElement("button");
    chip.className = `host-chip ${state.hosts.has(host) ? "active" : ""}`;
    chip.textContent = host;
    chip.onclick = () => {
      if (state.hosts.has(host)) {
        state.hosts.delete(host);
      } else {
        state.hosts.add(host);
      }
      _saveHostFilter();
      render(state.snapshot);
    };
    wrap.appendChild(chip);
  });
}

function renderErrors(snapshot) {
  const box = $("hostErrors");
  box.innerHTML = "";
  snapshot.hosts
    .filter((h) => h.error)
    .forEach((h) => {
      const div = document.createElement("div");
      div.className = "host-error";
      div.textContent = `${h.host}: ${h.error}`;
      box.appendChild(div);
    });
}

function agentMatches(agent) {
  if (state.hosts.size && !state.hosts.has(agent.host)) return false;
  if (_activeFilter && _activeFilter !== "agents") {
    const filterMap = { "needs-input": ["needs-input"], "busy": ["busy","active"], "idle": ["idle","stale"] };
    const allowed = filterMap[_activeFilter];
    if (allowed && !allowed.includes(agent.status)) return false;
  }
  const q = state.search.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    agent.host,
    agent.project,
    agent.branch,
    agent.cwd,
    agent.command,
    agent.recent_output,
    ...(agent.pending_items || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function openDrawer(agentId) {
  state.drawerAgentId = agentId;
  $("agentDrawer").classList.add("open");
  $("board").classList.add("drawer-open");
  _updateDrawerHeader(agentId);
  fetchSession(agentId);
}

function closeDrawer() {
  state.drawerAgentId = null;
  $("agentDrawer").classList.remove("open");
  $("board").classList.remove("drawer-open");
}

function _updateDrawerHeader(agentId) {
  if (!state.snapshot) return;
  const agents = state.snapshot.hosts.flatMap((h) => h.agents || []);
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) return;

  const statusEl = $("drawerStatus");
  statusEl.className = `pill status-${agent.status}`;
  statusEl.textContent = avatarCaption(agent.status);
  $("drawerProject").textContent = agent.display_name || agent.project || "(unknown)";
  $("drawerMeta").textContent = `${agent.agent_type} · pid ${agent.pid} · ${agent.host}`;
  $("drawerBranch").textContent = agent.branch ? `分支 · ${agent.branch}` : "";

  const pct = agent.context_pct;
  const ctxRow = $("drawerCtxRow");
  if (pct != null) {
    $("drawerCtxFill").style.width = `${pct}%`;
    $("drawerCtxLabel").textContent = `Context ${pct}%`;
    $("drawerCtxPct").textContent = `${pct}%`;
    ctxRow.style.display = "";
  } else {
    ctxRow.style.display = "none";
  }

  const drawerSendBtn = $("drawerSendBtn");
  const drawerInput = $("drawerInput");
  if (!agent.interactive_supported) {
    drawerSendBtn.disabled = true;
    drawerInput.disabled = true;
    drawerInput.placeholder = agent.send_unsupported_reason === "mac-no-tmux"
      ? "Mac 本地需在 tmux 内运行 agent"
      : "这工位现在没法发话";
  } else {
    drawerSendBtn.disabled = false;
    drawerInput.disabled = false;
    drawerInput.placeholder = "发话或输入 slash 命令…";
  }
}

async function fetchSession(agentId) {
  try {
    const data = await getJson(`/api/session?agent_id=${encodeURIComponent(agentId)}`);
    if (state.drawerAgentId === agentId) {
      renderConvo(data.messages || []);
    }
  } catch (err) {
    if (state.drawerAgentId === agentId) {
      $("drawerConvo").innerHTML =
        `<div class="convo-error">加载对话失败: ${escHtml(err.message)}</div>`;
    }
  }
}

function renderConvo(messages) {
  const convo = $("drawerConvo");
  const atBottom = convo.scrollHeight - convo.scrollTop - convo.clientHeight < 80;

  convo.innerHTML = "";
  if (!messages.length) {
    convo.innerHTML = '<div class="convo-empty">暂无对话记录</div>';
    return;
  }

  messages.forEach((msg) => {
    let el;
    if (msg.type === "text") {
      el = document.createElement("div");
      el.className = `msg-bubble ${msg.role === "user" ? "user" : "assistant"}`;
      el.textContent = msg.text;

    } else if (msg.type === "tool_use") {
      const inputStr = JSON.stringify(msg.tool_input || {}, null, 2);
      const preview = Object.entries(msg.tool_input || {})
        .map(([k, v]) => `${k}: ${truncateStr(String(v), 40)}`)
        .join(", ");
      el = document.createElement("div");
      el.className = "tool-block";
      el.innerHTML =
        `<div class="tool-head" onclick="` +
        `var b=this.nextElementSibling;b.classList.toggle('open');` +
        `this.querySelector('.tool-toggle').textContent=b.classList.contains('open')?'▼ 收起':'▶ 展开'` +
        `"><span class="tool-icon">🔧</span>` +
        `<span class="tool-name">${escHtml(msg.tool_name)}</span>` +
        `<span class="tool-args-preview">${escHtml(truncateStr(preview, 60))}</span>` +
        `<span class="tool-toggle">▶ 展开</span></div>` +
        `<div class="tool-body">${escHtml(inputStr)}</div>`;

    } else if (msg.type === "tool_result") {
      el = document.createElement("div");
      el.className = `tool-result-block${msg.is_error ? " err" : ""}`;
      const label = msg.tool_name ? `${escHtml(msg.tool_name)} 结果` : "结果";
      el.innerHTML =
        `<span class="tool-result-label">${label}</span>` +
        `<pre>${escHtml(msg.content || "")}</pre>`;

    } else if (msg.type === "thinking") {
      el = document.createElement("div");
      el.className = "thinking-block";
      el.innerHTML =
        `<span class="thinking-label">💭 思考中</span>${escHtml(msg.text)}`;
    }

    if (el) convo.appendChild(el);
  });

  if (atBottom) convo.scrollTop = convo.scrollHeight;
}

function makeCard(agent) {
  const tpl = $("agentCardTemplate");
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.classList.add(`status-${agent.status}`);
  node.dataset.agentId = agent.id;
  node.querySelector(".status-pill").textContent = avatarCaption(agent.status);
  node.querySelector(".status-pill").classList.add(`status-${agent.status}`);
  const typePill = node.querySelector(".type-pill");
  typePill.textContent = agent.agent_type === "claude" ? "Claude 班组" : "Codex 班组";
  typePill.classList.add(`type-${agent.agent_type}`);
  node.classList.add(`agent-type-${agent.agent_type}`);
  const hostPill = node.querySelector(".host-pill");
  hostPill.textContent = agent.host === "local" ? "Local" : agent.host;
  hostPill.style.display = "";
  if (agent.host === "local") {
    hostPill.style.background = "#eef0f8";
    hostPill.style.color = "#4a5270";
    hostPill.style.borderColor = "rgba(74,82,112,0.22)";
  }
  node.querySelector(".agent-avatar").innerHTML = avatarMarkup(agent.status, agent.agent_type);
  node.querySelector(".agent-caption").textContent = avatarCaption(agent.status);
  node.querySelector(".project").textContent = agent.display_name || agent.project || "(unknown project)";
  node.querySelector(".branch").textContent = agent.branch ? `分支 · ${agent.branch}` : "分支 · 暂无";
  node.querySelector(".hostline").textContent = `${agent.host} · pid ${agent.pid} · ${agent.stat}`;
  node.querySelector(".metrics").textContent =
    `cpu ${agent.cpu?.toFixed?.(1) ?? agent.cpu}% · mem ${agent.mem?.toFixed?.(1) ?? agent.mem}% · 在跑 ${fmtAge(agent.uptime_sec)} · 心跳 ${fmtAge(agent.heartbeat_age_sec)} 前`;
  node.querySelector(".recent-output").textContent = agent.recent_output || agent.last_user_message || "暂时没抓到动静";

  // Activity line
  const heroText = node.querySelector(".hero-text");
  if (heroText) {
    const activityEl = document.createElement("div");
    activityEl.className = "activity-line";
    if (agent.current_tool) {
      const badge = document.createElement("span");
      badge.className = "tool-badge";
      badge.textContent = agent.current_tool;
      activityEl.appendChild(badge);
    }
    activityEl.appendChild(document.createTextNode(
      truncateStr(agent.recent_output || agent.last_user_message || "暂时没抓到动静", 80)
    ));
    heroText.appendChild(activityEl);

    // Context mini-bar
    if (agent.context_pct != null) {
      const level = agent.context_pct >= 80 ? "high" : agent.context_pct >= 50 ? "mid" : "low";
      const ctxRow = document.createElement("div");
      ctxRow.className = "ctx-row";
      ctxRow.innerHTML =
        `<span class="ctx-label">Context</span>` +
        `<div class="ctx-bar"><div class="ctx-fill ctx-${level}" style="width:${agent.context_pct}%"></div></div>` +
        `<span class="ctx-pct${level === "high" ? " ctx-pct-high" : ""}">${agent.context_pct}%</span>`;
      heroText.appendChild(ctxRow);
    }
  }
  const list = node.querySelector(".pending-list");
  const items = agent.pending_items?.length ? agent.pending_items : ["（暂时没翻到明确待办）"];
  items.slice(0, 6).forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    list.appendChild(li);
  });
  node.querySelector(".cwd").textContent = `工地目录: ${agent.cwd || "n/a"}`;
  node.querySelector(".cmd").textContent = `跑的命令: ${agent.command || "n/a"}`;
  node.querySelector(".session").textContent = `工位档案: ${agent.session_id || "n/a"} · 刚更新于 ${fmtTs(agent.updated_at)}`;

  const feedback = node.querySelector(".action-feedback");
  const setFeedback = (msg, cls = "") => {
    feedback.textContent = msg || "";
    feedback.className = `action-feedback ${cls}`.trim();
  };

  const renameBtn = node.querySelector(".rename-btn");
  renameBtn.onclick = async () => {
    const current = agent.display_name || "";
    const next = window.prompt("给这个牛马改个花名", current);
    if (next === null) return;
    try {
      await postJson("/api/rename", { rename_key: agent.rename_key, alias: next.trim() });
      setFeedback("花名记上了", "ok");
      await loadDashboard();
    } catch (err) {
      setFeedback(String(err.message || err), "err");
    }
  };

  const sendBtn = node.querySelector(".send-btn");
  const input = node.querySelector(".quick-input");
  if (!agent.interactive_supported) {
    sendBtn.disabled = true;
    input.disabled = true;
    input.placeholder = agent.send_unsupported_reason === "mac-no-tmux"
      ? "Mac 本地需在 tmux 内运行 agent"
      : "这工位现在没法发话";
  } else {
    const doSend = async () => {
      if (sendBtn.disabled) return;
      const message = input.value.trim() || "继续";
      const isContinue = !input.value.trim();
      sendBtn.disabled = true;
      const origText = sendBtn.textContent;
      sendBtn.textContent = "发话中…";
      try {
        const res = await postJson("/api/action", { agent_id: agent.id, message });
        const ok = res.result?.returncode === 0;
        setFeedback(ok ? (isContinue ? "已催它继续干活" : `已发话: ${message}`) : (res.result?.stderr || "发不出去"), ok ? "ok" : "err");
        if (ok && !isContinue) input.value = "";
      } catch (err) {
        setFeedback(String(err.message || err), "err");
      } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = origText;
      }
    };
    sendBtn.onclick = doSend;
    input.addEventListener("keydown", (e) => {
      // Enter = send; Ctrl+Enter or Shift+Enter = newline
      if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault();
        doSend();
      }
    });
  }
  node.addEventListener("click", (e) => {
    if (e.target.closest("button, textarea, a, details, summary")) return;
    openDrawer(agent.id); // openDrawer defined in Task 7
  });
  node.style.cursor = "pointer";
  return node;
}

function buildToolSection(tool, agents) {
  const section = document.createElement("section");
  section.className = `tool-section ${tool}`;
  const title = tool === "codex" ? "Codex 班组" : "Claude 班组";
  const subtitle =
    tool === "codex"
      ? "写代码这队牛马，谁卡住了、谁摸鱼了、谁该催，一眼翻出来。"
      : "做任务这队牛马，谁还在装忙、谁停工了，工头都盯着。";
  section.innerHTML = `
    <div class="tool-head">
      <div class="tool-title-wrap">
        <div class="tool-kicker">${tool === "codex" ? "写码工地" : "跑活工地"}</div>
        <h2 class="tool-title">${title}</h2>
        <p class="tool-subtitle">${subtitle}</p>
      </div>
      <div class="tool-badge ${tool}">${agents.length} 个牛马</div>
    </div>
    <div class="tool-grid"></div>
  `;
  const grid = section.querySelector(".tool-grid");
  laneGroups.forEach((group) => {
    const lane = document.createElement("div");
    lane.className = "lane";
    const groupedAgents = agents
      .filter((agent) => group.statuses.includes(agent.status))
      .sort((a, b) => (a.heartbeat_age_sec ?? 1e12) - (b.heartbeat_age_sec ?? 1e12));
    lane.innerHTML = `
      <div class="lane-head ${group.key}">
        <span>${group.label}</span>
        <span class="count">${groupedAgents.length}</span>
      </div>
      <div class="lane-body"></div>
    `;
    const body = lane.querySelector(".lane-body");
    groupedAgents.forEach((agent) => body.appendChild(makeCard(agent)));
    grid.appendChild(lane);
  });
  return section;
}

function renderBoard(snapshot) {
  const board = $("board");
  // preserve text and focus state before tearing down DOM
  const savedInputs = {};
  let focusedAgentId = null;
  let focusedSel = null; // selectionStart
  let focusedSelEnd = null;
  board.querySelectorAll(".agent-card[data-agent-id]").forEach((card) => {
    const inp = card.querySelector(".quick-input");
    if (!inp) return;
    if (inp.value) savedInputs[card.dataset.agentId] = inp.value;
    if (document.activeElement === inp) {
      focusedAgentId = card.dataset.agentId;
      focusedSel = inp.selectionStart;
      focusedSelEnd = inp.selectionEnd;
    }
  });
  board.innerHTML = "";
  const agents = snapshot.hosts.flatMap((h) => h.agents || []).filter(agentMatches);
  const byTool = {
    codex: agents.filter((a) => a.agent_type === "codex"),
    claude: agents.filter((a) => a.agent_type === "claude"),
  };
  toolOrder.forEach((tool) => {
    board.appendChild(buildToolSection(tool, byTool[tool] || []));
  });
  // restore saved inputs and focus
  board.querySelectorAll(".agent-card[data-agent-id]").forEach((card) => {
    const v = savedInputs[card.dataset.agentId];
    const inp = card.querySelector(".quick-input");
    if (!inp) return;
    if (v) inp.value = v;
    if (card.dataset.agentId === focusedAgentId) {
      inp.focus();
      try { inp.setSelectionRange(focusedSel, focusedSelEnd ?? focusedSel); } catch {}
    }
  });
}

function setHostFormFeedback(message, cls = "") {
  const el = $("hostFormFeedback");
  el.textContent = message || "";
  el.className = `form-feedback ${cls}`.trim();
}

function _updatePasswordRowVisibility() {
  const isSshKey = $("hostModeInput").value === "ssh";
  $("hostPasswordRow").style.display = isSshKey ? "none" : "";
  $("hostPasswordInput").required = !isSshKey;
}

function readHostForm() {
  return {
    id: $("hostIdInput").value.trim(),
    name: $("hostNameInput").value.trim(),
    ssh_target: $("hostTargetInput").value.trim(),
    port: Number($("hostPortInput").value || 22),
    mode: $("hostModeInput").value,
    username: $("hostUsernameInput").value.trim(),
    password: $("hostPasswordInput").value,
    enabled: $("hostEnabledInput").checked,
    send_mode: $("hostSendModeInput").value,
  };
}

function resetHostForm() {
  $("hostFormTitle").textContent = "登记新工地";
  $("hostIdInput").value = "";
  $("hostNameInput").value = "";
  $("hostTargetInput").value = "";
  $("hostPortInput").value = "22";
  $("hostModeInput").value = "ssh";
  $("hostUsernameInput").value = "";
  $("hostPasswordInput").value = "";
  $("hostEnabledInput").checked = true;
  $("hostSendModeInput").value = "stdin";
  $("cancelHostBtn").hidden = true;
  setHostFormFeedback("");
  _updatePasswordRowVisibility();
}

function populateHostForm(host) {
  $("hostFormTitle").textContent = `改 ${host.name} 的资料`;
  $("hostIdInput").value = host.id || "";
  $("hostNameInput").value = host.name || "";
  $("hostTargetInput").value = host.ssh_target || "";
  $("hostPortInput").value = host.port || 22;
  $("hostModeInput").value = host.mode === "ssh_password" ? "ssh_password" : "ssh";
  $("hostUsernameInput").value = host.username || "";
  $("hostPasswordInput").value = "";
  $("hostEnabledInput").checked = !!host.enabled;
  $("hostSendModeInput").value = host.send_mode || "stdin";
  $("cancelHostBtn").hidden = false;
  setHostFormFeedback(host.mode === "ssh_password" ? "口令不给你看。留空就沿用旧的。" : "");
  _updatePasswordRowVisibility();
}

function renderManagedHosts(hosts) {
  state.managedHosts = hosts || [];
  $("managedHostCount").textContent = String(state.managedHosts.length);
  const wrap = $("managedHosts");
  wrap.innerHTML = "";
  if (!state.managedHosts.length) {
    const empty = document.createElement("div");
    empty.className = "managed-host-empty";
    empty.textContent = "还没登记工地。包工头现在只能盯本地牛马。";
    wrap.appendChild(empty);
    return;
  }

  state.managedHosts.forEach((host) => {
    const card = document.createElement("article");
    card.className = `managed-host ${host.enabled ? "" : "disabled"}`.trim();

    const head = document.createElement("div");
    head.className = "managed-host-head";

    const titleWrap = document.createElement("div");
    titleWrap.className = "managed-host-title-wrap";
    const title = document.createElement("h4");
    title.textContent = host.name;
    const meta = document.createElement("div");
    meta.className = "managed-host-meta";
    meta.textContent = `${host.username || "unknown"} @ ${host.ssh_target}:${host.port} · ${host.enabled ? "巡场中" : "停巡"}`;
    titleWrap.appendChild(title);
    titleWrap.appendChild(meta);

    const badge = document.createElement("div");
    badge.className = `managed-host-badge ${host.enabled ? "enabled" : "disabled"}`;
    badge.textContent = host.enabled ? "在巡" : "停巡";

    head.appendChild(titleWrap);
    head.appendChild(badge);
    card.appendChild(head);

    const error = document.createElement("div");
    error.className = host.last_error ? "managed-host-error" : "managed-host-note";
    error.textContent = host.last_error || "工地口令已经锁柜子里了。改资料时留空就沿用旧口令。";
    card.appendChild(error);

    const actions = document.createElement("div");
    actions.className = "managed-host-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "ghost-btn";
    editBtn.textContent = "改资料";
    editBtn.onclick = () => populateHostForm(host);

    const testBtn = document.createElement("button");
    testBtn.type = "button";
    testBtn.className = "ghost-btn";
    testBtn.textContent = "试通";
    testBtn.onclick = async () => {
      try {
        const payload = {
          id: host.id,
          name: host.name,
          ssh_target: host.ssh_target,
          port: host.port,
          username: host.username,
          password: "",
          enabled: host.enabled,
          send_mode: host.send_mode,
        };
        const res = await postJson("/api/hosts/test", payload);
        setHostFormFeedback(`试通了，抓到 ${res.result?.agent_count ?? 0} 个牛马`, "ok");
        await loadDashboard();
      } catch (err) {
        setHostFormFeedback(String(err.message || err), "err");
        await loadDashboard();
      }
    };

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "ghost-btn";
    toggleBtn.textContent = host.enabled ? "停巡" : "开巡";
    toggleBtn.onclick = async () => {
      try {
        await postJson("/api/hosts/toggle", { id: host.id, enabled: !host.enabled });
        setHostFormFeedback(host.enabled ? "这工地先不盯了" : "这工地重新纳入巡场", "ok");
        await loadDashboard();
      } catch (err) {
        setHostFormFeedback(String(err.message || err), "err");
      }
    };

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "danger-btn";
    deleteBtn.textContent = "除名";
    deleteBtn.onclick = async () => {
      if (!window.confirm(`真把工地 "${host.name}" 除名？`)) return;
      try {
        await postJson("/api/hosts/delete", { id: host.id });
        if ($("hostIdInput").value === host.id) resetHostForm();
        setHostFormFeedback("工地已经除名", "ok");
        await loadDashboard();
      } catch (err) {
        setHostFormFeedback(String(err.message || err), "err");
      }
    };

    actions.appendChild(editBtn);
    actions.appendChild(testBtn);
    actions.appendChild(toggleBtn);
    actions.appendChild(deleteBtn);
    card.appendChild(actions);
    wrap.appendChild(card);
  });
}

function render(snapshot) {
  state.snapshot = snapshot;
  $("generatedAt").textContent = fmtTs(snapshot.generated_at);
  $("pollInterval").textContent = `1s（后台静默）`;
  renderSummary(snapshot);
  renderHostFilters(snapshot);
  renderErrors(snapshot);
  renderBoard(snapshot);
}

async function loadDashboard() {
  const [snapshot, hostData] = await Promise.all([getJson("/api/snapshot"), getJson("/api/hosts")]);
  render(snapshot);
  renderManagedHosts(hostData.hosts || []);
}

async function triggerRefresh() {
  await fetch("/api/refresh");
  setTimeout(loadDashboard, 300);
}

$("searchInput").addEventListener("input", (e) => {
  state.search = e.target.value;
  if (state.snapshot) render(state.snapshot);
});

$("refreshBtn").addEventListener("click", triggerRefresh);

$("toggleHostsBtn").addEventListener("click", () => {
  const panel = $("remotePanel");
  const btn = $("toggleHostsBtn");
  const hidden = panel.hasAttribute("hidden");
  if (hidden) {
    panel.removeAttribute("hidden");
    btn.textContent = "收起工地";
  } else {
    panel.setAttribute("hidden", "");
    btn.textContent = "管工地";
  }
});

$("newHostBtn").addEventListener("click", () => {
  resetHostForm();
  $("hostNameInput").focus();
});

$("cancelHostBtn").addEventListener("click", resetHostForm);

$("hostForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const payload = readHostForm();
    const res = await postJson("/api/hosts/save", payload);
    resetHostForm();
    setHostFormFeedback(`工地已记档：${res.host?.name || "unnamed"}`, "ok");
    await loadDashboard();
  } catch (err) {
    setHostFormFeedback(String(err.message || err), "err");
  }
});

$("testHostBtn").addEventListener("click", async () => {
  try {
    const payload = readHostForm();
    const res = await postJson("/api/hosts/test", payload);
    setHostFormFeedback(`试通了，抓到 ${res.result?.agent_count ?? 0} 个牛马`, "ok");
    await loadDashboard();
  } catch (err) {
    setHostFormFeedback(String(err.message || err), "err");
  }
});

$("hostModeInput").addEventListener("change", _updatePasswordRowVisibility);
$("hostTargetInput").addEventListener("input", () => {
  const val = $("hostTargetInput").value.trim();
  // parse user@host or ssh user@host or ssh -p port user@host
  const match = val.match(/(?:ssh\s+)?(?:-p\s*(\d+)\s+)?([\w.\-]+)@([\w.\-:]+)/);
  if (match) {
    if (match[1]) $("hostPortInput").value = match[1];
    $("hostUsernameInput").value = match[2];
    $("hostTargetInput").value = match[3];
  }
});
resetHostForm();
// Silent background refresh — only re-render when data actually changes
let _lastSnapshotJson = "";
async function silentRefresh() {
  try {
    const [snapshot, hostData] = await Promise.all([getJson("/api/snapshot"), getJson("/api/hosts")]);
    const newJson = JSON.stringify(snapshot);
    if (newJson !== _lastSnapshotJson) {
      _lastSnapshotJson = newJson;
      render(snapshot);
    }
    renderManagedHosts(hostData.hosts || []);
  } catch (err) {
    console.warn("refresh error", err);
  }
}

loadDashboard().catch((err) => {
  console.error(err);
  setHostFormFeedback(String(err.message || err), "err");
});
setInterval(silentRefresh, 1000);

$("drawerCloseBtn").addEventListener("click", closeDrawer);

// Slash command chips fill the input on click
$("drawerCmdChips").querySelectorAll(".cmd-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    $("drawerInput").value = chip.dataset.cmd;
    $("drawerInput").focus();
  });
});

// Drawer send button
const _drawerDoSend = async () => {
  const agentId = state.drawerAgentId;
  if (!agentId) return;
  const drawerSendBtn = $("drawerSendBtn");
  if (drawerSendBtn.disabled) return;
  const message = $("drawerInput").value.trim() || "继续";
  const isContinue = !$("drawerInput").value.trim();
  drawerSendBtn.disabled = true;
  const origText = drawerSendBtn.textContent;
  drawerSendBtn.textContent = "发话中…";
  const feedback = $("drawerFeedback");
  try {
    const res = await postJson("/api/action", { agent_id: agentId, message });
    const ok = res.result?.returncode === 0;
    feedback.textContent = ok
      ? (isContinue ? "已催它继续干活" : `已发话: ${message}`)
      : (res.result?.stderr || "发不出去");
    feedback.className = `action-feedback ${ok ? "ok" : "err"}`;
    if (ok && !isContinue) $("drawerInput").value = "";
    setTimeout(() => { feedback.textContent = ""; feedback.className = "action-feedback"; }, 3000);
  } catch (err) {
    feedback.textContent = String(err.message || err);
    feedback.className = "action-feedback err";
  } finally {
    drawerSendBtn.disabled = false;
    drawerSendBtn.textContent = origText;
  }
};

$("drawerSendBtn").addEventListener("click", _drawerDoSend);
$("drawerInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
    e.preventDefault();
    _drawerDoSend();
  }
});

setInterval(() => {
  if (state.drawerAgentId) {
    _updateDrawerHeader(state.drawerAgentId);
    fetchSession(state.drawerAgentId);
  }
}, 3000);
