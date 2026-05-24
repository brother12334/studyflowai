// =========================
// STUDYFLOW AI - GEMINI VERSION
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
    chatHistory: [],
    xp: 0,
    level: 1,
    streak: 0,
    missedTopics: []
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
// FILE HANDLING
// =========================

document.getElementById("fileInput").onchange = handleFiles;

async function handleFiles(e) {

  if (!currentSubject) {
    alert("Select a subject first");
    return;
  }

  const files = Array.from(e.target.files);

  for (let file of files) {

    const text = await extractText(file);

    currentSubject.files.push({
      name: file.name,
      text
    });

    currentSubject.extractedText += "\n\n" + text;
  }

  saveSubjects();
  renderFiles();
}

// =========================
// TEXT EXTRACTION
// =========================

async function extractText(file) {

  // TXT
  if (file.type === "text/plain") {
    return await file.text();
  }

  // PDF
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

  // DOCX
  if (file.name.endsWith(".docx")) {
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value;
  }

  // IMAGE OCR
  if (file.type.startsWith("image/")) {
    const result = await Tesseract.recognize(file);
    return result.data.text;
  }

  return "";
}

// =========================
// RENDER FILES
// =========================

function renderFiles() {

  const list = document.getElementById("fileList");
  list.innerHTML = "";

  if (!currentSubject) return;

  currentSubject.files.forEach(file => {
    const li = document.createElement("li");
    li.textContent = file.name;
    list.appendChild(li);
  });
}

// =========================
// GEMINI API
// =========================

async function askAI(prompt) {

  if (!currentSubject) {
    return "Please select a subject first.";
  }

  try {

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{
                text: `
You are a strict study assistant.

ONLY use the uploaded study material.
If missing, say:
"That topic was not found in your uploaded study guides."

---

SUBJECT:
${currentSubject.name}

STUDY MATERIAL:
${currentSubject.extractedText}

---

QUESTION:
${prompt}
                `
              }]
            }
          ]
        })
      }
    );

    const data = await res.json();

    return data?.candidates?.[0]?.content?.parts?.[0]?.text
      || "No response.";

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
  const message = input.value.trim();

  if (!message) return;

  addMessage(message, "user");
  input.value = "";

  const reply = await askAI(message);

  addMessage(reply, "ai");

  currentSubject.chatHistory.push({ role: "user", content: message });
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

  currentSubject.chatHistory.forEach(msg => {
    addMessage(msg.content, msg.role === "user" ? "user" : "ai");
  });
}

// =========================
// TOOL SYSTEM
// =========================

async function runTool(prompt) {

  const result = await askAI(prompt);

  document.getElementById("output").textContent = result;
}

// =========================
// TOOL BUTTONS
// =========================

document.getElementById("summarizeBtn").onclick = () =>
  runTool("Summarize these notes into clean study notes.");

document.getElementById("flashcardBtn").onclick = () =>
  runTool("Generate 15 flashcards from the material.");

document.getElementById("quizBtn").onclick = () =>
  runTool("Create a 10 question multiple choice quiz.");

document.getElementById("eli5Btn").onclick = () =>
  runTool("Explain everything like I'm 5 years old.");

document.getElementById("mnemonicBtn").onclick = () =>
  runTool("Create memory tricks and mnemonics.");

document.getElementById("practiceTestBtn").onclick = () =>
  runTool("Create a full practice test with answers.");

document.getElementById("weaknessBtn").onclick = () =>
  runTool("Identify weak topics and study gaps.");

document.getElementById("studyPlanBtn").onclick = async () => {

  const date = prompt("Exam date?");
  const diff = prompt("Difficulty?");
  const amt = prompt("Amount of material?");

  const result = await askAI(`
Create a study plan.

Exam Date: ${date}
Difficulty: ${diff}
Material: ${amt}
  `);

  document.getElementById("output").textContent = result;
};

// =========================
// SEARCH
// =========================

document.getElementById("searchInput").oninput = (e) => {

  const val = e.target.value.toLowerCase();

  document.querySelectorAll(".subject-card").forEach(card => {
    card.style.display =
      card.innerText.toLowerCase().includes(val)
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

  handleFiles({ target: { files: e.dataTransfer.files } });
});

// =========================
// POMODORO
// =========================

let time = 1500;
let running = false;

document.getElementById("startTimer").onclick = () => {

  if (running) return;
  running = true;

  const interval = setInterval(() => {

    time--;

    const m = Math.floor(time / 60);
    const s = time % 60;

    document.getElementById("timer").textContent =
      `${m}:${s.toString().padStart(2, "0")}`;

    if (time <= 0) {
      clearInterval(interval);
      running = false;
      time = 1500;

      alert("Pomodoro done!");
      confetti();
    }

  }, 1000);
};

// =========================
// MUSIC
// =========================

const music = document.getElementById("studyMusic");
let playing = false;

document.getElementById("musicToggle").onclick = () => {

  if (playing) music.pause();
  else music.play();

  playing = !playing;
};

// =========================
// INIT
// =========================

renderSubjects();
