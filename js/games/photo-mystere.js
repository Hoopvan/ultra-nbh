import { db } from '../config.js';
import { profile, gamesData, demoMode, setProfile } from '../state.js';
import { showNotif } from '../utils.js';
import { getLevel, updateUI } from '../ui.js';
import { getToday } from '../date.js';

const BLUR_STAGES  = ['blur(14px) saturate(0)', 'blur(6px)', 'blur(0px)'];
const XP_STAGES    = [50, 30, 15];
const STAGE_LABELS = ['Indice 1 / 3 — Bonne réponse = +50 XP 🔥', 'Indice 2 / 3 — Bonne réponse = +30 XP', 'Dernière chance — Bonne réponse = +15 XP'];

let pmStage    = 1;
let pmAnswered = false;

export function initPhotoMystere() {
  pmStage    = 1;
  pmAnswered = false;
  const c = gamesData.photo_mystere?.content;
  if (!c) { console.warn('Pas de jeu Photo Mystère actif'); return; }

  const q = document.getElementById('pm-question');
  if (q) q.textContent = c.question || 'Qui est-ce ?';

  const img = document.getElementById('pm-img');
  if (img) { img.src = c.image_url; img.style.filter = BLUR_STAGES[0]; }

  document.getElementById('pm-stage-label').textContent = STAGE_LABELS[0];

  // Mélange des options
  const options = [...c.options].sort(() => Math.random() - 0.5);
  const list = document.getElementById('pm-answers');
  if (list) {
    list.innerHTML = options.map((opt, i) => `
      <button class="answer-btn" id="pm-opt-${i}" data-answer="${opt}">
        <span class="answer-letter">${['A','B','C','D'][i]}</span>${opt}
      </button>`).join('');
    list.onclick = e => {
      const btn = e.target.closest('[data-answer]');
      if (btn) answerPhotoMystere(btn.dataset.answer);
    };
  }

  document.getElementById('pm-expl').style.display      = 'none';
  document.getElementById('pm-xp').style.display        = 'none';
  document.getElementById('pm-continue').style.display  = 'none';
}

async function answerPhotoMystere(chosen) {
  if (pmAnswered) return;
  const c = gamesData.photo_mystere?.content;
  const isCorrect = chosen === c.answer;

  if (isCorrect || pmStage === 3) {
    // Fin du jeu — soumettre
    pmAnswered = true;
    await _submitPhotoMystere(chosen, pmStage, isCorrect, c);
  } else {
    // Mauvaise réponse — passer au stage suivant
    _markWrong(chosen);
    pmStage++;
    const img = document.getElementById('pm-img');
    if (img) img.style.filter = BLUR_STAGES[pmStage - 1];
    document.getElementById('pm-stage-label').textContent = STAGE_LABELS[pmStage - 1];
    showNotif('Pas tout à fait... Regarde mieux 👀');
  }
}

function _markWrong(chosen) {
  document.querySelectorAll('#pm-answers .answer-btn').forEach(b => {
    if (b.dataset.answer === chosen) b.classList.add('wrong');
    b.style.pointerEvents = 'none';
  });
  // Réactiver les autres boutons sauf celui choisi
  setTimeout(() => {
    document.querySelectorAll('#pm-answers .answer-btn').forEach(b => {
      if (b.dataset.answer !== chosen) b.style.pointerEvents = 'auto';
    });
  }, 600);
}

async function _submitPhotoMystere(chosen, stage, isCorrect, c) {
  const prevLevel = getLevel();
  let result;

  if (demoMode) {
    const xpGain = isCorrect ? XP_STAGES[stage - 1] : 10;
    const today  = getToday();
    setProfile({ ...profile, xp: profile.xp + xpGain, coins: (profile.coins||0) + xpGain, interactions: (profile.interactions||0) + 1, photo_mystere_date: today });
    result = { correct: isCorrect, xp_gain: xpGain, answer: c.answer };
  } else {
    const { data, error } = await db.rpc('submit_photo_mystere', { p_answer: chosen, p_stage: stage });
    if (error) { showNotif(error.message?.includes('ALREADY_PLAYED_TODAY') ? 'Tu as déjà joué aujourd\'hui !' : 'Oups, réponse non enregistrée.'); if (!error.message?.includes('ALREADY_PLAYED_TODAY')) pmAnswered = false; return; }
    setProfile(data.profile);
    result = data;
  }

  // Révéler l'image complète
  const img = document.getElementById('pm-img');
  if (img) img.style.filter = BLUR_STAGES[2];

  // Colorer les boutons
  document.querySelectorAll('#pm-answers .answer-btn').forEach(b => {
    b.style.pointerEvents = 'none';
    if (b.dataset.answer === c.answer) b.classList.add('correct');
    else if (b.dataset.answer === chosen && !result.correct) b.classList.add('wrong');
  });

  showNotif(`+${result.xp_gain} XP ⚡  +${result.xp_gain} 🐾`);
  const nextLevel = getLevel();
  if (prevLevel !== nextLevel) setTimeout(() => showNotif(`🏆 ${nextLevel.name} !`), 1600);

  if (c.explication) {
    const expl = document.getElementById('pm-expl');
    expl.textContent   = c.explication;
    expl.style.display = 'block';
  }
  document.getElementById('pm-xp').textContent       = `+${result.xp_gain} XP ⚡`;
  document.getElementById('pm-xp').style.display     = 'block';
  document.getElementById('pm-continue').style.display = 'block';
  updateUI();
}
