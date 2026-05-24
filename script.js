
// =========================
// GEMINI CONFIG
// =========================

const GEMINI_API_KEY = "AIzaSyAsYbE0FoMeMWbGIrTAr_sZbM16wKYr7xk";
const GEMINI_MODEL = "gemini-1.5-flash";

// =========================
// STATE
// =========================

let subjects = JSON.parse(localStorage.getItem("subjects")) || [];
let currentSubject = null;
let currentPDF = null;

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
    selectedFile: null,
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
// LOAD SUBJECT (NEW AI INSTANCE)
// =========================

function loadSubject(id) {

  currentSubject = subjects.find(s => s.id === id);

  document.getElementById("subjectTitle").innerText =
    currentSubject.name;

  renderFiles();
  renderChat();
  renderPDFList();
}

// =========================
// FILE UPLOAD
// =========================

document.getElementById("fileInput").onchange = async (e) => {

  if (!currentSubject) return;

  const files = Array.from(e.target.files);

  for (let file of files) {

    const text = await extractText(file);

    const chunks = chunkText(text, file.name);

    currentSubject.files.push({
      name: file.name,
      text
    });

    currentSubject.chunks.push(...chunks);
  }

  save();
  renderFiles();
};

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
// SMART RETRIEVAL
// =========================

function getRelevantChunks(question) {

  return currentSubject.chunks
    .map(c => {

      let score = 0;

      const words = question.toLowerCase().split(" ");
      const text = c.text.toLowerCase();

      words.forEach(w => {
        if (text.includes(w)) score += 2;
      });

      return { ...c, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

// =========================
// GEMINI AI (PER SUBJECT)
// =========================

async function askAI(prompt) {

  if (!currentSubject) return "Select a subject.";

  const chunks = getRelevantChunks(prompt);

  const context = chunks.map(c => c.text).join("\n\n");

  const sources = chunks.map(c =>
    `${c.source} | Page ${c.page}`
  ).join("\n");

  try {

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

ONLY use the context below.

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

    let text = "";

    if (data?.candidates?.length > 0) {
      const c = data.candidates[0];
      text = c?.content?.parts?.map(p => p.text).join("") || "";
    }

    if (!text) return "No response generated.";

    return `
${text}

-------------------
📚 SOURCES:
${sources}
    `;

  } catch (err) {
    console.error(err);
    return "AI error.";
  }
}

// =========================
// CHAT (PER SUBJECT)
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
// FILE LIST + PDF VIEWER
// =========================

function renderFiles() {

  const list = document.getElementById("fileList");
  list.innerHTML = "";

  currentSubject.files.forEach((f, i) => {

    const li = document.createElement("li");

    li.textContent = f.name;

    li.onclick = () => openPDF(i);

    list.appendChild(li);
  });
}

function openPDF(index) {

  const file = currentSubject.files[index];

  const viewer = document.getElementById("pdfViewer");

  viewer.textContent = file.text;

  currentPDF = file;
}

// =========================
// EXAM GENERATOR (NEW FEATURE)
// =========================

document.getElementById("examBtn").onclick = async () => {

  const chunks = currentSubject.chunks.slice(0, 10);

  const context = chunks.map(c => c.text).join("\n\n");

  const res = await askAI(`
Create a full exam:

- Multiple choice questions
- Short answer
- Essay question

Based ONLY on:

${context}
  `);

  document.getElementById("output").textContent = res;
};

// =========================
// INIT
// =========================

renderSubjects();
