import { profile } from './state.js';

let tutoStep = 1;
const TUTO_STEPS = 5;

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
}

export function initTuto() {
  tutoStep = 1;
  const nameEl = document.getElementById('tuto-name');
  if (nameEl && profile?.name) {
    nameEl.textContent = profile.name.split(' ')[0] + ' !';
  }
  // Affiche les instructions iOS seulement sur iPhone et hors standalone
  const iosBlock = document.getElementById('tuto-install-ios');
  if (iosBlock) iosBlock.style.display = isIOS() ? 'block' : 'none';
  updateTutoStep();
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
  document.dispatchEvent(new Event('tuto:done'));
}

function updateTutoStep() {
  for (let i = 1; i <= TUTO_STEPS; i++) {
    document.getElementById('tuto-'+i)?.classList.toggle('active', i === tutoStep);
    document.getElementById('dot-'+i)?.classList.toggle('active', i === tutoStep);
  }
  const nextBtn = document.getElementById('tuto-next');
  if (nextBtn) nextBtn.textContent = tutoStep === TUTO_STEPS ? 'MES MISSIONS 🎯' : 'SUIVANT →';
  const skipBtn = document.getElementById('tuto-skip');
  if (skipBtn) skipBtn.style.display = tutoStep === TUTO_STEPS ? 'none' : 'block';
  const prevBtn = document.getElementById('tuto-prev');
  if (prevBtn) prevBtn.style.display = tutoStep > 1 ? 'block' : 'none';
}
