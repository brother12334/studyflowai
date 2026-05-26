// =========================
// SUPABASE CONFIG
// =========================
const SUPABASE_URL  = "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON = "YOUR_ANON_KEY";

// =========================
// AUTH & SYNC
// =========================
const AUTH_KEY  = "studyapp_auth";
const SYNC_KEY  = "subjects_savedAt";
let currentUser = null;
let syncTimeout = null;

let CLAUDE_API_KEY = "";
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

// =========================
// SUPABASE HELPERS
// =========================
async function cloudSave() {
  if (!currentUser) return;
  const now = Date.now();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/user_data`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON,
        "Authorization": `Bearer ${SUPABASE_ANON}`,
        "Prefer": "resolution=merge-duplicates"
      },
      body: JSON.stringify({
        username: currentUser.username,
        subjects: subjects,
        saved_at: now
      })
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); console.warn("Cloud save failed:", e); return; }
    localStorage.setItem(SYNC_KEY, now.toString());
  } catch (e) { console.warn("Cloud save error:", e); }
}

async function cloudLoad(username) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/user_data?username=eq.${encodeURIComponent(username)}&select=subjects,saved_at`,
      { headers: { "apikey": SUPABASE_ANON, "Authorization": `Bearer ${SUPABASE_ANON}` } }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    if (!rows || rows.length === 0) return null;
    return { subjects: rows[0].subjects, savedAt: rows[0].saved_at };
  } catch (e) { console.warn("Cloud load error:", e); return null; }
}

function scheduleSyncSave() {
  clearTimeout(syncTimeout);
  syncTimeout = setTimeout(cloudSave, 1500);
}

function save() {
  localStorage.setItem("subjects", JSON.stringify(subjects));
  scheduleSyncSave();
}

// =========================
// TOAST
// =========================
function showToast(msg, color) {
  const existing = document.getElementById("syncToast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.id = "syncToast";
  toast.textContent = msg;
  toast.style.cssText = `
    position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(10px);
    background:#111;border:1px solid ${color || "rgba(255,255,255,0.15)"};
    color:${color ? "#fff" : "#ccc"};padding:10px 22px;border-radius:12px;
    font-size:0.88rem;font-family:inherit;box-shadow:0 8px 32px rgba(0,0,0,0.5);
    z-index:99999;opacity:0;transition:opacity 0.3s,transform 0.3s;pointer-events:none;
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(0)";
  });
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(10px)";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// =========================
// LOGIN SCREEN
// =========================
function showLoginScreen() {
  const app = document.querySelector(".app");
  if (app) app.style.display = "none";
  const existing = document.getElementById("loginOverlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "loginOverlay";
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:99998;
    display:flex;align-items:center;justify-content:center;
    background:#000;font-family:'Inter',sans-serif;
  `;
  overlay.innerHTML = `
    <div style="width:100%;max-width:440px;padding:48px 40px;background:#0d0d0d;border-radius:20px;
      border:1px solid rgba(255,255,255,0.09);box-shadow:0 32px 80px rgba(0,0,0,0.7);">
      <div style="text-align:center;margin-bottom:36px;">
        <div style="font-size:2.5rem;margin-bottom:14px;">📚</div>
        <h1 style="color:#f0f0f0;font-size:1.6rem;font-weight:700;margin:0 0 8px;font-family:'Sora',sans-serif;">StudyFlow AI</h1>
        <p style="color:#555;font-size:0.88rem;margin:0;">Sign in to sync your subjects across devices</p>
      </div>
      <div id="loginError" style="display:none;background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.3);
        color:#f87171;padding:10px 14px;border-radius:10px;font-size:0.85rem;margin-bottom:18px;"></div>
      <div style="margin-bottom:16px;">
        <label style="display:block;color:#666;font-size:0.75rem;margin-bottom:7px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;">Username</label>
        <input id="loginUsername" type="text" placeholder="e.g. alexsmith" autocomplete="username"
          style="width:100%;box-sizing:border-box;padding:12px 16px;background:#161616;
          border:1px solid rgba(255,255,255,0.09);border-radius:10px;color:#f0f0f0;
          font-size:0.95rem;outline:none;font-family:inherit;transition:border-color 0.2s;">
      </div>
      <div style="margin-bottom:28px;">
        <label style="display:block;color:#666;font-size:0.75rem;margin-bottom:7px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;">Claude API Key</label>
        <div style="position:relative;">
          <input id="loginApiKey" type="password" placeholder="sk-ant-..." autocomplete="off"
            style="width:100%;box-sizing:border-box;padding:12px 44px 12px 16px;background:#161616;
            border:1px solid rgba(255,255,255,0.09);border-radius:10px;color:#f0f0f0;
            font-size:0.95rem;outline:none;font-family:inherit;transition:border-color 0.2s;">
          <button id="eyeToggle" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);
            background:none;border:none;color:#555;cursor:pointer;font-size:15px;padding:4px;">👁</button>
        </div>
        <p style="color:#444;font-size:0.76rem;margin:8px 0 0;line-height:1.5;">
          Your key is saved <strong style="color:#666">only on this device</strong>.
          Your subjects sync by username across devices.
        </p>
      </div>
      <button id="loginSubmitBtn" style="width:100%;padding:13px;background:#fff;border:none;border-radius:10px;
        color:#000;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit;
        letter-spacing:0.02em;transition:opacity 0.2s,transform 0.1s;">Sign In / Create Account</button>
      <p style="text-align:center;color:#333;font-size:0.76rem;margin:20px 0 0;line-height:1.6;">
        New username = new account &nbsp;·&nbsp; Same username on any device = your data loads
      </p>
    </div>
  `;
  document.body.appendChild(overlay);

  const unEl   = overlay.querySelector("#loginUsername");
  const keyEl  = overlay.querySelector("#loginApiKey");
  const eyeBtn = overlay.querySelector("#eyeToggle");
  const btn    = overlay.querySelector("#loginSubmitBtn");

  unEl.addEventListener("focus",  () => { unEl.style.borderColor  = "rgba(255,255,255,0.3)"; });
  unEl.addEventListener("blur",   () => { unEl.style.borderColor  = "rgba(255,255,255,0.09)"; });
  keyEl.addEventListener("focus", () => { keyEl.style.borderColor = "rgba(255,255,255,0.3)"; });
  keyEl.addEventListener("blur",  () => { keyEl.style.borderColor = "rgba(255,255,255,0.09)"; });
  eyeBtn.onclick = () => { keyEl.type = keyEl.type === "password" ? "text" : "password"; };
  unEl.addEventListener("keydown",  e => { if (e.key === "Enter") keyEl.focus(); });
  keyEl.addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
  btn.onclick = doLogin;
}

function showLoginError(msg) {
  const el = document.getElementById("loginError");
  if (!el) return;
  el.textContent = msg;
  el.style.display = "block";
}

async function doLogin() {
  const username = document.getElementById("loginUsername").value.trim().toLowerCase().replace(/\s+/g, "");
  const apiKey   = document.getElementById("loginApiKey").value.trim();
  const btn      = document.getElementById("loginSubmitBtn");

  if (!username || username.length < 2) { showLoginError("Please enter a username (at least 2 characters)."); return; }
  if (!apiKey || !apiKey.startsWith("sk-")) { showLoginError("Please enter a valid Claude API key (starts with sk-)."); return; }

  btn.textContent = "Validating key...";
  btn.style.opacity = "0.7";
  btn.disabled = true;

  try {
    const testRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 5, messages: [{ role: "user", content: "hi" }] })
    });
    if (!testRes.ok) {
      const errData = await testRes.json().catch(() => ({}));
      showLoginError("API key rejected: " + (errData?.error?.message || "Invalid key."));
      btn.textContent = "Sign In / Create Account"; btn.style.opacity = "1"; btn.disabled = false;
      return;
    }
  } catch (e) {
    showLoginError("Network error checking key. Check your internet connection.");
    btn.textContent = "Sign In / Create Account"; btn.style.opacity = "1"; btn.disabled = false;
    return;
  }

  currentUser    = { username, apiKey };
  CLAUDE_API_KEY = apiKey;
  localStorage.setItem(AUTH_KEY, JSON.stringify(currentUser));

  btn.textContent = "Loading your data...";
  const cloudData = await cloudLoad(username);

  if (cloudData && Array.isArray(cloudData.subjects) && cloudData.subjects.length > 0) {
    subjects = cloudData.subjects;
    localStorage.setItem("subjects", JSON.stringify(subjects));
    document.getElementById("loginOverlay").remove();
    revealApp();
    renderSubjects();
    showToast(`✅ Loaded ${subjects.length} subject${subjects.length !== 1 ? "s" : ""} from your account`);
  } else {
    subjects = JSON.parse(localStorage.getItem("subjects")) || [];
    document.getElementById("loginOverlay").remove();
    revealApp();
    renderSubjects();
    if (subjects.length === 0) showToast("👋 Welcome! Create your first subject to get started.");
  }

  addUserBadge(username);
}

