// =========================
// SUPABASE CONFIG
// =========================
const SUPABASE_URL  = "https://pdteyiowlyvlqdqdhhkg.supabase.co";
const SUPABASE_ANON = "sb_publishable_RUhKJwZqo9L9dFVcTU3eaA_mrydsyvq";

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
// FLASHCARD HTML EXPORT
// =========================
function downloadFlashcardsHTML() {
  if (!currentFlashcards || currentFlashcards.length === 0) {
    showToast("No flashcards to download. Generate flashcards first.", "#f87171");
    return;
  }

  const subjectName = currentSubject?.name || "Flashcards";
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const cardsHTML = currentFlashcards.map((card, i) => `
    <div class="card" id="card-${i}">
      <div class="card-inner" id="inner-${i}">
        <div class="card-front">
          <span class="card-num">${i + 1} / ${currentFlashcards.length}</span>
          <p class="card-text">${card.q}</p>
          <span class="card-hint">click to flip</span>
        </div>
        <div class="card-back">
          <span class="card-num">${i + 1} / ${currentFlashcards.length}</span>
          <p class="card-text">${card.a}</p>
          <span class="card-hint">click to flip back</span>
        </div>
      </div>
    </div>`).join("");

  const listHTML = currentFlashcards.map((card, i) => `
    <div class="list-card">
      <div class="list-q">Q${i + 1}. ${card.q}</div>
      <div class="list-a">A: ${card.a}</div>
    </div>`).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subjectName} — Flashcards</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Inter:wght@400;500&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #0a0a0a; color: #f0f0f0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 40px 20px; }
    header { text-align: center; margin-bottom: 36px; }
    header h1 { font-family: 'Sora', sans-serif; font-size: 1.8rem; font-weight: 700; margin-bottom: 6px; }
    header p { color: #555; font-size: 0.85rem; }
    .controls { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; flex-wrap: wrap; justify-content: center; }
    .btn { padding: 9px 20px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.07); color: #ccc; font-size: 0.88rem; font-family: inherit; cursor: pointer; transition: background 0.2s, color 0.2s; }
    .btn:hover { background: rgba(255,255,255,0.13); color: #fff; }
    .btn.primary { background: #fff; color: #000; border-color: #fff; font-weight: 600; }
    .btn.primary:hover { background: #e0e0e0; }
    .counter { color: #555; font-size: 0.88rem; min-width: 80px; text-align: center; }
    .progress-wrap { width: 100%; max-width: 520px; height: 4px; background: rgba(255,255,255,0.08); border-radius: 4px; margin-bottom: 28px; overflow: hidden; }
    .progress-fill { height: 100%; background: #fff; border-radius: 4px; transition: width 0.3s ease; }
    .card-stage { width: 100%; max-width: 520px; perspective: 1200px; margin-bottom: 24px; }
    .card { display: none; cursor: pointer; }
    .card.active { display: block; }
    .card-inner { width: 100%; min-height: 280px; position: relative; transform-style: preserve-3d; transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1); border-radius: 18px; }
    .card-inner.flipped { transform: rotateY(180deg); }
    .card-front, .card-back { position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; border-radius: 18px; padding: 36px 32px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 16px; min-height: 280px; }
    .card-front { background: #141414; border: 1px solid rgba(255,255,255,0.1); }
    .card-back { background: #181825; border: 1px solid rgba(120,120,255,0.2); transform: rotateY(180deg); }
    .card-num { color: #444; font-size: 0.75rem; letter-spacing: 0.08em; }
    .card-text { font-size: 1.15rem; line-height: 1.6; color: #f0f0f0; font-family: 'Sora', sans-serif; }
    .card-back .card-text { color: #c8c8ff; }
    .card-hint { color: #333; font-size: 0.75rem; margin-top: 8px; }
    .verdict { display: none; justify-content: center; gap: 14px; margin-top: 20px; flex-wrap: wrap; }
    .verdict.visible { display: flex; }
    .verdict-btn { display: inline-flex; align-items: center; gap: 8px; padding: 14px 32px; border-radius: 14px; font-size: 1rem; font-weight: 700; font-family: inherit; cursor: pointer; min-width: 160px; justify-content: center; transition: transform 0.15s, opacity 0.15s; }
    .verdict-btn:hover { transform: translateY(-2px); opacity: 0.9; }
    .verdict-btn.unknown { border: 2px solid rgba(248,113,113,0.5); background: rgba(248,113,113,0.12); color: #f87171; }
    .verdict-btn.known { border: 2px solid rgba(74,222,128,0.5); background: rgba(74,222,128,0.12); color: #4ade80; }
    .score-row { display: flex; gap: 12px; margin-top: 4px; margin-bottom: 16px; justify-content: center; flex-wrap: wrap; }
    .chip { padding: 5px 14px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; }
    .chip.known { background: rgba(74,222,128,0.1); color: #4ade80; border: 1px solid rgba(74,222,128,0.25); }
    .chip.unknown { background: rgba(248,113,113,0.1); color: #f87171; border: 1px solid rgba(248,113,113,0.25); }
    .all-cards { width: 100%; max-width: 520px; display: none; flex-direction: column; gap: 12px; margin-top: 12px; }
    .all-cards.visible { display: flex; }
    .list-card { background: #111; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 18px 22px; }
    .list-q { font-weight: 600; margin-bottom: 8px; font-size: 0.92rem; }
    .list-a { color: #888; font-size: 0.88rem; line-height: 1.5; }
    footer { margin-top: 48px; color: #2a2a2a; font-size: 0.75rem; text-align: center; }
  </style>
</head>
<body>
  <header>
    <h1>📚 ${subjectName}</h1>
    <p>Flashcards · ${currentFlashcards.length} cards · ${date}</p>
  </header>
  <div class="controls">
    <button class="btn" onclick="prev()">← Prev</button>
    <span class="counter" id="counter">1 / ${currentFlashcards.length}</span>
    <button class="btn" onclick="next()">Next →</button>
    <button class="btn primary" onclick="flipCard()">Flip</button>
    <button class="btn" onclick="toggleList()" id="listToggleBtn">☰ All Cards</button>
  </div>
  <div class="progress-wrap"><div class="progress-fill" id="progressFill" style="width:${(1 / currentFlashcards.length * 100).toFixed(1)}%"></div></div>
  <div class="score-row">
    <span class="chip known" id="knownChip">✅ Known: 0</span>
    <span class="chip unknown" id="unknownChip">❌ To learn: ${currentFlashcards.length}</span>
  </div>
  <div class="card-stage">${cardsHTML}</div>
  <div class="verdict" id="verdict">
    <button class="verdict-btn unknown" onclick="markUnknown()">😕 Still Learning</button>
    <button class="verdict-btn known" onclick="markKnown()">💪 Know It!</button>
  </div>
  <div class="all-cards" id="allCards">${listHTML}</div>
  <footer>Generated by StudyFlow AI</footer>
  <script>
    let current = 0;
    const total = ${currentFlashcards.length};
    const cards = document.querySelectorAll('.card');
    let known = 0;
    function show(idx) {
      cards.forEach(c => c.classList.remove('active'));
      const prevInner = document.getElementById('inner-' + current);
      if (prevInner) prevInner.classList.remove('flipped');
      document.getElementById('verdict').classList.remove('visible');
      current = ((idx % total) + total) % total;
      cards[current].classList.add('active');
      document.getElementById('counter').textContent = (current + 1) + ' / ' + total;
      document.getElementById('progressFill').style.width = ((current + 1) / total * 100).toFixed(1) + '%';
    }
    function flipCard() {
      const inner = document.getElementById('inner-' + current);
      if (!inner) return;
      const flipped = inner.classList.toggle('flipped');
      document.getElementById('verdict').classList.toggle('visible', flipped);
    }
    function markKnown() { known = Math.min(known + 1, total); document.getElementById('knownChip').textContent = '✅ Known: ' + known; document.getElementById('unknownChip').textContent = '❌ To learn: ' + (total - known); next(); }
    function markUnknown() { next(); }
    function next() { show(current + 1); }
    function prev() { show(current - 1); }
    function toggleList() { const list = document.getElementById('allCards'); const btn = document.getElementById('listToggleBtn'); const visible = list.classList.toggle('visible'); btn.textContent = visible ? '✕ Hide List' : '☰ All Cards'; }
    cards.forEach(c => c.addEventListener('click', flipCard));
    document.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === ' ') { e.preventDefault(); flipCard(); }
    });
    show(0);
  <\/script>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${subjectName.replace(/[^a-z0-9]/gi, "_")}_flashcards.html`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("⬇️ Flashcards downloaded!");
}

// =========================
// SUPABASE HELPERS
// =========================
async function cloudSave() {
  if (!currentUser) return;
  const now = Date.now();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/user_data`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON, "Authorization": `Bearer ${SUPABASE_ANON}`, "Prefer": "resolution=merge-duplicates" },
      body: JSON.stringify({ username: currentUser.username, subjects: subjects, saved_at: now })
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

function scheduleSyncSave() { clearTimeout(syncTimeout); syncTimeout = setTimeout(cloudSave, 1500); }
function save() { localStorage.setItem("subjects", JSON.stringify(subjects)); scheduleSyncSave(); }

// =========================
// TOAST
// =========================
function showToast(msg, color) {
  const existing = document.getElementById("syncToast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.id = "syncToast";
  toast.textContent = msg;
  toast.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(10px);background:#111;border:1px solid ${color || "rgba(255,255,255,0.15)"};color:${color ? "#fff" : "#ccc"};padding:10px 22px;border-radius:12px;font-size:0.88rem;font-family:inherit;box-shadow:0 8px 32px rgba(0,0,0,0.5);z-index:99999;opacity:0;transition:opacity 0.3s,transform 0.3s;pointer-events:none;`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity = "1"; toast.style.transform = "translateX(-50%) translateY(0)"; });
  setTimeout(() => { toast.style.opacity = "0"; toast.style.transform = "translateX(-50%) translateY(10px)"; setTimeout(() => toast.remove(), 300); }, 3000);
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
  overlay.style.cssText = `position:fixed;inset:0;z-index:99998;display:flex;align-items:center;justify-content:center;background:#000;font-family:'Inter',sans-serif;`;
  overlay.innerHTML = `
    <div style="width:100%;max-width:440px;padding:48px 40px;background:#0d0d0d;border-radius:20px;border:1px solid rgba(255,255,255,0.09);box-shadow:0 32px 80px rgba(0,0,0,0.7);">
      <div style="text-align:center;margin-bottom:36px;">
        <div style="font-size:2.5rem;margin-bottom:14px;">📚</div>
        <h1 style="color:#f0f0f0;font-size:1.6rem;font-weight:700;margin:0 0 8px;font-family:'Sora',sans-serif;">StudyFlow AI</h1>
        <p style="color:#555;font-size:0.88rem;margin:0;">Sign in to sync your subjects across devices</p>
      </div>
      <div id="loginError" style="display:none;background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.3);color:#f87171;padding:10px 14px;border-radius:10px;font-size:0.85rem;margin-bottom:18px;"></div>
      <div style="margin-bottom:16px;">
        <label style="display:block;color:#666;font-size:0.75rem;margin-bottom:7px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;">Username</label>
        <input id="loginUsername" type="text" placeholder="e.g. alexsmith" autocomplete="username" style="width:100%;box-sizing:border-box;padding:12px 16px;background:#161616;border:1px solid rgba(255,255,255,0.09);border-radius:10px;color:#f0f0f0;font-size:0.95rem;outline:none;font-family:inherit;transition:border-color 0.2s;">
      </div>
      <div style="margin-bottom:28px;">
        <label style="display:block;color:#666;font-size:0.75rem;margin-bottom:7px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;">Claude API Key</label>
        <div style="position:relative;">
          <input id="loginApiKey" type="password" placeholder="sk-ant-..." autocomplete="off" style="width:100%;box-sizing:border-box;padding:12px 44px 12px 16px;background:#161616;border:1px solid rgba(255,255,255,0.09);border-radius:10px;color:#f0f0f0;font-size:0.95rem;outline:none;font-family:inherit;transition:border-color 0.2s;">
          <button id="eyeToggle" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;color:#555;cursor:pointer;font-size:15px;padding:4px;">👁</button>
        </div>
        <p style="color:#444;font-size:0.76rem;margin:8px 0 0;line-height:1.5;">Your key is saved <strong style="color:#666">only on this device</strong>. Your subjects sync by username across devices.</p>
      </div>
      <button id="loginSubmitBtn" style="width:100%;padding:13px;background:#fff;border:none;border-radius:10px;color:#000;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit;letter-spacing:0.02em;transition:opacity 0.2s,transform 0.1s;">Sign In / Create Account</button>
      <p style="text-align:center;color:#333;font-size:0.76rem;margin:20px 0 0;line-height:1.6;">New username = new account · Same username on any device = your data loads</p>
    </div>`;
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

  btn.textContent = "Validating key..."; btn.style.opacity = "0.7"; btn.disabled = true;

  try {
    const testRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
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
    revealApp(); renderSubjects();
    showToast(`✅ Loaded ${subjects.length} subject${subjects.length !== 1 ? "s" : ""} from your account`);
  } else {
    subjects = JSON.parse(localStorage.getItem("subjects")) || [];
    document.getElementById("loginOverlay").remove();
    revealApp(); renderSubjects();
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
    <button id="userBadgeBtn" style="width:100%;display:flex;align-items:center;gap:10px;padding:9px 14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#ccc;font-size:0.84rem;font-family:inherit;cursor:pointer;transition:background 0.2s;text-align:left;">
      <span style="font-size:1rem;">👤</span>
      <span style="flex:1;font-weight:500;">@${username}</span>
      <span style="color:#444;font-size:0.7rem;">▾</span>
    </button>
    <div id="userDropdown" style="display:none;position:absolute;bottom:calc(100% + 6px);left:0;right:0;background:#111;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:6px;z-index:9999;box-shadow:0 -8px 32px rgba(0,0,0,0.6);">
      <div style="padding:8px 12px 10px;border-bottom:1px solid rgba(255,255,255,0.07);margin-bottom:4px;">
        <div style="color:#f0f0f0;font-weight:600;font-size:0.88rem;">@${username}</div>
        <div style="color:#444;font-size:0.75rem;margin-top:2px;">☁️ Synced across devices</div>
      </div>
      <button class="udd-btn" id="uddUpdateKey">🔑  Update API Key</button>
      <button class="udd-btn" id="uddSync">☁️  Force Sync Now</button>
      <button class="udd-btn" id="uddLogout" style="color:#f87171;">↩  Sign Out</button>
    </div>`;

  if (!document.getElementById("uddStyles")) {
    const s = document.createElement("style");
    s.id = "uddStyles";
    s.textContent = `.udd-btn{display:block;width:100%;text-align:left;padding:8px 12px;background:none;border:none;color:#aaa;font-size:0.84rem;font-family:inherit;cursor:pointer;border-radius:8px;transition:background 0.15s;}.udd-btn:hover{background:rgba(255,255,255,0.06);}`;
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
    currentUser.apiKey = newKey.trim(); CLAUDE_API_KEY = newKey.trim();
    localStorage.setItem(AUTH_KEY, JSON.stringify(currentUser));
    showToast("✅ API key updated on this device");
  };

  wrap.querySelector("#uddSync").onclick = async () => { dropdown.style.display = "none"; await cloudSave(); showToast("☁️ Synced to cloud"); };

  wrap.querySelector("#uddLogout").onclick = () => {
    dropdown.style.display = "none";
    if (!confirm("Sign out? Your data is saved to the cloud.")) return;
    localStorage.removeItem(AUTH_KEY);
    currentUser = null; CLAUDE_API_KEY = ""; subjects = []; currentSubject = null;
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

        revealApp(); renderSubjects(); addUserBadge(auth.username);
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
  summarizeBtn: "summary",
  flashcardBtn: "flashcards",
  quizBtn:      "quiz",
  studyPlanBtn: "studyPlan",
  eli5Btn:      "eli5",
  mnemonicBtn:  "mnemonics",
  weaknessBtn:  "weakness"
};

const TOOL_NAMES = {
  summarizeBtn: "Summary",
  flashcardBtn: "Flashcards",
  quizBtn:      "Quiz",
  studyPlanBtn: "Study Plan",
  eli5Btn:      "ELI5",
  mnemonicBtn:  "Memory Tricks",
  weaknessBtn:  "Weak Spots"
};

// =========================
// SUBJECT CREATION
// =========================
document.getElementById("newSubjectBtn").onclick = () => {
  const name = prompt("Subject name?");
  if (!name || !name.trim()) return;
  subjects.push({ id: Date.now(), name: name.trim(), files: [], chunks: [], chatHistory: [], xp: 0, level: 1, streak: 0, cache: {}, savedQuizzes: [] });
  save(); renderSubjects();
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
    renameBtn.className = "subject-action-btn rename-btn"; renameBtn.title = "Rename"; renameBtn.innerHTML = "✏️";
    renameBtn.onclick = (e) => { e.stopPropagation(); renameSubject(sub.id); };
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "subject-action-btn delete-btn"; deleteBtn.title = "Delete"; deleteBtn.innerHTML = "🗑️";
    deleteBtn.onclick = (e) => { e.stopPropagation(); deleteSubject(sub.id); };
    actions.appendChild(renameBtn); actions.appendChild(deleteBtn);
    div.appendChild(info); div.appendChild(actions);
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
  if (currentSubject?.id === id) { currentSubject.name = sub.name; document.getElementById("subjectTitle").innerText = sub.name; }
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
  if (!currentSubject.savedQuizzes) currentSubject.savedQuizzes = [];
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
function chunkText(text, fileName, size = 2000) {
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
    .map(c => { let score = 0; const t = c.text.toLowerCase(); for (let w of words) if (t.includes(w)) score += 2; return { ...c, score }; })
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);
}

function getAllChunksContext() {
  if (!currentSubject || !currentSubject.chunks.length) return "";
  return currentSubject.chunks.map(c => c.text).join("\n\n");
}
// =========================
// CUT-OFF DETECTION
// =========================
function looksComplete(text, mode) {
  const trimmed = text.trimEnd();
  if (mode === "flashcard") {
    const lines = trimmed.split("\n").map(l => l.trim()).filter(Boolean);
    const last  = lines[lines.length - 1] || "";
    return last.match(/^A[:)]/i) !== null && last.length > 4;
  }
  if (mode === "quiz") {
    const lines = trimmed.split("\n").map(l => l.trim()).filter(Boolean);
    const last  = lines[lines.length - 1] || "";
    return last.match(/^[A-Da-d][\.\)]\s+.+/) !== null;
  }
  return /[.!?\n]$/.test(trimmed) || trimmed.endsWith("</ul>") || trimmed.endsWith("</p>") || /^A[:)].+$/m.test(trimmed);
}

// =========================
// COVERAGE SELF-CHECK
// =========================
async function selfCheckCoverage(generatedText, materialContext, mode) {
  const label  = mode === "flashcard" ? "flashcards" : "quiz questions";
  const prompt = `You are a thorough study assistant auditing a set of ${label}.

Below is the STUDY MATERIAL followed by the GENERATED ${label.toUpperCase()}.

Your job:
1. List every distinct topic, concept, term, date, formula, and process in the study material.
2. Check whether the generated ${label} cover each one.
3. Return ONLY a JSON object — no preamble, no markdown fences:
{"complete": true/false, "missing": ["topic 1", "topic 2", ...]}

STUDY MATERIAL:
${materialContext.slice(0, 8000)}

GENERATED ${label.toUpperCase()}:
${generatedText.slice(0, 6000)}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 1000,
        system: "You are a coverage auditor. Respond ONLY with a valid JSON object. No markdown, no explanation.",
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await res.json();
    if (!res.ok) return { complete: true, missing: [] };
    const raw    = (data?.content?.[0]?.text || "").replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(raw);
    return { complete: !!parsed.complete, missing: Array.isArray(parsed.missing) ? parsed.missing : [] };
  } catch (e) { console.warn("selfCheckCoverage error:", e); return { complete: true, missing: [] }; }
}

// =========================
// GENERATE MISSING CONTENT
// =========================
async function generateMissingContent(missingTopics, materialContext, mode) {
  const isFC      = mode === "flashcard";
  const topicList = missingTopics.map((t, i) => `${i + 1}. ${t}`).join("\n");
  const formatInstructions = isFC
    ? `Output ONLY flashcards in this exact format — no preamble:\nQ: [question]\nA: [answer]`
    : `Output ONLY quiz questions in this exact format — no preamble, one blank line between questions:\n1. [Question text]\nA. [option]\nB. [option]\nC. [option] (correct)\nD. [option]`;

  const prompt = `The following topics were NOT covered in the previously generated ${isFC ? "flashcards" : "quiz"}.
Generate ${isFC ? "one flashcard per topic" : "one quiz question per topic"} for EACH missing topic below.
Only use information from the study material. Do not skip any topic.

MISSING TOPICS:\n${topicList}

STUDY MATERIAL:\n${materialContext.slice(0, 10000)}

${formatInstructions}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 4000,
        system: isFC
          ? "You are a flashcard generator. Output ONLY Q:/A: pairs. No commentary."
          : "You are a quiz generator. Output ONLY numbered questions with A/B/C/D options. Mark one answer (correct). No commentary.",
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await res.json();
    if (!res.ok) return "";
    return (data?.content?.[0]?.text || "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  } catch (e) { console.warn("generateMissingContent error:", e); return ""; }
}

// =========================
// COVERAGE LOOP
// =========================
async function runCoverageLoop(result, context, mode, outputEl) {
  if (!mode) return result;
  const MAX_ROUNDS = 3;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    outputEl.innerHTML = `<p style="opacity:0.5">🔍 Checking coverage (pass ${round + 1} of ${MAX_ROUNDS})...</p>`;
    const check = await selfCheckCoverage(result, context, mode);

    if (check.complete || check.missing.length === 0) {
      showToast("✅ Coverage verified — nothing missed!");
      break;
    }

    const gapCount = check.missing.length;
    showToast(`⚠️ Found ${gapCount} uncovered topic${gapCount !== 1 ? "s" : ""} — filling gaps...`, "#facc15");
    outputEl.innerHTML = `<p style="opacity:0.5">➕ Generating ${gapCount} missing topic${gapCount !== 1 ? "s" : ""}...</p>`;

    const extra = await generateMissingContent(check.missing, context, mode);
    if (!extra) break;

    if (mode === "quiz") {
      const existingCount = (result.match(/^\d+\./gm) || []).length;
      let counter = existingCount + 1;
      const renumbered = extra.replace(/^\d+\./gm, () => `${counter++}.`);
      result = result + "\n\n" + renumbered;
    } else {
      result = result + "\n\n" + extra;
    }

    if (round === MAX_ROUNDS - 1 && gapCount > 0) {
      showToast(`ℹ️ Some topics may still need manual review.`, "#888");
    }
  }

  return result;
}

// =========================
// CONTINUE IF CUT OFF
// =========================
async function continueIfCutOff(result, originalContext, taskPrompt, systemPrompt, mode) {
  if (looksComplete(result, mode)) return result;

  const userWantsContinue = confirm("⚠️ The response looks like it may have been cut off.\n\nClick OK to continue generating, or Cancel to keep what you have.");
  if (!userWantsContinue) return result;

  document.getElementById("output").innerHTML = `<p style="opacity:0.5">⏳ Continuing generation...</p>`;
  let fullResult  = result;
  let attempts    = 0;
  const MAX_CONTINUES = 4;

  while (!looksComplete(fullResult, mode) && attempts < MAX_CONTINUES) {
    try {
      const contRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 8000,
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
      if (looksComplete(fullResult, mode)) break;
      if (attempts < MAX_CONTINUES) {
        const keepGoing = confirm(`⚠️ Still looks incomplete. Continue again? (${MAX_CONTINUES - attempts} attempt${MAX_CONTINUES - attempts !== 1 ? "s" : ""} remaining)`);
        if (!keepGoing) break;
      }
    } catch (err) { console.error("Continue error:", err); break; }
  }
  return fullResult;
}

// =========================
// MAP-REDUCE AI WITH COVERAGE CHECK
// =========================
async function mapReduceAI(taskPrompt, systemPrompt, mode) {
  const context    = getAllChunksContext();
  const BATCH_SIZE = 6000;
  const OVERLAP    = 300;
  const batches    = [];
  for (let i = 0; i < context.length; i += BATCH_SIZE - OVERLAP) {
    batches.push(context.slice(i, i + BATCH_SIZE));
  }

  const outputEl = document.getElementById("output");

  if (batches.length === 1) {
    outputEl.innerHTML = `<p style="opacity:0.5">⏳ Generating from material...</p>`;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 8000,
        system: systemPrompt || "You are a study assistant. List every single fact, term, definition, date, formula, concept, and key point from this section as short bullet points. One bullet per fact. Be exhaustive.",
        messages: [{ role: "user", content: `SUBJECT: ${currentSubject.name}\n\nSTUDY MATERIAL:\n${batches[0]}\n\nTASK:\n${taskPrompt}` }]
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || "API error");
    let result = data?.content?.[0]?.text?.trim() || "";
    result = await continueIfCutOff(result, batches[0], taskPrompt, systemPrompt, mode);
    result = await runCoverageLoop(result, context, mode, outputEl);
    return result;
  }

  let partialResults = [];
  for (let i = 0; i < batches.length; i++) {
    outputEl.innerHTML = `<p style="opacity:0.5">⏳ Reading section ${i + 1} of ${batches.length}...</p>`;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 3000,
        system: "You are a study assistant. Extract and preserve ALL key facts, terms, definitions, dates, formulas, and concepts from this material section. Be thorough.",
        messages: [{ role: "user", content: `SUBJECT: ${currentSubject.name}\n\nMATERIAL SECTION ${i + 1} of ${batches.length}:\n${batches[i]}\n\nTASK: ${taskPrompt}` }]
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || "API error");
    partialResults.push(data?.content?.[0]?.text?.trim() || "");
  }

  outputEl.innerHTML = `<p style="opacity:0.5">⏳ Combining all ${batches.length} sections...</p>`;
  const combined  = partialResults.map((r, i) => `--- Section ${i + 1} ---\n${r}`).join("\n\n");
  const reduceRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 16000,
      system: systemPrompt || "You are a study assistant. Combine the section results into one complete, well-organized final output. Do not lose any facts or cards.",
      messages: [{ role: "user", content: `SUBJECT: ${currentSubject.name}\n\nSECTION RESULTS:\n${combined}\n\nFINAL TASK: ${taskPrompt}` }]
    })
  });
  const reduceData = await reduceRes.json();
  if (!reduceRes.ok) throw new Error(reduceData?.error?.message || "API error");
  let result = reduceData?.content?.[0]?.text?.trim() || "";
  result = await continueIfCutOff(result, combined, taskPrompt, systemPrompt, mode);
  result = await runCoverageLoop(result, context, mode, outputEl);
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
    result = await continueIfCutOff(result, context, prompt, system, undefined);
    return result;
  } catch (err) { return `Network/API error: ${err.message}`; }
}

// =========================
// CLAUDE API — FULL CONTEXT
// =========================
async function askAIFull(prompt, systemPrompt, mode) {
  if (!currentSubject) return "Select a subject first.";
  if (!currentSubject.chunks.length) return "No study material uploaded yet. Add files first.";
  try { return await mapReduceAI(prompt, systemPrompt, mode); }
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
  bar.style.cssText = `display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;margin-bottom:14px;border-radius:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);font-size:0.83rem;color:#888;flex-shrink:0;`;
  bar.innerHTML = `<span>📌 Showing saved ${TOOL_NAMES[btnId] || "result"}</span>
    <button id="inlineRegenBtn" style="padding:5px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:transparent;color:inherit;cursor:pointer;font-size:0.82rem;white-space:nowrap;">🔄 Regenerate</button>`;
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
// TOOL RUNNER FULL — map-reduce with coverage check
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
    else if (btnId === "quizBtn")  showEditPanel("quiz");
    return;
  }
  activeTool = btnId;
  const btn  = document.getElementById(btnId);
  btn.disabled = true; btn.classList.add("loading");
  document.getElementById("output").innerHTML = `<p style="opacity:0.5">⏳ Generating from full material...</p>`;
  hideEditPanel(); hideCacheBar();

  const mode = btnId === "flashcardBtn" ? "flashcard" : btnId === "quizBtn" ? "quiz" : undefined;

  try {
    const result = await askAIFull(prompt, undefined, mode);
    if (cacheKey) { currentSubject.cache[cacheKey] = result; save(); }
    showResultWithBar(btnId, renderer, result);
    awardXP(10);
  } catch (e) {
    document.getElementById("output").innerHTML = `<p style="color:#f87171">Error: ${e.message}</p>`;
  }

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
  document.getElementById("editPanelTitle").textContent = mode === "flashcard" ? "✏️ Edit Flashcards" : "✏️ Edit Quiz";
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
// EDIT MESSAGE
// =========================
async function sendEditMessage() {
  const input = document.getElementById("editInput");
  const msg   = input.value.trim();
  if (!msg) return;
  addEditMessage(msg, "user");
  input.value = "";
  const typingDiv = addEditMessage("⏳ Thinking...", "ai");

  const FLASHCARD_SYSTEM = `You are a flashcard editor. The user will ask you to modify a set of flashcards.
You MUST respond with ONLY the complete updated flashcard set in this EXACT format — no preamble, no explanation, no extra text:

Q: [question]
A: [answer]

Every single card must start with "Q: " on its own line followed by "A: " on the next line.
Output ALL cards including ones that were not changed. Nothing else.`;

  const QUIZ_SYSTEM = `You are a quiz editor. The user will ask you to modify a set of quiz questions.
You MUST respond with ONLY the complete updated quiz in this EXACT format — no preamble, no explanation:

1. [Question text]
A. [option]
B. [option]
C. [option] (correct)
D. [option]

Mark exactly one answer per question with (correct) after it. Output ALL questions. Nothing else.`;

  let systemPrompt, currentData, renderer;

  if (currentMode === "flashcard") {
    systemPrompt = FLASHCARD_SYSTEM;
    currentData  = currentFlashcards.map(c => `Q: ${c.q}\nA: ${c.a}`).join("\n\n");
    renderer = (text) => {
      const pairs = parseFlashcards(text);
      if (pairs.length > 0) {
        currentFlashcards = pairs;
        if (currentSubject?.cache) { currentSubject.cache["flashcards"] = text; save(); }
        if (hasFCProgress()) { showFCResumePrompt(pairs); } else { startFlashcardSession(pairs); }
        typingDiv.innerHTML = `✅ Updated to ${pairs.length} cards.`;
      } else {
        typingDiv.innerHTML = `⚠️ Couldn't parse response as flashcards. Try rephrasing.`;
      }
    };
  } else {
    systemPrompt = QUIZ_SYSTEM;
    currentData  = currentQuizQuestions.map((q, i) =>
      `${i + 1}. ${q.q}\n${q.options.map((o, oi) => `${o.letter}. ${o.text}${oi === q.correct ? " (correct)" : ""}`).join("\n")}`
    ).join("\n\n");
    renderer = (text) => {
      const qs = parseQuiz(text);
      if (qs.length > 0) {
        currentQuizQuestions = qs;
        openQuizInNewTab(qs);
        setOutput(`<p style="opacity:0.6">✅ Quiz updated and opened in a new tab — ${qs.length} questions.</p>`);
        if (currentSubject?.cache) { currentSubject.cache["quiz"] = text; save(); }
        typingDiv.innerHTML = `✅ Updated to ${qs.length} questions — opened in new tab.`;
      } else {
        typingDiv.innerHTML = `⚠️ Couldn't parse response as quiz questions. Try rephrasing.`;
      }
    };
  }

  const userPrompt = `Here are the current ${currentMode === "flashcard" ? "flashcards" : "quiz questions"}:\n\n${currentData}\n\nUser request: ${msg}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 4000, system: systemPrompt, messages: [{ role: "user", content: userPrompt }] })
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
  return p.knownIds.length < p.allCards.length;
}

function resumeFCSession() {
  const p        = currentSubject._fcProgress;
  const allCards = p.allCards;
  const known    = allCards.filter(c => p.knownIds.includes(c.id));
  const unknown  = allCards.filter(c => p.unknownIds.includes(c.id));
  const seenIds  = [...p.knownIds, ...p.unknownIds];
  const unseen   = allCards.filter(c => !seenIds.includes(c.id));
  fcSession = { allCards, queue: shuffle([...unknown, ...unseen]), unknown: [], known, roundIndex: 0, roundNumber: p.roundNumber || 1, retest: false };
  renderFCSession();
}

function showFCResumePrompt(pairs) {
  const p     = currentSubject._fcProgress;
  const done  = p.knownIds.length;
  const total = p.allCards.length;
  const pct   = Math.round((done / total) * 100);
  const html  = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:48px 24px;text-align:center;">
      <div style="font-size:2.5rem;">🃏</div>
      <h2 style="margin:0;font-size:1.3rem;font-weight:700;">Resume your session?</h2>
      <p style="margin:0;opacity:0.6;font-size:0.9rem;">You've mastered <strong>${done} / ${total}</strong> cards — Round ${p.roundNumber}</p>
      <div style="width:100%;max-width:300px;height:6px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:#4ade80;border-radius:4px;transition:width 0.4s;"></div>
      </div>
      <button onclick="resumeFCSession()" style="padding:12px 32px;border-radius:10px;border:2px solid rgba(74,222,128,0.4);background:rgba(74,222,128,0.1);color:#4ade80;font-size:1rem;font-weight:700;cursor:pointer;">▶ Resume Session</button>
      <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;">
        <button onclick="startFlashcardSession(currentFlashcards)" style="padding:7px 18px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:#555;font-size:0.8rem;cursor:pointer;">↺ Restart from scratch</button>
        <button onclick="downloadFlashcardsHTML()" style="padding:7px 18px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:#555;font-size:0.8rem;cursor:pointer;">⬇️ Download</button>
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
  if (hasFCProgress()) { showFCResumePrompt(pairs); } else { startFlashcardSession(pairs); }
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
    unknown:     [], known: [], roundIndex: 0, roundNumber: 1, retest: false
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
          <div class="fc-front"><span class="fc-side-label">Question</span><p class="fc-text">${card.q}</p><span class="fc-hint">Click to reveal answer</span></div>
          <div class="fc-back"><span class="fc-side-label">Answer</span><p class="fc-text">${card.a}</p></div>
        </div>
      </div>
      <div class="fc-verdict" id="fcVerdict" style="display:none;">
        <button class="fc-btn-unknown" onclick="fcMarkUnknown()" style="display:inline-flex;align-items:center;gap:8px;padding:14px 28px;border-radius:12px;border:2px solid rgba(248,113,113,0.4);background:rgba(248,113,113,0.1);color:#f87171;font-size:1rem;font-weight:600;cursor:pointer;min-width:150px;justify-content:center;"><span>😕</span> Don't Know It</button>
        <button class="fc-btn-known" onclick="fcMarkKnown()" style="display:inline-flex;align-items:center;gap:8px;padding:14px 28px;border-radius:12px;border:2px solid rgba(74,222,128,0.4);background:rgba(74,222,128,0.1);color:#4ade80;font-size:1rem;font-weight:600;cursor:pointer;min-width:150px;justify-content:center;"><span>💪</span> Know It!</button>
      </div>
      <div style="display:flex;justify-content:center;margin-top:16px;">
        <button onclick="startFlashcardSession(currentFlashcards)" style="padding:7px 18px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:#555;font-size:0.8rem;cursor:pointer;">↺ Restart</button>
      </div>
      <p class="fc-kb-hint">Space = flip · ← Don't know · → Know it</p>
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
    if (verdict) { verdict.style.display = "flex"; verdict.style.gap = "16px"; verdict.style.justifyContent = "center"; verdict.style.marginTop = "20px"; verdict.style.flexWrap = "wrap"; }
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
  const blocks = text.split(/(?=^\d+[\.\)]\s)/m).filter(b => b.trim());

  for (let block of blocks) {
    block = block.trim();
    if (!block) continue;
    const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 3) continue;
    const qText = lines[0].replace(/^\d+[\.\)]\s*/, "").trim();
    if (!qText) continue;

    const options = [];
    let correct = -1;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^([A-Da-d])[\.\)]\s*(.+)/);
      if (!match) {
        const ansMatch = line.match(/^(?:answer|correct)[:\s]+([A-Da-d])/i);
        if (ansMatch) { correct = "ABCD".indexOf(ansMatch[1].toUpperCase()); }
        continue;
      }
      const letter = match[1].toUpperCase();
      let optText  = match[2].trim();
      const isCorrect = /\(correct\)/i.test(optText) || optText.includes("✓") || /\[correct\]/i.test(optText);
      optText = optText.replace(/\s*\(correct\)\s*/gi, "").replace(/\s*✓\s*/g, "").replace(/\s*\[correct\]\s*/gi, "").trim();
      options.push({ letter, text: optText });
      if (isCorrect) correct = options.length - 1;
    }

    if (options.length >= 2) {
      questions.push({ q: qText, options, correct });
    }
  }

  return questions;
}

// =========================
// QUIZ RENDER ENTRY
// =========================
function renderQuiz(text) {
  const questions = parseQuiz(text);
  if (questions.length === 0) { setOutput(text); return; }
  currentQuizQuestions = questions;
  openQuizInNewTab(questions);
  setOutput(`<p style="opacity:0.6">✅ Quiz opened in a new tab — ${questions.length} questions ready!</p>`);
  showEditPanel("quiz");
}

function renderQuizUI(questions) {
  currentQuizQuestions = questions;
  openQuizInNewTab(questions);
  setOutput(`<p style="opacity:0.6">✅ Quiz updated and opened in a new tab — ${questions.length} questions.</p>`);
}

// =========================
// SAVED QUIZZES — MANAGER
// Shows a panel to create named quizzes with custom instructions,
// view saved quizzes, open or delete them.
// =========================
function showQuizManager() {
  if (!currentSubject) { alert("Select a subject first."); return; }
  if (!currentSubject.savedQuizzes) currentSubject.savedQuizzes = [];

  const overlay = document.createElement("div");
  overlay.id    = "quizManagerOverlay";
  overlay.style.cssText = `position:fixed;inset:0;z-index:99990;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;padding:20px;font-family:'Inter',sans-serif;`;

  overlay.innerHTML = `
    <div style="width:100%;max-width:600px;max-height:90vh;overflow-y:auto;background:#0d0d0d;border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:32px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
        <h2 style="margin:0;font-size:1.2rem;font-weight:700;color:#f0f0f0;">📝 Quiz Manager</h2>
        <button onclick="document.getElementById('quizManagerOverlay').remove()" style="background:none;border:none;color:#555;font-size:1.2rem;cursor:pointer;padding:4px 8px;">✕</button>
      </div>

      <!-- CREATE NEW QUIZ -->
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:20px;margin-bottom:24px;">
        <h3 style="margin:0 0 16px;font-size:0.9rem;font-weight:600;color:#aaa;text-transform:uppercase;letter-spacing:0.06em;">Create New Quiz</h3>
        <div style="margin-bottom:12px;">
          <label style="display:block;color:#666;font-size:0.75rem;margin-bottom:6px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">Quiz Name</label>
          <input id="qmName" type="text" placeholder="e.g. Chapter 3 Review, Final Exam Prep..." style="width:100%;box-sizing:border-box;padding:10px 14px;background:#161616;border:1px solid rgba(255,255,255,0.09);border-radius:9px;color:#f0f0f0;font-size:0.9rem;outline:none;font-family:inherit;">
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block;color:#666;font-size:0.75rem;margin-bottom:6px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">Custom Instructions <span style="color:#444;font-weight:400;text-transform:none;">(optional)</span></label>
          <textarea id="qmInstructions" rows="4" placeholder="e.g. Focus only on Chapter 3. Make questions harder than usual. Include 5 true/false questions. Emphasise dates and names. Ask about causes and effects..." style="width:100%;box-sizing:border-box;padding:10px 14px;background:#161616;border:1px solid rgba(255,255,255,0.09);border-radius:9px;color:#f0f0f0;font-size:0.88rem;outline:none;font-family:inherit;resize:vertical;line-height:1.5;"></textarea>
          <p style="color:#444;font-size:0.75rem;margin:6px 0 0;">Leave blank to use the default "cover everything" prompt.</p>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <select id="qmDifficulty" style="padding:9px 12px;background:#161616;border:1px solid rgba(255,255,255,0.09);border-radius:9px;color:#aaa;font-size:0.88rem;font-family:inherit;outline:none;">
            <option value="standard">Standard difficulty</option>
            <option value="easy">Easy — recall & recognition</option>
            <option value="hard">Hard — application & analysis</option>
            <option value="mixed">Mixed difficulty</option>
          </select>
          <select id="qmCount" style="padding:9px 12px;background:#161616;border:1px solid rgba(255,255,255,0.09);border-radius:9px;color:#aaa;font-size:0.88rem;font-family:inherit;outline:none;">
            <option value="15">~15 questions</option>
            <option value="25">~25 questions</option>
            <option value="40">~40 questions</option>
            <option value="max">As many as possible</option>
          </select>
        </div>
        <button id="qmGenerateBtn" onclick="generateNamedQuiz()" style="margin-top:16px;width:100%;padding:12px;background:#fff;color:#000;border:none;border-radius:10px;font-size:0.92rem;font-weight:700;cursor:pointer;font-family:inherit;transition:opacity 0.2s;">⚡ Generate Quiz</button>
      </div>

      <!-- SAVED QUIZZES LIST -->
      <div>
        <h3 style="margin:0 0 14px;font-size:0.9rem;font-weight:600;color:#aaa;text-transform:uppercase;letter-spacing:0.06em;">Saved Quizzes <span id="qmCount" style="color:#555;font-weight:400;">(${currentSubject.savedQuizzes.length})</span></h3>
        <div id="qmSavedList"></div>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  renderSavedQuizList();
}

function renderSavedQuizList() {
  const list = document.getElementById("qmSavedList");
  if (!list || !currentSubject) return;
  document.getElementById("qmCount").textContent = `(${currentSubject.savedQuizzes.length})`;

  if (!currentSubject.savedQuizzes.length) {
    list.innerHTML = `<p style="color:#444;font-size:0.85rem;text-align:center;padding:20px 0;">No saved quizzes yet. Create one above!</p>`;
    return;
  }

  list.innerHTML = currentSubject.savedQuizzes.map((q, i) => `
    <div style="display:flex;align-items:center;gap:12px;padding:13px 16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;margin-bottom:8px;">
      <div style="flex:1;min-width:0;">
        <div style="color:#f0f0f0;font-weight:600;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHTML(q.name)}</div>
        <div style="color:#555;font-size:0.76rem;margin-top:3px;">${q.questions.length} questions · ${new Date(q.createdAt).toLocaleDateString()}</div>
        ${q.instructions ? `<div style="color:#444;font-size:0.75rem;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">📋 ${escHTML(q.instructions.slice(0, 60))}${q.instructions.length > 60 ? "…" : ""}</div>` : ""}
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        <button onclick="openSavedQuiz(${i})" style="padding:7px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:#ccc;font-size:0.8rem;cursor:pointer;white-space:nowrap;">▶ Open</button>
        <button onclick="renameSavedQuiz(${i})" style="padding:7px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:transparent;color:#666;font-size:0.8rem;cursor:pointer;" title="Rename">✏️</button>
        <button onclick="deleteSavedQuiz(${i})" style="padding:7px 10px;border-radius:8px;border:1px solid rgba(248,113,113,0.2);background:transparent;color:#f87171;font-size:0.8rem;cursor:pointer;" title="Delete">🗑️</button>
      </div>
    </div>`).join("");
}

function escHTML(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

async function generateNamedQuiz() {
  if (!currentSubject) return;
  if (!currentSubject.chunks.length) { showToast("Upload study files first.", "#f87171"); return; }

  const nameEl         = document.getElementById("qmName");
  const instructionsEl = document.getElementById("qmInstructions");
  const diffEl         = document.getElementById("qmDifficulty");
  const countEl        = document.getElementById("qmCount");
  const genBtn         = document.getElementById("qmGenerateBtn");

  const rawName        = (nameEl?.value || "").trim();
  const name           = rawName || `Quiz ${(currentSubject.savedQuizzes.length + 1)}`;
  const customInstr    = (instructionsEl?.value || "").trim();
  const difficulty     = diffEl?.value || "standard";
  const countVal       = countEl?.value || "15";

  const difficultyText = {
    standard: "Use a mix of recall, comprehension, and application questions.",
    easy:     "Focus on straightforward recall and recognition. Questions should be accessible.",
    hard:     "Focus on application, analysis, and higher-order thinking. Avoid simple recall.",
    mixed:    "Include easy, medium, and hard questions in roughly equal proportions."
  }[difficulty];

  const countText = countVal === "max"
    ? "Generate as many questions as possible — cover every major concept."
    : `Generate approximately ${countVal} questions.`;

  const basePrompt = `CRITICAL RULE: Every question and every answer option MUST come ONLY from the study material. Do NOT use any outside knowledge.

You are reading the COMPLETE study material. Generate a multiple-choice quiz.

RULES:
- ${countText}
- ${difficultyText}
- Each question must have exactly 4 options labelled A, B, C, D.
- All answer options must be plausible distractors drawn from the material.
- Mark the one correct answer by writing (correct) immediately after the option text.
- No preamble, no explanation — output ONLY the numbered questions.
${customInstr ? `\nADDITIONAL INSTRUCTIONS FROM USER:\n${customInstr}` : ""}

EXACT FORMAT — follow precisely, one blank line between questions:
1. [Question text]
A. [option text]
B. [option text]
C. [option text] (correct)
D. [option text]`;

  if (genBtn) { genBtn.disabled = true; genBtn.textContent = "⏳ Generating…"; }

  try {
    const result = await askAIFull(basePrompt, undefined, "quiz");
    const questions = parseQuiz(result);

    if (questions.length === 0) {
      showToast("Couldn't parse quiz output. Try again.", "#f87171");
      if (genBtn) { genBtn.disabled = false; genBtn.textContent = "⚡ Generate Quiz"; }
      return;
    }

    if (!currentSubject.savedQuizzes) currentSubject.savedQuizzes = [];
    currentSubject.savedQuizzes.push({
      id:           Date.now(),
      name,
      instructions: customInstr,
      difficulty,
      questions,
      rawText:      result,
      createdAt:    Date.now()
    });
    save();

    currentQuizQuestions = questions;
    openQuizInNewTab(questions, name);
    renderSavedQuizList();
    awardXP(10);
    showToast(`✅ "${name}" saved — ${questions.length} questions`);

    // Reset form
    if (nameEl)         nameEl.value         = "";
    if (instructionsEl) instructionsEl.value = "";
    if (diffEl)         diffEl.value         = "standard";
    if (countEl)        countEl.value        = "15";

  } catch (e) {
    showToast("Error generating quiz: " + e.message, "#f87171");
  }

  if (genBtn) { genBtn.disabled = false; genBtn.textContent = "⚡ Generate Quiz"; }
}

function openSavedQuiz(index) {
  if (!currentSubject?.savedQuizzes?.[index]) return;
  const q = currentSubject.savedQuizzes[index];
  currentQuizQuestions = q.questions;
  openQuizInNewTab(q.questions, q.name);
}

function renameSavedQuiz(index) {
  if (!currentSubject?.savedQuizzes?.[index]) return;
  const q       = currentSubject.savedQuizzes[index];
  const newName = prompt("Rename quiz:", q.name);
  if (!newName || !newName.trim()) return;
  q.name = newName.trim();
  save();
  renderSavedQuizList();
}

function deleteSavedQuiz(index) {
  if (!currentSubject?.savedQuizzes?.[index]) return;
  const q = currentSubject.savedQuizzes[index];
  if (!confirm(`Delete "${q.name}"? This cannot be undone.`)) return;
  currentSubject.savedQuizzes.splice(index, 1);
  save();
  renderSavedQuizList();
  showToast(`🗑️ "${q.name}" deleted`);
}

// =========================
// OPEN QUIZ IN NEW TAB
// =========================
function openQuizInNewTab(questions, quizTitle) {
  const subjectName   = quizTitle || currentSubject?.name || "Quiz";
  const date          = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const questionsJSON = JSON.stringify(questions.map(q => ({ q: q.q, options: q.options, correct: q.correct })));

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subjectName} — Quiz</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Inter:wght@400;500&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #0a0a0a; color: #f0f0f0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 40px 20px 80px; }
    header { text-align: center; margin-bottom: 40px; }
    header h1 { font-family: 'Sora', sans-serif; font-size: 1.8rem; font-weight: 700; margin-bottom: 6px; }
    header p { color: #555; font-size: 0.85rem; }
    .quiz-wrap { width: 100%; max-width: 700px; display: flex; flex-direction: column; gap: 24px; }
    .question-card { background: #111; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 24px 28px; transition: border-color 0.3s, background 0.3s; }
    .question-card.correct-card { border-color: rgba(74,222,128,0.3); background: rgba(74,222,128,0.04); }
    .question-card.wrong-card   { border-color: rgba(248,113,113,0.3); background: rgba(248,113,113,0.04); }
    .q-num { color: #444; font-size: 0.75rem; letter-spacing: 0.08em; margin-bottom: 10px; }
    .q-text { font-size: 1.05rem; font-weight: 500; margin-bottom: 18px; line-height: 1.55; color: #f0f0f0; }
    .options { display: flex; flex-direction: column; gap: 10px; }
    .opt-btn { display: flex; align-items: center; gap: 14px; padding: 12px 18px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: #ccc; font-size: 0.95rem; font-family: inherit; cursor: pointer; text-align: left; transition: background 0.15s, border-color 0.15s, color 0.15s; }
    .opt-btn:hover:not(:disabled) { background: rgba(255,255,255,0.09); color: #fff; border-color: rgba(255,255,255,0.2); }
    .opt-btn:disabled { cursor: default; }
    .opt-btn.is-selected      { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.35); color: #fff; }
    .opt-btn.selected-correct { background: rgba(74,222,128,0.12); border-color: rgba(74,222,128,0.5); color: #4ade80; }
    .opt-btn.selected-wrong   { background: rgba(248,113,113,0.12); border-color: rgba(248,113,113,0.5); color: #f87171; }
    .opt-btn.show-correct     { background: rgba(74,222,128,0.08); border-color: rgba(74,222,128,0.3); color: #4ade80; }
    .opt-letter { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; min-width: 26px; border-radius: 6px; background: rgba(255,255,255,0.07); font-size: 0.8rem; font-weight: 600; color: #888; }
    .opt-btn.is-selected      .opt-letter { background: rgba(255,255,255,0.15); color: #fff; }
    .opt-btn.selected-correct .opt-letter { background: rgba(74,222,128,0.2);  color: #4ade80; }
    .opt-btn.selected-wrong   .opt-letter { background: rgba(248,113,113,0.2); color: #f87171; }
    .opt-btn.show-correct     .opt-letter { background: rgba(74,222,128,0.15); color: #4ade80; }
    .q-feedback { margin-top: 14px; font-size: 0.88rem; font-weight: 500; display: none; }
    .q-feedback.visible { display: block; }
    .q-feedback.correct-fb { color: #4ade80; }
    .q-feedback.wrong-fb   { color: #f87171; }
    .submit-wrap { display: flex; justify-content: center; margin-top: 12px; width: 100%; max-width: 700px; }
    .submit-btn { padding: 14px 48px; background: #fff; color: #000; font-size: 1rem; font-weight: 700; font-family: inherit; border: none; border-radius: 12px; cursor: pointer; transition: opacity 0.2s; }
    .submit-btn:hover { opacity: 0.88; }
    .submit-btn:disabled { opacity: 0.4; cursor: default; }
    #resultsPanel { display: none; width: 100%; max-width: 700px; margin-top: 16px; }
    #resultsPanel.visible { display: block; }
    .results-card { background: #111; border: 1px solid rgba(255,255,255,0.1); border-radius: 18px; padding: 36px 32px; text-align: center; margin-bottom: 28px; }
    .score-big { font-family: 'Sora', sans-serif; font-size: 4rem; font-weight: 700; margin-bottom: 6px; line-height: 1; }
    .score-big.pass { color: #4ade80; }
    .score-big.fail { color: #f87171; }
    .score-label { color: #555; font-size: 0.9rem; margin-bottom: 20px; }
    .score-bar-wrap { height: 8px; background: rgba(255,255,255,0.07); border-radius: 6px; overflow: hidden; margin: 0 auto 20px; max-width: 320px; }
    .score-bar { height: 100%; border-radius: 6px; transition: width 0.8s cubic-bezier(0.4,0,0.2,1); }
    .score-bar.high { background: #4ade80; } .score-bar.mid { background: #facc15; } .score-bar.low { background: #f87171; }
    .chips-row { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-bottom: 20px; }
    .chip { padding: 5px 16px; border-radius: 20px; font-size: 0.82rem; font-weight: 600; }
    .chip.correct-chip { background: rgba(74,222,128,0.1);  color: #4ade80; border: 1px solid rgba(74,222,128,0.25); }
    .chip.wrong-chip   { background: rgba(248,113,113,0.1); color: #f87171; border: 1px solid rgba(248,113,113,0.25); }
    .chip.pct-chip     { background: rgba(255,255,255,0.07); color: #ccc; border: 1px solid rgba(255,255,255,0.15); }
    .verdict-msg { font-size: 1.05rem; font-weight: 500; color: #f0f0f0; margin-bottom: 24px; }
    .retry-btn { padding: 11px 32px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.15); background: transparent; color: #ccc; font-size: 0.9rem; font-family: inherit; cursor: pointer; transition: background 0.2s, color 0.2s; }
    .retry-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }
    .wrong-review { display: flex; flex-direction: column; gap: 14px; }
    .wrong-review-title { font-family: 'Sora', sans-serif; font-size: 1.1rem; font-weight: 600; color: #f87171; margin-bottom: 4px; }
    .review-item { background: rgba(248,113,113,0.05); border: 1px solid rgba(248,113,113,0.2); border-radius: 12px; padding: 18px 20px; }
    .review-q { font-size: 0.95rem; font-weight: 500; margin-bottom: 10px; color: #f0f0f0; }
    .review-row { display: flex; align-items: flex-start; gap: 8px; font-size: 0.88rem; margin-bottom: 5px; }
    .review-label { font-weight: 600; min-width: 70px; }
    .review-label.your  { color: #f87171; }
    .review-label.right { color: #4ade80; }
    .review-val { color: #aaa; }
    footer { margin-top: 56px; color: #2a2a2a; font-size: 0.75rem; text-align: center; }
    @media (max-width: 560px) { .q-text { font-size: 0.97rem; } .opt-btn { font-size: 0.88rem; padding: 11px 14px; } .score-big { font-size: 3rem; } .results-card { padding: 28px 20px; } }
  </style>
</head>
<body>
  <header>
    <h1>📝 ${subjectName}</h1>
    <p>Multiple choice quiz · ${questions.length} questions · ${date}</p>
  </header>
  <div class="quiz-wrap" id="quizWrap"></div>
  <div class="submit-wrap">
    <button class="submit-btn" id="submitBtn" onclick="submitQuiz()">Submit Quiz</button>
  </div>
  <div id="resultsPanel">
    <div class="results-card" id="summaryCard"></div>
    <div class="wrong-review" id="wrongReview"></div>
  </div>
  <footer>Generated by StudyFlow AI</footer>
  <script>
    var QUESTIONS = ${questionsJSON};
    var userAnswers = new Array(QUESTIONS.length).fill(null);
    var submitted = false;

    function esc(str) {
      return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function build() {
      var wrap = document.getElementById('quizWrap');
      wrap.innerHTML = '';
      QUESTIONS.forEach(function(q, qi) {
        var card = document.createElement('div');
        card.className = 'question-card';
        card.id = 'qcard-' + qi;
        var optsHTML = q.options.map(function(opt, oi) {
          return '<button class="opt-btn" id="opt-' + qi + '-' + oi + '" onclick="pick(' + qi + ',' + oi + ')">'
            + '<span class="opt-letter">' + esc(opt.letter) + '</span>'
            + esc(opt.text)
            + '</button>';
        }).join('');
        card.innerHTML =
          '<p class="q-num">QUESTION ' + (qi + 1) + ' OF ' + QUESTIONS.length + '</p>'
          + '<p class="q-text">' + esc(q.q) + '</p>'
          + '<div class="options" id="opts-' + qi + '">' + optsHTML + '</div>'
          + '<div class="q-feedback" id="fb-' + qi + '"></div>';
        wrap.appendChild(card);
      });
    }

    function pick(qi, oi) {
      if (submitted) return;
      userAnswers[qi] = oi;
      document.querySelectorAll('#opts-' + qi + ' .opt-btn').forEach(function(btn, i) {
        btn.classList.toggle('is-selected', i === oi);
      });
      updateSubmitBtn();
    }

    function updateSubmitBtn() {
      var answered = userAnswers.filter(function(a) { return a !== null; }).length;
      document.getElementById('submitBtn').textContent =
        answered === QUESTIONS.length ? 'Submit Quiz' : 'Submit Quiz (' + answered + ' / ' + QUESTIONS.length + ' answered)';
    }

    function submitQuiz() {
      if (submitted) return;
      var answered = userAnswers.filter(function(a) { return a !== null; }).length;
      if (answered < QUESTIONS.length) {
        var missing = QUESTIONS.length - answered;
        if (!confirm('You have ' + missing + ' unanswered question' + (missing !== 1 ? 's' : '') + '. Submit anyway?')) return;
      }
      submitted = true;
      document.getElementById('submitBtn').disabled = true;
      document.getElementById('submitBtn').textContent = 'Submitted!';

      var correctCount = 0;
      var wrongItems = [];

      QUESTIONS.forEach(function(q, qi) {
        var chosen = userAnswers[qi];
        var isCorrect = chosen !== null && chosen === q.correct;
        if (isCorrect) correctCount++;
        var card = document.getElementById('qcard-' + qi);
        var fb   = document.getElementById('fb-' + qi);
        document.querySelectorAll('#opts-' + qi + ' .opt-btn').forEach(function(b) { b.disabled = true; });

        if (chosen === null) {
          card.classList.add('wrong-card');
          fb.textContent = '— Not answered';
          fb.className = 'q-feedback visible wrong-fb';
          if (q.correct >= 0) { var cb = document.getElementById('opt-' + qi + '-' + q.correct); if (cb) cb.classList.add('show-correct'); }
          wrongItems.push({ qi: qi, q: q, chosen: null });
        } else if (isCorrect) {
          card.classList.add('correct-card');
          var cb2 = document.getElementById('opt-' + qi + '-' + chosen);
          if (cb2) { cb2.classList.remove('is-selected'); cb2.classList.add('selected-correct'); }
          fb.textContent = '✅ Correct!';
          fb.className = 'q-feedback visible correct-fb';
        } else {
          card.classList.add('wrong-card');
          var wb = document.getElementById('opt-' + qi + '-' + chosen);
          if (wb) { wb.classList.remove('is-selected'); wb.classList.add('selected-wrong'); }
          if (q.correct >= 0) { var cb3 = document.getElementById('opt-' + qi + '-' + q.correct); if (cb3) cb3.classList.add('show-correct'); }
          var correctLetter = q.correct >= 0 ? ' — correct answer: ' + q.options[q.correct].letter : '';
          fb.textContent = '❌ Wrong' + correctLetter;
          fb.className = 'q-feedback visible wrong-fb';
          wrongItems.push({ qi: qi, q: q, chosen: chosen });
        }
        fb.style.display = 'block';
      });

      showResults(correctCount, wrongItems);
    }

    function showResults(correctCount, wrongItems) {
      var total    = QUESTIONS.length;
      var pct      = Math.round((correctCount / total) * 100);
      var passed   = pct >= 70;
      var barClass = pct >= 80 ? 'high' : pct >= 60 ? 'mid' : 'low';
      var verdictText =
        pct === 100 ? '🎉 Perfect score! Outstanding work!' :
        pct >= 80   ? '🌟 Great job! You really know this material.' :
        pct >= 70   ? '👍 Good work — just a few to review.' :
        pct >= 50   ? '📖 Decent effort, but some gaps to fill.' :
                      "💪 Keep studying — you'll get there!";

      document.getElementById('summaryCard').innerHTML =
        '<div class="score-big ' + (passed ? 'pass' : 'fail') + '">' + pct + '%</div>'
        + '<p class="score-label">' + correctCount + ' of ' + total + ' correct</p>'
        + '<div class="score-bar-wrap"><div class="score-bar ' + barClass + '" id="scoreBarFill" style="width:0%"></div></div>'
        + '<div class="chips-row"><span class="chip correct-chip">✅ Correct: ' + correctCount + '</span><span class="chip wrong-chip">❌ Wrong: ' + (total - correctCount) + '</span><span class="chip pct-chip">Score: ' + pct + '%</span></div>'
        + '<p class="verdict-msg">' + verdictText + '</p>'
        + '<button class="retry-btn" onclick="retryQuiz()">↺ Try Again</button>';

      var panel = document.getElementById('resultsPanel');
      panel.classList.add('visible');
      setTimeout(function() { var bar = document.getElementById('scoreBarFill'); if (bar) bar.style.width = pct + '%'; }, 100);
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

      var reviewWrap = document.getElementById('wrongReview');
      if (wrongItems.length > 0) {
        reviewWrap.innerHTML = '<p class="wrong-review-title">❌ Questions you got wrong</p>'
          + wrongItems.map(function(item) {
            var yourAns = item.chosen !== null
              ? item.q.options[item.chosen].letter + '. ' + item.q.options[item.chosen].text
              : 'Not answered';
            var correctAns = item.q.correct >= 0
              ? item.q.options[item.q.correct].letter + '. ' + item.q.options[item.q.correct].text
              : 'N/A';
            return '<div class="review-item">'
              + '<p class="review-q">Q' + (item.qi + 1) + '. ' + esc(item.q.q) + '</p>'
              + '<div class="review-row"><span class="review-label your">Your answer:</span><span class="review-val">' + esc(yourAns) + '</span></div>'
              + '<div class="review-row"><span class="review-label right">Correct:</span><span class="review-val">' + esc(correctAns) + '</span></div>'
              + '</div>';
          }).join('');
      } else {
        reviewWrap.innerHTML = '<p style="text-align:center;color:#4ade80;font-size:1rem;margin-top:8px;">🎉 You got every question right!</p>';
      }
    }

    function retryQuiz() {
      submitted = false;
      userAnswers.fill(null);
      document.getElementById('submitBtn').disabled = false;
      document.getElementById('submitBtn').textContent = 'Submit Quiz';
      document.getElementById('resultsPanel').classList.remove('visible');
      document.getElementById('summaryCard').innerHTML = '';
      document.getElementById('wrongReview').innerHTML = '';
      build();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    build();
    updateSubmitBtn();
  <\/script>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 300000);
}

// =========================
// TOOL BUTTONS
// =========================
document.getElementById("summarizeBtn").onclick = () => runTool(
  "Summarize all the key concepts and important points from this study material. Use headers, bold key terms, and bullet points.", "summarizeBtn"
);
document.getElementById("flashcardBtn").onclick = () => runToolFull(
  `Read ALL of the study material and create a flashcard for EVERY distinct fact, term, definition, concept, date, formula, process, and key point.

STRICT RULES:
- One card per fact. If there are 40 facts, make 40 cards.
- Questions: specific and exam-style.
- Answers: MAX 1 sentence or 3–5 word list.
- NO vague questions. NO filler, preamble, or commentary. Output ONLY the cards.

EXACT FORMAT:
Q: [question]
A: [answer]`, "flashcardBtn", renderFlashcards
);
document.getElementById("quizBtn").onclick = () => {
  // The default quiz button now opens the Quiz Manager
  showQuizManager();
};

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
