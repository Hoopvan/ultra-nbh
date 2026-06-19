import { db, LEVELS, CURRENT_ORG_ID } from './config.js';
import { profile, gamesData, demoMode } from './state.js';
import { miniAvatarSVG } from './avatar.js';
import { getLevel } from './ui.js';
import { escapeHtml } from './utils.js';

const MEDALS = ['🥇', '🥈', '🥉'];

export async function loadCommunityData() {
  if (demoMode) return;
  const { count } = await db.from('users').select('*', {count:'exact',head:true}).eq('org_id', CURRENT_ORG_ID);
  const fc = document.getElementById('fans-total'); if (fc) fc.textContent = count || '—';

  if (gamesData.pouls) {
    const c = gamesData.pouls.content;
    const matchEl = document.getElementById('tribune-match-name');
    const dateEl = document.getElementById('tribune-match-date');
    if (matchEl) matchEl.innerHTML = escapeHtml(c.match).replace(' vs ', '<br>vs ');
    if (dateEl) dateEl.textContent = c.date_label;
    const { data: votes } = await db.from('pouls_votes').select('emotion').eq('match_id', c.match_id).eq('org_id', CURRENT_ORG_ID);
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
    const { data: votes } = await db.from('pouls_votes').select('emotion').eq('org_id', CURRENT_ORG_ID);
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

  const SEL = 'id,name,xp,streak,avatar_skin,avatar_top,avatar_hair_color,avatar_eyes,avatar_mouth,avatar_facial_hair,avatar_clothe,worn_items';

  // Top 3 global + pool du même niveau en parallèle
  const lvl = getLevel(profile?.xp || 0);
  const [{ data: top3 }, { data: peerPool }] = await Promise.all([
    db.from('users').select(SEL).eq('org_id', CURRENT_ORG_ID).order('xp', {ascending:false}).limit(3),
    db.from('users').select(SEL).eq('org_id', CURRENT_ORG_ID).gte('xp', lvl.min).lt('xp', lvl.max).limit(20),
  ]);

  if (!top3 || top3.length === 0) return;

  // Fans du même niveau hors top 3, mélangés pour la diversité
  const top3Ids = new Set(top3.map(f => f.id));
  const shuffledPeers = (peerPool || [])
    .filter(f => !top3Ids.has(f.id))
    .sort(() => Math.random() - 0.5);
  let peers = shuffledPeers.slice(0, 7);

  // Remplissage si le niveau est peu peuplé
  if (peers.length < 7) {
    const exclude = new Set([...top3Ids, ...peers.map(f => f.id)]);
    const { data: fill } = await db.from('users').select(SEL)
      .eq('org_id', CURRENT_ORG_ID)
      .not('id', 'in', `(${[...exclude].join(',')})`)
      .limit(7 - peers.length);
    if (fill) peers = [...peers, ...fill];
  }

  const allFans = [...top3, ...peers];

  const top = allFans[0];
  const fn = document.getElementById('fj-name'); if (fn) fn.textContent = top.name;
  const fs = document.getElementById('fj-sub'); if (fs) fs.textContent = `${getLevel(top.xp).name} · ${top.xp} XP · 🔥 ${top.streak}j`;
  const fa = document.getElementById('fj-av');
  if (fa) { fa.style.cssText = 'width:44px;height:44px'; fa.innerHTML = await miniAvatarSVG(top); }

  const grid = document.getElementById('fans-grid'); if (!grid) return;
  const avatarSVGs = await Promise.all(allFans.map(f => miniAvatarSVG(f)));
  grid.innerHTML = allFans.map((f, i) => {
    const badge = i < 3
      ? `<span style="position:absolute;bottom:-3px;right:-3px;font-size:15px;line-height:1;filter:drop-shadow(0 1px 2px #000)">${MEDALS[i]}</span>`
      : `<span style="position:absolute;bottom:-4px;right:-4px;width:16px;height:16px;border-radius:50%;background:var(--black3);border:1.5px solid var(--black5);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:var(--white-muted);font-family:'Barlow Condensed',sans-serif">${LEVELS.indexOf(getLevel(f.xp)) + 1}</span>`;
    return `
      <div class="fan-tile">
        <div style="position:relative;width:52px;height:52px">
          <div class="fan-tile-avatar">${avatarSVGs[i]}</div>
          ${badge}
        </div>
        <div class="fan-tile-name">${escapeHtml(f.name.substring(0, 8))}</div>
      </div>`;
  }).join('');
}
