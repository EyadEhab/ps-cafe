// ============================================================
// PS CAFE PRESENTATION — Main Script
// ============================================================

(function () {
  'use strict';

  // ---- Slides Setup ----
  const slides = document.querySelectorAll('.slide');
  const totalSlides = slides.length;
  let current = 0;
  let isTransitioning = false;

  // ---- Navigation Dots ----
  const nav = document.getElementById('slideNav');
  for (let i = 0; i < totalSlides; i++) {
    const btn = document.createElement('button');
    btn.dataset.index = i;
    if (i === 0) btn.classList.add('active');
    btn.addEventListener('click', () => goTo(i));
    nav.appendChild(btn);
  }
  const navDots = nav.querySelectorAll('button');

  // ---- Progress Bar ----
  const progressSpan = document.querySelector('#progressBar span');

  // ---- Go To Slide ----
  function goTo(index) {
    if (isTransitioning || index === current) return;
    if (index < 0 || index >= totalSlides) return;
    isTransitioning = true;

    slides[current].classList.remove('active');
    navDots[current].classList.remove('active');

    current = index;

    slides[current].classList.add('active');
    navDots[current].classList.add('active');

    // Progress
    const pct = ((current + 1) / totalSlides) * 100;
    progressSpan.style.width = pct + '%';

    setTimeout(() => { isTransitioning = false; }, 700);
  }

  // ---- Keyboard Navigation ----
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      goTo(current + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      goTo(current - 1);
    }
  });

  // ---- Mouse Wheel ----
  let wheelTimeout = false;
  document.addEventListener('wheel', (e) => {
    if (wheelTimeout) return;
    wheelTimeout = true;
    if (e.deltaY > 0) goTo(current + 1);
    else goTo(current - 1);
    setTimeout(() => { wheelTimeout = false; }, 800);
  }, { passive: true });

  // ---- Touch Swipe ----
  let touchStartY = 0;
  document.addEventListener('touchstart', (e) => {
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    const diff = touchStartY - e.changedTouches[0].screenY;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goTo(current + 1);
      else goTo(current - 1);
    }
  }, { passive: true });

  // ============================================================
  // ANIMATED BACKGROUND — Particle Grid
  // ============================================================
  const canvas = document.getElementById('bgCanvas');
  const ctx = canvas.getContext('2d');
  let W, H;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const particles = [];
  const PARTICLE_COUNT = 80;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      r: Math.random() * 1.8 + 0.5,
      a: Math.random() * 0.5 + 0.1,
    });
  }

  function drawParticles() {
    ctx.clearRect(0, 0, W, H);

    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200) {
          const alpha = (1 - dist / 200) * 0.15;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    // Draw particles
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 240, 255, ${p.a})`;
      ctx.fill();
    }
  }

  function updateParticles() {
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
    }
  }

  function animate() {
    updateParticles();
    drawParticles();
    requestAnimationFrame(animate);
  }
  animate();

  // ============================================================
  // OBSERVER — Re-trigger animations on slide change
  // ============================================================
  // (Animations play via CSS on first load; this is handled by .active transition)

  // ---- Init ----
  // Ensure first slide progress is correct
  progressSpan.style.width = (1 / totalSlides * 100) + '%';

})();