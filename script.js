
// =========================
// STUDYFLOW AI - ADVANCED RAG VERSION
// =========================

// =========================
// CONFIG
// =========================

const GEMINI_API_KEY = "AIzaSyB6ckEA11Oqj02iB0r5FujXgiLF9wFa8Kg";
const GEMINI_MODEL = "gemini-1.5-flash";

// =========================
// STATE
// =========================

let subjects =
  JSON.parse(localStorage.getItem("subjects")) || [];

let currentSubject = null;

// =========================
// SAVE
// =========================

function saveSubjects() {
  localStorage.setItem("subjects", JSON.stringify(subjects));
}

// =========================
// CHUNKING (with page tracking)
// =========================

function chunkText(text, fileName, chunkSize = 1200) {

  const chunks = [];
  let page = 1;

  for (let i = 0; i < text.length; i += chunkSize) {

    const chunkText = text.slice(i, i + chunkSize);

    chunks.push({
      text: chunkText,
      source: fileName,
      page: page
    });

    page++;
  }

  return chunks;
}

// =========================
// SEMANTIC SCORING (HYBRID)
// =========================

function scoreChunk(chunk, question) {

  const qWords = question.toLowerCase().split(" ");
  const text = chunk.text.toLowerCase();

  let score = 0;

  // keyword match
  qWords.forEach(word => {
    if (text.includes(word)) score += 2;
  });

  // density boost (semantic approximation)
  const overlapRatio =
    qWords.filter(w => text.includes(w)).length / qWords.length;

  score += overlapRatio * 5;

  return score;
}

// =========================
// RETRIEVE RELEVANT CHUNKS
// =========================

function getRelevantChunks(question, chunks, limit = 6) {

  return chunks
    .map(c => ({
      ...c,
      score: scoreChunk(c, question)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// =========================
// SUBJECTS
// =========================

function renderSubjects() {

  const list = document.getElementById("subjectList");
  list.innerHTML = "";

  subjects.forEach(subject => {

    const card = document.createElement("div");
    card.className = "subject-card";

    card.innerHTML = `
      <h3>${subject.name}</h3>
      <p>${subject.files.length} files</p>
      <p>XP: ${subject.xp}</p>
    `;

    card.onclick = () => loadSubject(subject.id);

    list.appendChild(card);
  });
}

document.getElementById("newSubjectBtn").onclick = () => {

  const name = prompt("Enter subject name:");
  if (!name) return;

  subjects.push({
    id: Date.now(),
    name,
    files: [],
    extractedText: "",
    chunks: [], // IMPORTANT
    chatHistory: [],
    xp: 0,
    level: 1,
    streak: 0
  });

  saveSubjects();
  renderSubjects();
};

// =========================
// LOAD SUBJECT
// =========================

function loadSubject(id) {

  currentSubject = subjects.find(s => s.id === id);

  document.getElementById("subjectTitle").innerText =
    currentSubject.name;

  document.getElementById("xp").innerText =
    currentSubject.xp;

  document.getElementById("level").innerText =
    currentSubject.level;

  document.getElementById("streak").innerText =
    currentSubject.streak;

  renderFiles();
  renderChat();
}

// =========================
// FILE UPLOAD
// =========================

document.getElementById("fileInput").onchange = handleFiles;

async function handleFiles(e) {

  if (!currentSubject)
    return alert("Select a subject first");

  const files = Array.from(e.target.files);

  for (let file of files) {

    const text = await extractText(file);

    currentSubject.files.push({
      name: file.name,
      text
    });

    currentSubject.extractedText += "\n\n" + text;

    // 🧠 NEW: structured chunking with page tracking
    const newChunks = chunkText(text, file.name);

    currentSubject.chunks.push(...newChunks);
  }

  saveSubjects();
  renderFiles();
}

// =========================
// TEXT EXTRACTION
// =========================

async function extractText(file) {

  if (file.type === "text/plain") {
    return await file.text();
  }

  if (file.type === "application/pdf") {

    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

    let text = "";

    for (let i = 1; i <= pdf.numPages; i++) {

      const page = await pdf.getPage(i);
      const content = await page.getTextContent();

      text += content.items.map(i => i.str).join(" ");
    }

    return text;
  }

  if (file.name.endsWith(".docx")) {

    const buffer = await file.arrayBuffer();
    const result =
      await mammoth.extractRawText({ arrayBuffer: buffer });

    return result.value;
  }

  if (file.type.startsWith("image/")) {

    const result = await Tesseract.recognize(file);
    return result.data.text;
  }

  return "";
}

// =========================
// AI CORE (WITH SOURCES + PAGE TRACKING)
// =========================

async function askAI(prompt, mode = "normal") {

  if (!currentSubject)
    return "Select a subject first.";

  try {

    const chunks = getRelevantChunks(
      prompt,
      currentSubject.chunks
    );

    const context = chunks.map(c => c.text).join("\n\n");

    const sourceMap = chunks.map(c =>
      `Source: ${c.source} | Page: ${c.page}`
    ).join("\n");

    const systemMode =
      mode === "exam"
        ? `
YOU ARE IN EXAM PREDICTION MODE.

Based on the material:
- Predict likely exam questions
- Identify key test topics
- Highlight what teachers focus on most
- Give a practice exam at the end
        `
        : `
You are a strict study assistant.
Only use the provided material.
If missing, say: "Not found in study guides."
        `;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{
              text: `
${systemMode}

SUBJECT:
${currentSubject.name}

RELEVANT CONTEXT:
${context}

SOURCE MAP:
${sourceMap}

QUESTION:
${prompt}
              `
            }]
          }]
        })
      }
    );

    const data = await res.json();

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    // =========================
    // RETURN WITH SOURCE HIGHLIGHTING
    // =========================

    return `
${text}

------------------------
📚 SOURCES USED:
${sourceMap}
    `;

  } catch (err) {
    console.error(err);
    return "AI error.";
  }
}

