import { LEVELS } from './config.js';
import { profile, gamesData } from './state.js';
import { getToday } from './date.js';
import { renderAvatar, renderEquip, renderNextUnlocks } from './avatar.js';
import { isAdmin } from './admin.js';
import { renderBio } from './profile.js';

export function getLevel(xp = profile?.xp || 0) {
  return LEVELS.find(l => xp >= l.min && xp < l.max) || LEVELS[LEVELS.length-1];
}

export function setMissionDone(cardId, xpId) {
  const mc = document.getElementById(cardId);
  if (mc) {
    mc.className = 'mission-card';
    mc.style.opacity = '.6';
    mc.style.borderColor = 'var(--black4)';
    mc.style.cursor = 'pointer';
  }
  const mx = document.getElementById(xpId);
  if (mx) { mx.textContent = 'Fait ✓'; mx.className = 'mission-xp xp-done'; }
}

export function updateUI() {
  if (!profile) return;
  const lvl = getLevel();
  const lvlIdx = LEVELS.indexOf(lvl) + 1;
  const pct = Math.min(100, Math.round((profile.xp - lvl.min) / (lvl.max - lvl.min) * 100));

  ['xp-t','xp-m','xp-a'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = profile.xp; });
  ['coins-t','coins-m','coins-a'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = profile.coins||0; });

  const mn = document.getElementById('m-fan-name'); if (mn) mn.textContent = profile.name;
  const md = document.getElementById('m-date');
  if (md) { const d = new Date(); md.textContent = d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}); }
  const ml = document.getElementById('m-lvl-label'); if (ml) ml.textContent = `Niveau ${lvlIdx} · ${lvl.name}`;
  const mp = document.getElementById('m-lvl-pts'); if (mp) mp.textContent = `${profile.xp}/${lvl.max} XP`;
  const mx = document.getElementById('m-xp-bar'); if (mx) mx.style.width = pct + '%';
  const ms = document.getElementById('m-streak'); if (ms) ms.textContent = profile.streak;
  const mss = document.getElementById('m-streak-s'); if (mss) mss.textContent = profile.streak > 1 ? 's' : '';
  const sx = document.getElementById('s-xp'); if (sx) sx.textContent = profile.xp;
  const sm = document.getElementById('s-missions'); if (sm) sm.textContent = profile.interactions;
  const ss = document.getElementById('s-streak'); if (ss) ss.textContent = profile.streak;

  const today = getToday();

  const mcVest = document.getElementById('mc-vestiaire');
  const mcAnec = document.getElementById('mc-anecdote');
  const mcNnb  = document.getElementById('mc-nantes-nbh');
  const mcAa   = document.getElementById('mc-avant-apres');
  const mcTl   = document.getElementById('mc-timeline');
  const mcPm   = document.getElementById('mc-photo-mystere');
  if (mcVest) mcVest.style.display = gamesData.vestiaire     ? '' : 'none';
  if (mcAnec) mcAnec.style.display = gamesData.anecdote      ? '' : 'none';
  if (mcNnb)  mcNnb.style.display  = gamesData.nantes_nbh    ? '' : 'none';
  if (mcAa)   mcAa.style.display   = gamesData.avant_apres   ? '' : 'none';
  if (mcTl)   mcTl.style.display   = gamesData.timeline      ? '' : 'none';
  if (mcPm)   mcPm.style.display   = gamesData.photo_mystere ? '' : 'none';

  const mcProno = document.getElementById('mc-pronostic');
  if (mcProno) mcProno.style.display = gamesData.pronostic ? '' : 'none';

  if (profile.free_booster_date  === today) setMissionDone('mc-free-booster', 'mx-free-booster');
  if (profile.pouls_date         === today) setMissionDone('mc-pouls',        'mx-pouls');
  if (profile.vestiaire_date     === today) setMissionDone('mc-vestiaire',    'mx-vestiaire');
  if (profile.anecdote_date      === today) setMissionDone('mc-anecdote',     'mx-anecdote');
  if (profile.nantes_nbh_date    === today) setMissionDone('mc-nantes-nbh',   'mx-nantes-nbh');
  if (profile.pronostic_date     === today) setMissionDone('mc-pronostic',    'mx-pronostic');
  if (profile.avant_apres_date   === today) setMissionDone('mc-avant-apres',  'mx-avant-apres');
  if (profile.timeline_date      === today) setMissionDone('mc-timeline',     'mx-timeline');
  if (profile.photo_mystere_date === today) setMissionDone('mc-photo-mystere','mx-photo-mystere');

  const an = document.getElementById('av-name'); if (an) an.textContent = profile.name;
  const ar = document.getElementById('av-rank'); if (ar) ar.textContent = `★ ${lvl.name}`;
  renderBio();

  const adminBtn = document.getElementById('admin-btn');
  if (adminBtn) adminBtn.style.display = isAdmin() ? 'flex' : 'none';

  renderAvatar();
  renderEquip();
  renderNextUnlocks();
}

export function showLevelsModal() {
  const modal = document.getElementById('levels-modal');
  if (modal) {
    const lvl = getLevel();
    ['Curieux','Supporter','Fidèle','Ultras','Légende'].forEach(n => {
      const row = document.getElementById('lvl-row-'+n);
      if (row) row.style.borderColor = n === lvl.name ? 'var(--red)' : 'var(--black4)';
    });
    modal.classList.add('show');
  }
}
