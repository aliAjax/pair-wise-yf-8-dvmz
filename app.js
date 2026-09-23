const storageKey = "zfl17-film-strip-desk";

const fallbackThumbs = ["#d49b35", "#347d89", "#b54d48", "#4d7656", "#6d6378"];

const reactionTypes = [
  { key: "applause", label: "掌声", icon: "👏" },
  { key: "silence", label: "冷场", icon: "🧊" },
  { key: "question", label: "提问", icon: "❓" }
];

const defaultState = {
  reelTitle: "春日试映A卷",
  activeId: null,
  segments: [
    {
      id: crypto.randomUUID(),
      code: "A-001",
      duration: 18,
      shift: "正常",
      damage: "完好",
      note: "开场街景，节奏平稳，适合保留原顺序。",
      thumb: "",
      reactions: { applause: 0, silence: 0, question: 0 }
    },
    {
      id: crypto.randomUUID(),
      code: "A-006",
      duration: 9,
      shift: "偏红",
      damage: "轻微划痕",
      note: "人物近景左侧有划痕，试映时留意是否明显。",
      thumb: "",
      reactions: { applause: 0, silence: 0, question: 0 }
    },
    {
      id: crypto.randomUUID(),
      code: "A-012",
      duration: 14,
      shift: "褪色",
      damage: "接片松动",
      note: "接片位置靠近段尾，放映前建议重新压平。",
      thumb: "",
      reactions: { applause: 0, silence: 0, question: 0 }
    }
  ]
};

let state = loadState();
let draggedId = null;

const els = {
  reelTitle: document.querySelector("#reelTitle"),
  colorFilter: document.querySelector("#colorFilter"),
  searchInput: document.querySelector("#searchInput"),
  segmentForm: document.querySelector("#segmentForm"),
  codeInput: document.querySelector("#codeInput"),
  durationInput: document.querySelector("#durationInput"),
  shiftInput: document.querySelector("#shiftInput"),
  damageInput: document.querySelector("#damageInput"),
  thumbInput: document.querySelector("#thumbInput"),
  noteInput: document.querySelector("#noteInput"),
  segmentList: document.querySelector("#segmentList"),
  warningList: document.querySelector("#warningList"),
  totalDuration: document.querySelector("#totalDuration"),
  damageCount: document.querySelector("#damageCount"),
  segmentCount: document.querySelector("#segmentCount"),
  exportBtn: document.querySelector("#exportBtn"),
  screeningStatus: document.querySelector("#screeningStatus"),
  screeningStatusText: document.querySelector("#screeningStatusText"),
  endRoundBtn: document.querySelector("#endRoundBtn"),
  ovActive: document.querySelector("#ovActive"),
  ovRecorded: document.querySelector("#ovRecorded"),
  ovTotal: document.querySelector("#ovTotal"),
  ovApplause: document.querySelector("#ovApplause"),
  ovSilence: document.querySelector("#ovSilence"),
  ovQuestion: document.querySelector("#ovQuestion")
};

function normalizeReactions(reactions) {
  return {
    applause: Number(reactions?.applause) || 0,
    silence: Number(reactions?.silence) || 0,
    question: Number(reactions?.question) || 0
  };
}

