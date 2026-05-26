// =========================
// CLAUDE API KEY
// =========================

let CLAUDE_API_KEY = localStorage.getItem("claude_api_key") || "";

if (!CLAUDE_API_KEY) {
  const key = prompt("Enter your Claude API Key:");
  if (key && key.trim()) {
    CLAUDE_API_KEY = key.trim();
    localStorage.setItem("claude_api_key", CLAUDE_API_KEY);
  } else {
    alert("Claude API key required.");
  }
}

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

// =========================
// STATE
// =========================
let subjects             = JSON.parse(localStorage.getItem("subjects")) || [];
let currentSubject       = null;
let timerInterval        = null;
let timerSeconds         = 25 * 60;
let timerRunning         = false;
let musicPlaying         = false;
let currentFlashcards    = [];
let currentQuizQuestions = [];
let currentMode          = null;
let lastBtnId            = null;
let activeTool           = null;

// =========================
// FLASHCARD STUDY SESSION STATE
// =========================
let fcSession = {
  allCards:   [],
  queue:      [],
  unknown:    [],
  known:      [],
  roundIndex:  0,
  roundNumber: 1,
  retest:     false
};

// =========================
// CACHE KEY MAP
// =========================
const CACHE_KEYS = {
  summarizeBtn:    "summary",
  flashcardBtn:    "flashcards",
  quizBtn:         "quiz",
  studyPlanBtn:    "studyPlan",
  eli5Btn:         "eli5",
  mnemonicBtn:     "mnemonics",
  practiceTestBtn: "practiceTest",
  weaknessBtn:     "weakness"
};

const TOOL_NAMES = {
  summarizeBtn:    "Summary",
  flashcardBtn:    "Flashcards",
  quizBtn:         "Quiz",
  studyPlanBtn:    "Study Plan",
  eli5Btn:         "ELI5",
  mnemonicBtn:     "Memory Tricks",
  practiceTestBtn: "Practice Test",
  weaknessBtn:     "Weak Spots"
};

// =========================
// SAVE
// =========================
function save() {
  localStorage.setItem("subjects", JSON.stringify(subjects));
}

// =========================
// SUBJECT CREATION
// =========================
document.getElementById("newSubjectBtn").onclick = () => {
  const name = prompt("Subject name?");
  if (!name || !name.trim()) return;
  subjects.push({ id: Date.now(), name: name.trim(), files: [], chunks: [], chatHistory: [], xp: 0, level: 1, streak: 0, cache: {} });
  save();
  renderSubjects();
};

// =========================
// SEARCH
// =========================
document.getElementById("searchInput").addEventListener("input", (e) => {
  renderSubjects(e.target.value.toLowerCase().trim());
});

// =========================
// RENDER SUBJECTS
// =========================
function renderSubjects(filter = "") {
  const list = document.getElementById("subjectList");
  list.innerHTML = "";
  const filtered = filter ? subjects.filter(s => s.name.toLowerCase().includes(filter)) : subjects;
  filtered.forEach(sub => {
    const div = document.createElement("div");
    div.className = "subject-card" + (currentSubject?.id === sub.id ? " active" : "");
    const info = document.createElement("div");
    info.className = "subject-info";
    info.innerHTML = `<h3>${sub.name}</h3><p>${sub.files.length} file${sub.files.length !== 1 ? "s" : ""}</p>`;
    info.onclick = () => loadSubject(sub.id);
    const actions = document.createElement("div");
    actions.className = "subject-actions";
    const renameBtn = document.createElement("button");
    renameBtn.className = "subject-action-btn rename-btn";
    renameBtn.title = "Rename";
    renameBtn.innerHTML = "✏️";
    renameBtn.onclick = (e) => { e.stopPropagation(); renameSubject(sub.id); };
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "subject-action-btn delete-btn";
    deleteBtn.title = "Delete";
    deleteBtn.innerHTML = "🗑️";
    deleteBtn.onclick = (e) => { e.stopPropagation(); deleteSubject(sub.id); };
    actions.appendChild(renameBtn);
    actions.appendChild(deleteBtn);
    div.appendChild(info);
    div.appendChild(actions);
    list.appendChild(div);
  });
}

// =========================
// RENAME SUBJECT
// =========================
function renameSubject(id) {
  const sub = subjects.find(s => s.id === id);
  if (!sub) return;
  const newName = prompt("New name for subject:", sub.name);
  if (!newName || !newName.trim()) return;
  sub.name = newName.trim();
  if (currentSubject?.id === id) {
    currentSubject.name = sub.name;
    document.getElementById("subjectTitle").innerText = sub.name;
  }
  save();
  renderSubjects();
}

// =========================
// DELETE SUBJECT
// =========================
function deleteSubject(id) {
  const sub = subjects.find(s => s.id === id);
  if (!sub) return;
  if (!confirm(`Delete "${sub.name}"? This cannot be undone.`)) return;
  subjects = subjects.filter(s => s.id !== id);
  if (currentSubject?.id === id) {
    currentSubject = null;
    activeTool = null;
    document.getElementById("subjectTitle").innerText = "Select a Subject";
    document.getElementById("subjectSubtitle").innerText = "Upload study guides to begin.";
    document.getElementById("fileList").innerHTML = "";
    document.getElementById("chatMessages").innerHTML = "";
    document.getElementById("output").innerHTML = "";
    document.getElementById("xp").innerText = "0";
    document.getElementById("level").innerText = "1";
    hideEditPanel();
    hideCacheBar();
  }
  save();
  renderSubjects();
}

