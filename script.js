// =========================
// CLAUDE API (FIXED)
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

// ✅ WORKING MODEL
const CLAUDE_MODEL = "claude-3-5-sonnet-latest";

async function askAI(prompt, systemPrompt) {
  if (!currentSubject) return "Select a subject first.";
  if (!currentSubject.chunks.length) return "No study material uploaded yet.";

  const chunks = getRelevantChunks(prompt);

  const context = chunks
    .filter(c => c.text && c.text.length > 20)
    .map(c => c.text.split(" ").slice(0, 180).join(" "))
    .join("\n\n");

  const system = systemPrompt || `
You are a strict study assistant.
Only use provided material.
If missing, say "Not found in your study material."
Be concise.
`;

  const fullPrompt = `
SUBJECT: ${currentSubject.name}

STUDY MATERIAL:
${context}

QUESTION:
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
        max_tokens: 500,
        system,
        messages: [
          { role: "user", content: fullPrompt }
        ]
      })
    });

    const data = await res.json();

    // 🔥 REAL ERROR OUTPUT
    if (!res.ok) {
      console.error("Claude API ERROR:", data);
      return data?.error?.message || "API request failed.";
    }

    const text = data?.content?.[0]?.text?.trim();

    if (!text) return "AI returned no response.";

    return text;

  } catch (err) {
    console.error("NETWORK ERROR:", err);
    return "Network error (check key / CORS / connection).";
  }
}

// =========================
// STATE
// =========================
let subjects              = JSON.parse(localStorage.getItem("subjects")) || [];
let currentSubject        = null;
let timerInterval         = null;
let timerSeconds          = 25 * 60;
let timerRunning          = false;
let musicPlaying          = false;
let currentFlashcards     = [];
let currentQuizQuestions  = [];
let currentMode           = null;

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
  subjects.push({ id: Date.now(), name: name.trim(), files: [], chunks: [], chatHistory: [], xp: 0, level: 1, streak: 0 });
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
    document.getElementById("subjectTitle").innerText = "Select a Subject";
    document.getElementById("subjectSubtitle").innerText = "Upload study guides to begin.";
    document.getElementById("fileList").innerHTML = "";
    document.getElementById("chatMessages").innerHTML = "";
    document.getElementById("output").innerHTML = "";
    document.getElementById("xp").innerText = "0";
    document.getElementById("level").innerText = "1";
    hideEditPanel();
  }
  save();
  renderSubjects();
}

// =========================
// LOAD SUBJECT
// =========================
function loadSubject(id) {
  currentSubject = subjects.find(s => s.id === id);
  document.getElementById("subjectTitle").innerText = currentSubject.name;
  document.getElementById("subjectSubtitle").innerText = `${currentSubject.files.length} file(s) uploaded`;
  document.getElementById("xp").innerText = currentSubject.xp || 0;
  document.getElementById("level").innerText = currentSubject.level || 1;
  renderFiles();
  renderChat();
  renderSubjects();
  hideEditPanel();
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
    .slice(0, 1); // ✅ ONLY 1 CHUNK (massive cost reduction)
}

// Returns context sampled evenly across ALL files so no document is ignored.
function getAllChunksContext() {
  if (!currentSubject || !currentSubject.chunks.length) return "";

  const MAX_CHARS = 80000;

  // Group chunks by source file
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
// CLAUDE API (ASK AI)
// =========================

async function askAI(prompt, systemPrompt) {

  if (!currentSubject)
    return "Select a subject first.";

  if (!currentSubject.chunks.length)
    return "No study material uploaded yet. Add files first.";

  const chunks = getRelevantChunks(prompt);

  const context = chunks
    .filter(c => c.text && c.text.length > 20)
    .map(c =>
      c.text.split(" ").slice(0, 180).join(" ")
    )
    .join("\n\n");

  const system = systemPrompt || `
You are a focused study assistant.
Only use the provided study material.
If the answer is not in the material, say:
"Not found in your study material."
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

    const res = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": CLAUDE_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 500,
          system,
          messages: [
            {
              role: "user",
              content: fullPrompt
            }
          ]
        })
      }
    );

    const data = await res.json();

    console.log("Claude response:", data);

    if (!res.ok) {
      return `API Error: ${data?.error?.message || "Unknown error"}`;
    }

    return data?.content?.[0]?.text?.trim() || "No response.";

  } catch (err) {
    console.error("Claude error:", err);
    return `Network/API error: ${err.message}`;
  }
}