// =========================
// CHAT
// =========================

document.getElementById("sendBtn").onclick = sendMessage;

async function sendMessage() {

  const input = document.getElementById("chatInput");
  const msg = input.value.trim();

  if (!msg) return;

  addMessage(msg, "user");
  input.value = "";

  const reply = await askAI(msg);

  addMessage(reply, "ai");

  currentSubject.chatHistory.push({ role: "user", content: msg });
  currentSubject.chatHistory.push({ role: "ai", content: reply });

  saveSubjects();
}

function addMessage(text, type) {

  const div = document.createElement("div");
  div.className = `chat-bubble ${type}`;
  div.textContent = text;

  document.getElementById("chatMessages").appendChild(div);
}

function renderChat() {

  const box = document.getElementById("chatMessages");
  box.innerHTML = "";

  if (!currentSubject) return;

  currentSubject.chatHistory.forEach(m => {
    addMessage(m.content, m.role === "user" ? "user" : "ai");
  });
}

// =========================
// TOOLS
// =========================

function runTool(prompt, mode = "normal") {

  askAI(prompt, mode)
    .then(res => {
      document.getElementById("output").textContent = res;
    });
}

// normal tools
document.getElementById("summarizeBtn").onclick = () =>
  runTool("Summarize notes");

document.getElementById("flashcardBtn").onclick = () =>
  runTool("Generate flashcards");

document.getElementById("quizBtn").onclick = () => {
  runTool("Create quiz");
  confetti();
};

document.getElementById("eli5Btn").onclick = () =>
  runTool("Explain like I'm 5");

document.getElementById("mnemonicBtn").onclick = () =>
  runTool("Create mnemonics");

document.getElementById("practiceTestBtn").onclick = () =>
  runTool("Create practice test");

document.getElementById("weaknessBtn").onclick = () =>
  runTool("Find weak topics");

// 🎯 EXAM PREDICTION MODE
document.getElementById("studyPlanBtn").onclick = () => {
  runTool("Predict exam questions and create study plan", "exam");
};

// =========================
// SEARCH
// =========================

document.getElementById("searchInput").oninput = (e) => {

  const val = e.target.value.toLowerCase();

  document.querySelectorAll(".subject-card").forEach(c => {
    c.style.display =
      c.innerText.toLowerCase().includes(val)
        ? "block"
        : "none";
  });
};

// =========================
// DRAG & DROP
// =========================

const dropZone = document.getElementById("dropZone");

dropZone.addEventListener("dragover", e => {
  e.preventDefault();
  dropZone.classList.add("dragging");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragging");
});

dropZone.addEventListener("drop", e => {
  e.preventDefault();
  dropZone.classList.remove("dragging");

  handleFiles({
    target: { files: e.dataTransfer.files }
  });
});

// =========================
// INIT
// =========================

renderSubjects();