function normalizeState(raw) {
  const base = structuredClone(defaultState);
  if (!raw || typeof raw !== "object") return base;
  return {
    ...base,
    ...raw,
    activeId: typeof raw.activeId === "string" ? raw.activeId : null,
    segments: Array.isArray(raw.segments)
      ? raw.segments.map((item) => ({ ...item, reactions: normalizeReactions(item.reactions) }))
      : base.segments
  };
}

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return structuredClone(defaultState);
  try {
    const normalized = normalizeState(JSON.parse(saved));
    // 放映中的片段若已不存在，自动归位为空闲
    if (normalized.activeId && !normalized.segments.some((item) => item.id === normalized.activeId)) {
      normalized.activeId = null;
    }
    return normalized;
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function getFilteredSegments() {
  const color = els.colorFilter.value;
  const keyword = els.searchInput.value.trim();
  return state.segments.filter((item) => {
    const matchesColor = color === "all" || item.shift === color;
    const matchesKeyword = !keyword || `${item.code}${item.note}${item.damage}`.includes(keyword);
    return matchesColor && matchesKeyword;
  });
}

function reactionTotal(reactions) {
  return reactionTypes.reduce((sum, type) => sum + (reactions[type.key] || 0), 0);
}

function renderStats() {
  const total = state.segments.reduce((sum, item) => sum + Number(item.duration), 0);
  const damaged = state.segments.filter((item) => item.damage !== "完好").length;
  els.totalDuration.textContent = formatDuration(total);
  els.damageCount.textContent = damaged;
  els.segmentCount.textContent = state.segments.length;
}

function renderOverview() {
  const active = state.segments.find((item) => item.id === state.activeId);
  els.screeningStatus.classList.toggle("is-live", Boolean(active));
  if (active) {
    const activeIndex = state.segments.findIndex((item) => item.id === active.id) + 1;
    els.screeningStatusText.textContent = `放映中：${activeIndex}. ${active.code}`;
    els.ovActive.textContent = active.code;
    els.endRoundBtn.hidden = false;
  } else {
    els.screeningStatusText.textContent = "暂未开始放映";
    els.ovActive.textContent = "—";
    els.endRoundBtn.hidden = true;
  }

  const recorded = state.segments.filter((item) => reactionTotal(item.reactions) > 0);
  const totals = reactionTypes.reduce(
    (acc, type) => {
      acc[type.key] = state.segments.reduce((sum, item) => sum + (item.reactions[type.key] || 0), 0);
      return acc;
    },
    {}
  );

  els.ovRecorded.textContent = `${recorded.length} 段`;
  els.ovTotal.textContent = totals.applause + totals.silence + totals.question;
  els.ovApplause.textContent = totals.applause;
  els.ovSilence.textContent = totals.silence;
  els.ovQuestion.textContent = totals.question;
}

function renderReactionConsole(item, isActive) {
  const counts = item.reactions;
  const summary = reactionTypes
    .map((type) => `<span class="reaction-chip ${type.key}">${type.icon} ${counts[type.key] || 0}</span>`)
    .join("");

  if (isActive) {
    const buttons = reactionTypes
      .map(
        (type) =>
          `<button type="button" class="reaction-btn ${type.key}" draggable="false" data-reaction="${item.id}:${type.key}">
             <span class="reaction-icon">${type.icon}</span>
             <span>${type.label}</span>
             <b>${counts[type.key] || 0}</b>
           </button>`
      )
      .join("");
    return `
      <div class="reaction-console is-active">
        <div class="reaction-summary">${summary}</div>
        <div class="reaction-buttons">${buttons}</div>
      </div>
    `;
  }

  const hasRecord = reactionTotal(counts) > 0;
  const canStart = !state.activeId;
  return `
    <div class="reaction-console">
      <div class="reaction-summary">
        ${hasRecord ? summary : `<span class="reaction-empty">本轮还没有反应记录</span>`}
      </div>
      <button type="button" class="start-screen-btn" draggable="false" data-start="${item.id}" ${
        canStart ? "" : "disabled"
      } title="${canStart ? "进入放映并开始记录" : "请先结束当前放映片段"}">▶ 进入放映</button>
    </div>
  `;
}

function renderList() {
  const segments = getFilteredSegments();
  els.segmentList.innerHTML =
    segments
      .map((item) => {
        const realIndex = state.segments.findIndex((segment) => segment.id === item.id);
        const hasDamage = item.damage !== "完好";
        const isActive = item.id === state.activeId;
        return `
          <article class="segment-card ${isActive ? "screening" : ""}" draggable="true" data-id="${item.id}">
            <div class="thumb">
              ${
                item.thumb
                  ? `<img src="${item.thumb}" alt="${escapeHtml(item.code)}缩略图" />`
                  : `<div class="film-placeholder" style="background:${fallbackThumbs[realIndex % fallbackThumbs.length]}">${escapeHtml(item.code)}</div>`
              }
            </div>
            <div class="segment-main">
              <div class="segment-title">
                <strong>${realIndex + 1}. ${escapeHtml(item.code)}</strong>
                <span>${formatDuration(item.duration)}</span>
                ${isActive ? `<span class="on-air-badge"><i class="live-dot"></i>放映中</span>` : ""}
              </div>
              <div class="tag-row">
                <span class="tag">${escapeHtml(item.shift)}</span>
                <span class="tag ${hasDamage ? "damage" : "ok"}">${escapeHtml(item.damage)}</span>
              </div>
              <p class="segment-note">${escapeHtml(item.note || "没有备注。")}</p>
              ${renderReactionConsole(item, isActive)}
            </div>
            <div class="segment-actions">
              <button type="button" title="上移" data-move-up="${item.id}">↑</button>
              <button type="button" title="下移" data-move-down="${item.id}">↓</button>
              <button type="button" title="删除" data-delete="${item.id}">×</button>
            </div>
          </article>
        `;
      })
      .join("") || `<p class="empty">没有符合筛选的片段。</p>`;
}

function renderWarnings() {
  const warnings = state.segments.filter((item) => item.damage !== "完好" || item.shift !== "正常");
  els.warningList.innerHTML =
    warnings
      .map((item) => {
        const index = state.segments.findIndex((segment) => segment.id === item.id) + 1;
        const reasons = [item.shift !== "正常" ? item.shift : "", item.damage !== "完好" ? item.damage : ""].filter(Boolean).join(" · ");
        return `
          <div class="warning-item">
            <strong>${index}. ${escapeHtml(item.code)}</strong>
            <span>${escapeHtml(reasons)}${item.note ? `：${escapeHtml(item.note)}` : ""}</span>
          </div>
        `;
      })
      .join("") || `<p class="empty">当前清单没有颜色偏移或破损提醒。</p>`;
}

function renderAll() {
  saveState();
  els.reelTitle.value = state.reelTitle;
  renderStats();
  renderOverview();
  renderList();
  renderWarnings();
}

function formatDuration(seconds) {
  const value = Number(seconds) || 0;
  const minutes = Math.floor(value / 60);
  const rest = String(value % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

async function addSegment(event) {
  event.preventDefault();
  const thumb = await readFileAsDataUrl(els.thumbInput.files[0]);
  state.segments.push({
    id: crypto.randomUUID(),
    code: els.codeInput.value.trim(),
    duration: Number(els.durationInput.value),
    shift: els.shiftInput.value,
    damage: els.damageInput.value,
    note: els.noteInput.value.trim(),
    thumb,
    reactions: { applause: 0, silence: 0, question: 0 }
  });
  els.segmentForm.reset();
  els.durationInput.value = 12;
  renderAll();
}

function moveSegment(id, direction) {
  const index = state.segments.findIndex((item) => item.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= state.segments.length) return;
  const [item] = state.segments.splice(index, 1);
  state.segments.splice(target, 0, item);
  renderAll();
}

function deleteSegment(id) {
  state.segments = state.segments.filter((item) => item.id !== id);
  // 移除片段时，相关反应记录随片段一起清掉；若删的正是放映中的片段，这一轮一并结束
  if (state.activeId === id) state.activeId = null;
  renderAll();
}

function startScreening(id) {
  // 同一时刻只允许一段处于放映中，换段前必须先结束当前这一轮
  if (state.activeId) return;
  if (!state.segments.some((item) => item.id === id)) return;
  state.activeId = id;
  renderAll();
}

function endRound() {
  state.activeId = null;
  renderAll();
}

function addReaction(id, key) {
  if (state.activeId !== id) return;
  const segment = state.segments.find((item) => item.id === id);
  if (!segment || !reactionTypes.some((type) => type.key === key)) return;
  segment.reactions[key] = (segment.reactions[key] || 0) + 1;
  renderAll();
}

function exportList() {
  const lines = [
    `胶片卷：${state.reelTitle || "未命名胶片卷"}`,
    `总时长：${formatDuration(state.segments.reduce((sum, item) => sum + Number(item.duration), 0))}`,
    "",
    ...state.segments.map((item, index) => {
      const reactions = reactionTypes.map((type) => `${type.label} ${item.reactions[type.key] || 0}`).join("、");
      return `${index + 1}. ${item.code}｜${formatDuration(item.duration)}｜${item.shift}｜${item.damage}｜反应：${reactions}｜${item.note || "无备注"}`;
    })
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${state.reelTitle || "film-reel"}-checklist.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

els.reelTitle.addEventListener("input", () => {
  state.reelTitle = els.reelTitle.value;
  saveState();
});
els.colorFilter.addEventListener("change", renderList);
els.searchInput.addEventListener("input", renderList);
els.segmentForm.addEventListener("submit", addSegment);
els.exportBtn.addEventListener("click", exportList);
els.endRoundBtn.addEventListener("click", endRound);

els.segmentList.addEventListener("click", (event) => {
  const reaction = event.target.closest("[data-reaction]");
  const start = event.target.closest("[data-start]");
  const up = event.target.closest("[data-move-up]");
  const down = event.target.closest("[data-move-down]");
  const remove = event.target.closest("[data-delete]");
  if (reaction) {
    const [id, key] = reaction.dataset.reaction.split(":");
    addReaction(id, key);
    return;
  }
  if (start) {
    startScreening(start.dataset.start);
    return;
  }
  if (up) moveSegment(up.dataset.moveUp, -1);
  if (down) moveSegment(down.dataset.moveDown, 1);
  if (remove) deleteSegment(remove.dataset.delete);
});

els.segmentList.addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-id]");
  if (!card) return;
  draggedId = card.dataset.id;
  card.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
});

els.segmentList.addEventListener("dragend", (event) => {
  event.target.closest("[data-id]")?.classList.remove("dragging");
  draggedId = null;
});

els.segmentList.addEventListener("dragover", (event) => {
  const card = event.target.closest("[data-id]");
  if (!card || !draggedId || card.dataset.id === draggedId) return;
  event.preventDefault();
  const fromIndex = state.segments.findIndex((item) => item.id === draggedId);
  const toIndex = state.segments.findIndex((item) => item.id === card.dataset.id);
  if (fromIndex < 0 || toIndex < 0) return;
  const [item] = state.segments.splice(fromIndex, 1);
  state.segments.splice(toIndex, 0, item);
  renderAll();
});

renderAll();