// =========================
// LOAD SUBJECT
// =========================
function loadSubject(id) {
  currentSubject = subjects.find(s => s.id === id);
  if (!currentSubject.cache) currentSubject.cache = {};
  activeTool = null;
  document.getElementById("subjectTitle").innerText = currentSubject.name;
  document.getElementById("subjectSubtitle").innerText = `${currentSubject.files.length} file(s) uploaded`;
  document.getElementById("xp").innerText = currentSubject.xp || 0;
  document.getElementById("level").innerText = currentSubject.level || 1;
  document.getElementById("output").innerHTML = "";
  renderFiles();
  renderChat();
  renderSubjects();
  hideEditPanel();
  hideCacheBar();
  lastBtnId = null;
}

// =========================
// FILE UPLOAD
// =========================
const dropZone = document.getElementById("dropZone");
dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("dragging"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragging"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault(); dropZone.classList.remove("dragging");
  if (!currentSubject) { alert("Select a subject first."); return; }
  handleFileList(Array.from(e.dataTransfer.files));
});
document.getElementById("fileInput").onchange = (e) => {
  if (!currentSubject) { alert("Select a subject first."); return; }
  handleFileList(Array.from(e.target.files));
};

async function handleFileList(files) {
  setOutput("Reading files...");
  for (let file of files) {
    const text = await extractText(file);
    if (!text) continue;
    currentSubject.files.push({ name: file.name, text });
    currentSubject.chunks.push(...chunkText(text, file.name));
  }
  save(); renderFiles();
  setOutput(`${files.length} file(s) loaded. Ready to study!`);
}

// =========================
// TEXT EXTRACTION
// =========================
async function extractText(file) {
  if (file.type === "text/plain") return await file.text();
  if (file.type === "application/pdf") {
    try {
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += "\n" + content.items.map(i => i.str).join(" ");
      }
      return text;
    } catch (err) { console.error("PDF error:", err); return ""; }
  }
  if (file.name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    try {
      const buffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: buffer });
      return result.value;
    } catch (err) { console.error("DOCX error:", err); return ""; }
  }
  return "";
}

// =========================
// CHUNKING
// =========================
function chunkText(text, fileName, size = 1200) {
  const chunks = []; let page = 1;
  for (let i = 0; i < text.length; i += size) {
    chunks.push({ text: text.slice(i, i + size), source: fileName, page }); page++;
  }
  return chunks;
}

// =========================
// SMART RETRIEVAL
// =========================
function getRelevantChunks(question) {
  if (!currentSubject || !currentSubject.chunks.length) return [];
  const words = question.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  return currentSubject.chunks
    .map(c => {
      let score = 0;
      const t = c.text.toLowerCase();
      for (let w of words) if (t.includes(w)) score += 2;
      return { ...c, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

function getAllChunksContext() {
  if (!currentSubject || !currentSubject.chunks.length) return "";
  const MAX_CHARS = 80000;
  const byFile = {};
  for (const chunk of currentSubject.chunks) {
    const src = chunk.source || "unknown";
    if (!byFile[src]) byFile[src] = [];
    byFile[src].push(chunk);
  }
  const files = Object.keys(byFile);
  const charsPerFile = Math.floor(MAX_CHARS / files.length);
  const parts = files.map(src => {
    let text = "";
    for (const chunk of byFile[src]) {
      if (text.length + chunk.text.length > charsPerFile) break;
      text += chunk.text + "\n\n";
    }
    return `--- Source: ${src} ---\n` + text.trim();
  });
  return parts.join("\n\n");
}

// =========================
// CLAUDE API (FOCUSED)
// =========================
async function askAI(prompt, systemPrompt) {
  if (!currentSubject) return "Select a subject first.";
  if (!currentSubject.chunks.length) return "No study material uploaded yet. Add files first.";

  const chunks = getRelevantChunks(prompt);
  const context = chunks
    .filter(c => c.text && c.text.length > 20)
    .map(c => c.text.split(" ").slice(0, 180).join(" "))
    .join("\n\n");

  const system = systemPrompt || `
You are a focused study assistant.
Only use the provided study material.
If the answer is not in the material, say: "Not found in your study material."
Be concise.
`;

  const fullPrompt = `
SUBJECT: ${currentSubject.name}

STUDY MATERIAL:
${context}

TASK:
${prompt}
`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2000,
        system,
        messages: [{ role: "user", content: fullPrompt }]
      })
    });
    const data = await res.json();
    if (!res.ok) return `API Error: ${data?.error?.message || "Unknown error"}`;
    return data?.content?.[0]?.text?.trim() || "No response.";
  } catch (err) {
    return `Network/API error: ${err.message}`;
  }
}