function revealApp() {
  const app = document.querySelector(".app");
  if (app) app.style.display = "";
}

// =========================
// USER BADGE
// =========================
function addUserBadge(username) {
  const existing = document.getElementById("userBadgeWrap");
  if (existing) existing.remove();
  const sidebar = document.querySelector(".sidebar-bottom");
  if (!sidebar) return;

  const wrap = document.createElement("div");
  wrap.id = "userBadgeWrap";
  wrap.style.cssText = "position:relative;margin-bottom:8px;";
  wrap.innerHTML = `
    <button id="userBadgeBtn" style="width:100%;display:flex;align-items:center;gap:10px;
      padding:9px 14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
      border-radius:10px;color:#ccc;font-size:0.84rem;font-family:inherit;cursor:pointer;
      transition:background 0.2s;text-align:left;">
      <span style="font-size:1rem;">👤</span>
      <span style="flex:1;font-weight:500;">@${username}</span>
      <span style="color:#444;font-size:0.7rem;">▾</span>
    </button>
    <div id="userDropdown" style="display:none;position:absolute;bottom:calc(100% + 6px);left:0;right:0;
      background:#111;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:6px;
      z-index:9999;box-shadow:0 -8px 32px rgba(0,0,0,0.6);">
      <div style="padding:8px 12px 10px;border-bottom:1px solid rgba(255,255,255,0.07);margin-bottom:4px;">
        <div style="color:#f0f0f0;font-weight:600;font-size:0.88rem;">@${username}</div>
        <div style="color:#444;font-size:0.75rem;margin-top:2px;">☁️ Synced across devices</div>
      </div>
      <button class="udd-btn" id="uddUpdateKey">🔑  Update API Key</button>
      <button class="udd-btn" id="uddSync">☁️  Force Sync Now</button>
      <button class="udd-btn" id="uddLogout" style="color:#f87171;">↩  Sign Out</button>
    </div>
  `;

  if (!document.getElementById("uddStyles")) {
    const s = document.createElement("style");
    s.id = "uddStyles";
    s.textContent = `.udd-btn{display:block;width:100%;text-align:left;padding:8px 12px;background:none;border:none;
      color:#aaa;font-size:0.84rem;font-family:inherit;cursor:pointer;border-radius:8px;transition:background 0.15s;}
      .udd-btn:hover{background:rgba(255,255,255,0.06);}`;
    document.head.appendChild(s);
  }

  sidebar.insertBefore(wrap, sidebar.firstChild);

  const badgeBtn = wrap.querySelector("#userBadgeBtn");
  const dropdown = wrap.querySelector("#userDropdown");

  badgeBtn.onclick = (e) => { e.stopPropagation(); dropdown.style.display = dropdown.style.display === "none" ? "block" : "none"; };
  document.addEventListener("click", () => { dropdown.style.display = "none"; });

  wrap.querySelector("#uddUpdateKey").onclick = () => {
    dropdown.style.display = "none";
    const newKey = prompt("Enter your new Claude API key:");
    if (!newKey || !newKey.trim()) return;
    if (!newKey.trim().startsWith("sk-")) { alert("That doesn't look like a valid key (should start with sk-)."); return; }
    currentUser.apiKey = newKey.trim();
    CLAUDE_API_KEY     = newKey.trim();
    localStorage.setItem(AUTH_KEY, JSON.stringify(currentUser));
    showToast("✅ API key updated on this device");
  };

  wrap.querySelector("#uddSync").onclick = async () => {
    dropdown.style.display = "none";
    await cloudSave();
    showToast("☁️ Synced to cloud");
  };

  wrap.querySelector("#uddLogout").onclick = () => {
    dropdown.style.display = "none";
    if (!confirm("Sign out? Your data is saved to the cloud.")) return;
    localStorage.removeItem(AUTH_KEY);
    currentUser    = null;
    CLAUDE_API_KEY = "";
    subjects       = [];
    currentSubject = null;
    const app = document.querySelector(".app");
    if (app) app.style.display = "none";
    showLoginScreen();
  };
}

