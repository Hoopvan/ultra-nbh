import { db } from '../config.js';
import { profile, gamesData, demoMode, setProfile } from '../state.js';
import { showNotif, escapeHtml } from '../utils.js';
import { getToday } from '../date.js';
import { getLevel, updateUI } from '../ui.js';

let anecAnswered = false;
let anecShuffledAnswers = [];

export function initAnecdote() {
  anecAnswered = false;
  const c = gamesData.anecdote?.content;
  if (!c) { console.warn('Pas de jeu Anecdote actif'); return; }
  const subj = document.getElementById('anec-subject'); if (subj) subj.textContent = c.subject || 'Le Club';
  const q = document.getElementById('anec-question'); if (q) q.textContent = c.question;
  const list = document.getElementById('anec-answers'); if (!list) return;
  anecShuffledAnswers = [...c.answers].sort(() => Math.random() - 0.5);
  list.innerHTML = anecShuffledAnswers.map((a,i) => `
    <button class="answer-btn" id="anec-${i}" data-idx="${i}" data-correct="${a.correct}">
      <span class="answer-letter">${['A','B','C'][i]}</span>${escapeHtml(a.text)}
    </button>`).join('');
  list.onclick = e => {
    const btn = e.target.closest('[data-idx]');
    if (btn) answerAnecdote(parseInt(btn.dataset.idx), btn.dataset.correct === 'true', btn);
  };
  document.getElementById('anec-expl').style.display = 'none';
  document.getElementById('anec-xp').style.display = 'none';
  document.getElementById('anec-continue').style.display = 'none';
}

export async function answerAnecdote(idx, correct, btn) {
  if (anecAnswered) return; anecAnswered = true;
  const c = gamesData.anecdote?.content;
  document.querySelectorAll('#anec-answers .answer-btn').forEach(b => { b.style.pointerEvents = 'none'; });
  btn.classList.add(correct ? 'correct' : 'wrong');
  if (!correct) {
    const allBtns = document.querySelectorAll('#anec-answers .answer-btn');
    allBtns.forEach(b => { if (b.textContent.trim().includes(c.answers.find(a=>a.correct)?.text?.substring(0,20))) b.classList.add('correct'); });
  }
  document.getElementById('anec-expl').textContent = c.explication;
  document.getElementById('anec-expl').style.display = 'block';
  document.getElementById('anec-xp').style.display = 'block';
  document.getElementById('anec-continue').style.display = 'block';

  const prevLevel = getLevel();
  let xpGain;
  if (demoMode) {
    xpGain = correct ? 30 : 15;
    const today = getToday();
    setProfile({ ...profile, xp: profile.xp + xpGain, coins: (profile.coins||0) + xpGain, interactions: (profile.interactions||0) + 1, anecdote_date: today });
  } else {
    const { data, error } = await db.rpc('submit_anecdote_answer', { p_answer_text: anecShuffledAnswers[idx]?.text });
    if (error) { showNotif('Oups, réponse non enregistrée.'); return; }
    setProfile(data.profile);
    xpGain = data.correct ? 30 : 15;
  }
  showNotif(`+${xpGain} XP ⚡  +${xpGain} 🐾`);
  const nextLevel = getLevel();
  if (prevLevel !== nextLevel) setTimeout(() => showNotif(`🏆 ${nextLevel.name} !`), 1600);
  updateUI();
}