// =========================
// CLAUDE API (FULL CONTEXT)
// =========================
async function askAIFull(prompt, systemPrompt) {
  if (!currentSubject) return "Select a subject first.";
  if (!currentSubject.chunks.length) return "No study material uploaded yet. Add files first.";

  const context = getAllChunksContext();
  const system = systemPrompt || `
You are a study assistant.
Use ONLY the provided material.
Be complete and accurate.
`;

  const fullPrompt = `
SUBJECT: ${currentSubject.name}

STUDY MATERIAL:
${context}

TASK:
${prompt}
`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 4000,
        system,
        messages: [{ role: "user", content: fullPrompt }]
      })
    });
    const data = await res.json();
    if (!res.ok) return `API Error: ${data?.error?.message || "Unknown error"}`;
    return data?.content?.[0]?.text?.trim() || "No response.";
  } catch (err) {
    return `Network/API error: ${err.message}`;
  }
}

// =========================
// CACHE BAR (legacy stub — kept so old references don't break)
// =========================
function hideCacheBar() {
  const bar = document.getElementById("cacheBar");
  if (bar) bar.style.display = "none";
}

// =========================
// INLINE RESULT BAR
// Injects a "Showing saved X / Regenerate" bar at top of #output
// =========================
function showResultWithBar(btnId, renderer, value) {
  activeTool = btnId;
  hideCacheBar();

  // Render content first
  if (renderer) {
    renderer(value);
  } else {
    setOutput(value);
  }

  // Inject bar at top of output
  const outputDiv = document.getElementById("output");
  const existing = document.getElementById("inlineCacheBar");
  if (existing) existing.remove();

  const bar = document.createElement("div");
  bar.id = "inlineCacheBar";
  bar.style.cssText = `
    display:flex; align-items:center; justify-content:space-between;
    gap:12px; padding:10px 14px; margin-bottom:14px;
    border-radius:10px; background:rgba(255,255,255,0.05);
    border:1px solid rgba(255,255,255,0.1); font-size:0.83rem;
    color:#888; flex-shrink:0;
  `;
  bar.innerHTML = `
    <span>📌 Showing saved ${TOOL_NAMES[btnId] || "result"}</span>
    <button id="inlineRegenBtn" style="
      padding:5px 12px; border-radius:6px;
      border:1px solid rgba(255,255,255,0.15);
      background:transparent; color:inherit;
      cursor:pointer; font-size:0.82rem;
      white-space:nowrap; transition:background 0.2s;
    ">🔄 Regenerate</button>
  `;

  outputDiv.insertBefore(bar, outputDiv.firstChild);

  document.getElementById("inlineRegenBtn").onclick = () => {
    if (!currentSubject) return;
    const cacheKey = CACHE_KEYS[btnId];
    if (cacheKey && currentSubject.cache) {
      delete currentSubject.cache[cacheKey];
      save();
    }
    activeTool = null;
    document.getElementById(btnId)?.click();
  };
}

// =========================
// TOOL RUNNER — focused context, with toggle
// =========================
async function runTool(prompt, btnId, renderer) {
  if (!currentSubject) { alert("Select a subject first."); return; }
  if (!currentSubject.chunks.length) { alert("Upload study files first."); return; }
  if (!currentSubject.cache) currentSubject.cache = {};

  const cacheKey = CACHE_KEYS[btnId];
  lastBtnId = btnId;

  // Already cached — show it
  if (cacheKey && currentSubject.cache[cacheKey]) {
    hideEditPanel();
    showResultWithBar(btnId, renderer, currentSubject.cache[cacheKey]);
    return;
  }

  // Generate fresh
  activeTool = btnId;
  const btn = document.getElementById(btnId);
  btn.disabled = true;
  btn.classList.add("loading");
  document.getElementById("output").innerHTML = `<p style="opacity:0.5">⏳ Thinking...</p>`;
  hideEditPanel();
  hideCacheBar();

  const result = await askAI(prompt);

  if (cacheKey) {
    currentSubject.cache[cacheKey] = result;
    save();
  }

  showResultWithBar(btnId, renderer, result);
  awardXP(10);
  btn.disabled = false;
  btn.classList.remove("loading");
}

// =========================
// TOOL RUNNER FULL — full context, with toggle
// =========================
async function runToolFull(prompt, btnId, renderer) {
  if (!currentSubject) { alert("Select a subject first."); return; }
  if (!currentSubject.chunks.length) { alert("Upload study files first."); return; }
  if (!currentSubject.cache) currentSubject.cache = {};

  const cacheKey = CACHE_KEYS[btnId];
  lastBtnId = btnId;

  // Already cached — show it
  if (cacheKey && currentSubject.cache[cacheKey]) {
    hideEditPanel();
    showResultWithBar(btnId, renderer, currentSubject.cache[cacheKey]);
    if (btnId === "flashcardBtn") showEditPanel("flashcard");
    else if (btnId === "quizBtn" || btnId === "practiceTestBtn") showEditPanel("quiz");
    return;
  }

  // Generate fresh
  activeTool = btnId;
  const btn = document.getElementById(btnId);
  btn.disabled = true;
  btn.classList.add("loading");
  document.getElementById("output").innerHTML = `<p style="opacity:0.5">⏳ Generating from full material...</p>`;
  hideEditPanel();
  hideCacheBar();

  const result = await askAIFull(prompt);

  if (cacheKey) {
    currentSubject.cache[cacheKey] = result;
    save();
  }

  showResultWithBar(btnId, renderer, result);
  awardXP(10);
  btn.disabled = false;
  btn.classList.remove("loading");
}