// =========================
// BOOT
// =========================
(async function boot() {
  const app = document.querySelector(".app");
  if (app) app.style.display = "none";

  const saved = localStorage.getItem(AUTH_KEY);
  if (saved) {
    try {
      const auth = JSON.parse(saved);
      if (auth.username && auth.apiKey) {
        currentUser    = auth;
        CLAUDE_API_KEY = auth.apiKey;
        subjects       = JSON.parse(localStorage.getItem("subjects")) || [];

        const cloudData = await cloudLoad(auth.username);
        if (cloudData && Array.isArray(cloudData.subjects) && cloudData.subjects.length > 0) {
          const cloudTime = cloudData.savedAt || 0;
          const localTime = parseInt(localStorage.getItem(SYNC_KEY) || "0");
          if (subjects.length === 0 || cloudTime > localTime) {
            subjects = cloudData.subjects;
            localStorage.setItem("subjects", JSON.stringify(subjects));
            localStorage.setItem(SYNC_KEY, cloudTime.toString());
            showToast("☁️ Synced latest data from cloud");
          }
        }

        revealApp();
        renderSubjects();
        addUserBadge(auth.username);
        return;
      }
    } catch (e) { /* fall through */ }
  }

  showLoginScreen();
})();

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
// FLASHCARD SESSION STATE
// =========================
let fcSession = {
  allCards: [], queue: [], unknown: [], known: [],
  roundIndex: 0, roundNumber: 1, retest: false
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
    renameBtn.title = "Rename"; renameBtn.innerHTML = "✏️";
    renameBtn.onclick = (e) => { e.stopPropagation(); renameSubject(sub.id); };
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "subject-action-btn delete-btn";
    deleteBtn.title = "Delete"; deleteBtn.innerHTML = "🗑️";
    deleteBtn.onclick = (e) => { e.stopPropagation(); deleteSubject(sub.id); };
    actions.appendChild(renameBtn);
    actions.appendChild(deleteBtn);
    div.appendChild(info);
    div.appendChild(actions);
    list.appendChild(div);
  });
}

// =========================
// RENAME / DELETE SUBJECT
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
  save(); renderSubjects();
}

function deleteSubject(id) {
  const sub = subjects.find(s => s.id === id);
  if (!sub) return;
  if (!confirm(`Delete "${sub.name}"? This cannot be undone.`)) return;
  subjects = subjects.filter(s => s.id !== id);
  if (currentSubject?.id === id) {
    currentSubject = null; activeTool = null;
    document.getElementById("subjectTitle").innerText    = "Select a Subject";
    document.getElementById("subjectSubtitle").innerText = "Upload study guides to begin.";
    document.getElementById("fileList").innerHTML        = "";
    document.getElementById("chatMessages").innerHTML   = "";
    document.getElementById("output").innerHTML          = "";
    document.getElementById("xp").innerText             = "0";
    document.getElementById("level").innerText          = "1";
    hideEditPanel(); hideCacheBar();
  }
  save(); renderSubjects();
}

// =========================
// LOAD SUBJECT
// =========================
function loadSubject(id) {
  currentSubject = subjects.find(s => s.id === id);
  if (!currentSubject.cache) currentSubject.cache = {};
  activeTool = null;
  document.getElementById("subjectTitle").innerText    = currentSubject.name;
  document.getElementById("subjectSubtitle").innerText = `${currentSubject.files.length} file(s) uploaded`;
  document.getElementById("xp").innerText             = currentSubject.xp || 0;
  document.getElementById("level").innerText          = currentSubject.level || 1;
  document.getElementById("output").innerHTML         = "";
  renderFiles(); renderChat(); renderSubjects(); hideEditPanel(); hideCacheBar();
  lastBtnId = null;
}

// =========================
// FILE UPLOAD
// =========================
const dropZone = document.getElementById("dropZone");
dropZone.addEventListener("dragover",  (e) => { e.preventDefault(); dropZone.classList.add("dragging"); });
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
      const pdf    = await pdfjsLib.getDocument({ data: buffer }).promise;
      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page    = await pdf.getPage(i);
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
    .slice(0, 15);
}

function getAllChunksContext() {
  if (!currentSubject || !currentSubject.chunks.length) return "";
  const MAX_CHARS   = 80000;
  const byFile      = {};
  for (const chunk of currentSubject.chunks) {
    const src = chunk.source || "unknown";
    if (!byFile[src]) byFile[src] = [];
    byFile[src].push(chunk);
  }
  const files        = Object.keys(byFile);
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
// CUT-OFF DETECTION
// =========================
function looksComplete(text) {
  const trimmed = text.trimEnd();
  return /[.!?\n]$/.test(trimmed) || trimmed.endsWith("</ul>") || trimmed.endsWith("</p>") || /^A[:)].+$/m.test(trimmed);
}

