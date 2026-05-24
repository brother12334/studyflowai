// =========================
// STUDYFLOW AI - STABLE GEMINI VERSION (FIXED)
// =========================

const GEMINI_API_KEY = "AIzaSyAsYbE0FoMeMWbGIrTAr_sZbM16wKYr7xk";
const GEMINI_MODEL = "gemini-1.5-flash";

// =========================
// STATE
// =========================

let subjects = JSON.parse(localStorage.getItem("subjects")) || [];
let currentSubject = null;

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
  if (!name) return;

  subjects.push({
    id: Date.now(),
    name,
    files: [],
    chunks: [],
    chatHistory: [],
    xp: 0,
    level: 1
  });

  save();
  renderSubjects();
};

// =========================
// RENDER SUBJECTS
// =========================

function renderSubjects() {

  const list = document.getElementById("subjectList");
  list.innerHTML = "";

  subjects.forEach(sub => {

    const div = document.createElement("div");
    div.className = "subject-card";

    div.innerHTML = `
      <h3>${sub.name}</h3>
      <p>${sub.files.length} files</p>
    `;

    div.onclick = () => loadSubject(sub.id);

    list.appendChild(div);
  });
}

// =========================
// LOAD SUBJECT
// =========================

function loadSubject(id) {

  currentSubject = subjects.find(s => s.id === id);

  document.getElementById("subjectTitle").innerText =
    currentSubject.name;

  renderFiles();
  renderChat();
}

// =========================
// FILE UPLOAD
// =========================

document.getElementById("fileInput").onchange = handleFiles;

async function handleFiles(e) {

  if (!currentSubject) return alert("Select a subject first");

  const files = Array.from(e.target.files);

  for (let file of files) {

    const text = await extractText(file);

    currentSubject.files.push({
      name: file.name,
      text
    });

    const chunks = chunkText(text, file.name);

    currentSubject.chunks.push(...chunks);
  }

  save();
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
      text += "\n" + content.items.map(i => i.str).join(" ");
    }

    return text;
  }

  return "";
}

// =========================
// CHUNKING
// =========================

function chunkText(text, fileName, size = 1200) {

  const chunks = [];
  let page = 1;

  for (let i = 0; i < text.length; i += size) {

    chunks.push({
      text: text.slice(i, i + size),
      source: fileName,
      page
    });

    page++;
  }

  return chunks;
}

// =========================
// SMART RETRIEVAL (FIXED LIMIT)
// =========================

function getRelevantChunks(question) {

  if (!currentSubject) return [];

  const words = question.toLowerCase().split(" ");

  return currentSubject.chunks
    .map(c => {

      let score = 0;
      const text = c.text.toLowerCase();

      for (let w of words) {
        if (text.includes(w)) score += 2;
      }

      return { ...c, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3); // 🔥 IMPORTANT FIX: reduced from 4 → 3
}

// =========================
// GEMINI RESPONSE PARSER (SAFE)
// =========================

function extractGeminiText(data) {

  if (data?.promptFeedback?.blockReason) {
    return `Blocked: ${data.promptFeedback.blockReason}`;
  }

  const parts = data?.candidates?.[0]?.content?.parts;

  if (!parts || parts.length === 0) {
    console.log("FULL GEMINI RESPONSE:", data);
    return null;
  }

  return parts.map(p => p.text || "").join("").trim();
}

// =========================
// GEMINI AI CORE (FIXED + STABLE)
// =========================

async function askAI(prompt) {

  if (!currentSubject) return "Select a subject first.";

  try {

    const chunks = getRelevantChunks(prompt);

    // 🔥 HARD LIMIT context size (THIS FIXES YOUR ISSUE)
    const context = chunks
      .filter(c => c.text && c.text.length > 20)
      .slice(0, 3) // 🔥 smaller = more stable
      .map(c => c.text.slice(0, 600)) // 🔥 strict cap
      .join("\n\n");

    const sources = chunks.map(c =>
      `${c.source} | Page ${c.page}`
    ).join("\n");

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
You are a strict study assistant.

ONLY use the material below.

If missing say:
"Not found in study material."

---

SUBJECT:
${currentSubject.name}

CONTEXT:
${context}

QUESTION:
${prompt}
              `
            }]
          }]
        })
      }
    );

    const data = await res.json();

    console.log("GEMINI DEBUG:", data);

    const text = extractGeminiText(data);

    // 🔥 FINAL SAFETY FALLBACK (NO MORE UNDEFINED)
    if (!text || text.trim().length === 0) {
      return "AI returned empty response. Try a shorter or clearer question.";
    }

    return `
${text}

-------------------
📚 SOURCES:
${sources}
    `;

  } catch (err) {
    console.error("AI ERROR:", err);
    return "AI error (network/API issue).";
  }
}

// =========================
// CHAT SYSTEM
// =========================

document.getElementById("sendBtn").onclick = sendMessage;

async function sendMessage() {

  const input = document.getElementById("chatInput");
  const msg = input.value.trim();

  if (!msg || !currentSubject) return;

  addMessage(msg, "user");

  input.value = "";

  const reply = await askAI(msg);

  addMessage(reply, "ai");

  currentSubject.chatHistory.push({ role: "user", content: msg });
  currentSubject.chatHistory.push({ role: "ai", content: reply });

  save();
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
// FILE LIST
// =========================

function renderFiles() {

  const list = document.getElementById("fileList");
  list.innerHTML = "";

  if (!currentSubject) return;

  currentSubject.files.forEach(f => {

    const li = document.createElement("li");
    li.textContent = f.name;

    list.appendChild(li);
  });
}

// =========================
// EXAM GENERATOR
// =========================

document.getElementById("examBtn").onclick = async () => {

  const chunks = currentSubject.chunks.slice(0, 6);

  const context = chunks.map(c => c.text).join("\n\n");

  const res = await askAI(`
Create a full exam based ONLY on this material:

${context}

Include:
- multiple choice
- short answer
- essay questions
  `);

  document.getElementById("output").textContent = res;
};

// =========================
// INIT
// =========================

renderSubjects();