// =========================
// MARKDOWN RENDERER
// =========================
function renderMarkdown(text) {
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^## (.+)$/gm, "<h3>$1</h3>")
    .replace(/^# (.+)$/gm, "<h2>$1</h2>")
    .replace(/^[-•] (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/^(?!<[hulo])(.+)$/gm, (m) => m.trim() ? m : "")
    .replace(/\n/g, "<br>");
}

function setOutput(html, isHTML = false) {
  document.getElementById("output").innerHTML = isHTML ? html : `<p>${renderMarkdown(html)}</p>`;
}

// =========================
// EDIT PANEL
// =========================
function showEditPanel(mode) {
  currentMode = mode;
  const panel = document.getElementById("editPanel");
  document.getElementById("editPanelTitle").textContent = mode === "flashcard"
    ? "✏️ Edit Flashcards — Ask AI to tweak your cards"
    : "✏️ Edit Quiz — Ask AI to modify your questions";
  panel.style.display = "block";
  document.getElementById("editMessages").innerHTML = "";
  document.getElementById("editInput").value = "";
  document.getElementById("editInput").placeholder = mode === "flashcard"
    ? 'e.g. "Add 5 more cards" or "Make the questions harder"'
    : 'e.g. "Add 3 more questions" or "Change Q2 to ask about photosynthesis"';
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function hideEditPanel() {
  document.getElementById("editPanel").style.display = "none";
  currentMode = null;
}

document.getElementById("editSendBtn").onclick = sendEditMessage;
document.getElementById("editInput").addEventListener("keydown", (e) => { if (e.key === "Enter") sendEditMessage(); });
document.getElementById("editCloseBtn").onclick = hideEditPanel;

async function sendEditMessage() {
  const input = document.getElementById("editInput");
  const msg = input.value.trim();
  if (!msg) return;
  addEditMessage(msg, "user");
  input.value = "";
  const typingDiv = addEditMessage("⏳ Thinking...", "ai");
  let formatPrompt, renderer;

  if (currentMode === "flashcard") {
    const currentData = currentFlashcards.map((c, i) => `Q${i+1}: ${c.q}\nA${i+1}: ${c.a}`).join("\n\n");
    formatPrompt = `Current flashcards:\n${currentData}\n\nUser request: ${msg}\n\nRespond ONLY with the full updated set in this EXACT format:\nQ: [question]\nA: [answer]`;
    renderer = (text) => {
      const pairs = parseFlashcards(text);
      if (pairs.length > 0) {
        currentFlashcards = pairs;
        renderFlashcardUI(pairs);
        if (currentSubject && currentSubject.cache) {
          currentSubject.cache["flashcards"] = text;
          save();
        }
        typingDiv.innerHTML = `✅ Done! Updated to ${pairs.length} cards.`;
      } else {
        typingDiv.innerHTML = renderMarkdown(text);
      }
    };
  } else {
    const currentData = currentQuizQuestions.map((q, i) =>
      `${i+1}. ${q.q}\n${q.options.map((o, oi) => `${o.letter}. ${o.text}${oi===q.correct?" (correct)":""}`).join("\n")}`
    ).join("\n\n");
    formatPrompt = `Current quiz:\n${currentData}\n\nUser request: ${msg}\n\nRespond ONLY with the full updated set in this EXACT format:\n1. [Question]\nA. [option]\nB. [option]\nC. [option] (correct)\nD. [option]`;
    renderer = (text) => {
      const qs = parseQuiz(text);
      if (qs.length > 0) {
        currentQuizQuestions = qs;
        renderQuizUI(qs);
        if (currentSubject && currentSubject.cache) {
          const key = lastBtnId === "practiceTestBtn" ? "practiceTest" : "quiz";
          currentSubject.cache[key] = text;
          save();
        }
        typingDiv.innerHTML = `✅ Done! Updated to ${qs.length} questions.`;
      } else {
        typingDiv.innerHTML = renderMarkdown(text);
      }
    };
  }

  try {
    const editSystem = "You are a study assistant helping edit flashcards or quiz questions. Follow the exact format. Output ONLY the cards/questions, no preamble.";
    const result = await askAI(`${editSystem}\n\n${formatPrompt}`);
    renderer(result);
  } catch (err) {
    typingDiv.innerHTML = "Error: " + err.message;
  }
}

function addEditMessage(text, type) {
  const div = document.createElement("div");
  div.className = `chat-bubble ${type}`;
  if (type === "user") div.textContent = text; else div.innerHTML = renderMarkdown(text);
  const box = document.getElementById("editMessages");
  box.appendChild(div); box.scrollTop = box.scrollHeight;
  return div;
}

// =========================
// FLASHCARD PARSER
// =========================
function parseFlashcards(text) {
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const pairs = [];
  const lines = text.split("\n");
  let currentQ = "", currentA = "";
  for (let line of lines) {
    line = line.trim();
    if (line.match(/^Q[:)]/i)) {
      if (currentQ && currentA) pairs.push({ q: currentQ, a: currentA });
      currentQ = line.replace(/^Q[:)]\s*/i, ""); currentA = "";
    } else if (line.match(/^A[:)]/i)) {
      currentA = line.replace(/^A[:)]\s*/i, "");
    } else if (currentA && line) {
      currentA += " " + line;
    }
  }
  if (currentQ && currentA) pairs.push({ q: currentQ, a: currentA });
  return pairs;
}