// =========================
// CONTINUE IF CUT OFF
// =========================
async function continueIfCutOff(result, originalContext, taskPrompt, systemPrompt) {
  if (looksComplete(result)) return result;
  const userWantsContinue = confirm("⚠️ The response looks like it may have been cut off.\n\nClick OK to continue generating, or Cancel to keep what you have.");
  if (!userWantsContinue) return result;
  document.getElementById("output").innerHTML = `<p style="opacity:0.5">⏳ Continuing generation...</p>`;
  let fullResult = result;
  let attempts   = 0;
  const MAX_CONTINUES = 4;
  while (!looksComplete(fullResult) && attempts < MAX_CONTINUES) {
    try {
      const contRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 4000,
          system: systemPrompt || "You are a study assistant. Continue exactly where the previous output left off. Do not repeat anything already written.",
          messages: [{ role: "user", content: `SUBJECT: ${currentSubject.name}\n\nCONTEXT:\n${originalContext}\n\nTASK: ${taskPrompt}\n\nCONTINUE FROM HERE (do not repeat, just continue):\n${fullResult}` }]
        })
      });
      const contData = await contRes.json();
      if (!contRes.ok) break;
      const continuation = contData?.content?.[0]?.text?.trim() || "";
      if (!continuation) break;
      fullResult += "\n" + continuation;
      attempts++;
      if (looksComplete(fullResult)) break;
      if (attempts < MAX_CONTINUES) {
        const keepGoing = confirm(`⚠️ Still looks incomplete. Continue again? (${MAX_CONTINUES - attempts} attempt${MAX_CONTINUES - attempts !== 1 ? "s" : ""} remaining)`);
        if (!keepGoing) break;
      }
    } catch (err) { console.error("Continue error:", err); break; }
  }
  return fullResult;
}

// =========================
// MAP-REDUCE AI
// =========================
async function mapReduceAI(taskPrompt, systemPrompt) {
  const context    = getAllChunksContext();
  const BATCH_SIZE = 6000;
  const batches    = [];
  for (let i = 0; i < context.length; i += BATCH_SIZE) batches.push(context.slice(i, i + BATCH_SIZE));

  if (batches.length === 1) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 4000,
        system: systemPrompt || "You are a study assistant. Use ONLY the provided material. Be complete and accurate.",
        messages: [{ role: "user", content: `SUBJECT: ${currentSubject.name}\n\nSTUDY MATERIAL:\n${batches[0]}\n\nTASK:\n${taskPrompt}` }]
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || "API error");
    let result = data?.content?.[0]?.text?.trim() || "";
    result = await continueIfCutOff(result, batches[0], taskPrompt, systemPrompt);
    return result;
  }

  let partialResults = [];
  for (let i = 0; i < batches.length; i++) {
    document.getElementById("output").innerHTML = `<p style="opacity:0.5">⏳ Processing section ${i + 1} of ${batches.length}...</p>`;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 1500,
        system: "You are a study assistant. Extract and preserve ALL key facts, terms, definitions, dates, formulas, and concepts from this material section. Be thorough.",
        messages: [{ role: "user", content: `SUBJECT: ${currentSubject.name}\n\nMATERIAL SECTION ${i + 1} of ${batches.length}:\n${batches[i]}\n\nTASK: ${taskPrompt}` }]
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || "API error");
    partialResults.push(data?.content?.[0]?.text?.trim() || "");
  }

  document.getElementById("output").innerHTML = `<p style="opacity:0.5">⏳ Combining all sections into final output...</p>`;
  const combined  = partialResults.map((r, i) => `--- Section ${i + 1} ---\n${r}`).join("\n\n");
  const reduceRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 4000,
      system: systemPrompt || "You are a study assistant. Combine the section results into one complete, well-organized final output. Do not lose any facts or cards.",
      messages: [{ role: "user", content: `SUBJECT: ${currentSubject.name}\n\nSECTION RESULTS:\n${combined}\n\nFINAL TASK: ${taskPrompt}` }]
    })
  });
  const reduceData = await reduceRes.json();
  if (!reduceRes.ok) throw new Error(reduceData?.error?.message || "API error");
  let result = reduceData?.content?.[0]?.text?.trim() || "";
  result = await continueIfCutOff(result, combined, taskPrompt, systemPrompt);
  return result;
}

// =========================
// CLAUDE API — FOCUSED
// =========================
async function askAI(prompt, systemPrompt) {
  if (!currentSubject) return "Select a subject first.";
  if (!currentSubject.chunks.length) return "No study material uploaded yet. Add files first.";
  const chunks  = getRelevantChunks(prompt);
  const context = chunks.filter(c => c.text && c.text.length > 20).map(c => c.text.split(" ").slice(0, 300).join(" ")).join("\n\n");
  const system  = systemPrompt || `You are a focused study assistant.\nOnly use the provided study material.\nIf the answer is not in the material, say: "Not found in your study material."\nBe concise.`;
  const fullPrompt = `SUBJECT: ${currentSubject.name}\n\nSTUDY MATERIAL:\n${context}\n\nTASK:\n${prompt}`;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 2000, system, messages: [{ role: "user", content: fullPrompt }] })
    });
    const data = await res.json();
    if (!res.ok) return `API Error: ${data?.error?.message || "Unknown error"}`;
    let result = data?.content?.[0]?.text?.trim() || "No response.";
    result = await continueIfCutOff(result, context, prompt, system);
    return result;
  } catch (err) { return `Network/API error: ${err.message}`; }
}

// =========================
// CLAUDE API — FULL CONTEXT
// =========================
async function askAIFull(prompt, systemPrompt) {
  if (!currentSubject) return "Select a subject first.";
  if (!currentSubject.chunks.length) return "No study material uploaded yet. Add files first.";
  try { return await mapReduceAI(prompt, systemPrompt); }
  catch (err) { return `Error: ${err.message}`; }
}

// =========================
// CACHE BAR
// =========================
function hideCacheBar() {
  const bar = document.getElementById("cacheBar");
  if (bar) bar.style.display = "none";
}

