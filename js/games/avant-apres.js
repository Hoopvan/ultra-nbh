import { db } from '../config.js';
import { profile, gamesData, demoMode, setProfile } from '../state.js';
import { showNotif } from '../utils.js';
import { getLevel, updateUI } from '../ui.js';
import { getToday } from '../date.js';

let aaExplored = false;
let aaAnswered = false;

export function initAvantApres() {
  aaExplored = false; aaAnswered = false;
  const c = gamesData.avant_apres?.content;
  if (!c) { console.warn('Pas de jeu Avant/Après actif'); document.dispatchEvent(new Event('game:closed')); return; }
  document.getElementById('aa-title').textContent = c.title || 'Avant / Après';
  document.getElementById('aa-label-avant').textContent = c.label_avant || 'Avant';
  document.getElementById('aa-label-apres').textContent = c.label_apres || 'Après';
  document.getElementById('aa-img-avant').src = c.image_avant;
  document.getElementById('aa-img-apres').src = c.image_apres;
  document.getElementById('aa-result').style.display = 'none';
  document.getElementById('aa-cta').style.display = 'block';
  document.getElementById('aa-clip').style.width = '50%';
  document.getElementById('aa-line').style.left = '50%';
  const revealBtn = document.getElementById('aa-reveal-btn');
  revealBtn.style.opacity = '.35'; revealBtn.style.pointerEvents = 'none';
  const touch = document.getElementById('aa-touch');
  const wrap = document.getElementById('aa-slider-wrap');

  function moveSlider(clientX) {
    const rect = wrap.getBoundingClientRect();
    let pct = (clientX - rect.left) / rect.width * 100;
    pct = Math.min(95, Math.max(5, pct));
    document.getElementById('aa-clip').style.width = pct + '%';
    document.getElementById('aa-line').style.left = pct + '%';
    if (!aaExplored && (pct < 20 || pct > 80)) {
      aaExplored = true;
      revealBtn.style.opacity = '1'; revealBtn.style.pointerEvents = 'auto';
    }
  }
  let dragging = false;
  touch.onmousedown = () => dragging = true;
  window.onmouseup = () => dragging = false;
  touch.onmousemove = e => { if (dragging) moveSlider(e.clientX); };
  touch.ontouchstart = e => moveSlider(e.touches[0].clientX);
  touch.ontouchmove = e => { e.preventDefault(); moveSlider(e.touches[0].clientX); };
}

export async function revealAvantApres() {
  if (aaAnswered) return; aaAnswered = true;
  const c = gamesData.avant_apres?.content;
  document.getElementById('aa-cta').style.display = 'none';
  document.getElementById('aa-expl').textContent = c.explication;
  document.getElementById('aa-result').style.display = 'block';

  const prevLevel = getLevel();
  if (demoMode) {
    const today = getToday();
    setProfile({ ...profile, xp: profile.xp + 30, coins: (profile.coins||0) + 30, interactions: (profile.interactions||0) + 1, avant_apres_date: today });
  } else {
    const { data, error } = await db.rpc('game_avant_apres');
    if (error) { if (!error.message?.includes('TOO_FAST')) showNotif(error.message?.includes('ALREADY_PLAYED_TODAY') ? 'Tu as déjà joué aujourd\'hui !' : 'Oups, le gain n\'a pas pu être enregistré.'); return; }
    setProfile(data);
  }
  showNotif(`+30 XP ⚡  +30 🐾`);
  const nextLevel = getLevel();
  if (prevLevel !== nextLevel) setTimeout(() => showNotif(`🏆 ${nextLevel.name} !`), 1600);
  updateUI();
}