// =========================
// FLASHCARD RENDER ENTRY
// =========================
function renderFlashcards(text) {
  const pairs = parseFlashcards(text);
  if (pairs.length === 0) { setOutput(text); return; }
  currentFlashcards = pairs;
  startFlashcardSession(pairs);
  showEditPanel("flashcard");
}

// =========================
// FLASHCARD SESSION — SPACED REPETITION
// =========================
const RETEST_INTERVAL = 5;

function startFlashcardSession(pairs) {
  fcSession = {
    allCards:    pairs.map((p, i) => ({ ...p, id: i })),
    queue:       pairs.map((p, i) => ({ ...p, id: i })),
    unknown:     [],
    known:       [],
    roundIndex:  0,
    roundNumber: 1,
    retest:      false
  };
  renderFCSession();
}

function renderFCSession() {
  const s = fcSession;

  // All mastered
  if (s.known.length === s.allCards.length) {
    const pct = 100;
    setOutput(`
      <div class="fc-complete">
        <div class="fc-complete-icon">🎉</div>
        <h2 class="fc-complete-title">You nailed every card!</h2>
        <p class="fc-complete-sub">All ${s.allCards.length} cards mastered across ${s.roundNumber} round${s.roundNumber !== 1 ? "s" : ""}.</p>
        <div class="fc-score-bar-wrap"><div class="fc-score-bar" style="width:${pct}%"></div></div>
        <button class="fc-restart-full-btn" onclick="startFlashcardSession(currentFlashcards)">↺ Study Again</button>
      </div>
    `, true);
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    awardXP(20);
    return;
  }

  // Retest burst check
  if (!s.retest && s.roundIndex > 0 && s.roundIndex % RETEST_INTERVAL === 0 && s.unknown.length > 0) {
    s.retest = true;
    s.retestQueue = shuffle([...s.unknown]);
    s.retestIndex = 0;
    s.unknown = [];
  }

  // Retest mode
  if (s.retest) {
    if (s.retestIndex >= s.retestQueue.length) {
      s.retest = false;
      renderFCSession();
      return;
    }
    const card = s.retestQueue[s.retestIndex];
    renderFCCard(card, true);
    return;
  }

  // Normal — queue exhausted
  if (s.roundIndex >= s.queue.length) {
    if (s.unknown.length === 0) {
      s.known = s.allCards;
      renderFCSession();
      return;
    }
    s.roundNumber++;
    s.queue = shuffle([...s.unknown]);
    s.unknown = [];
    s.roundIndex = 0;
    renderFCSession();
    return;
  }

  const card = s.queue[s.roundIndex];
  renderFCCard(card, false);
}

function renderFCCard(card, isRetest) {
  const s = fcSession;
  const masteredCount = s.known.length;
  const totalCount = s.allCards.length;
  const pct = Math.round((masteredCount / totalCount) * 100);

  const pos   = isRetest ? s.retestIndex + 1 : s.roundIndex + 1;
  const total = isRetest ? s.retestQueue.length : s.queue.length;
  const retestBadge = isRetest ? `<span class="fc-retest-badge">🔁 Retest</span>` : "";
  const roundLabel  = isRetest
    ? `Reviewing ${s.retestQueue.length} card${s.retestQueue.length !== 1 ? "s" : ""} you missed`
    : `Round ${s.roundNumber} · ${masteredCount}/${totalCount} mastered`;

  const html = `
    <div class="fc-wrap">
      <div class="fc-top-bar">
        <div class="fc-progress-bar">
          <div class="fc-progress-fill" style="width:${pct}%"></div>
        </div>
        <p class="fc-counter">${pos} / ${total} ${retestBadge}</p>
      </div>
      <p class="fc-round-label">${roundLabel}</p>

      <div class="fc-mastery-row">
        <span class="fc-chip fc-chip-known">✅ Known: ${masteredCount}</span>
        <span class="fc-chip fc-chip-unknown">❌ To learn: ${totalCount - masteredCount}</span>
      </div>

      <div class="fc-card" id="fcCard" onclick="fcFlip()">
        <div class="fc-inner" id="fcInner">
          <div class="fc-front">
            <span class="fc-side-label">Question</span>
            <p class="fc-text">${card.q}</p>
            <span class="fc-hint">Click to reveal answer</span>
          </div>
          <div class="fc-back">
            <span class="fc-side-label">Answer</span>
            <p class="fc-text">${card.a}</p>
          </div>
        </div>
      </div>

      <div class="fc-verdict" id="fcVerdict" style="display:none;">
        <button class="fc-btn-unknown" onclick="fcMarkUnknown()" style="
          display:inline-flex; align-items:center; gap:8px;
          padding:14px 28px; border-radius:12px; border:2px solid rgba(248,113,113,0.4);
          background:rgba(248,113,113,0.1); color:#f87171;
          font-size:1rem; font-weight:600; cursor:pointer;
          transition:all 0.2s; min-width:150px; justify-content:center;
        ">
          <span>😕</span> Don't Know It
        </button>
        <button class="fc-btn-known" onclick="fcMarkKnown()" style="
          display:inline-flex; align-items:center; gap:8px;
          padding:14px 28px; border-radius:12px; border:2px solid rgba(74,222,128,0.4);
          background:rgba(74,222,128,0.1); color:#4ade80;
          font-size:1rem; font-weight:600; cursor:pointer;
          transition:all 0.2s; min-width:150px; justify-content:center;
        ">
          <span>💪</span> Know It!
        </button>
      </div>

      <p class="fc-kb-hint">Space = flip &nbsp;·&nbsp; ← Don't know &nbsp;·&nbsp; → Know it</p>
    </div>
  `;

  setOutput(html, true);
  setupFCSessionKeyboard();
}