// =========================
// INLINE RESULT BAR
// =========================
function showResultWithBar(btnId, renderer, value) {
  activeTool = btnId;
  hideCacheBar();
  if (renderer) renderer(value); else setOutput(value);
  const outputDiv = document.getElementById("output");
  const existing  = document.getElementById("inlineCacheBar");
  if (existing) existing.remove();
  const bar = document.createElement("div");
  bar.id = "inlineCacheBar";
  bar.style.cssText = `display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;
    margin-bottom:14px;border-radius:10px;background:rgba(255,255,255,0.05);
    border:1px solid rgba(255,255,255,0.1);font-size:0.83rem;color:#888;flex-shrink:0;`;
  bar.innerHTML = `<span>📌 Showing saved ${TOOL_NAMES[btnId] || "result"}</span>
    <button id="inlineRegenBtn" style="padding:5px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);
      background:transparent;color:inherit;cursor:pointer;font-size:0.82rem;white-space:nowrap;">🔄 Regenerate</button>`;
  outputDiv.insertBefore(bar, outputDiv.firstChild);
  document.getElementById("inlineRegenBtn").onclick = () => {
    if (!currentSubject) return;
    const cacheKey = CACHE_KEYS[btnId];
    if (cacheKey && currentSubject.cache) { delete currentSubject.cache[cacheKey]; save(); }
    activeTool = null;
    document.getElementById(btnId)?.click();
  };
}

// =========================
// TOOL RUNNER — focused
// =========================
async function runTool(prompt, btnId, renderer) {
  if (!currentSubject) { alert("Select a subject first."); return; }
  if (!currentSubject.chunks.length) { alert("Upload study files first."); return; }
  if (!currentSubject.cache) currentSubject.cache = {};
  const cacheKey = CACHE_KEYS[btnId];
  lastBtnId = btnId;
  if (cacheKey && currentSubject.cache[cacheKey]) { hideEditPanel(); showResultWithBar(btnId, renderer, currentSubject.cache[cacheKey]); return; }
  activeTool = btnId;
  const btn = document.getElementById(btnId);
  btn.disabled = true; btn.classList.add("loading");
  document.getElementById("output").innerHTML = `<p style="opacity:0.5">⏳ Thinking...</p>`;
  hideEditPanel(); hideCacheBar();
  const result = await askAI(prompt);
  if (cacheKey) { currentSubject.cache[cacheKey] = result; save(); }
  showResultWithBar(btnId, renderer, result);
  awardXP(10);
  btn.disabled = false; btn.classList.remove("loading");
}

// =========================
// TOOL RUNNER FULL — map-reduce
// =========================
async function runToolFull(prompt, btnId, renderer) {
  if (!currentSubject) { alert("Select a subject first."); return; }
  if (!currentSubject.chunks.length) { alert("Upload study files first."); return; }
  if (!currentSubject.cache) currentSubject.cache = {};
  const cacheKey = CACHE_KEYS[btnId];
  lastBtnId = btnId;
  if (cacheKey && currentSubject.cache[cacheKey]) {
    hideEditPanel();
    showResultWithBar(btnId, renderer, currentSubject.cache[cacheKey]);
    if (btnId === "flashcardBtn") showEditPanel("flashcard");
    else if (btnId === "quizBtn" || btnId === "practiceTestBtn") showEditPanel("quiz");
    return;
  }
  activeTool = btnId;
  const btn = document.getElementById(btnId);
  btn.disabled = true; btn.classList.add("loading");
  document.getElementById("output").innerHTML = `<p style="opacity:0.5">⏳ Generating from full material...</p>`;
  hideEditPanel(); hideCacheBar();
  const result = await askAIFull(prompt);
  if (cacheKey) { currentSubject.cache[cacheKey] = result; save(); }
  showResultWithBar(btnId, renderer, result);
  awardXP(10);
  btn.disabled = false; btn.classList.remove("loading");
}

// =========================
// MARKDOWN RENDERER
// =========================
function renderMarkdown(text) {
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,     "<em>$1</em>")
    .replace(/^### (.+)$/gm,   "<h4>$1</h4>")
    .replace(/^## (.+)$/gm,    "<h3>$1</h3>")
    .replace(/^# (.+)$/gm,     "<h2>$1</h2>")
    .replace(/^[-•] (.+)$/gm,  "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/gs,"<ul>$1</ul>")
    .replace(/\n{2,}/g,        "</p><p>")
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
    ? "✏️ Edit Flashcards"
    : "✏️ Edit Quiz";
  panel.style.display = "block";
  document.getElementById("editMessages").innerHTML = "";
  document.getElementById("editInput").value        = "";
  document.getElementById("editInput").placeholder  = mode === "flashcard"
    ? 'e.g. "Add 5 more cards about Chapter 3" or "Make the questions harder"'
    : 'e.g. "Add 3 more questions" or "Focus more on definitions"';
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function hideEditPanel() {
  document.getElementById("editPanel").style.display = "none";
  currentMode = null;
}

document.getElementById("editSendBtn").onclick  = sendEditMessage;
document.getElementById("editInput").addEventListener("keydown", (e) => { if (e.key === "Enter") sendEditMessage(); });
document.getElementById("editCloseBtn").onclick = hideEditPanel;

// =========================
// EDIT MESSAGE — FIXED
// System prompt passed correctly; API called directly (not via askAI)
// =========================
async function sendEditMessage() {
  const input = document.getElementById("editInput");
  const msg   = input.value.trim();
  if (!msg) return;
  addEditMessage(msg, "user");
  input.value = "";
  const typingDiv = addEditMessage("⏳ Thinking...", "ai");

  const FLASHCARD_SYSTEM = `You are a flashcard editor. The user will ask you to modify a set of flashcards.
You MUST respond with ONLY the complete updated flashcard set in this EXACT format — no preamble, no explanation, no extra text of any kind:

Q: [question]
A: [answer]

Every single card must start with "Q: " on its own line followed by "A: " on the next line.
Output ALL cards including ones that were not changed. Nothing else — no intro, no summary, no commentary.`;

  const QUIZ_SYSTEM = `You are a quiz editor. The user will ask you to modify a set of quiz questions.
You MUST respond with ONLY the complete updated quiz in this EXACT format — no preamble, no explanation, no extra text of any kind:

1. [Question text]
A. [option]
B. [option]
C. [option] (correct)
D. [option]

Mark exactly one answer per question with (correct) after it. Output ALL questions including unchanged ones. Nothing else.`;

  let systemPrompt, currentData, renderer;

  if (currentMode === "flashcard") {
    systemPrompt = FLASHCARD_SYSTEM;
    currentData  = currentFlashcards.map(c => `Q: ${c.q}\nA: ${c.a}`).join("\n\n");
    renderer = (text) => {
      const pairs = parseFlashcards(text);
      if (pairs.length > 0) {
        currentFlashcards = pairs;
        if (currentSubject?.cache) { currentSubject.cache["flashcards"] = text; save(); }
        // Show resume prompt if there's progress to preserve, otherwise restart
        if (hasFCProgress()) {
          showFCResumePrompt(pairs);
        } else {
          startFlashcardSession(pairs);
        }
        typingDiv.innerHTML = `✅ Updated to ${pairs.length} cards.`;
      } else {
        typingDiv.innerHTML = `⚠️ Couldn't parse response as flashcards. Try rephrasing your request.`;
        console.warn("Unparseable AI response:", text);
      }
    };
  } else {
    systemPrompt = QUIZ_SYSTEM;
    currentData  = currentQuizQuestions.map((q, i) =>
      `${i + 1}. ${q.q}\n${q.options.map((o, oi) =>
        `${o.letter}. ${o.text}${oi === q.correct ? " (correct)" : ""}`
      ).join("\n")}`
    ).join("\n\n");
    renderer = (text) => {
      const qs = parseQuiz(text);
      if (qs.length > 0) {
        currentQuizQuestions = qs;
        renderQuizUI(qs);
        if (currentSubject?.cache) {
          const key = lastBtnId === "practiceTestBtn" ? "practiceTest" : "quiz";
          currentSubject.cache[key] = text; save();
        }
        typingDiv.innerHTML = `✅ Updated to ${qs.length} questions.`;
      } else {
        typingDiv.innerHTML = `⚠️ Couldn't parse response as quiz questions. Try rephrasing your request.`;
        console.warn("Unparseable AI response:", text);
      }
    };
  }

  const userPrompt = `Here are the current ${currentMode === "flashcard" ? "flashcards" : "quiz questions"}:\n\n${currentData}\n\nUser request: ${msg}`;

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
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }]
      })
    });
    const data = await res.json();
    if (!res.ok) { typingDiv.innerHTML = `API Error: ${data?.error?.message || "Unknown error"}`; return; }
    const text = data?.content?.[0]?.text?.replace(/<think>[\s\S]*?<\/think>/gi, "").trim() || "";
    renderer(text);
  } catch (err) {
    typingDiv.innerHTML = "Network error: " + err.message;
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
    } else if (currentA && line) { currentA += " " + line; }
  }
  if (currentQ && currentA) pairs.push({ q: currentQ, a: currentA });
  return pairs;
}

