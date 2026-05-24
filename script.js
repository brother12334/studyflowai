// =========================
// STUDYFLOW AI — FIXED
// Uses Google Gemini API (gemini-1.5-flash)
// =========================

const GEMINI_API_KEY = "AIzaSyA7LvR94nryDzmZyyhU28AFcYepCLj9lGY";
const GEMINI_MODEL = "gemini-1.5-flash";

// =========================
// STATE
// =========================

let subjects = JSON.parse(localStorage.getItem("subjects")) || [];
let currentSubject = null;
let timerInterval = null;
let timerSeconds = 25 * 60;
let timerRunning = false;
let musicPlaying = false;

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

  subjects.push({
    id: Date.now(),
    name: name.trim(),
    files: [],
    chunks: [],
    chatHistory: [],
    xp: 0,
    level: 1,
    streak: 0
  });

  save();
  renderSubjects();
};

// =========================
// SEARCH — filters subject list
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

  const filtered = filter
    ? subjects.filter(s => s.name.toLowerCase().includes(filter))
    : subjects;

  filtered.forEach(sub => {
    const div = document.createElement("div");
    div.className = "subject-card" + (currentSubject?.id === sub.id ? " active" : "");
    div.innerHTML = `<h3>${sub.name}</h3><p>${sub.files.length} file${sub.files.length !== 1 ? "s" : ""}</p>`;
    div.onclick = () => loadSubject(sub.id);
    list.appendChild(div);
  });
}

// =========================
// LOAD SUBJECT
// =========================

function loadSubject(id) {
  currentSubject = subjects.find(s => s.id === id);
  document.getElementById("subjectTitle").innerText = currentSubject.name;
  document.getElementById("subjectSubtitle").innerText =
    `${currentSubject.files.length} file(s) uploaded`;
  document.getElementById("xp").innerText = currentSubject.xp || 0;
  document.getElementById("level").innerText = currentSubject.level || 1;
  renderFiles();
  renderChat();
  renderSubjects();
}

// =========================
// FILE UPLOAD — drag-and-drop + click
// =========================

const dropZone = document.getElementById("dropZone");

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragging");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragging");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragging");
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
  save();
  renderFiles();
  setOutput(`${files.length} file(s) loaded. Ready to study!`);
}

// =========================
// TEXT EXTRACTION — PDF, DOCX, TXT
// =========================

async function extractText(file) {
  if (file.type === "text/plain") {
    return await file.text();
  }

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
    } catch (err) {
      console.error("PDF error:", err);
      return "";
    }
  }

  if (
    file.name.endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    try {
      const buffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: buffer });
      return result.value;
    } catch (err) {
      console.error("DOCX error:", err);
      return "";
    }
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
    chunks.push({ text: text.slice(i, i + size), source: fileName, page });
    page++;
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
      const text = c.text.toLowerCase();
      for (let w of words) { if (text.includes(w)) score += 2; }
      return { ...c, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

// =========================
// GEMINI API
// =========================

async function askAI(prompt) {
  if (!currentSubject) return "Select a subject first.";
  if (!currentSubject.chunks.length) return "No study material uploaded yet. Add files first.";

  const chunks = getRelevantChunks(prompt);
  const context = chunks
    .filter(c => c.text && c.text.length > 20)
    .map(c => c.text.slice(0, 600))
    .join("\n\n");

  const sources = chunks.map(c => `${c.source} | Chunk ${c.page}`).join("\n");

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
              text: `You are a focused study assistant. Answer ONLY from the study material below. If the answer is not in the material, say "Not found in your study material." Be concise and helpful.

SUBJECT: ${currentSubject.name}

STUDY MATERIAL:
${context}

QUESTION: ${prompt}`
            }]
          }]
        })
      }
    );

    const data = await res.json();

    if (data?.promptFeedback?.blockReason)
      return `Blocked by API: ${data.promptFeedback.blockReason}`;

    if (data.error) return `API error: ${data.error.message}`;

    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("").trim();
    if (!text) return "AI returned an empty response. Try rephrasing.";

    return `${text}\n\n---\nSources:\n${sources}`;

  } catch (err) {
    console.error("AI error:", err);
    return "Network or API error. Check your connection.";
  }
}

// =========================
// TOOL BUTTONS
// =========================

function setOutput(text) {
  document.getElementById("output").textContent = text;
}

async function runTool(prompt, btnId) {
  if (!currentSubject) { alert("Select a subject first."); return; }
  if (!currentSubject.chunks.length) { alert("Upload study files first."); return; }

  const btn = document.getElementById(btnId);
  btn.disabled = true;
  btn.classList.add("loading");
  setOutput("Thinking...");

  const result = await askAI(prompt);
  setOutput(result);
  awardXP(10);

  btn.disabled = false;
  btn.classList.remove("loading");
}

document.getElementById("summarizeBtn").onclick = () =>
  runTool("Summarize all the key concepts and important points from this study material.", "summarizeBtn");

