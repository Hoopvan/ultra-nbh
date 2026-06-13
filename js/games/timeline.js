import { db } from '../config.js';
import { profile, gamesData, demoMode, setProfile } from '../state.js';
import { showNotif } from '../utils.js';
import { getLevel, updateUI } from '../ui.js';

let tlSelection = [];   // IDs dans l'ordre choisi par le fan
let tlAnswered  = false;

export function initTimeline() {
  tlSelection = [];
  tlAnswered  = false;
  const c = gamesData.timeline?.content;
  if (!c) { console.warn('Pas de jeu Timeline actif'); return; }

  const q = document.getElementById('tl-question');
  if (q) q.textContent = c.question || 'Remets ces événements dans le bon ordre';

  // Mélange des événements
  const shuffled = [...c.events].sort(() => Math.random() - 0.5);
  const list = document.getElementById('tl-events');
  if (!list) return;
  list.innerHTML = shuffled.map(e => `
    <div class="tl-event" id="tl-ev-${e.id}" data-id="${e.id}" style="
      background:var(--black3);border:1.5px solid var(--black5);border-radius:var(--radius-sm);
      padding:14px 16px;cursor:pointer;display:flex;align-items:center;gap:12px;transition:all .15s">
      <div class="tl-rank" id="tl-rank-${e.id}" style="
        min-width:28px;height:28px;border-radius:50%;background:var(--black5);
        display:flex;align-items:center;justify-content:center;
        font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:800;color:var(--white-muted)">
        ?
      </div>
      <div style="flex:1;font-size:14px;color:var(--white);line-height:1.4">${e.text}</div>
    </div>`).join('');

  list.onclick = e => {
    const card = e.target.closest('[data-id]');
    if (card) selectTimelineEvent(parseInt(card.dataset.id));
  };

  document.getElementById('tl-result').style.display   = 'none';
  document.getElementById('tl-xp').style.display       = 'none';
  document.getElementById('tl-submit').style.display   = 'none';
  document.getElementById('tl-continue').style.display = 'none';
}

function selectTimelineEvent(id) {
  if (tlAnswered) return;
  const c = gamesData.timeline?.content;
  const already = tlSelection.indexOf(id);

  if (already > -1) {
    // Désélectionner : retirer et recalculer les rangs
    tlSelection.splice(already, 1);
  } else {
    tlSelection.push(id);
  }

  // Mettre à jour l'affichage de tous les événements
  c.events.forEach(e => {
    const rank = tlSelection.indexOf(e.id);
    const rankEl = document.getElementById('tl-rank-' + e.id);
    const card   = document.getElementById('tl-ev-'   + e.id);
    if (!rankEl || !card) return;
    if (rank > -1) {
      rankEl.textContent     = rank + 1;
      rankEl.style.background = 'var(--red)';
      rankEl.style.color      = 'white';
      card.style.borderColor  = 'var(--red)';
    } else {
      rankEl.textContent     = '?';
      rankEl.style.background = 'var(--black5)';
      rankEl.style.color      = 'var(--white-muted)';
      card.style.borderColor  = 'var(--black5)';
    }
  });

  const submitBtn = document.getElementById('tl-submit');
  if (submitBtn) submitBtn.style.display = tlSelection.length === c.events.length ? 'block' : 'none';
}

export async function submitTimeline() {
  if (tlAnswered) return;
  tlAnswered = true;
  const c = gamesData.timeline?.content;
  if (!c) return;

  const prevLevel = getLevel();
  let result;

  if (demoMode) {
    const correctOrder = [...c.events].sort((a, b) => a.year - b.year);
    const isCorrect    = JSON.stringify(tlSelection) === JSON.stringify(correctOrder.map(e => e.id));
    const xpGain       = isCorrect ? 30 : 15;
    const today        = new Date().toISOString().split('T')[0];
    setProfile({ ...profile, xp: profile.xp + xpGain, coins: (profile.coins||0) + xpGain, interactions: (profile.interactions||0) + 1, timeline_date: today });
    result = { correct: isCorrect, xp_gain: xpGain, correct_order: correctOrder };
  } else {
    const { data, error } = await db.rpc('submit_timeline_answer', { p_order: tlSelection });
    if (error) { showNotif('Oups, réponse non enregistrée.'); tlAnswered = false; return; }
    setProfile(data.profile);
    result = data;
  }

  showNotif(`+${result.xp_gain} XP ⚡  +${result.xp_gain} 🐾`);
  const nextLevel = getLevel();
  if (prevLevel !== nextLevel) setTimeout(() => showNotif(`🏆 ${nextLevel.name} !`), 1600);

  _showTimelineResult(result, c);
  updateUI();
}

function _showTimelineResult(result, c) {
  const correctOrder = result.correct_order || [...c.events].sort((a, b) => a.year - b.year);
  const resultEl = document.getElementById('tl-result');
  if (!resultEl) return;

  resultEl.innerHTML = `
    <div style="background:${result.correct ? 'rgba(26,158,94,.15)' : 'var(--red-dim)'};border:1px solid ${result.correct ? '#1a9e5e' : 'var(--red)'};border-radius:var(--radius-sm);padding:14px;text-align:center;margin-bottom:16px">
      <div style="font-size:22px;margin-bottom:4px">${result.correct ? '🎯' : '⏳'}</div>
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:800;color:var(--white)">${result.correct ? 'Parfait !' : 'Pas tout à fait...'}</div>
    </div>
    <div style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--white-muted);margin-bottom:10px">Le bon ordre</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">
      ${correctOrder.map((e, i) => {
        const userRank = tlSelection.indexOf(e.id ?? e);
        const ok       = userRank === i;
        return `<div style="display:flex;align-items:center;gap:10px;background:var(--black3);border-radius:var(--radius-sm);padding:10px 14px;border:1px solid ${ok ? '#1a9e5e' : 'var(--black4)'}">
          <span style="font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:800;color:${ok ? '#1a9e5e' : 'var(--red)'}">${i+1}</span>
          <span style="font-size:13px;color:var(--white);flex:1">${e.text || e}</span>
          <span style="font-size:11px;color:var(--white-muted)">${e.year || ''}</span>
        </div>`;
      }).join('')}
    </div>
    ${c.explication ? `<div style="background:var(--black3);border-radius:var(--radius-sm);padding:14px;font-size:13px;color:var(--white-muted);line-height:1.6;margin-bottom:16px">${c.explication}</div>` : ''}`;

  resultEl.style.display = 'block';
  document.getElementById('tl-submit').style.display  = 'none';
  document.getElementById('tl-xp').textContent        = `+${result.xp_gain} XP ⚡`;
  document.getElementById('tl-xp').style.display      = 'block';
  document.getElementById('tl-continue').style.display = 'block';
}