// =========================
// FLASHCARD PROGRESS HELPERS
// =========================
function saveFCProgress() {
  if (!currentSubject) return;
  currentSubject._fcProgress = {
    allCards:    fcSession.allCards,
    knownIds:    fcSession.known.map(c => c.id),
    unknownIds:  fcSession.unknown.map(c => c.id),
    roundNumber: fcSession.roundNumber
  };
  save();
}

function hasFCProgress() {
  const p = currentSubject?._fcProgress;
  if (!p || !Array.isArray(p.allCards) || p.allCards.length === 0) return false;
  return p.knownIds.length < p.allCards.length; // only if not fully complete
}

function resumeFCSession() {
  const p        = currentSubject._fcProgress;
  const allCards = p.allCards;
  const known    = allCards.filter(c => p.knownIds.includes(c.id));
  const unknown  = allCards.filter(c => p.unknownIds.includes(c.id));
  const seenIds  = [...p.knownIds, ...p.unknownIds];
  const unseen   = allCards.filter(c => !seenIds.includes(c.id));

  fcSession = {
    allCards,
    queue:       shuffle([...unknown, ...unseen]),
    unknown:     [],
    known,
    roundIndex:  0,
    roundNumber: p.roundNumber || 1,
    retest:      false
  };
  renderFCSession();
}

