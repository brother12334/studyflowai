// -------------------------
// GLOBAL STATE
// -------------------------

let subjects = JSON.parse(localStorage.getItem("subjects")) || [];
let currentSubject = null;

// -------------------------
// SAVE DATA
// -------------------------

function saveSubjects() {
  localStorage.setItem("subjects", JSON.stringify(subjects));
}

// -------------------------
// CREATE SUBJECT
// -------------------------

document.getElementById("newSubjectBtn")
.addEventListener("click", () => {

  const name = prompt("Enter Subject Name");

  if (!name) return;

  const subject = {
    id: Date.now(),
    name,
    files: [],
    extractedText: "",
    flashcards: [],
    quizzes: [],
    xp: 0,
    streak: 0,
    level: 1
  };

  subjects.push(subject);

  saveSubjects();

  renderSubjects();
});

// -------------------------
// RENDER SUBJECTS
// -------------------------

function renderSubjects() {

  const container = document.getElementById("subjectList");

  container.innerHTML = "";

  subjects.forEach(subject => {

    const div = document.createElement("div");

    div.className = "subject-card";

    div.innerHTML = `
      <h3>${subject.name}</h3>
      <p>${subject.files.length} files</p>
    `;

    div.onclick = () => loadSubject(subject.id);

    container.appendChild(div);
  });
}

// -------------------------
// LOAD SUBJECT
// -------------------------

function loadSubject(id) {

  currentSubject = subjects.find(s => s.id === id);

  document.getElementById("subjectTitle")
    .textContent = currentSubject.name;

  renderFiles();
}

// -------------------------
// FILE UPLOADS
// -------------------------

document.getElementById("fileInput")
.addEventListener("change", handleFiles);

async function handleFiles(e) {

  const files = Array.from(e.target.files);

  for (const file of files) {

    const text = await extractText(file);

    currentSubject.files.push({
      name: file.name,
      text
    });

    currentSubject.extractedText += "\n" + text;
  }

  saveSubjects();

  renderFiles();
}

// -------------------------
// TEXT EXTRACTION
// -------------------------

async function extractText(file) {

  if (file.type === "text/plain") {
    return await file.text();
  }

  if (file.type === "application/pdf") {

    const arrayBuffer = await file.arrayBuffer();

    const pdf = await pdfjsLib
      .getDocument({data: arrayBuffer}).promise;

    let text = "";

    for (let i = 1; i <= pdf.numPages; i++) {

      const page = await pdf.getPage(i);

      const content = await page.getTextContent();

      text += content.items.map(i => i.str).join(" ");
    }

    return text;
  }

  if (file.name.endsWith(".docx")) {

    const arrayBuffer = await file.arrayBuffer();

    const result = await mammoth.extractRawText({
      arrayBuffer
    });

    return result.value;
  }

  return "";
}

// -------------------------
// RENDER FILES
// -------------------------

function renderFiles() {

  const list = document.getElementById("fileList");

  list.innerHTML = "";

  currentSubject.files.forEach(file => {

    const li = document.createElement("li");

    li.textContent = file.name;

    list.appendChild(li);
  });
}

// -------------------------
// CHATGPT API
// -------------------------

async function askAI(prompt) {

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type":"application/json"
    },
    body: JSON.stringify({
      prompt,
      context: currentSubject.extractedText
    })
  });

  const data = await response.json();

  return data.reply;
}

// -------------------------
// SEND CHAT MESSAGE
// -------------------------

document.getElementById("sendBtn")
.addEventListener("click", async () => {

  const input = document.getElementById("chatInput");

  const message = input.value;

  addMessage(message, "user");

  const reply = await askAI(message);

  addMessage(reply, "ai");

  input.value = "";
});

// -------------------------
// CHAT UI
// -------------------------

function addMessage(text, type) {

  const div = document.createElement("div");

  div.className = `chat-bubble ${type}`;

  div.textContent = text;

  document.getElementById("chatMessages")
    .appendChild(div);
}

// -------------------------
// FLASHCARD GENERATOR
// -------------------------

document.getElementById("flashcardBtn")
.addEventListener("click", async () => {

  const prompt = `
    Generate 10 flashcards from these notes:
    ${currentSubject.extractedText}
  `;

  const flashcards = await askAI(prompt);

  console.log(flashcards);
});

// -------------------------
// QUIZ GENERATOR
// -------------------------

document.getElementById("quizBtn")
.addEventListener("click", async () => {

  const prompt = `
    Generate a multiple choice quiz
    from these notes:
    ${currentSubject.extractedText}
  `;

  const quiz = await askAI(prompt);

  console.log(quiz);

  confetti();
});
