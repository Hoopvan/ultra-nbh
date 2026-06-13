import { db } from '../config.js';
import { profile, gamesData, currentUser, demoMode, setProfile } from '../state.js';
import { showNotif } from '../utils.js';
import { getLevel, updateUI } from '../ui.js';

let pronoHome = 0, pronoAway = 0;

export function initPronostic() {
  const c = gamesData.pronostic?.content;
  if (!c) return;
  pronoHome = 75; pronoAway = 75;
  const teams = c.match.split(' vs ');
  document.getElementById('prono-match-name').textContent = c.match;
  document.getElementById('prono-date-label').textContent = c.date_label || '';
  if (teams[1]) document.getElementById('prono-away-name').textContent = teams[1].trim();
  document.getElementById('score-home').textContent = '75';
  document.getElementById('score-away').textContent = '75';
  document.getElementById('prono-input-ui').style.display = 'block';
  document.getElementById('prono-done-ui').style.display = 'none';
}

export function adjustScore(side, delta) {
  if (side === 'home') { pronoHome = Math.max(0, pronoHome + delta); document.getElementById('score-home').textContent = pronoHome; }
  else { pronoAway = Math.max(0, pronoAway + delta); document.getElementById('score-away').textContent = pronoAway; }
}

export async function submitPronostic() {
  const score = `${pronoHome}-${pronoAway}`;
  const prevLevel = getLevel();
  if (demoMode) {
    const today = new Date().toISOString().split('T')[0];
    setProfile({ ...profile, xp: profile.xp + 25, coins: (profile.coins||0) + 25, interactions: (profile.interactions||0) + 1, pronostic_date: today, pronostic_score: score });
  } else {
    const { data, error } = await db.rpc('submit_pronostic', { p_score_home: pronoHome, p_score_away: pronoAway });
    if (error) {
      showNotif(error.message?.includes('ALREADY_PLAYED_TODAY') ? 'Tu as déjà pronostiqué aujourd\'hui !' : 'Oups, le pronostic n\'a pas pu être enregistré.');
      return;
    }
    setProfile(data.profile);
  }
  showNotif(`+25 XP ⚡  +25 🐾`);
  const nextLevel = getLevel();
  if (prevLevel !== nextLevel) setTimeout(() => showNotif(`🏆 ${nextLevel.name} !`), 1600);
  document.getElementById('prono-recap').textContent = score;
  document.getElementById('prono-input-ui').style.display = 'none';
  document.getElementById('prono-done-ui').style.display = 'block';
  updateUI();
}

export async function checkPronoResult() {
  if (demoMode) return;
  const resultCard = document.getElementById('mc-prono-result');
  if (!resultCard || !profile?.pronostic_date) { if (resultCard) resultCard.style.display = 'none'; return; }
  const yesterday = new Date(Date.now()-86400000).toISOString().split('T')[0];
  if (profile.pronostic_date !== yesterday) { resultCard.style.display = 'none'; return; }

  const { data: games } = await db.from('games').select('*').eq('type','pronostic').eq('date', yesterday);
  const yesterdayGame = games?.find(g => g.content?.score_domicile_final != null);
  if (!yesterdayGame) { resultCard.style.display = 'none'; return; }

  const c = yesterdayGame.content;
  const finalScore = `${c.score_domicile_final}-${c.score_exterieur_final}`;
  const [fh, fa] = finalScore.split('-').map(Number);

  const { data: votes } = await db.from('pronostic_votes').select('user_name, score, user_id').eq('match_id', c.match_id || 'unknown');
  if (!votes || !votes.length) { resultCard.style.display = 'none'; return; }

  const ranked = votes.map(v => {
    const [vh, va] = v.score.split('-').map(Number);
    const ecart = Math.abs(vh - fh) + Math.abs(va - fa);
    return { ...v, ecart, exact: ecart === 0 };
  }).sort((a, b) => a.ecart - b.ecart);

  const myRank = ranked.findIndex(v => v.user_id === currentUser?.id) + 1;
  const myVote = ranked.find(v => v.user_id === currentUser?.id);
  const top3 = ranked.slice(0, 3);
  const medals = ['🥇','🥈','🥉'];

  let html = `<div style="padding:12px 16px">
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:800;color:var(--white);margin-bottom:4px">Résultats du prono</div>
    <div style="font-size:12px;color:var(--white-muted);margin-bottom:12px">Score final : <strong style="color:var(--white)">${finalScore}</strong> · ${votes.length} participants</div>
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">`;

  top3.forEach((v, i) => {
    const isMe = v.user_id === currentUser?.id;
    html += `<div style="display:flex;align-items:center;gap:10px;background:${isMe?'var(--red-dim)':'var(--black3)'};border-radius:var(--radius-sm);padding:8px 12px;border:1px solid ${isMe?'var(--red)':'var(--black4)'}">
      <span style="font-size:18px">${medals[i]}</span>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:500;color:var(--white)">${v.user_name}${isMe?' (toi)':''}</div>
        <div style="font-size:11px;color:var(--white-muted)">Prono : ${v.score} · écart : ${v.ecart} pts${v.exact?' · 🎯 Score exact':''}</div>
      </div>
    </div>`;
  });

  html += `</div>`;
  if (myRank > 3 && myVote) {
    html += `<div style="background:var(--red-dim);border:1px solid var(--red);border-radius:var(--radius-sm);padding:8px 12px;display:flex;align-items:center;gap:10px">
      <span style="font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:700;color:var(--red)">#${myRank}</span>
      <div style="flex:1">
        <div style="font-size:13px;color:var(--white)">Ton rang · Prono : ${myVote.score}</div>
        <div style="font-size:11px;color:var(--white-muted)">Écart : ${myVote.ecart} pts sur ${votes.length} participants</div>
      </div>
    </div>`;
  }
  html += `</div>`;

  const descEl = document.getElementById('prono-result-desc');
  if (descEl) descEl.innerHTML = html;
  resultCard.style.display = '';
  resultCard.style.cursor = 'default';
  resultCard.removeAttribute('onclick');
}
