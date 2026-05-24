// =========================
// script.js
// =========================

// -------------------------
// API KEY
// -------------------------

const OPENAI_API_KEY = "PASTE_API_KEY_HERE";

// -------------------------
// GLOBAL STATE
// -------------------------

let subjects =
  JSON.parse(localStorage.getItem("subjects"))
  || [];

let currentSubject = null;

// -------------------------
// SAVE
// -------------------------

function saveSubjects() {

  localStorage.setItem(
    "subjects",
    JSON.stringify(subjects)
  );
}

// -------------------------
// RENDER SUBJECTS
// -------------------------

function renderSubjects() {

  const subjectList =
    document.getElementById("subjectList");

  subjectList.innerHTML = "";

  subjects.forEach(subject => {

    const card =
      document.createElement("div");

    card.className = "subject-card";

    card.innerHTML = `
      <h3>${subject.name}</h3>
      <p>
        ${subject.files.length} files
      </p>
    `;

    card.onclick = () => {
      loadSubject(subject.id);
    };

    subjectList.appendChild(card);
  });
}

// -------------------------
// CREATE SUBJECT
// -------------------------

document
.getElementById("newSubjectBtn")
.addEventListener("click", () => {

  const name =
    prompt("Enter subject name:");

  if (!name) return;

  const subject = {

    id: Date.now(),

    name,

    files: [],

    extractedText: "",

    flashcards: [],

    quizzes: [],

    chatHistory: [],

    missedTopics: [],

    xp: 0,

    streak: 0,

    level: 1
  };

  subjects.push(subject);

  saveSubjects();

  renderSubjects();
});

// -------------------------
// LOAD SUBJECT
// -------------------------

function loadSubject(id) {

  currentSubject =
    subjects.find(s => s.id === id);

  document
  .getElementById("subjectTitle")
  .textContent = currentSubject.name;

  document
  .getElementById("xp")
  .textContent = currentSubject.xp;

  document
  .getElementById("streak")
  .textContent = currentSubject.streak;

  document
  .getElementById("level")
  .textContent = currentSubject.level;

  renderFiles();

  renderChat();
}

// -------------------------
// FILES
// -------------------------

document
.getElementById("fileInput")
.addEventListener("change", handleFiles);

async function handleFiles(e) {

  if (!currentSubject) {
    alert("Select a subject first.");
    return;
  }

  const files =
    Array.from(e.target.files);

  for (const file of files) {

    const text =
      await extractText(file);

    currentSubject.files.push({

      name: file.name,

      text
    });

    currentSubject.extractedText +=
      "\n\n" + text;
  }

  saveSubjects();

  renderFiles();
}

// -------------------------
// EXTRACT TEXT
// -------------------------

async function extractText(file) {

  // TXT

  if (file.type === "text/plain") {

    return await file.text();
  }

  // PDF

  if (file.type === "application/pdf") {

    const buffer =
      await file.arrayBuffer();

    const pdf =
      await pdfjsLib
      .getDocument({ data: buffer })
      .promise;

    let text = "";

    for (
      let i = 1;
      i <= pdf.numPages;
      i++
    ) {

      const page =
        await pdf.getPage(i);

      const content =
        await page.getTextContent();

      text +=
        content.items
        .map(item => item.str)
        .join(" ");
    }

    return text;
  }

  // DOCX

  if (file.name.endsWith(".docx")) {

    const buffer =
      await file.arrayBuffer();

    const result =
      await mammoth.extractRawText({
        arrayBuffer: buffer
      });

    return result.value;
  }

  // IMAGES OCR

  if (file.type.startsWith("image/")) {

    const result =
      await Tesseract.recognize(file);

    return result.data.text;
  }

  return "";
}

// -------------------------
// RENDER FILES
// -------------------------

function renderFiles() {

  const list =
    document.getElementById("fileList");

  list.innerHTML = "";

  currentSubject.files.forEach(file => {

    const li =
      document.createElement("li");

    li.textContent = file.name;

    list.appendChild(li);
  });
}

// -------------------------
// OPENAI
// -------------------------

async function askAI(prompt) {

  try {

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {

        method: "POST",

        headers: {

          "Content-Type":
            "application/json",

          "Authorization":
            `Bearer ${OPENAI_API_KEY}`
        },

        body: JSON.stringify({

          model: "gpt-4.1-mini",

          messages: [

            {
              role: "system",

              content: `
                You are a study assistant.

                ONLY answer using the
                uploaded study guides.

                Be concise but helpful.
              `
            },

            {
              role: "user",

              content: `
                SUBJECT:
                ${currentSubject.name}

                STUDY MATERIAL:
                ${currentSubject.extractedText}

                QUESTION:
                ${prompt}
              `
            }
          ]
        })
      }
    );

    const data =
      await response.json();

    return data
      .choices[0]
      .message
      .content;

  } catch (err) {

    console.error(err);

    return "Error contacting AI.";
  }
}

// -------------------------
// CHAT
// -------------------------

document
.getElementById("sendBtn")
.addEventListener("click", sendMessage);

async function sendMessage() {

  const input =
    document.getElementById("chatInput");

  const message = input.value;

  if (!message) return;

  addMessage(message, "user");

  input.value = "";

  const reply =
    await askAI(message);

  addMessage(reply, "ai");

  currentSubject.chatHistory.push({

    role: "user",
    content: message

  });

  currentSubject.chatHistory.push({

    role: "assistant",
    content: reply

  });

  saveSubjects();
}

