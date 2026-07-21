import { profile } from './state.js';

let tutoStep = 1;
let tutoIsReplay = false;
let coinAnimDone = false;
const TUTO_STEPS = 6;

export function initTuto(replay = false) {
  tutoStep = 1;
  tutoIsReplay = replay;
  coinAnimDone = false;
  const nameEl = document.getElementById('tuto-name');
  if (nameEl && profile?.name) {
    nameEl.textContent = profile.name.split(' ')[0] + ' !';
  }
  updateTutoStep();
}

function animateCoinGift() {
  if (coinAnimDone) return;
  coinAnimDone = true;
  const emoji = document.getElementById('tuto-coin-emoji');
  const countEl = document.getElementById('tuto-coin-count');
  if (!countEl) return;
  const target = profile?.coins || 150;
  emoji?.classList.add('tuto-coin-pop');
  const duration = 900;
  const start = performance.now();
  function tick(now) {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    countEl.textContent = Math.round(eased * target);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

export function nextTuto() {
  if (tutoStep < TUTO_STEPS) { tutoStep++; updateTutoStep(); }
  else skipTuto();
}

export function prevTuto() {
  if (tutoStep > 1) { tutoStep--; updateTutoStep(); }
}

export function skipTuto() {
  try { localStorage.setItem('hoop_tuto_done', '1'); } catch(e) {}
  document.dispatchEvent(new CustomEvent('tuto:done', { detail: { replay: tutoIsReplay } }));
}

function updateTutoStep() {
  for (let i = 1; i <= TUTO_STEPS; i++) {
    document.getElementById('tuto-'+i)?.classList.toggle('active', i === tutoStep);
    document.getElementById('dot-'+i)?.classList.toggle('active', i === tutoStep);
  }
  if (tutoStep === 2) animateCoinGift();
  const nextBtn = document.getElementById('tuto-next');
  if (nextBtn) nextBtn.textContent = tutoStep === TUTO_STEPS ? 'MES MISSIONS 🎯' : 'SUIVANT →';
  const skipBtn = document.getElementById('tuto-skip');
  if (skipBtn) skipBtn.style.display = tutoStep === 1 ? 'block' : 'none';
  const prevBtn = document.getElementById('tuto-prev');
  if (prevBtn) prevBtn.style.display = tutoStep > 1 ? 'block' : 'none';
}