// =========================
// CLAUDE API (FULL CONTEXT)
// =========================

async function askAIFull(prompt, systemPrompt) {

  if (!currentSubject)
    return "Select a subject first.";

  if (!currentSubject.chunks.length)
    return "No study material uploaded yet. Add files first.";

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

    const res = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": CLAUDE_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 1500,
          system,
          messages: [
            {
              role: "user",
              content: fullPrompt
            }
          ]
        })
      }
    );

    const data = await res.json();

    console.log("Claude full response:", data);

    if (!res.ok) {
      return `API Error: ${data?.error?.message || "Unknown error"}`;
    }

    return data?.content?.[0]?.text?.trim() || "No response.";

  } catch (err) {
    console.error("Claude full error:", err);
    return `Network/API error: ${err.message}`;
  }
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
      if (pairs.length > 0) { currentFlashcards = pairs; renderFlashcardUI(pairs); typingDiv.innerHTML = `✅ Done! Updated to ${pairs.length} cards.`; }
      else typingDiv.innerHTML = renderMarkdown(text);
    };
  } else {
    const currentData = currentQuizQuestions.map((q, i) =>
      `${i+1}. ${q.q}\n${q.options.map((o, oi) => `${o.letter}. ${o.text}${oi===q.correct?" (correct)":""}`).join("\n")}`
    ).join("\n\n");
    formatPrompt = `Current quiz:\n${currentData}\n\nUser request: ${msg}\n\nRespond ONLY with the full updated set in this EXACT format:\n1. [Question]\nA. [option]\nB. [option]\nC. [option] (correct)\nD. [option]`;
    renderer = (text) => {
      const qs = parseQuiz(text);
      if (qs.length > 0) { currentQuizQuestions = qs; renderQuizUI(qs); typingDiv.innerHTML = `✅ Done! Updated to ${qs.length} questions.`; }
      else typingDiv.innerHTML = renderMarkdown(text);
    };
  }

  try {
    const editSystem = "You are a study assistant helping edit flashcards or quiz questions. Follow the exact format. Output ONLY the cards/questions, no preamble.";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: `${editSystem}\n\n${formatPrompt}` }] }] })
      }
    );
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "No response.";
    renderer(text);
  } catch (err) {
    typingDiv.innerHTML = "Error: " + err.message;
  }
}

// =========================
// ADD EDIT MESSAGE
// =========================
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
// FLASHCARD UI
// =========================
function renderFlashcards(text) {
  const pairs = parseFlashcards(text);
  if (pairs.length === 0) { setOutput(text); return; }
  currentFlashcards = pairs;
  renderFlashcardUI(pairs);
  showEditPanel("flashcard");
}

