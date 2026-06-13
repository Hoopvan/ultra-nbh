import { db } from '../config.js';
import { profile, gamesData, demoMode, setProfile } from '../state.js';
import { showNotif } from '../utils.js';
import { updateUI } from '../ui.js';

function closeGame() { document.dispatchEvent(new Event('game:closed')); }

let _boiteResult = null;

export function checkBoiteAccess() {
  const boiteCard = document.getElementById('mc-boite');
  if (!boiteCard || !gamesData.boite_mystere) return;
  const today = new Date().toISOString().split('T')[0];

  if (profile?.boite_date === today) {
    boiteCard.style.display = '';
    const xpEl = document.getElementById('mx-boite');
    if (xpEl) { xpEl.textContent = 'Voir mon code'; xpEl.style.background = 'var(--black4)'; xpEl.style.color = 'var(--white-muted)'; }
    return;
  }

  const done = [
    gamesData.pouls ? profile?.pouls_date === today : null,
    gamesData.vestiaire ? profile?.vestiaire_date === today : null,
    gamesData.anecdote ? profile?.anecdote_date === today : null,
    gamesData.nantes_nbh ? profile?.nantes_nbh_date === today : null,
    gamesData.avant_apres ? profile?.avant_apres_date === today : null,
    gamesData.pronostic ? profile?.pronostic_date === today : null,
  ].filter(v => v !== null);
  const allDone = done.length > 0 && done.every(v => v === true);
  boiteCard.style.display = allDone ? '' : 'none';
}

export function openBoiteReadOnly() {
  document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });
  document.getElementById('navbar').style.display = 'none';
  const screen = document.getElementById('game-boite_mystere');
  screen.style.display = 'flex'; screen.classList.add('active');
  const c = gamesData.boite_mystere?.content;
  if (!c) return;
  document.getElementById('boite-sponsor-name').textContent = c.sponsor_name || '—';
  if (c.sponsor_logo) document.getElementById('boite-sponsor-logo').innerHTML = `<img src="${c.sponsor_logo}" style="max-height:50px;max-width:150px;object-fit:contain">`;
  const canvas = document.getElementById('scratch-canvas');
  if (canvas) canvas.style.display = 'none';
  const r = profile?.boite_last_result;
  if (r) {
    document.getElementById('scratch-result-icon').textContent = r.won ? '🏆' : '🎟️';
    document.getElementById('scratch-result-title').textContent = r.won ? 'Félicitations !' : 'Pas de chance...';
    document.getElementById('scratch-result-desc').textContent = r.reward || '';
    document.getElementById('scratch-result-code').textContent = r.code || '';
  }
  document.getElementById('scratch-hint').textContent = '👁️ Déjà gratté aujourd\'hui';
  document.getElementById('boite-claim-btn').style.display = 'none';
}

export async function initBoite() {
  const today = new Date().toISOString().split('T')[0];
  if (profile?.boite_date === today) { closeGame(); return; }
  const c = gamesData.boite_mystere?.content;
  if (!c) return;
  document.getElementById('boite-sponsor-name').textContent = c.sponsor_name || '—';
  if (c.sponsor_logo) document.getElementById('boite-sponsor-logo').innerHTML = `<img src="${c.sponsor_logo}" style="max-height:50px;max-width:150px;object-fit:contain">`;

  if (demoMode) {
    const won = Math.random() < (c.win_probability || 0.3);
    _boiteResult = { won, reward: won ? c.win_reward : c.lose_reward, code: (won ? c.win_code : c.lose_code) || '', sponsor_name: c.sponsor_name };
    setProfile({ ...profile, xp: profile.xp + (won ? 100 : 30), coins: (profile.coins||0) + (won ? 100 : 30), interactions: (profile.interactions||0) + 1, boite_date: today, boite_last_result: _boiteResult });
  } else {
    const { data, error } = await db.rpc('open_boite_mystere');
    if (error) {
      showNotif(error.message?.includes('ALREADY_PLAYED_TODAY') ? 'Tu as déjà gratté aujourd\'hui !' : 'Oups, impossible d\'ouvrir la boîte.');
      closeGame(); return;
    }
    _boiteResult = data;
    setProfile(data.profile);
  }

  const won = _boiteResult.won;
  document.getElementById('scratch-result-icon').textContent = won ? '🏆' : '🎟️';
  document.getElementById('scratch-result-title').textContent = won ? 'Félicitations !' : 'Pas de chance...';
  document.getElementById('scratch-result-desc').textContent = _boiteResult.reward || '';
  document.getElementById('scratch-result-code').textContent = _boiteResult.code || '';
  document.getElementById('scratch-hint').textContent = 'Gratte avec le doigt pour révéler';
  document.getElementById('boite-claim-btn').style.display = 'none';
  const canvas = document.getElementById('scratch-canvas');
  if (canvas) canvas.style.display = 'block';
  initScratchCanvas();
}

function initScratchCanvas() {
  const canvas = document.getElementById('scratch-canvas');
  if (!canvas) return;
  canvas.width = 340; canvas.height = 200;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 340, 200);
  grad.addColorStop(0, '#f5a623'); grad.addColorStop(1, '#e85d04');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 340, 200);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = 'bold 64px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('🎁', 170, 120);
  let scratching = false;

  function scratch(x, y) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI*2); ctx.fill();
    const d = ctx.getImageData(0,0,340,200).data;
    let t = 0; for (let i = 3; i < d.length; i += 4) if (d[i] === 0) t++;
    if (t/(340*200) > 0.4) {
      canvas.style.display = 'none';
      document.getElementById('scratch-hint').textContent = '🎉 Révélé !';
      document.getElementById('boite-claim-btn').style.display = 'block';
    }
  }
  canvas.onmousedown = e => { scratching = true; scratch(e.offsetX, e.offsetY); };
  canvas.onmouseup = () => scratching = false;
  canvas.onmousemove = e => { if (scratching) scratch(e.offsetX, e.offsetY); };
  canvas.ontouchstart = e => { e.preventDefault(); const r = canvas.getBoundingClientRect(); scratch(e.touches[0].clientX-r.left, e.touches[0].clientY-r.top); };
  canvas.ontouchmove = e => { e.preventDefault(); const r = canvas.getBoundingClientRect(); scratch(e.touches[0].clientX-r.left, e.touches[0].clientY-r.top); };
}

export function claimBoite() {
  closeGame(); updateUI();
}
