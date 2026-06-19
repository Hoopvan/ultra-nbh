import { db } from '../config.js';
import { profile, gamesData, demoMode, setProfile } from '../state.js';
import { showNotif, escapeHtml } from '../utils.js';
import { getLevel, updateUI } from '../ui.js';
import { getToday } from '../date.js';

let nnbAnswered = false;

export function initNantesNBH() {
  nnbAnswered = false;
  const c = gamesData.nantes_nbh?.content;
  if (!c) { console.warn('Pas de jeu Nantes/NBH actif'); document.dispatchEvent(new Event('game:closed')); return; }
  const ctx = document.getElementById('nnb-context'); if (ctx) ctx.textContent = c.context || '';
  const q = document.getElementById('nnb-question'); if (q) q.textContent = c.question;
  document.getElementById('nnb-result').style.display = 'none';
  const btns = document.getElementById('nnb-buttons');
  if (!btns) return;
  btns.innerHTML = `
    <button data-choice="nantes" data-answer="${escapeHtml(c.answer)}" style="background:var(--black2);border:2px solid var(--black4);border-radius:var(--radius);padding:18px 8px;cursor:pointer;text-align:center;transition:all .15s;display:flex;flex-direction:column;align-items:center;gap:6px">
      <span style="font-size:28px">🏙️</span>
      <span style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;color:var(--white)">Nantes</span>
    </button>
    <button data-choice="nbh" data-answer="${escapeHtml(c.answer)}" style="background:var(--black2);border:2px solid var(--black4);border-radius:var(--radius);padding:18px 8px;cursor:pointer;text-align:center;transition:all .15s;display:flex;flex-direction:column;align-items:center;gap:6px">
      <span style="font-size:28px">🏀</span>
      <span style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;color:var(--white)">NBH</span>
    </button>
    <button data-choice="les_deux" data-answer="${escapeHtml(c.answer)}" style="background:var(--black2);border:2px solid var(--black4);border-radius:var(--radius);padding:18px 8px;cursor:pointer;text-align:center;transition:all .15s;display:flex;flex-direction:column;align-items:center;gap:6px">
      <span style="font-size:28px">❤️</span>
      <span style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;color:var(--white)">Les Deux</span>
    </button>`;
  btns.onclick = e => {
    const btn = e.target.closest('[data-choice]');
    if (btn) answerNantesNBH(btn.dataset.choice, btn.dataset.answer);
  };
}

export async function answerNantesNBH(choice, correct) {
  if (nnbAnswered) return; nnbAnswered = true;
  const c = gamesData.nantes_nbh?.content;
  const isCorrect = choice === correct;
  document.querySelectorAll('#nnb-buttons button').forEach(b => { b.style.pointerEvents = 'none'; b.style.opacity = '.4'; });
  const btns = document.querySelectorAll('#nnb-buttons button');
  const idx = ['nantes','nbh','les_deux'].indexOf(choice);
  const correctIdx = ['nantes','nbh','les_deux'].indexOf(correct);
  if (idx >= 0) btns[idx].style.borderColor = isCorrect ? '#1a9e5e' : 'var(--red)';
  if (!isCorrect && correctIdx >= 0) { btns[correctIdx].style.borderColor = '#1a9e5e'; btns[correctIdx].style.opacity = '1'; }
  document.getElementById('nnb-expl').textContent = c.explication;
  document.getElementById('nnb-result').style.display = 'block';

  const prevLevel = getLevel();
  let xpGain;
  if (demoMode) {
    xpGain = isCorrect ? 30 : 15;
    const today = getToday();
    setProfile({ ...profile, xp: profile.xp + xpGain, coins: (profile.coins||0) + xpGain, interactions: (profile.interactions||0) + 1, nantes_nbh_date: today });
  } else {
    const { data, error } = await db.rpc('submit_nantes_nbh_answer', { p_choice: choice });
    if (error) { showNotif('Oups, réponse non enregistrée.'); return; }
    setProfile(data.profile);
    xpGain = data.correct ? 30 : 15;
  }
  showNotif(`+${xpGain} XP ⚡  +${xpGain} 🐾`);
  const nextLevel = getLevel();
  if (prevLevel !== nextLevel) setTimeout(() => showNotif(`🏆 ${nextLevel.name} !`), 1600);
  updateUI();
}