function renderFlashcardUI(pairs) {
  let idx = 0, flipped = false;

  function cardHTML(i) {
    const p = pairs[i];
    const pct = ((i + 1) / pairs.length) * 100;
    return `<div class="fc-wrap">
      <div class="fc-top-bar">
        <div class="fc-progress-bar"><div class="fc-progress-fill" style="width:${pct}%"></div></div>
        <p class="fc-counter">${i + 1} / ${pairs.length}</p>
      </div>
      <div class="fc-nav">
        <button class="fc-nav-btn" onclick="fcPrev()" ${i === 0 ? "disabled" : ""}>← Prev</button>
        <div class="fc-card" id="fcCard" onclick="toggleFlip()">
          <div class="fc-inner" id="fcInner">
            <div class="fc-front">
              <span class="fc-side-label">Question</span>
              <p class="fc-text">${p.q}</p>
              <span class="fc-hint">Click to flip</span>
            </div>
            <div class="fc-back">
              <span class="fc-side-label">Answer</span>
              <p class="fc-text">${p.a}</p>
            </div>
          </div>
        </div>
        <button class="fc-nav-btn" onclick="fcNext()" ${i === pairs.length - 1 ? "disabled" : ""}>Next →</button>
      </div>
      <div class="fc-actions">
        <button class="fc-action-btn" onclick="fcShuffle()">🔀 Shuffle</button>
        <button class="fc-action-btn" onclick="fcRestart()">↺ Restart</button>
      </div>
    </div>`;
  }

  setOutput(cardHTML(idx), true);
  setupFCKeyboard();

  window.toggleFlip = () => { flipped = !flipped; document.getElementById("fcInner")?.classList.toggle("flipped", flipped); };
  window.fcNext = () => { if (idx < pairs.length - 1) { idx++; flipped = false; setOutput(cardHTML(idx), true); setupFCKeyboard(); } };
  window.fcPrev = () => { if (idx > 0) { idx--; flipped = false; setOutput(cardHTML(idx), true); setupFCKeyboard(); } };
  window.fcShuffle = () => {
    for (let i = pairs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pairs[i], pairs[j]] = [pairs[j], pairs[i]]; }
    idx = 0; flipped = false; setOutput(cardHTML(idx), true); setupFCKeyboard();
  };
  window.fcRestart = () => { idx = 0; flipped = false; setOutput(cardHTML(idx), true); setupFCKeyboard(); };
}

function setupFCKeyboard() {
  document.onkeydown = (e) => {
    // Never hijack keypresses when the user is typing in any input or textarea
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === "ArrowRight") window.fcNext?.();
    else if (e.key === "ArrowLeft") window.fcPrev?.();
    else if (e.key === " ") { e.preventDefault(); window.toggleFlip?.(); }
  };
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
async function runTool(prompt, btnId, renderer) {
  if (!currentSubject) { alert("Select a subject first."); return; }
  if (!currentSubject.chunks.length) { alert("Upload study files first."); return; }
  const btn = document.getElementById(btnId);
  btn.disabled = true; btn.classList.add("loading");
  document.getElementById("output").innerHTML = `<p style="opacity:0.5">⏳ Thinking...</p>`;
  hideEditPanel();
  const result = await askAI(prompt);
  renderer ? renderer(result) : setOutput(result);
  awardXP(10);
  btn.disabled = false; btn.classList.remove("loading");
}

// runToolFull uses ALL chunks — for exhaustive generation tools
async function runToolFull(prompt, btnId, renderer) {
  if (!currentSubject) { alert("Select a subject first."); return; }
  if (!currentSubject.chunks.length) { alert("Upload study files first."); return; }
  const btn = document.getElementById(btnId);
  btn.disabled = true; btn.classList.add("loading");
  document.getElementById("output").innerHTML = `<p style="opacity:0.5">⏳ Generating from full material...</p>`;
  hideEditPanel();
  const result = await askAIFull(prompt);
  renderer ? renderer(result) : setOutput(result);
  awardXP(10);
  btn.disabled = false; btn.classList.remove("loading");
}

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
if (localStorage.getItem("theme") === "light") {
  document.body.classList.add("light");
  themeBtn.textContent = "🌞 Light Mode";
} else {
  themeBtn.textContent = "🌙 Dark Mode";
}
themeBtn.onclick = () => {
  document.body.classList.toggle("light");
  const isLight = document.body.classList.contains("light");
  themeBtn.textContent = isLight ? "🌞 Light Mode" : "🌙 Dark Mode";
  localStorage.setItem("theme", isLight ? "light" : "dark");
};

// =========================
// RESET API KEY
// =========================
document.getElementById("resetKeyBtn")?.addEventListener("click", () => {
  const newKey = prompt("Enter new Gemini API key:");
  if (newKey && newKey.trim()) {
    GEMINI_API_KEY = newKey.trim();
    localStorage.setItem("gemini_api_key", GEMINI_API_KEY);
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

// =========================
// INIT
// =========================
renderSubjects();