// Flip
window.fcFlip = function() {
  const inner = document.getElementById("fcInner");
  if (!inner) return;
  const isFlipped = inner.classList.toggle("flipped");
  if (isFlipped) {
    const verdict = document.getElementById("fcVerdict");
    if (verdict) {
      verdict.style.display = "flex";
      verdict.style.gap = "16px";
      verdict.style.justifyContent = "center";
      verdict.style.marginTop = "20px";
      verdict.style.flexWrap = "wrap";
    }
  }
};

// Mark Known
window.fcMarkKnown = function() {
  const s = fcSession;
  const card = s.retest ? s.retestQueue[s.retestIndex] : s.queue[s.roundIndex];
  if (!card) return;
  if (!s.known.find(c => c.id === card.id)) s.known.push(card);
  if (s.retest) s.retestIndex++; else s.roundIndex++;
  animateCardOut("right", renderFCSession);
};

// Mark Unknown
window.fcMarkUnknown = function() {
  const s = fcSession;
  const card = s.retest ? s.retestQueue[s.retestIndex] : s.queue[s.roundIndex];
  if (!card) return;
  s.known = s.known.filter(c => c.id !== card.id);
  if (!s.unknown.find(c => c.id === card.id)) s.unknown.push(card);
  if (s.retest) s.retestIndex++; else s.roundIndex++;
  animateCardOut("left", renderFCSession);
};

// Swipe animation
function animateCardOut(direction, cb) {
  const card = document.getElementById("fcCard");
  if (!card) { cb(); return; }
  card.style.transition = "transform 0.25s ease, opacity 0.25s ease";
  card.style.transform = direction === "right" ? "translateX(120%) rotate(8deg)" : "translateX(-120%) rotate(-8deg)";
  card.style.opacity = "0";
  setTimeout(cb, 240);
}

// Keyboard controls
function setupFCSessionKeyboard() {
  document.onkeydown = (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === " ") { e.preventDefault(); fcFlip(); }
    else if (e.key === "ArrowRight") {
      const inner = document.getElementById("fcInner");
      if (inner?.classList.contains("flipped")) window.fcMarkKnown();
    }
    else if (e.key === "ArrowLeft") {
      const inner = document.getElementById("fcInner");
      if (inner?.classList.contains("flipped")) window.fcMarkUnknown();
    }
  };
}

// Shuffle
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// renderFlashcardUI kept for edit panel compatibility
function renderFlashcardUI(pairs) {
  currentFlashcards = pairs;
  startFlashcardSession(pairs);
}

// =========================
// QUIZ PARSER
// =========================
function parseQuiz(text) {
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const questions = [];
  const blocks = text.split(/\n(?=\d+[\.\)])/);
  for (let block of blocks) {
    block = block.trim(); if (!block) continue;
    const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 3) continue;
    const qText = lines[0].replace(/^\d+[\.\)]\s*/, "");
    const options = []; let correct = -1;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^([A-D])[\.\)]\s*(.+)/i);
      if (match) {
        const isCorrect = line.includes("✓") || line.toLowerCase().includes("(correct)") || line.includes("*") || line.match(/\[correct\]/i);
        options.push({ letter: match[1].toUpperCase(), text: match[2].replace(/[✓*]|\(correct\)|\[correct\]/gi, "").trim() });
        if (isCorrect) correct = options.length - 1;
      } else if (line.toLowerCase().includes("answer:") || line.toLowerCase().includes("correct:")) {
        const ans = line.match(/[A-D]/i);
        if (ans) correct = "ABCD".indexOf(ans[0].toUpperCase());
      }
    }
    if (options.length >= 2) questions.push({ q: qText, options, correct });
  }
  return questions;
}

// =========================
// QUIZ UI
// =========================
function renderQuiz(text) {
  const questions = parseQuiz(text);
  if (questions.length === 0) { setOutput(text); return; }
  currentQuizQuestions = questions;
  renderQuizUI(questions);
  showEditPanel("quiz");
}

