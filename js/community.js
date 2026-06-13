import { db, LEVELS } from './config.js';
import { profile, gamesData, demoMode } from './state.js';
import { miniAvatarSVG } from './avatar.js';
import { getLevel } from './ui.js';

const MEDALS = ['🥇', '🥈', '🥉'];

export async function loadCommunityData() {
  if (demoMode) return;
  const { count } = await db.from('users').select('*', {count:'exact',head:true});
  const fc = document.getElementById('fans-total'); if (fc) fc.textContent = count || '—';

  if (gamesData.pouls) {
    const c = gamesData.pouls.content;
    const matchEl = document.getElementById('tribune-match-name');
    const dateEl = document.getElementById('tribune-match-date');
    if (matchEl) matchEl.innerHTML = c.match.replace(' vs ', '<br>vs ');
    if (dateEl) dateEl.textContent = c.date_label;
    const { data: votes } = await db.from('pouls_votes').select('emotion').eq('match_id', c.match_id);
    if (votes && votes.length) {
      const t = {'En feu':0,'Confiant':0,'On y croit':0,'Nerveux':0};
      votes.forEach(v => { if (t[v.emotion] !== undefined) t[v.emotion]++; });
      const total = votes.length;
      [['feu','En feu'],['conf','Confiant'],['croit','On y croit'],['nerv','Nerveux']].forEach(([k,e]) => {
        const pct = Math.round(t[e]/total*100);
        const bar = document.getElementById('bar-'+k); if (bar) bar.style.width = pct + '%';
        const p = document.getElementById('pct-'+k); if (p) p.textContent = pct + '%';
      });
    }
  } else {
    const { data: votes } = await db.from('pouls_votes').select('emotion');
    if (votes && votes.length) {
      const t = {'En feu':0,'Confiant':0,'On y croit':0,'Nerveux':0};
      votes.forEach(v => { if (t[v.emotion] !== undefined) t[v.emotion]++; });
      const total = votes.length;
      [['feu','En feu'],['conf','Confiant'],['croit','On y croit'],['nerv','Nerveux']].forEach(([k,e]) => {
        const pct = Math.round(t[e]/total*100);
        const bar = document.getElementById('bar-'+k); if (bar) bar.style.width = pct + '%';
        const p = document.getElementById('pct-'+k); if (p) p.textContent = pct + '%';
      });
    }
  }

  const { data: topFans } = await db.from('users').select('id,name,xp,streak,avatar_skin,avatar_top,avatar_hair_color,avatar_eyes,avatar_mouth,avatar_facial_hair,avatar_clothe,worn_items').order('xp',{ascending:false}).limit(10);
  if (topFans && topFans.length) {
    const top = topFans[0];
    const fn = document.getElementById('fj-name'); if (fn) fn.textContent = top.name;
    const fs = document.getElementById('fj-sub'); if (fs) fs.textContent = `${getLevel(top.xp).name} · ${top.xp} XP · 🔥 ${top.streak}j`;
    const fa = document.getElementById('fj-av');
    if (fa) { fa.style.cssText = 'width:44px;height:44px'; fa.innerHTML = await miniAvatarSVG(top); }
    const grid = document.getElementById('fans-grid'); if (!grid) return;
    const avatarSVGs = await Promise.all(topFans.map(f => miniAvatarSVG(f)));
    grid.innerHTML = topFans.map((f, i) => {
      const badge = i < 3
        ? `<span style="position:absolute;bottom:-3px;right:-3px;font-size:15px;line-height:1;filter:drop-shadow(0 1px 2px #000)">${MEDALS[i]}</span>`
        : `<span style="position:absolute;bottom:-4px;right:-4px;width:16px;height:16px;border-radius:50%;background:var(--black3);border:1.5px solid var(--black5);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:var(--white-muted);font-family:'Barlow Condensed',sans-serif">${LEVELS.indexOf(getLevel(f.xp)) + 1}</span>`;
      return `
        <div class="fan-tile">
          <div style="position:relative;width:52px;height:52px">
            <div class="fan-tile-avatar">${avatarSVGs[i]}</div>
            ${badge}
          </div>
          <div class="fan-tile-name">${f.name.substring(0, 8)}</div>
        </div>`;
    }).join('');
  }
}
