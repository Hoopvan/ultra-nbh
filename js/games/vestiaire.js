import { db } from '../config.js';
import { profile, gamesData, demoMode, setProfile } from '../state.js';
import { showNotif } from '../utils.js';
import { getLevel, updateUI } from '../ui.js';
import { getToday } from '../date.js';

let vAnswered = false;

export function initVestiaire() {
  vAnswered = false;
  const c = gamesData.vestiaire?.content;
  if (!c) { console.warn('Pas de jeu Vestiaire actif'); return; }
  const list = document.getElementById('v-answers'); if (!list) return;
  list.innerHTML = c.answers.map((a,i) => `
    <button class="answer-btn" id="va-${i}" data-idx="${i}" data-correct="${a.correct}">
      <span class="answer-letter">${['A','B','C'][i]}</span>${a.text}
    </button>`).join('');
  list.onclick = e => {
    const btn = e.target.closest('[data-idx]');
    if (btn) answerVestiaire(parseInt(btn.dataset.idx), btn.dataset.correct === 'true');
  };
  document.getElementById('v-expl').style.display = 'none';
  document.getElementById('v-xp').style.display = 'none';
  document.getElementById('v-insta-link').style.display = 'none';
  document.getElementById('v-continue').style.display = 'none';
}

export async function answerVestiaire(idx, correct) {
  if (vAnswered) return; vAnswered = true;
  const c = gamesData.vestiaire?.content;
  if (!c) return;
  c.answers.forEach((a,i) => {
    const b = document.getElementById('va-'+i); if (!b) return;
    b.style.pointerEvents = 'none';
    if (a.correct) b.classList.add('correct');
    else if (i === idx && !correct) b.classList.add('wrong');
  });
  document.getElementById('v-expl').textContent = c.explication;
  document.getElementById('v-expl').style.display = 'block';
  document.getElementById('v-xp').style.display = 'block';
  const instaLink = document.getElementById('v-insta-link');
  if (c.instagram_url) {
    instaLink.href = c.instagram_url;
    instaLink.style.display = 'flex';
  }
  document.getElementById('v-continue').style.display = 'block';

  const prevLevel = getLevel();
  let xpGain;
  if (demoMode) {
    xpGain = correct ? 30 : 15;
    const today = getToday();
    setProfile({ ...profile, xp: profile.xp + xpGain, coins: (profile.coins||0) + xpGain, interactions: (profile.interactions||0) + 1, vestiaire_date: today });
  } else {
    const { data, error } = await db.rpc('submit_vestiaire_answer', { p_answer_index: idx });
    if (error) { if (!error.message?.includes('TOO_FAST')) showNotif(error.message?.includes('ALREADY_PLAYED_TODAY') ? 'Tu as déjà joué aujourd\'hui !' : 'Oups, réponse non enregistrée.'); return; }
    setProfile(data.profile);
    xpGain = data.correct ? 30 : 15;
  }
  showNotif(`+${xpGain} XP ⚡  +${xpGain} 🐾`);
  const nextLevel = getLevel();
  if (prevLevel !== nextLevel) setTimeout(() => showNotif(`🏆 ${nextLevel.name} !`), 1600);
  updateUI();
}