function renderQuizUI(questions) {
  let html = `<div class="quiz-container" id="quizContainer">`;
  questions.forEach((q, qi) => {
    html += `<div class="quiz-question" id="qq-${qi}"><p class="q-text"><strong>Q${qi+1}.</strong> ${q.q}</p><div class="q-options">`;
    q.options.forEach((opt, oi) => {
      html += `<button class="q-opt" onclick="answerQ(${qi},${oi},${q.correct})" id="opt-${qi}-${oi}"><span class="opt-letter">${opt.letter}</span> ${opt.text}</button>`;
    });
    html += `</div><div class="q-feedback" id="fb-${qi}"></div></div>`;
  });
  html += `<div class="quiz-score" id="quizScore" style="display:none">
    <h3>Results</h3><p id="scoreText"></p>
    <div class="quiz-score-bar-wrap"><div class="quiz-score-bar" id="quizScoreBar"></div></div>
    <button onclick="resetQuiz()" class="tool-btn" style="margin-top:14px">↺ Try Again</button>
  </div></div>`;
  setOutput(html, true);
  window._quizData = { questions, answered: 0, correct: 0, total: questions.length };
}

window.answerQ = function(qi, oi, correct) {
  const qd = window._quizData; if (!qd) return;
  document.querySelectorAll(`#qq-${qi} .q-opt`).forEach(b => b.disabled = true);
  const chosen = document.getElementById(`opt-${qi}-${oi}`);
  const fb = document.getElementById(`fb-${qi}`);
  if (oi === correct) {
    chosen.classList.add("correct"); fb.textContent = "✅ Correct!"; fb.style.color = "#4ade80"; qd.correct++;
  } else {
    chosen.classList.add("wrong");
    fb.textContent = correct >= 0 ? `❌ Wrong — correct answer was ${qd.questions[qi].options[correct]?.letter}` : "❌ Wrong";
    fb.style.color = "#f87171";
    if (correct >= 0) { const cb = document.getElementById(`opt-${qi}-${correct}`); if (cb) cb.classList.add("correct"); }
  }
  qd.answered++;
  if (qd.answered === qd.total) {
    const pct = Math.round((qd.correct / qd.total) * 100);
    const scoreEl = document.getElementById("quizScore");
    document.getElementById("scoreText").textContent = `You got ${qd.correct} / ${qd.total} correct (${pct}%) ${pct >= 70 ? "🎉 Great job!" : "📖 Keep studying!"}`;
    const bar = document.getElementById("quizScoreBar");
    if (bar) { bar.style.width = pct + "%"; bar.style.background = pct >= 70 ? "#4ade80" : "#f87171"; }
    scoreEl.style.display = "block";
    scoreEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    awardXP(qd.correct * 5);
  }
};

window.resetQuiz = () => renderQuizUI(currentQuizQuestions);

// =========================
// TOOL BUTTONS
// =========================
document.getElementById("summarizeBtn").onclick = () => runTool(
  "Summarize all the key concepts and important points from this study material. Use headers, bold key terms, and bullet points.",
  "summarizeBtn"
);

document.getElementById("flashcardBtn").onclick = () => runToolFull(
  `Read ALL of the study material and create a flashcard for EVERY distinct fact, term, definition, concept, date, formula, process, and key point — no matter how many cards that takes. Do not stop early. Do not group things together to save cards.

STRICT RULES:
- One card per fact. If there are 40 facts, make 40 cards.
- Questions: specific and exam-style. E.g. "What is X?", "What causes Y?", "What year did Z?", "List the steps of W."
- Answers: MAX 1 sentence or 3–5 word list. Cut every unnecessary word.
- NO vague questions like "What is important about X?" — only testable specifics.
- NO filler, preamble, or commentary. Output ONLY the cards.

EXACT FORMAT — every card must follow this precisely:
Q: [question]
A: [answer]`,
  "flashcardBtn", renderFlashcards
);

document.getElementById("quizBtn").onclick = () => runToolFull(
  `Read ALL of the study material and generate a multiple choice question for every major concept, fact, term, and process — use as many questions as the material requires, minimum 10. Do not stop early.

STRICT RULES:
- One question per concept. Cover everything.
- Questions must be specific and testable, not vague.
- Wrong options must be plausible, not obviously silly.
- NO preamble or commentary. Output ONLY the questions.

EXACT FORMAT:
1. [Question text]
A. [option]
B. [option]
C. [option] (correct)
D. [option]

Mark the correct answer with (correct) after it.`,
  "quizBtn", renderQuiz
);

document.getElementById("studyPlanBtn").onclick = () => runTool(
  "Create a structured study plan for mastering this material. Break it into daily sessions with specific topics. Use bold headings and bullet points.",
  "studyPlanBtn"
);

document.getElementById("eli5Btn").onclick = () => runTool(
  "Explain the main concepts from this study material like I am 5 years old. Use simple words, fun analogies, and bullet points.",
  "eli5Btn"
);

document.getElementById("mnemonicBtn").onclick = () => runTool(
  "Create memory tricks, mnemonics, and acronyms to help remember the key concepts. Use bold for the mnemonics.",
  "mnemonicBtn"
);

document.getElementById("practiceTestBtn").onclick = () => runToolFull(
  `Read ALL of the study material and generate a comprehensive practice test covering every topic — use as many questions as needed, minimum 15. Prioritize the most testable and important facts.

STRICT RULES:
- Cover every section and topic in the material.
- Questions must be specific, not vague or generic.
- Wrong options must be plausible.
- NO preamble or commentary. Output ONLY the questions.

EXACT FORMAT:
1. [Question text]
A. [option]
B. [option]
C. [option] (correct)
D. [option]

Mark the correct answer with (correct) after it.`,
  "practiceTestBtn", renderQuiz
);