function showFCResumePrompt(pairs) {
  const p     = currentSubject._fcProgress;
  const done  = p.knownIds.length;
  const total = p.allCards.length;
  const html  = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
      gap:18px;padding:48px 24px;text-align:center;">
      <div style="font-size:2.5rem;">🃏</div>
      <h2 style="margin:0;font-size:1.3rem;font-weight:700;">Resume your session?</h2>
      <p style="margin:0;opacity:0.6;font-size:0.9rem;">
        You had mastered <strong>${done} / ${total}</strong> cards — Round ${p.roundNumber}
      </p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
        <button onclick="resumeFCSession()" style="padding:12px 28px;border-radius:10px;border:none;
          background:#fff;color:#000;font-weight:700;font-size:0.95rem;cursor:pointer;">▶ Continue</button>
        <button onclick="startFlashcardSession(currentFlashcards)" style="padding:12px 28px;border-radius:10px;
          border:1px solid rgba(255,255,255,0.2);background:transparent;color:#ccc;font-size:0.95rem;cursor:pointer;">
          ↺ Start Over</button>
      </div>
    </div>`;
  setOutput(html, true);
}

// =========================
// FLASHCARD RENDER ENTRY
// =========================
function renderFlashcards(text) {
  const pairs = parseFlashcards(text);
  if (pairs.length === 0) { setOutput(text); return; }
  currentFlashcards = pairs;
  if (hasFCProgress()) {
    showFCResumePrompt(pairs);
  } else {
    startFlashcardSession(pairs);
  }
  showEditPanel("flashcard");
}

// =========================
// FLASHCARD SESSION
// =========================
const RETEST_INTERVAL = 5;

function startFlashcardSession(pairs) {
  if (currentSubject) { currentSubject._fcProgress = null; save(); }
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
  saveFCProgress();

  if (s.known.length === s.allCards.length) {
    if (currentSubject) { currentSubject._fcProgress = null; save(); }
    setOutput(`
      <div class="fc-complete">
        <div class="fc-complete-icon">🎉</div>
        <h2 class="fc-complete-title">You nailed every card!</h2>
        <p class="fc-complete-sub">All ${s.allCards.length} cards mastered across ${s.roundNumber} round${s.roundNumber !== 1 ? "s" : ""}.</p>
        <div class="fc-score-bar-wrap"><div class="fc-score-bar" style="width:100%"></div></div>
        <button class="fc-restart-full-btn" onclick="startFlashcardSession(currentFlashcards)">↺ Study Again</button>
      </div>`, true);
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    awardXP(20);
    return;
  }

  if (!s.retest && s.roundIndex > 0 && s.roundIndex % RETEST_INTERVAL === 0 && s.unknown.length > 0) {
    s.retest = true; s.retestQueue = shuffle([...s.unknown]); s.retestIndex = 0; s.unknown = [];
  }

  if (s.retest) {
    if (s.retestIndex >= s.retestQueue.length) { s.retest = false; renderFCSession(); return; }
    renderFCCard(s.retestQueue[s.retestIndex], true);
    return;
  }

  if (s.roundIndex >= s.queue.length) {
    if (s.unknown.length === 0) { s.known = s.allCards; renderFCSession(); return; }
    s.roundNumber++; s.queue = shuffle([...s.unknown]); s.unknown = []; s.roundIndex = 0;
    renderFCSession();
    return;
  }

  renderFCCard(s.queue[s.roundIndex], false);
}

function renderFCCard(card, isRetest) {
  const s             = fcSession;
  const masteredCount = s.known.length;
  const totalCount    = s.allCards.length;
  const pct           = Math.round((masteredCount / totalCount) * 100);
  const pos           = isRetest ? s.retestIndex + 1 : s.roundIndex + 1;
  const total         = isRetest ? s.retestQueue.length : s.queue.length;
  const retestBadge   = isRetest ? `<span class="fc-retest-badge">🔁 Retest</span>` : "";
  const roundLabel    = isRetest
    ? `Reviewing ${s.retestQueue.length} card${s.retestQueue.length !== 1 ? "s" : ""} you missed`
    : `Round ${s.roundNumber} · ${masteredCount}/${totalCount} mastered`;

  const html = `
    <div class="fc-wrap">
      <div class="fc-top-bar">
        <div class="fc-progress-bar"><div class="fc-progress-fill" style="width:${pct}%"></div></div>
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
        <button class="fc-btn-unknown" onclick="fcMarkUnknown()" style="display:inline-flex;align-items:center;gap:8px;
          padding:14px 28px;border-radius:12px;border:2px solid rgba(248,113,113,0.4);
          background:rgba(248,113,113,0.1);color:#f87171;font-size:1rem;font-weight:600;
          cursor:pointer;min-width:150px;justify-content:center;"><span>😕</span> Don't Know It</button>
        <button class="fc-btn-known" onclick="fcMarkKnown()" style="display:inline-flex;align-items:center;gap:8px;
          padding:14px 28px;border-radius:12px;border:2px solid rgba(74,222,128,0.4);
          background:rgba(74,222,128,0.1);color:#4ade80;font-size:1rem;font-weight:600;
          cursor:pointer;min-width:150px;justify-content:center;"><span>💪</span> Know It!</button>
      </div>
      <div style="display:flex;justify-content:center;margin-top:16px;">
        <button onclick="startFlashcardSession(currentFlashcards)" style="padding:7px 18px;border-radius:8px;
          border:1px solid rgba(255,255,255,0.12);background:transparent;color:#555;
          font-size:0.8rem;cursor:pointer;transition:color 0.2s;" onmouseover="this.style.color='#999'"
          onmouseout="this.style.color='#555'">↺ Restart</button>
      </div>
      <p class="fc-kb-hint">Space = flip &nbsp;·&nbsp; ← Don't know &nbsp;·&nbsp; → Know it</p>
    </div>`;
  setOutput(html, true);
  setupFCSessionKeyboard();
}

window.fcFlip = function () {
  const inner = document.getElementById("fcInner");
  if (!inner) return;
  const isFlipped = inner.classList.toggle("flipped");
  if (isFlipped) {
    const verdict = document.getElementById("fcVerdict");
    if (verdict) {
      verdict.style.display        = "flex";
      verdict.style.gap            = "16px";
      verdict.style.justifyContent = "center";
      verdict.style.marginTop      = "20px";
      verdict.style.flexWrap       = "wrap";
    }
  }
};

window.fcMarkKnown = function () {
  const s    = fcSession;
  const card = s.retest ? s.retestQueue[s.retestIndex] : s.queue[s.roundIndex];
  if (!card) return;
  if (!s.known.find(c => c.id === card.id)) s.known.push(card);
  if (s.retest) s.retestIndex++; else s.roundIndex++;
  animateCardOut("right", renderFCSession);
};

window.fcMarkUnknown = function () {
  const s    = fcSession;
  const card = s.retest ? s.retestQueue[s.retestIndex] : s.queue[s.roundIndex];
  if (!card) return;
  s.known = s.known.filter(c => c.id !== card.id);
  if (!s.unknown.find(c => c.id === card.id)) s.unknown.push(card);
  if (s.retest) s.retestIndex++; else s.roundIndex++;
  animateCardOut("left", renderFCSession);
};

function animateCardOut(direction, cb) {
  const card = document.getElementById("fcCard");
  if (!card) { cb(); return; }
  card.style.transition = "transform 0.25s ease, opacity 0.25s ease";
  card.style.transform  = direction === "right" ? "translateX(120%) rotate(8deg)" : "translateX(-120%) rotate(-8deg)";
  card.style.opacity    = "0";
  setTimeout(cb, 240);
}

function setupFCSessionKeyboard() {
  document.onkeydown = (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === " ") { e.preventDefault(); fcFlip(); }
    else if (e.key === "ArrowRight") { const inner = document.getElementById("fcInner"); if (inner?.classList.contains("flipped")) window.fcMarkKnown(); }
    else if (e.key === "ArrowLeft")  { const inner = document.getElementById("fcInner"); if (inner?.classList.contains("flipped")) window.fcMarkUnknown(); }
  };
}

function renderFlashcardUI(pairs) { currentFlashcards = pairs; startFlashcardSession(pairs); }

// =========================
// QUIZ PARSER
// =========================
function parseQuiz(text) {
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const questions = [];
  const blocks    = text.split(/\n(?=\d+[\.\)])/);
  for (let block of blocks) {
    block = block.trim(); if (!block) continue;
    const lines   = block.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 3) continue;
    const qText   = lines[0].replace(/^\d+[\.\)]\s*/, "");
    const options = []; let correct = -1;
    for (let i = 1; i < lines.length; i++) {
      const line  = lines[i];
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
    html += `<div class="quiz-question" id="qq-${qi}">
      <p class="q-text"><strong>Q${qi + 1}.</strong> ${q.q}</p>
      <div class="q-options">`;
    q.options.forEach((opt, oi) => {
      html += `<button class="q-opt" onclick="answerQ(${qi},${oi},${q.correct})" id="opt-${qi}-${oi}">
        <span class="opt-letter">${opt.letter}</span> ${opt.text}</button>`;
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

window.answerQ = function (qi, oi, correct) {
  const qd = window._quizData; if (!qd) return;
  document.querySelectorAll(`#qq-${qi} .q-opt`).forEach(b => b.disabled = true);
  const chosen = document.getElementById(`opt-${qi}-${oi}`);
  const fb     = document.getElementById(`fb-${qi}`);
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
    const pct     = Math.round((qd.correct / qd.total) * 100);
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
  "Summarize all the key concepts and important points from this study material. Use headers, bold key terms, and bullet points.", "summarizeBtn"
);
document.getElementById("flashcardBtn").onclick = () => runToolFull(
  `Read ALL of the study material and create a flashcard for EVERY distinct fact, term, definition, concept, date, formula, process, and key point — no matter how many cards that takes. Do not stop early. Do not group things together to save cards.

STRICT RULES:
- One card per fact. If there are 40 facts, make 40 cards.
- Questions: specific and exam-style.
- Answers: MAX 1 sentence or 3–5 word list.
- NO vague questions. NO filler, preamble, or commentary. Output ONLY the cards.

EXACT FORMAT:
Q: [question]
A: [answer]`, "flashcardBtn", renderFlashcards
);
document.getElementById("quizBtn").onclick = () => runToolFull(
  `Read ALL of the study material and generate a multiple choice question for every major concept, fact, term, and process — minimum 10.

EXACT FORMAT:
1. [Question text]
A. [option]
B. [option]
C. [option] (correct)
D. [option]

Mark the correct answer with (correct) after it.`, "quizBtn", renderQuiz
);
document.getElementById("studyPlanBtn").onclick = () => runTool(
  "Create a structured study plan for mastering this material. Break it into daily sessions with specific topics. Use bold headings and bullet points.", "studyPlanBtn"
);
document.getElementById("eli5Btn").onclick = () => runTool(
  "Explain the main concepts from this study material like I am 5 years old. Use simple words, fun analogies, and bullet points.", "eli5Btn"
);
document.getElementById("mnemonicBtn").onclick = () => runTool(
  "Create memory tricks, mnemonics, and acronyms to help remember the key concepts. Use bold for the mnemonics.", "mnemonicBtn"
);
document.getElementById("practiceTestBtn").onclick = () => runToolFull(
  `Read ALL of the study material and generate a comprehensive practice test covering every topic — minimum 15 questions.

EXACT FORMAT:
1. [Question text]
A. [option]
B. [option]
C. [option] (correct)
D. [option]

Mark the correct answer with (correct) after it.`, "practiceTestBtn", renderQuiz
);
document.getElementById("weaknessBtn").onclick = () => runTool(
  "Identify the 3-5 most complex or tricky concepts in this material. Use bold headers for each concept, explain why it is difficult, and give tips for mastering it.", "weaknessBtn"
);

