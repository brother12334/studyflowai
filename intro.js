// =========================
// INTRO SPLASH ANIMATION
// =========================

(function () {
  // --- Particle canvas ---
  const canvas = document.getElementById("introCanvas");
  const ctx = canvas.getContext("2d");
  let W, H, particles, raf;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function makeParticle() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.6 + 0.4,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      alpha: Math.random() * 0.5 + 0.1,
      hue: Math.random() > 0.5 ? 260 : 240,
    };
  }

  function initParticles() {
    particles = Array.from({ length: 120 }, makeParticle);
  }

  function drawParticles() {
    ctx.clearRect(0, 0, W, H);
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 80%, 75%, ${p.alpha})`;
      ctx.fill();
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;
    }
    raf = requestAnimationFrame(drawParticles);
  }

  resize();
  window.addEventListener("resize", () => { resize(); initParticles(); });
  initParticles();
  drawParticles();

  // --- Typewriter ---
  const taglineEl = document.querySelector(".intro-tagline");
  const cursorEl  = document.querySelector(".intro-cursor");
  const text1 = "Your AI-powered study companion.";
  const text2 = "Created by Phineas Yablon";

  function typeWrite(el, text, speed, cb) {
    let i = 0;
    const interval = setInterval(() => {
      el.textContent = text.slice(0, ++i);
      if (i === text.length) { clearInterval(interval); if (cb) setTimeout(cb, 400); }
    }, speed);
  }

  // Start typewriter after tagline fades in (1.5s delay in CSS)
  setTimeout(() => {
    typeWrite(taglineEl, text1, 38, () => {
      // Pause, then wipe and type second line
      setTimeout(() => {
        taglineEl.textContent = "";
        taglineEl.style.color = "rgba(180,170,255,0.5)";
       }, 5800);

  // --- Dismiss after bar completes ---
  // Bar animation: 2s delay + 1.8s fill = 3.8s total
  setTimeout(() => {
    const splash = document.getElementById("introSplash");
    splash.classList.add("fade-out");
    setTimeout(() => {
      cancelAnimationFrame(raf);
      splash.remove();
    }, 950);
  }, 5800);
})();