function addMessage(text, type) {

  const div =
    document.createElement("div");

  div.className =
    `chat-bubble ${type}`;

  div.textContent = text;

  document
  .getElementById("chatMessages")
  .appendChild(div);
}

function renderChat() {

  const container =
    document.getElementById("chatMessages");

  container.innerHTML = "";

  currentSubject.chatHistory
  .forEach(msg => {

    addMessage(
      msg.content,
      msg.role === "user"
      ? "user"
      : "ai"
    );
  });
}

// -------------------------
// AI TOOL BUTTONS
// -------------------------

async function runTool(prompt) {

  const result =
    await askAI(prompt);

  document
  .getElementById("output")
  .textContent = result;
}

// SUMMARY

document
.getElementById("summarizeBtn")
.onclick = () => {

  runTool(`
    Summarize all uploaded notes
    into concise study notes.
  `);
};

// FLASHCARDS

document
.getElementById("flashcardBtn")
.onclick = async () => {

  const result =
    await askAI(`
      Generate 15 flashcards
      from these notes.
    `);

  document
  .getElementById("output")
  .textContent = result;
};

// QUIZ

document
.getElementById("quizBtn")
.onclick = async () => {

  const result =
    await askAI(`
      Create a 10 question
      multiple choice quiz.
    `);

  document
  .getElementById("output")
  .textContent = result;

  currentSubject.xp += 25;

  currentSubject.level =
    Math.floor(
      currentSubject.xp / 100
    ) + 1;

  confetti();

  saveSubjects();

  loadSubject(currentSubject.id);
};

// ELI5

document
.getElementById("eli5Btn")
.onclick = () => {

  runTool(`
    Explain the most difficult
    concepts like I'm 5 years old.
  `);
};

// MNEMONICS

document
.getElementById("mnemonicBtn")
.onclick = () => {

  runTool(`
    Create mnemonics and memory
    tricks for these notes.
  `);
};

// PRACTICE TEST

document
.getElementById("practiceTestBtn")
.onclick = () => {

  runTool(`
    Create a realistic practice
    test with answer key.
  `);
};

// WEAKNESS DETECTOR

document
.getElementById("weaknessBtn")
.onclick = () => {

  runTool(`
    Analyze likely weak topics
    based on the uploaded notes.
  `);
};

// STUDY PLAN

document
.getElementById("studyPlanBtn")
.onclick = async () => {

  const examDate =
    prompt("Exam date?");

  const difficulty =
    prompt("Difficulty level?");

  const material =
    prompt("Amount of material?");

  const result =
    await askAI(`
      Create a study plan.

      Exam Date:
      ${examDate}

      Difficulty:
      ${difficulty}

      Material:
      ${material}
    `);

  document
  .getElementById("output")
  .textContent = result;
};

// -------------------------
// SEARCH
// -------------------------

document
.getElementById("searchInput")
.addEventListener("input", e => {

  const value =
    e.target.value.toLowerCase();

  const cards =
    document.querySelectorAll(
      ".subject-card"
    );

  cards.forEach(card => {

    const text =
      card.innerText.toLowerCase();

    card.style.display =
      text.includes(value)
      ? "block"
      : "none";
  });
});

// -------------------------
// DRAG DROP
// -------------------------

const dropZone =
  document.getElementById("dropZone");

dropZone.addEventListener(
  "dragover",
  e => {

    e.preventDefault();

    dropZone.classList.add(
      "dragging"
    );
  }
);

dropZone.addEventListener(
  "dragleave",
  () => {

    dropZone.classList.remove(
      "dragging"
    );
  }
);

dropZone.addEventListener(
  "drop",
  e => {

    e.preventDefault();

    dropZone.classList.remove(
      "dragging"
    );

    handleFiles({
      target: {
        files: e.dataTransfer.files
      }
    });
  }
);

// -------------------------
// POMODORO
// -------------------------

let timerRunning = false;

let time = 1500;

document
.getElementById("startTimer")
.onclick = () => {

  if (timerRunning) return;

  timerRunning = true;

  const interval =
    setInterval(() => {

      time--;

      const minutes =
        Math.floor(time / 60);

      const seconds =
        time % 60;

      document
      .getElementById("timer")
      .textContent =
        `${minutes}:${
          seconds
          .toString()
          .padStart(2, "0")
        }`;

      if (time <= 0) {

        clearInterval(interval);

        timerRunning = false;

        alert("Pomodoro Complete!");

        confetti();

        time = 1500;
      }

    }, 1000);
};

// -------------------------
// MUSIC
// -------------------------

const music =
  document.getElementById(
    "studyMusic"
  );

let musicPlaying = false;

document
.getElementById("musicToggle")
.onclick = () => {

  if (musicPlaying) {

    music.pause();

  } else {

    music.play();
  }

  musicPlaying = !musicPlaying;
};

// -------------------------
// THEME
// -------------------------

document
.getElementById("themeToggle")
.onclick = () => {

  document.body.classList.toggle(
    "light-mode"
  );
};

// -------------------------
// INITIALIZE
// -------------------------

renderSubjects();