document.getElementById("weaknessBtn").onclick = () => runTool(
  "Identify the 3-5 most complex or tricky concepts in this material. Use bold headers for each concept, explain why it is difficult, and give tips for mastering it.",
  "weaknessBtn"
);

// =========================
// CHAT
// =========================
document.getElementById("sendBtn").onclick = sendMessage;
document.getElementById("chatInput").addEventListener("keydown", (e) => { if (e.key === "Enter") sendMessage(); });

async function sendMessage() {
  const input = document.getElementById("chatInput");
  const msg = input.value.trim();
  if (!msg || !currentSubject) return;
  addMessage(msg, "user"); input.value = "";
  const typingDiv = addMessage("...", "ai");
  const reply = await askAI(msg);
  const clean = reply.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  typingDiv.innerHTML = renderMarkdown(clean);
  currentSubject.chatHistory.push({ role: "user", content: msg });
  currentSubject.chatHistory.push({ role: "ai", content: clean });
  awardXP(5); save();
}

function addMessage(text, type) {
  const div = document.createElement("div");
  div.className = `chat-bubble ${type}`;
  if (type === "ai") div.innerHTML = renderMarkdown(text); else div.textContent = text;
  const box = document.getElementById("chatMessages");
  box.appendChild(div); box.scrollTop = box.scrollHeight;
  return div;
}

function renderChat() {
  const box = document.getElementById("chatMessages"); box.innerHTML = "";
  if (!currentSubject) return;
  currentSubject.chatHistory.forEach(m => addMessage(m.content, m.role === "user" ? "user" : "ai"));
}

// =========================
// FILE LIST
// =========================
function renderFiles() {
  const list = document.getElementById("fileList"); list.innerHTML = "";
  if (!currentSubject) return;
  if (!currentSubject.files.length) { list.innerHTML = `<li style="opacity:0.4">No files yet.</li>`; return; }
  currentSubject.files.forEach(f => {
    const li = document.createElement("li"); li.textContent = "📄 " + f.name; list.appendChild(li);
  });
  document.getElementById("subjectSubtitle").innerText = `${currentSubject.files.length} file(s) uploaded`;
}

// =========================
// XP & LEVELS
// =========================
function awardXP(amount) {
  if (!currentSubject) return;
  currentSubject.xp = (currentSubject.xp || 0) + amount;
  const newLevel = Math.floor(currentSubject.xp / 100) + 1;
  if (newLevel > currentSubject.level) {
    currentSubject.level = newLevel;
    confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
  }
  document.getElementById("xp").innerText = currentSubject.xp;
  document.getElementById("level").innerText = currentSubject.level;
  save();
}

// =========================
// THEME TOGGLE
// =========================
const themeBtn = document.getElementById("themeToggle");
const savedTheme = localStorage.getItem("theme") || "dark";
if (savedTheme === "light") {
  document.body.classList.add("light");
  if (themeBtn) themeBtn.textContent = "🌞 Light Mode";
} else {
  if (themeBtn) themeBtn.textContent = "🌙 Dark Mode";
}

if (themeBtn) {
  themeBtn.onclick = () => {
    document.body.classList.toggle("light");
    document.documentElement.classList.toggle("light");
    const isLight = document.body.classList.contains("light");
    themeBtn.textContent = isLight ? "🌞 Light Mode" : "🌙 Dark Mode";
    localStorage.setItem("theme", isLight ? "light" : "dark");
  };
}

// =========================
// RESET API KEY
// =========================
document.getElementById("resetKeyBtn")?.addEventListener("click", () => {
  const newKey = prompt("Enter new Claude API key:");
  if (newKey && newKey.trim()) {
    CLAUDE_API_KEY = newKey.trim();
    localStorage.setItem("claude_api_key", CLAUDE_API_KEY);
    alert("API key updated!");
  }
});

// =========================
// MUSIC TOGGLE
// =========================
const music = document.getElementById("studyMusic");
document.getElementById("musicToggle").onclick = () => {
  if (musicPlaying) { music.pause(); document.getElementById("musicToggle").textContent = "🎵 Music"; }
  else { music.play().catch(() => {}); document.getElementById("musicToggle").textContent = "🔇 Stop Music"; }
  musicPlaying = !musicPlaying;
};

// =========================
// POMODORO TIMER
// =========================
function formatTime(s) { return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`; }
function updateTimerDisplay() { document.getElementById("timer").textContent = formatTime(timerSeconds); }

document.getElementById("startTimer").onclick = () => {
  if (timerRunning) return; timerRunning = true;
  timerInterval = setInterval(() => {
    timerSeconds--; updateTimerDisplay();
    if (timerSeconds <= 0) {
      clearInterval(timerInterval); timerRunning = false; timerSeconds = 5 * 60; updateTimerDisplay();
      confetti({ particleCount: 80, spread: 60 }); alert("Pomodoro done! Take a 5-minute break.");
    }
  }, 1000);
};
document.getElementById("pauseTimer").onclick = () => { clearInterval(timerInterval); timerRunning = false; };
document.getElementById("resetTimer").onclick = () => { clearInterval(timerInterval); timerRunning = false; timerSeconds = 25 * 60; updateTimerDisplay(); };