// =========================
// CHAT
// =========================
document.getElementById("sendBtn").onclick = sendMessage;
document.getElementById("chatInput").addEventListener("keydown", (e) => { if (e.key === "Enter") sendMessage(); });

async function sendMessage() {
  const input = document.getElementById("chatInput");
  const msg   = input.value.trim();
  if (!msg || !currentSubject) return;
  addMessage(msg, "user"); input.value = "";
  const typingDiv = addMessage("...", "ai");
  const reply     = await askAI(msg);
  const clean     = reply.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  typingDiv.innerHTML = renderMarkdown(clean);
  currentSubject.chatHistory.push({ role: "user", content: msg });
  currentSubject.chatHistory.push({ role: "ai",   content: clean });
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
  currentSubject.files.forEach(f => { const li = document.createElement("li"); li.textContent = "📄 " + f.name; list.appendChild(li); });
  document.getElementById("subjectSubtitle").innerText = `${currentSubject.files.length} file(s) uploaded`;
}

// =========================
// XP & LEVELS
// =========================
function awardXP(amount) {
  if (!currentSubject) return;
  currentSubject.xp = (currentSubject.xp || 0) + amount;
  const newLevel = Math.floor(currentSubject.xp / 100) + 1;
  if (newLevel > currentSubject.level) { currentSubject.level = newLevel; confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } }); }
  document.getElementById("xp").innerText    = currentSubject.xp;
  document.getElementById("level").innerText = currentSubject.level;
  save();
}

// =========================
// SHUFFLE
// =========================
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// =========================
// THEME TOGGLE
// =========================
const themeBtn   = document.getElementById("themeToggle");
const savedTheme = localStorage.getItem("theme") || "dark";
if (savedTheme === "light") { document.body.classList.add("light"); if (themeBtn) themeBtn.textContent = "🌞 Light Mode"; }
else { if (themeBtn) themeBtn.textContent = "🌙 Dark Mode"; }

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
// RESET API KEY BUTTON
// =========================
document.getElementById("resetKeyBtn")?.addEventListener("click", () => {
  const newKey = prompt("Enter new Claude API key:");
  if (!newKey || !newKey.trim()) return;
  if (!newKey.trim().startsWith("sk-")) { alert("That doesn't look like a valid key."); return; }
  if (currentUser) { currentUser.apiKey = newKey.trim(); localStorage.setItem(AUTH_KEY, JSON.stringify(currentUser)); }
  CLAUDE_API_KEY = newKey.trim();
  showToast("✅ API key updated");
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
function formatTime(s) { return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; }
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
