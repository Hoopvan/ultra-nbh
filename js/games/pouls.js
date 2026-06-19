import { db, CURRENT_ORG_ID } from '../config.js';
import { profile, gamesData, demoMode, setProfile } from '../state.js';
import { showNotif } from '../utils.js';
import { getLevel, updateUI } from '../ui.js';
import { getToday } from '../date.js';

let selEmotion = null;

export function selectEmotion(btn, emoji, label) {
  document.querySelectorAll('.emotion-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  selEmotion = { emoji, label };
  document.getElementById('pouls-submit').disabled = false;
}

export async function submitPouls() {
  if (!selEmotion || !profile) return;
  const matchId = gamesData.pouls?.content?.match_id || 'match-inconnu';
  const prevLevel = getLevel();

  if (demoMode) {
    const today = getToday();
    setProfile({ ...profile, xp: profile.xp + 20, coins: (profile.coins||0) + 20, interactions: (profile.interactions||0) + 1, pouls_date: today });
  } else {
    const { data, error } = await db.rpc('submit_pouls_vote', { p_match_id: matchId, p_emotion: selEmotion.label });
    if (error) {
      showNotif(error.message?.includes('ALREADY_VOTED_TODAY') ? 'Tu as déjà voté aujourd\'hui !' : 'Oups, le vote n\'a pas pu être enregistré.');
      return;
    }
    setProfile(data);
  }

  showNotif(`+20 XP ⚡  +20 🐾`);
  const nextLevel = getLevel();
  if (prevLevel !== nextLevel) setTimeout(() => showNotif(`🏆 ${nextLevel.name} !`), 1600);

  const { data: votes } = await db.from('pouls_votes').select('emotion').eq('match_id', matchId).eq('org_id', CURRENT_ORG_ID);
  let pct = 0;
  if (votes && votes.length) { const same = votes.filter(v => v.emotion === selEmotion.label).length; pct = Math.round(same/votes.length*100); }
  document.getElementById('pouls-vote-ui').style.display = 'none';
  document.getElementById('pouls-result-ui').classList.add('show');
  document.getElementById('r-emoji').textContent = selEmotion.emoji;
  document.getElementById('r-desc').innerHTML = `<strong>${pct}% des fans</strong> ressentent la même chose avant ce match.<br>L'Hermine peut compter sur toi.`;
  updateUI();
}