document.getElementById("flashcardBtn").onclick = () =>
  runTool("Create 10 flashcard-style Q&A pairs from this study material. Format each as:\nQ: ...\nA: ...", "flashcardBtn");

document.getElementById("quizBtn").onclick = () =>
  runTool("Generate 5 multiple choice quiz questions from this study material. Include 4 answer options (A-D) and mark the correct answer.", "quizBtn");

document.getElementById("studyPlanBtn").onclick = () =>
  runTool("Create a structured study plan for mastering this material. Break it into daily sessions with specific topics.", "studyPlanBtn");

document.getElementById("eli5Btn").onclick = () =>
  runTool("Explain the main concepts from this study material like I am 5 years old. Use simple words and fun analogies.", "eli5Btn");

document.getElementById("mnemonicBtn").onclick = () =>
  runTool("Create memory tricks, mnemonics, and acronyms to help remember the key concepts in this study material.", "mnemonicBtn");

document.getElementById("practiceTestBtn").onclick = () =>
  runTool("Create a full practice test with: 5 multiple choice questions, 3 short answer questions, and 1 essay question. Base it entirely on the study material.", "practiceTestBtn");

document.getElementById("weaknessBtn").onclick = () =>
  runTool("Identify the 3-5 most complex or tricky concepts in this material that students commonly struggle with. Explain why each is difficult and give tips for mastering them.", "weaknessBtn");

// =========================
// CHAT
// =========================

document.getElementById("sendBtn").onclick = sendMessage;

document.getElementById("chatInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

async function sendMessage() {
  const input = document.getElementById("chatInput");
  const msg = input.value.trim();
  if (!msg || !currentSubject) return;

  addMessage(msg, "user");
  input.value = "";

  const typingDiv = addMessage("...", "ai");
  const reply = await askAI(msg);
  typingDiv.textContent = reply;

  currentSubject.chatHistory.push({ role: "user", content: msg });
  currentSubject.chatHistory.push({ role: "ai", content: reply });

  awardXP(5);
  save();
}

function addMessage(text, type) {
  const div = document.createElement("div");
  div.className = `chat-bubble ${type}`;
  div.textContent = text;
  const box = document.getElementById("chatMessages");
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  return div;
}

function renderChat() {
  const box = document.getElementById("chatMessages");
  box.innerHTML = "";
  if (!currentSubject) return;
  currentSubject.chatHistory.forEach(m =>
    addMessage(m.content, m.role === "user" ? "user" : "ai")
  );
}

// =========================
// FILE LIST
// =========================

function renderFiles() {
  const list = document.getElementById("fileList");
  list.innerHTML = "";
  if (!currentSubject) return;
  if (!currentSubject.files.length) {
    list.innerHTML = `<li style="opacity:0.4">No files yet.</li>`;
    return;
  }
  currentSubject.files.forEach(f => {
    const li = document.createElement("li");
    li.textContent = "📄 " + f.name;
    list.appendChild(li);
  });
  document.getElementById("subjectSubtitle").innerText =
    `${currentSubject.files.length} file(s) uploaded`;
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

document.getElementById("themeToggle").onclick = () => {
  document.body.classList.toggle("light");
  const isLight = document.body.classList.contains("light");
  document.getElementById("themeToggle").textContent =
    isLight ? "🌞 Toggle Theme" : "🌙 Toggle Theme";
};

// =========================
// MUSIC TOGGLE
// =========================

const music = document.getElementById("studyMusic");

document.getElementById("musicToggle").onclick = () => {
  if (musicPlaying) {
    music.pause();
    document.getElementById("musicToggle").textContent = "🎵 Music";
  } else {
    music.play().catch(() => {});
    document.getElementById("musicToggle").textContent = "🔇 Stop Music";
  }
  musicPlaying = !musicPlaying;
};

// =========================
// POMODORO TIMER
// =========================

function formatTime(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function updateTimerDisplay() {
  document.getElementById("timer").textContent = formatTime(timerSeconds);
}

document.getElementById("startTimer").onclick = () => {
  if (timerRunning) return;
  timerRunning = true;
  timerInterval = setInterval(() => {
    timerSeconds--;
    updateTimerDisplay();
    if (timerSeconds <= 0) {
      clearInterval(timerInterval);
      timerRunning = false;
      timerSeconds = 5 * 60;
      updateTimerDisplay();
      confetti({ particleCount: 80, spread: 60 });
      alert("Pomodoro done! Take a 5-minute break.");
    }
  }, 1000);
};

document.getElementById("pauseTimer").onclick = () => {
  clearInterval(timerInterval);
  timerRunning = false;
};

document.getElementById("resetTimer").onclick = () => {
  clearInterval(timerInterval);
  timerRunning = false;
  timerSeconds = 25 * 60;
  updateTimerDisplay();
};

// =========================
// INIT
// =========================

renderSubjects();
