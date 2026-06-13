let tutoStep = 1;
const TUTO_STEPS = 5;

export function initTuto() {
  tutoStep = 1;
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
  // nav.js écoute cet événement pour appeler showTab('tribune')
  document.dispatchEvent(new Event('tuto:done'));
}

function updateTutoStep() {
  for (let i = 1; i <= TUTO_STEPS; i++) {
    document.getElementById('tuto-'+i)?.classList.toggle('active', i === tutoStep);
    document.getElementById('dot-'+i)?.classList.toggle('active', i === tutoStep);
  }
  const nextBtn = document.getElementById('tuto-next');
  if (nextBtn) nextBtn.textContent = tutoStep === TUTO_STEPS ? "C'EST PARTI ! 🏀" : 'SUIVANT →';
  const skipBtn = document.getElementById('tuto-skip');
  if (skipBtn) skipBtn.style.display = tutoStep === TUTO_STEPS ? 'none' : 'block';
  const prevBtn = document.getElementById('tuto-prev');
  if (prevBtn) prevBtn.style.display = tutoStep > 1 ? 'block' : 'none';
}
