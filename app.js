// ── CONFIG SUPABASE ────────────────────────────────────────
// Remplace ces deux valeurs avec tes vraies clés
const SUPABASE_URL = "{{SUPABASE_URL}}";
const SUPABASE_ANON_KEY = "{{SUPABASE_ANON_KEY}}";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── CONSTANTES ─────────────────────────────────────────────
const LEVELS = [
  {name:'Curieux',min:0,max:100},{name:'Supporter',min:100,max:300},
  {name:'Fidèle',min:300,max:600},{name:'Ultras',min:600,max:1000},
  {name:'Légende',min:1000,max:9999}
];
const UNLOCKABLES = [
  {id:'couleurs',icon:'🎨',name:'Couleurs NBH',cost:50,desc:'Les couleurs officielles du club sur ton avatar'},
  {id:'echarpe',icon:'🧣',name:'Écharpe',cost:80,desc:'L\'écharpe officielle de l\'Hermine'},
  {id:'casquette',icon:'🧢',name:'Casquette',cost:120,desc:'La casquette bleue marine'},
  {id:'maillot',icon:'👕',name:'Maillot',cost:200,desc:'Le maillot domicile du club'},
  {id:'badge',icon:'🏅',name:'Badge Fondateur',cost:300,desc:'Membre fondateur de la communauté'},
  {id:'couronne',icon:'👑',name:'Couronne',cost:500,desc:'Légende de l\'Hermine'}
];
// Jeux chargés depuis Supabase
let gamesData = { pouls: null, vestiaire: null, anecdote: null, nantes_nbh: null, avant_apres: null };

// Palettes
const SKINS = {skin1:'#f5c89a',skin2:'#d4956a',skin3:'#a0673a',skin4:'#6b3a1f'};

// ── STATE ──────────────────────────────────────────────────
let currentUser = null;
let profile = null;
let selEmotion = null;
let vAnswered = false;
// État création avatar
let newName = '';
let newSil = 'A';
let newSkin = 'skin1';
let newHair = 'hair1';

// ── INIT ───────────────────────────────────────────────────
window.onload = async () => {
  startCountdown();

  // Affiche le bouton démo uniquement en local
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    const btn = document.getElementById('demo-btn');
    if (btn) btn.style.display = 'block';
  }

  const { data: { session } } = await db.auth.getSession();
  if (session) { currentUser = session.user; await loadOrCreateProfile(); }
  else showScreen('onboarding');
  db.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) { currentUser = session.user; await loadOrCreateProfile(); }
  });
};

// Mode démo — profil fictif en mémoire, pas de Supabase auth
function startDemoMode() {
  currentUser = { id: 'demo-user-local' };
  profile = {
    id: 'demo-user-local',
    name: 'Fan Demo',
    xp: 150,
    interactions: 8,
    streak: 3,
    last_play: new Date().toISOString().split('T')[0],
    active_items: ['couleurs', 'echarpe'],
    avatar_silhouette: 'A',
    avatar_skin: 'skin2',
    avatar_hair: 'hair1',
    pouls_date: null,
    vestiaire_date: null
  };

  // Override des fonctions Supabase pour le mode démo
  window._demoMode = true;

  loadGames().then(() => {
    loadCommunityData();
    showMain();
  });
}

async function signInWithGoogle() {
  const { error } = await db.auth.signInWithOAuth({
    provider:'google', options:{ redirectTo: window.location.href }
  });
  if (error) document.getElementById('auth-error').classList.add('show');
}

async function loadOrCreateProfile() {
  const { data } = await db.from('users').select('*').eq('id', currentUser.id).single();
  if (data) { profile = data; await checkStreak(); await loadGames(); await loadCommunityData(); showMain(); }
  else showScreen('name');
}

// ── CRÉATION PROFIL ────────────────────────────────────────
function goToAvatarCreate() {
  const name = document.getElementById('name-input').value.trim();
  if (!name) { document.getElementById('name-input').focus(); return; }
  newName = name;
  showScreen('create-avatar');
  updateCreatePreview();
}

// Sélecteurs de personnalisation
function setSil(v) {
  newSil = v; ['A','B'].forEach(s => document.getElementById('sil-'+s).classList.toggle('sel', s===v));
  updateCreatePreview();
}
function setSkin(v) {
  newSkin = v; Object.keys(SKINS).forEach(s => document.getElementById('skin-'+s).classList.toggle('sel', s===v));
  updateCreatePreview();
}
function setHair(v) {
  newHair = v; ['hair1','hair2','hair3','hair4'].forEach(h => document.getElementById('hair-'+h).classList.toggle('sel', h===v));
  updateCreatePreview();
}
function updateCreatePreview() {
  const el = document.getElementById('create-preview');
  if (el) el.innerHTML = buildAvatarSVG(false, false, false, newSil, newSkin, newHair);
}

async function submitProfile() {
  if (window._demoMode) {
    profile.name = newName; profile.avatar_silhouette = newSil;
    profile.avatar_skin = newSkin; profile.avatar_hair = newHair;
    showMain(); return;
  }
  // Le serveur fixe les valeurs de départ (xp/coins/streak...) — le client
  // ne fait que proposer le nom et l'apparence (voir create_profile dans
  // supabase/04_lock_down_users_table.sql).
  const { data, error } = await db.rpc('create_profile', {
    p_name: newName, p_silhouette: newSil, p_skin: newSkin, p_hair: newHair
  });
  if (data) { profile = data; showMain(); }
  else console.error('Insert error:', error);
}

async function checkStreak() {
  if (!profile) return;
  const today = new Date().toISOString().split('T')[0];
  if (profile.last_play === today) return;
  // Le serveur revalide la progression du streak à partir de sa propre date
  // (voir update_streak dans supabase/04_lock_down_users_table.sql).
  if (window._demoMode) {
    const diff = Math.floor((new Date(today) - new Date(profile.last_play)) / 86400000);
    if (diff === 1) profile = { ...profile, streak: profile.streak + 1, last_play: today };
    else if (diff > 1) profile = { ...profile, streak: 1, last_play: today };
    return;
  }
  const { data, error } = await db.rpc('update_streak');
  if (!error && data) profile = data;
  else if (error) console.error('update_streak error:', error);
}

async function updateProfile(fields) {
  if (window._demoMode) { profile = {...profile, ...fields}; return; }
  const { data } = await db.from('users').update(fields).eq('id', currentUser.id).select().single();
  if (data) profile = data;
}

// ── NAVIGATION ─────────────────────────────────────────────
function showScreen(name) {
  // Cache TOUS les écrans sans exception
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });
  // Affiche uniquement le bon
  const target = document.getElementById('screen-'+name);
  if (target) {
    target.style.display = 'flex';
    target.classList.add('active');
  }
  // Navbar toujours cachée sur les écrans hors app
  const appScreens = ['tribune','missions','avatar'];
  document.getElementById('navbar').style.display = appScreens.includes(name) ? 'flex' : 'none';
}

function showMain() {
  let tutoDone = false;
  try { tutoDone = localStorage.getItem('hoop_tuto_done') === '1'; } catch(e) {}
  if (!tutoDone) { showTuto(); return; }
  showTab('tribune');
}

function showTuto() {
  showScreen('tuto');
  tutoStep = 1;
  updateTutoStep();
}

function skipTuto() {
  try { localStorage.setItem('hoop_tuto_done', '1'); } catch(e) {}
  showTab('tribune');
}

const TABS = ['tribune','missions','avatar'];
function showTab(tab) {
  // Cache tous les écrans proprement
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });
  // Affiche le bon onglet
  const target = document.getElementById('screen-'+tab);
  if(target) { target.style.display = 'flex'; target.classList.add('active'); }
  document.getElementById('navbar').style.display = 'flex';
  // Active le bon bouton nav
  ['tribune','missions','avatar'].forEach(t => {
    document.getElementById('nav-'+t)?.classList.toggle('active', t===tab);
  });
  updateUI();
  if (tab === 'tribune') loadCommunityData();
}

// ── UI ─────────────────────────────────────────────────────
function getLevel() {
  const xp = profile?.xp || 0;
  return LEVELS.find(l => xp >= l.min && xp < l.max) || LEVELS[LEVELS.length-1];
}

function updateUI() {
  if (!profile) return;
  const lvl = getLevel();
  const lvlIdx = LEVELS.indexOf(lvl) + 1;
  const pct = Math.min(100, Math.round((profile.xp - lvl.min) / (lvl.max - lvl.min) * 100));
  ['xp-t','xp-m','xp-a'].forEach(id => { const el=document.getElementById(id); if(el) el.textContent=profile.xp; });
  ['coins-t','coins-m','coins-a'].forEach(id => { const el=document.getElementById(id); if(el) el.textContent=profile.coins||0; });
  const mn=document.getElementById('m-fan-name'); if(mn) mn.textContent=profile.name;
  const md=document.getElementById('m-date');
  if(md){ const d=new Date(); md.textContent=d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}); }
  const ml=document.getElementById('m-lvl-label'); if(ml) ml.textContent=`Niveau ${lvlIdx} · ${lvl.name}`;
  const mp=document.getElementById('m-lvl-pts'); if(mp) mp.textContent=`${profile.xp}/${lvl.max} XP`;
  const mx=document.getElementById('m-xp-bar'); if(mx) mx.style.width=pct+'%';
  const ms=document.getElementById('m-streak'); if(ms) ms.textContent=profile.streak;
  const mss=document.getElementById('m-streak-s'); if(mss) mss.textContent=profile.streak>1?'s':'';
  const sx=document.getElementById('s-xp'); if(sx) sx.textContent=profile.xp;
  const sm=document.getElementById('s-missions'); if(sm) sm.textContent=profile.interactions;
  const ss=document.getElementById('s-streak'); if(ss) ss.textContent=profile.streak;
  const today = new Date().toISOString().split('T')[0];
  // Affiche/masque les cartes selon les jeux disponibles aujourd'hui
  const mcVest = document.getElementById('mc-vestiaire');
  const mcAnec = document.getElementById('mc-anecdote');
  const mcNnb = document.getElementById('mc-nantes-nbh');
  const mcAa = document.getElementById('mc-avant-apres');
  if(mcVest) mcVest.style.display = gamesData.vestiaire ? '' : 'none';
  if(mcAnec) mcAnec.style.display = gamesData.anecdote ? '' : 'none';
  if(mcNnb) mcNnb.style.display = gamesData.nantes_nbh ? '' : 'none';
  if(mcAa) mcAa.style.display = gamesData.avant_apres ? '' : 'none';

  if(profile.pouls_date===today) setMissionDone('mc-pouls','mx-pouls','pouls');
  if(profile.vestiaire_date===today) setMissionDone('mc-vestiaire','mx-vestiaire','vestiaire');
  if(profile.anecdote_date===today) setMissionDone('mc-anecdote','mx-anecdote','anecdote');
  if(profile.nantes_nbh_date===today) setMissionDone('mc-nantes-nbh','mx-nantes-nbh','nantes_nbh');
  const mcProno = document.getElementById('mc-pronostic');
  if(mcProno) mcProno.style.display = gamesData.pronostic ? '' : 'none';

  if(profile.pronostic_date===today) setMissionDone('mc-pronostic','mx-pronostic','pronostic');
  if(profile.avant_apres_date===today) setMissionDone('mc-avant-apres','mx-avant-apres','avant_apres');

  // Boîte mystère — visible uniquement si toutes missions du jour faites
  checkBoiteAccess();

  // Résultat pronostic d'hier
  checkPronoResult();
  const an=document.getElementById('av-name'); if(an) an.textContent=profile.name;
  const ar=document.getElementById('av-rank'); if(ar) ar.textContent=`★ ${lvl.name}`;
  renderAvatar();
  renderEquip();
  renderNextUnlocks();
}

function setMissionDone(cardId, xpId, gameType) {
  const mc = document.getElementById(cardId);
  if(mc) {
    mc.className = 'mission-card';
    mc.style.opacity = '.6';
    mc.style.borderColor = 'var(--black4)';
    mc.style.cursor = 'pointer';
    mc.setAttribute('onclick', gameType ? `openGameReadOnly('${gameType}')` : '');
  }
  const mx = document.getElementById(xpId);
  if(mx){ mx.textContent = 'Fait ✓'; mx.className = 'mission-xp xp-done'; }
}

// ── AVATAR ─────────────────────────────────────────────────
function renderAvatar() {
  const wrap = document.getElementById('avatar-svg'); if(!wrap) return;
  const worn = profile?.worn_items || [];
  wrap.innerHTML = buildAvatarSVG(
    worn.includes('echarpe'), worn.includes('casquette'), worn.includes('maillot'),
    profile?.avatar_silhouette || 'A',
    profile?.avatar_skin || 'skin1',
    profile?.avatar_hair || 'hair1'
  );
}

function buildAvatarSVG(echarpe, casquette, maillot, sil='A', skin='skin1', hair='hair1') {
  const sc = SKINS[skin] || '#f5c89a';
  const hasNBHColors = echarpe || casquette || maillot || true; // couleurs visibles dès le début, items gérés via paramètres
  const bodyColor = maillot ? '#0d1b3e' : '#1c1c26';
  const hc = '#2a1a0a';

  // ── VISAGE : A = masculin (mâchoire carrée), B = féminin (ovale) ──
  const faceSVG = sil === 'B'
    ? `<!-- Visage féminin : ovale, traits fins, cils -->
       <ellipse cx="75" cy="63" rx="25" ry="28" fill="${sc}"/>
       <ellipse cx="47" cy="65" rx="5" ry="6.5" fill="${sc}"/>
       <ellipse cx="103" cy="65" rx="5" ry="6.5" fill="${sc}"/>
       <circle cx="65" cy="58" r="4" fill="#1a1a2e"/><circle cx="85" cy="58" r="4" fill="#1a1a2e"/>
       <circle cx="66.5" cy="56.5" r="1.5" fill="white"/><circle cx="86.5" cy="56.5" r="1.5" fill="white"/>
       <path d="M61 52 Q65 49 69 52" stroke="#3a2010" stroke-width="1.8" fill="none" stroke-linecap="round"/>
       <path d="M81 52 Q85 49 89 52" stroke="#3a2010" stroke-width="1.8" fill="none" stroke-linecap="round"/>
       <path d="M61 50 Q65 47.5 69 50" stroke="#1a1a2e" stroke-width="2" fill="none" stroke-linecap="round"/>
       <path d="M81 50 Q85 47.5 89 50" stroke="#1a1a2e" stroke-width="2" fill="none" stroke-linecap="round"/>
       <ellipse cx="75" cy="66" rx="2.5" ry="2" fill="${sc}" stroke="#c49a6c" stroke-width=".5"/>
       <path d="M69 73 Q75 78 81 73" stroke="#c0506a" stroke-width="2" fill="none" stroke-linecap="round"/>
       <ellipse cx="64" cy="62" rx="4" ry="2.5" fill="rgba(232,100,120,.15)"/>
       <ellipse cx="86" cy="62" rx="4" ry="2.5" fill="rgba(232,100,120,.15)"/>`
    : `<!-- Visage masculin : légèrement carré, mâchoire marquée -->
       <ellipse cx="75" cy="64" rx="27" ry="29" fill="${sc}"/>
       <ellipse cx="48" cy="66" rx="5.5" ry="7" fill="${sc}"/>
       <ellipse cx="102" cy="66" rx="5.5" ry="7" fill="${sc}"/>
       <path d="M52 78 Q75 86 98 78" fill="${sc}"/>
       <circle cx="65" cy="59" r="4.5" fill="#1a1a2e"/><circle cx="85" cy="59" r="4.5" fill="#1a1a2e"/>
       <circle cx="66.5" cy="57.5" r="1.5" fill="white"/><circle cx="86.5" cy="57.5" r="1.5" fill="white"/>
       <path d="M60 53 Q65 50 70 53" stroke="#5a3a1a" stroke-width="2" fill="none" stroke-linecap="round"/>
       <path d="M80 53 Q85 50 90 53" stroke="#5a3a1a" stroke-width="2" fill="none" stroke-linecap="round"/>
       <ellipse cx="75" cy="68" rx="3" ry="2.5" fill="${sc}" stroke="#c49a6c" stroke-width=".5"/>
       <path d="M69 75 Q75 80 81 75" stroke="#8b4513" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;

  // ── CHEVEUX : hair1/hair2 = masc, hair3/hair4 = fém ──
  const hairSVG = {
    // Masculin — court dégradé
    hair1: `<ellipse cx="75" cy="38" rx="27" ry="14" fill="${hc}"/><ellipse cx="75" cy="34" rx="24" ry="10" fill="${hc}"/>
            <ellipse cx="50" cy="50" rx="6" ry="10" fill="${hc}"/><ellipse cx="100" cy="50" rx="6" ry="10" fill="${hc}"/>`,
    // Masculin — dégradé fondu (côtés rasés, dessus plus long)
    hair2: `<ellipse cx="75" cy="36" rx="27" ry="12" fill="${hc}"/>
            <rect x="48" y="36" width="7" height="16" rx="3.5" fill="${hc}" opacity=".6"/>
            <rect x="95" y="36" width="7" height="16" rx="3.5" fill="${hc}" opacity=".6"/>
            <ellipse cx="75" cy="32" rx="22" ry="10" fill="${hc}"/>`,
    // Féminin — chignon haut
    hair3: `<ellipse cx="75" cy="38" rx="27" ry="15" fill="${hc}"/>
            <ellipse cx="75" cy="30" rx="20" ry="12" fill="${hc}"/>
            <ellipse cx="47" cy="60" rx="5" ry="14" fill="${hc}"/>
            <ellipse cx="103" cy="60" rx="5" ry="14" fill="${hc}"/>
            <circle cx="75" cy="22" r="10" fill="${hc}"/>
            <rect x="69" y="24" width="12" height="6" rx="3" fill="${hc}"/>`,
    // Féminin — queue de cheval
    hair4: `<ellipse cx="75" cy="37" rx="27" ry="14" fill="${hc}"/>
            <ellipse cx="75" cy="32" rx="23" ry="10" fill="${hc}"/>
            <ellipse cx="47" cy="58" rx="5" ry="13" fill="${hc}"/>
            <ellipse cx="103" cy="58" rx="5" ry="13" fill="${hc}"/>
            <rect x="70" y="28" width="10" height="5" rx="2.5" fill="#e8192c"/>
            <path d="M98 38 Q115 48 112 65 Q110 75 103 72" stroke="${hc}" stroke-width="8" fill="none" stroke-linecap="round"/>`
  }[hair] || '';

  // Casquette override cheveux
  const capSVG = casquette
    ? `<ellipse cx="75" cy="36" rx="32" ry="14" fill="#0d1b3e"/><rect x="43" y="29" width="64" height="18" rx="4" fill="#0d1b3e"/><rect x="41" y="44" width="24" height="7" rx="3" fill="#0d1b3e"/><text x="75" y="44" text-anchor="middle" font-family="Barlow Condensed" font-weight="800" font-size="11" fill="#e8192c">NBH</text>`
    : hairSVG;

  // ── CORPS : unique, ajusté légèrement selon visage ──
  const bodySVG = `<ellipse cx="75" cy="112" rx="32" ry="38" fill="${bodyColor}"/>
    ${maillot?`<text x="75" y="118" text-anchor="middle" font-family="Barlow Condensed" font-weight="800" font-size="14" fill="white">NBH</text>`:''}`;

  const scarfSVG = echarpe
    ? `<rect x="52" y="85" width="46" height="10" rx="5" fill="#e8192c"/><rect x="57" y="93" width="6" height="15" rx="3" fill="#e8192c"/><rect x="87" y="93" width="6" height="15" rx="3" fill="#e8192c"/><text x="75" y="93" text-anchor="middle" font-family="Barlow Condensed" font-weight="700" font-size="7" fill="white">HERMINE</text>`
    : '';

  return `<svg viewBox="0 0 150 168" fill="none" xmlns="http://www.w3.org/2000/svg">
    ${bodySVG}
    ${faceSVG}
    ${capSVG}
    ${scarfSVG}
    <ellipse cx="42" cy="110" rx="8.5" ry="21" fill="${bodyColor}" transform="rotate(-10 42 110)"/>
    <ellipse cx="108" cy="110" rx="8.5" ry="21" fill="${bodyColor}" transform="rotate(10 108 110)"/>
    <ellipse cx="36" cy="128" rx="8" ry="7" fill="${sc}" transform="rotate(-10 36 128)"/>
    <ellipse cx="114" cy="128" rx="8" ry="7" fill="${sc}" transform="rotate(10 114 128)"/>
    <rect x="57" y="147" width="15" height="17" rx="7" fill="#252530"/>
    <rect x="78" y="147" width="15" height="17" rx="7" fill="#252530"/>
  </svg>`;
}

function miniAvatarSVG(p) {
  const sc = SKINS[p?.avatar_skin || 'skin1'] || '#f5c89a';
  const worn = p?.worn_items || [];
  const hasCap = worn.includes('casquette');
  const hasScarf = worn.includes('echarpe');
  const hasMaillot = worn.includes('maillot');
  const hc = '#2a1a0a';
  const bodyColor = hasMaillot ? '#0d1b3e' : '#1c1c26';

  // Cheveux selon coupe
  const hairMap = {
    hair1: `<ellipse cx="26" cy="13" rx="12" ry="7" fill="${hc}"/><ellipse cx="26" cy="11" rx="10" ry="5" fill="${hc}"/>`,
    hair2: `<ellipse cx="26" cy="12" rx="12" ry="6" fill="${hc}"/><rect x="14" y="13" width="3" height="7" rx="1.5" fill="${hc}" opacity=".6"/><rect x="35" y="13" width="3" height="7" rx="1.5" fill="${hc}" opacity=".6"/>`,
    hair3: `<ellipse cx="26" cy="13" rx="12" ry="8" fill="${hc}"/><circle cx="26" cy="8" r="5" fill="${hc}"/>`,
    hair4: `<ellipse cx="26" cy="12" rx="12" ry="6" fill="${hc}"/><path d="M34 13 Q40 17 39 24" stroke="${hc}" stroke-width="3" fill="none" stroke-linecap="round"/>`
  };
  const hairSVG = hasCap
    ? `<ellipse cx="26" cy="12" rx="13" ry="6" fill="#0d1b3e"/><rect x="13" y="9" width="26" height="8" rx="2" fill="#0d1b3e"/><rect x="11" y="15" width="9" height="4" rx="2" fill="#0d1b3e"/>`
    : (hairMap[p?.avatar_hair || 'hair1'] || hairMap.hair1);

  return `<svg viewBox="0 0 52 52" fill="none">
    <ellipse cx="26" cy="33" rx="13" ry="15" fill="${bodyColor}"/>
    ${hasMaillot ? `<text x="26" y="36" text-anchor="middle" font-family="Barlow Condensed" font-weight="800" font-size="6" fill="white">NBH</text>` : ''}
    <ellipse cx="26" cy="21" rx="10" ry="11" fill="${sc}"/>
    ${hairSVG}
    ${hasScarf ? `<rect x="16" y="29" width="20" height="5" rx="2.5" fill="#e8192c"/>` : ''}
    <circle cx="22" cy="20" r="2" fill="#1a1a2e"/>
    <circle cx="30" cy="20" r="2" fill="#1a1a2e"/>
  </svg>`;
}

function renderEquip() {
  const grid = document.getElementById('equip-grid'); if(!grid) return;
  const owned = profile?.active_items || [];
  const worn = profile?.worn_items || [];
  const coins = profile?.coins || 0;

  grid.innerHTML = UNLOCKABLES.map(u => {
    const isOwned = owned.includes(u.id);
    const isWorn = worn.includes(u.id);
    const canAfford = coins >= u.cost;

    if (isOwned) {
      return `<div class="equip-item unlocked ${isWorn ? 'active-eq' : ''}" onclick="toggleWorn('${u.id}')">
        <div class="equip-icon">${u.icon}</div>
        <div class="equip-name">${u.name}</div>
        <div style="font-size:9px;color:${isWorn ? 'var(--red)' : 'var(--white-muted)'};margin-top:2px">${isWorn ? '✓ Porté' : 'Tap pour porter'}</div>
      </div>`;
    } else {
      return `<div class="equip-item locked-eq" onclick="${canAfford ? `buyItem('${u.id}')` : ''}"
        style="${canAfford ? 'cursor:pointer;opacity:1;border-color:rgba(245,166,35,.3)' : ''}">
        <div class="equip-icon">${u.icon}</div>
        <div class="equip-name">${u.name}</div>
        <div class="equip-req">${u.cost} 🐾 ${canAfford ? '🛒' : '🔒'}</div>
      </div>`;
    }
  }).join('');
}

async function toggleWorn(id) {
  if (!profile) return;
  const worn = [...(profile.worn_items || [])];
  const idx = worn.indexOf(id);
  if (idx > -1) worn.splice(idx, 1);
  else worn.push(id);
  await updateProfile({ worn_items: worn });
  renderAvatar(); renderEquip();
}

function renderNextUnlocks() {
  const wrap = document.getElementById('next-unlocks'); if(!wrap) return;
  const items = profile?.worn_items || [];
  const coins = profile?.coins || 0;
  const next = UNLOCKABLES.filter(u => !items.includes(u.id)).slice(0, 3);
  if(!next.length){ wrap.innerHTML='<div style="font-size:13px;color:var(--red);padding:0 0 4px">🏆 Tout débloqué !</div>'; return; }
  wrap.innerHTML = next.map(u => {
    const pct = Math.min(100, Math.round(coins / u.cost * 100));
    return `<div class="next-unlock-row">
      <div style="font-size:22px;flex-shrink:0">${u.icon}</div>
      <div class="next-unlock-info">
        <div class="next-unlock-name">${u.name}</div>
        <div class="next-unlock-bar"><div class="next-unlock-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="next-unlock-count">${coins}/${u.cost} 🐾</div>
    </div>`;
  }).join('');
}

// ── COMMUNITY ──────────────────────────────────────────────
async function loadCommunityData() {
  const { count } = await db.from('users').select('*', {count:'exact',head:true});
  const fc = document.getElementById('fans-total'); if(fc) fc.textContent = count || '—';

  // Infos du prochain match depuis le jeu Pouls actif
  if (gamesData.pouls) {
    const c = gamesData.pouls.content;
    const matchEl = document.getElementById('tribune-match-name');
    const dateEl = document.getElementById('tribune-match-date');
    if (matchEl) matchEl.innerHTML = c.match.replace(' vs ', '<br>vs ');
    if (dateEl) dateEl.textContent = c.date_label;
    // Filtre les votes par match_id
    const { data: votes } = await db.from('pouls_votes').select('emotion').eq('match_id', c.match_id);
    if(votes && votes.length) {
      const t = {'En feu':0,'Confiant':0,'On y croit':0,'Nerveux':0};
      votes.forEach(v => { if(t[v.emotion]!==undefined) t[v.emotion]++; });
      const total = votes.length;
      [['feu','En feu'],['conf','Confiant'],['croit','On y croit'],['nerv','Nerveux']].forEach(([k,e]) => {
        const pct = Math.round(t[e]/total*100);
        const bar=document.getElementById('bar-'+k); if(bar) bar.style.width=pct+'%';
        const p=document.getElementById('pct-'+k); if(p) p.textContent=pct+'%';
      });
    }
  } else {
    // Fallback si pas de jeu actif
    const { data: votes } = await db.from('pouls_votes').select('emotion');
    if(votes && votes.length) {
      const t = {'En feu':0,'Confiant':0,'On y croit':0,'Nerveux':0};
      votes.forEach(v => { if(t[v.emotion]!==undefined) t[v.emotion]++; });
      const total = votes.length;
      [['feu','En feu'],['conf','Confiant'],['croit','On y croit'],['nerv','Nerveux']].forEach(([k,e]) => {
        const pct = Math.round(t[e]/total*100);
        const bar=document.getElementById('bar-'+k); if(bar) bar.style.width=pct+'%';
        const p=document.getElementById('pct-'+k); if(p) p.textContent=pct+'%';
      });
    }
  }

  const { data: topFans } = await db.from('users').select('name,xp,streak,avatar_silhouette,avatar_skin,avatar_hair,worn_items').order('xp',{ascending:false}).limit(10);
  if(topFans && topFans.length) {
    const top = topFans[0];
    const fn=document.getElementById('fj-name'); if(fn) fn.textContent=top.name;
    const fs=document.getElementById('fj-sub'); if(fs) fs.textContent=`${getLevel().name} · ${top.xp} XP · 🔥 ${top.streak}j`;
    const fa=document.getElementById('fj-av'); if(fa){ fa.style.cssText='width:44px;height:44px'; fa.innerHTML=miniAvatarSVG(top); }
    const grid=document.getElementById('fans-grid'); if(!grid) return;
    grid.innerHTML = topFans.map((f,i) => `
      <div class="fan-tile">
        <div class="fan-tile-avatar ${i<3?'online':''}">${miniAvatarSVG(f)}</div>
        <div class="fan-tile-name">${f.name.substring(0,8)}</div>
      </div>`).join('');
  }
}

// ── GAMES ──────────────────────────────────────────────────
// ── CHARGEMENT JEUX DEPUIS SUPABASE ────────────────────────
async function loadGames() {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await db.from('games')
    .select('*')
    .eq('active', true)
    .order('date', { ascending: false });

  if (!data) return;

  // Prend le jeu du jour pour chaque type
  // Pour le pouls : prend le prochain match à venir (match_datetime dans le futur)
  const now = new Date().toISOString();
  const upcomingPouls = data.filter(g => g.type === 'pouls' && g.content?.match_datetime && g.content.match_datetime > now);
  gamesData.pouls = upcomingPouls.length > 0
    ? upcomingPouls[upcomingPouls.length - 1] // le plus proche dans le futur
    : data.find(g => g.type === 'pouls') || null; // fallback sur le plus récent
  // Pour les autres : uniquement le jeu daté aujourd'hui
  gamesData.vestiaire = data.find(g => g.type === 'vestiaire' && g.date === today) || null;
  gamesData.anecdote = data.find(g => g.type === 'anecdote' && g.date === today) || null;
  gamesData.nantes_nbh = data.find(g => g.type === 'nantes_nbh' && g.date === today) || null;
  gamesData.avant_apres = data.find(g => g.type === 'avant_apres' && g.date === today) || null;
  gamesData.pronostic = data.find(g => g.type === 'pronostic' && g.date === today) || null;
  gamesData.boite_mystere = data.find(g => g.type === 'boite_mystere' && g.active) || null;

  // Met à jour les infos du Pouls dans l'écran du jeu
  if (gamesData.pouls) {
    const c = gamesData.pouls.content;
    const el = document.getElementById('pouls-match-info-text');
    if (el) el.textContent = `${c.match} · ${c.date_label}`;
    // Met à jour le countdown avec la date du match
    if (c.match_datetime) _matchTarget = new Date(c.match_datetime);
  }

  // Met à jour les infos du Vestiaire
  if (gamesData.vestiaire) {
    const c = gamesData.vestiaire.content;
    const num = document.getElementById('v-num'); if(num) num.textContent = c.num;
    const name = document.getElementById('v-name'); if(name) name.textContent = c.name;
    const pos = document.getElementById('v-pos'); if(pos) pos.textContent = c.pos;
    const q = document.getElementById('v-question-text'); if(q) q.innerHTML = c.question;
  }
}

// Mode lecture seule — voir une mission déjà faite sans pouvoir la refaire
function openGameReadOnly(name) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });
  document.getElementById('navbar').style.display = 'none';
  const screen = document.getElementById('game-'+name);
  if(screen) { screen.style.display = 'flex'; screen.classList.add('active'); }

  // Initialise le contenu du jeu
  if(name === 'vestiaire') { vAnswered = false; initVestiaire(); }
  if(name === 'anecdote') { anecAnswered = false; initAnecdote(); }
  if(name === 'nantes_nbh') { nnbAnswered = false; initNantesNBH(); }
  if(name === 'avant_apres') initAvantApres();
  if(name === 'pronostic') {
    initPronostic();
    // Affiche le prono déjà soumis au lieu de 75-75
    if(profile?.pronostic_score) {
      const [h, a] = profile.pronostic_score.split('-').map(Number);
      pronoHome = isNaN(h) ? 75 : h;
      pronoAway = isNaN(a) ? 75 : a;
      const sh = document.getElementById('score-home'); if(sh) sh.textContent = pronoHome;
      const sa = document.getElementById('score-away'); if(sa) sa.textContent = pronoAway;
    }
  }

  // Bloque les interactions après init
  setTimeout(() => {
    screen?.querySelectorAll('button').forEach(b => {
      const action = b.getAttribute('onclick') || '';
      const isBack = b.classList.contains('game-back-btn') || action.includes('closeGame');
      if (!isBack) {
        b.style.pointerEvents = 'none';
        b.style.opacity = b.classList.contains('correct') ? '1' : '.5';
      }
    });
    screen?.querySelectorAll('.answer-btn, .emotion-btn').forEach(b => {
      b.style.pointerEvents = 'none';
    });
    // Badge lecture
    const scroll = screen?.querySelector('.game-scroll');
    if(scroll && !scroll.querySelector('.readonly-badge')) {
      const badge = document.createElement('div');
      badge.className = 'readonly-badge';
      badge.style.cssText = 'background:var(--black3);border:1px solid var(--black5);border-radius:var(--radius-sm);padding:8px 14px;font-size:12px;color:var(--white-muted);text-align:center;margin-bottom:12px';
      badge.textContent = '👁️ Déjà complétée — consultation uniquement.';
      scroll.prepend(badge);
    }
  }, 100);
}

// Modal des niveaux
function showLevelsModal() {
  const modal = document.getElementById('levels-modal');
  if(modal) {
    // Surbrillance du niveau actuel
    const lvl = getLevel();
    ['Curieux','Supporter','Fidèle','Ultras','Légende'].forEach(n => {
      const row = document.getElementById('lvl-row-'+n);
      if(row) row.style.borderColor = n === lvl.name ? 'var(--red)' : 'var(--black4)';
    });
    modal.classList.add('show');
  }
}

function openGame(name) {
  // Cache tous les écrans proprement
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });
  document.getElementById('navbar').style.display = 'none';
  // Affiche le jeu en plein écran
  const gameScreen = document.getElementById('game-'+name);
  if(gameScreen) { gameScreen.style.display = 'flex'; gameScreen.classList.add('active'); }
  if(name === 'vestiaire') initVestiaire();
  if(name === 'anecdote') { anecAnswered = false; initAnecdote(); }
  if(name === 'nantes_nbh') { nnbAnswered = false; initNantesNBH(); }
  if(name === 'avant_apres') initAvantApres();
  if(name === 'pronostic') initPronostic();
  if(name === 'boite_mystere') initBoite();
}

function closeGame() {
  // Cache tous les jeux
  document.querySelectorAll('.game-screen').forEach(g => {
    g.classList.remove('active');
    g.style.display = 'none';
    // Supprime le badge lecture si présent
    g.querySelector('.readonly-badge')?.remove();
  });
  // Remet les éléments du pouls à zéro
  const pvu = document.getElementById('pouls-vote-ui'); if(pvu) pvu.style.display = 'block';
  const pru = document.getElementById('pouls-result-ui'); if(pru) pru.classList.remove('show');
  document.querySelectorAll('.emotion-btn').forEach(b => b.classList.remove('sel'));
  selEmotion = null;
  const sb = document.getElementById('pouls-submit'); if(sb) sb.disabled = true;
  // Retour à l'onglet missions
  showTab('missions');
}

function selectEmotion(btn, emoji, label) {
  document.querySelectorAll('.emotion-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel'); selEmotion = {emoji, label};
  document.getElementById('pouls-submit').disabled = false;
}

async function submitPouls() {
  if(!selEmotion || !profile) return;
  const matchId = gamesData.pouls?.content?.match_id || 'match-inconnu';
  const prevLevel = getLevel();

  if (window._demoMode) {
    const today = new Date().toISOString().split('T')[0];
    profile = { ...profile, xp: profile.xp + 20, coins: (profile.coins || 0) + 20, interactions: (profile.interactions || 0) + 1, pouls_date: today };
  } else {
    // Le serveur valide (auth, émotion, anti double-vote) et applique XP/pièces —
    // voir supabase/01_submit_pouls_vote.sql. Le client ne fait que demander.
    const { data, error } = await db.rpc('submit_pouls_vote', { p_match_id: matchId, p_emotion: selEmotion.label });
    if (error) {
      showNotif(error.message?.includes('ALREADY_VOTED_TODAY') ? 'Tu as déjà voté aujourd\'hui !' : 'Oups, le vote n\'a pas pu être enregistré.');
      return;
    }
    profile = data;
  }

  showNotif(`+20 XP ⚡  +20 🐾`);
  const nextLevel = getLevel();
  if (prevLevel !== nextLevel) setTimeout(() => showNotif(`🏆 ${nextLevel.name} !`), 1600);

  const { data: votes } = await db.from('pouls_votes').select('emotion').eq('match_id', matchId);
  let pct = 0;
  if(votes && votes.length){ const same=votes.filter(v=>v.emotion===selEmotion.label).length; pct=Math.round(same/votes.length*100); }
  document.getElementById('pouls-vote-ui').style.display = 'none';
  document.getElementById('pouls-result-ui').classList.add('show');
  document.getElementById('r-emoji').textContent = selEmotion.emoji;
  document.getElementById('r-desc').innerHTML = `<strong>${pct}% des fans</strong> ressentent la même chose avant ce match.<br>L'Hermine peut compter sur toi.`;
  updateUI();
}

function initVestiaire() {
  vAnswered = false;
  const c = gamesData.vestiaire?.content;
  if (!c) { console.warn('Pas de jeu Vestiaire actif'); return; }
  const list = document.getElementById('v-answers'); if(!list) return;
  list.innerHTML = c.answers.map((a,i) => `
    <button class="answer-btn" id="va-${i}" onclick="answerVestiaire(${i},${a.correct})">
      <span class="answer-letter">${['A','B','C'][i]}</span>${a.text}
    </button>`).join('');
  document.getElementById('v-expl').style.display='none';
  document.getElementById('v-xp').style.display='none';
  document.getElementById('v-continue').style.display='none';
}

async function answerVestiaire(idx, correct) {
  if(vAnswered) return; vAnswered = true;
  const c = gamesData.vestiaire?.content;
  if (!c) return;
  c.answers.forEach((a,i) => {
    const b=document.getElementById('va-'+i); if(!b) return;
    b.style.pointerEvents='none';
    if(a.correct) b.classList.add('correct');
    else if(i===idx && !correct) b.classList.add('wrong');
  });
  document.getElementById('v-expl').textContent = c.explication;
  document.getElementById('v-expl').style.display = 'block';
  document.getElementById('v-xp').style.display = 'block';
  document.getElementById('v-continue').style.display = 'block';

  // Le serveur revérifie indépendamment si la réponse est correcte (voir
  // supabase/02_migrate_missions.sql) — le client ne décide plus du gain XP.
  const prevLevel = getLevel();
  let xpGain;
  if (window._demoMode) {
    xpGain = correct ? 30 : 15;
    const today = new Date().toISOString().split('T')[0];
    profile = { ...profile, xp: profile.xp + xpGain, coins: (profile.coins||0) + xpGain, interactions: (profile.interactions||0) + 1, vestiaire_date: today };
  } else {
    const { data, error } = await db.rpc('submit_vestiaire_answer', { p_answer_index: idx });
    if (error) { showNotif('Oups, réponse non enregistrée.'); return; }
    profile = data.profile;
    xpGain = data.correct ? 30 : 15;
  }
  showNotif(`+${xpGain} XP ⚡  +${xpGain} 🐾`);
  const nextLevel = getLevel();
  if (prevLevel !== nextLevel) setTimeout(() => showNotif(`🏆 ${nextLevel.name} !`), 1600);
  updateUI();
}

// ── JEU ANECDOTE ───────────────────────────────────────────
function initAnecdote() {
  const c = gamesData.anecdote?.content;
  if (!c) { console.warn('Pas de jeu Anecdote actif'); closeGame(); return; }
  const subj = document.getElementById('anec-subject'); if(subj) subj.textContent = c.subject || 'Le Club';
  const q = document.getElementById('anec-question'); if(q) q.innerHTML = c.question;
  const list = document.getElementById('anec-answers'); if(!list) return;
  // Mélange les réponses (gardé en mémoire pour identifier le choix par son texte côté serveur)
  anecShuffledAnswers = [...c.answers].sort(() => Math.random() - 0.5);
  list.innerHTML = anecShuffledAnswers.map((a,i) => `
    <button class="answer-btn" id="anec-${i}" onclick="answerAnecdote(${i},${a.correct},this)">
      <span class="answer-letter">${['A','B','C'][i]}</span>${a.text}
    </button>`).join('');
  document.getElementById('anec-expl').style.display = 'none';
  document.getElementById('anec-xp').style.display = 'none';
  document.getElementById('anec-continue').style.display = 'none';
}

let anecAnswered = false;
let anecShuffledAnswers = [];
async function answerAnecdote(idx, correct, btn) {
  if(anecAnswered) return; anecAnswered = true;
  const c = gamesData.anecdote?.content;
  document.querySelectorAll('#anec-answers .answer-btn').forEach((b,i) => {
    b.style.pointerEvents = 'none';
  });
  btn.classList.add(correct ? 'correct' : 'wrong');
  // Trouve et colorie la bonne réponse
  if (!correct) {
    const allBtns = document.querySelectorAll('#anec-answers .answer-btn');
    allBtns.forEach(b => { if(b.textContent.trim().includes(c.answers.find(a=>a.correct)?.text?.substring(0,20))) b.classList.add('correct'); });
  }
  document.getElementById('anec-expl').textContent = c.explication;
  document.getElementById('anec-expl').style.display = 'block';
  document.getElementById('anec-xp').style.display = 'block';
  document.getElementById('anec-continue').style.display = 'block';

  // Le serveur retrouve la réponse choisie par son texte (l'ordre est mélangé
  // côté client) et revérifie indépendamment si elle est correcte.
  const prevLevel = getLevel();
  let xpGain;
  if (window._demoMode) {
    xpGain = correct ? 30 : 15;
    const today = new Date().toISOString().split('T')[0];
    profile = { ...profile, xp: profile.xp + xpGain, coins: (profile.coins||0) + xpGain, interactions: (profile.interactions||0) + 1, anecdote_date: today };
  } else {
    const { data, error } = await db.rpc('submit_anecdote_answer', { p_answer_text: anecShuffledAnswers[idx]?.text });
    if (error) { showNotif('Oups, réponse non enregistrée.'); return; }
    profile = data.profile;
    xpGain = data.correct ? 30 : 15;
  }
  showNotif(`+${xpGain} XP ⚡  +${xpGain} 🐾`);
  const nextLevel = getLevel();
  if (prevLevel !== nextLevel) setTimeout(() => showNotif(`🏆 ${nextLevel.name} !`), 1600);
  updateUI();
}

// ── JEU NANTES / NBH / LES DEUX ────────────────────────────
function initNantesNBH() {
  const c = gamesData.nantes_nbh?.content;
  if (!c) { console.warn('Pas de jeu Nantes/NBH actif'); closeGame(); return; }
  const ctx = document.getElementById('nnb-context'); if(ctx) ctx.textContent = c.context || '';
  const q = document.getElementById('nnb-question'); if(q) q.textContent = c.question;
  document.getElementById('nnb-result').style.display = 'none';
  const btns = document.getElementById('nnb-buttons');
  if(!btns) return;
  btns.innerHTML = `
    <button onclick="answerNantesNBH('nantes','${c.answer}')" style="background:var(--black2);border:2px solid var(--black4);border-radius:var(--radius);padding:18px 8px;cursor:pointer;text-align:center;transition:all .15s;display:flex;flex-direction:column;align-items:center;gap:6px">
      <span style="font-size:28px">🏙️</span>
      <span style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;color:var(--white)">Nantes</span>
    </button>
    <button onclick="answerNantesNBH('nbh','${c.answer}')" style="background:var(--black2);border:2px solid var(--black4);border-radius:var(--radius);padding:18px 8px;cursor:pointer;text-align:center;transition:all .15s;display:flex;flex-direction:column;align-items:center;gap:6px">
      <span style="font-size:28px">🏀</span>
      <span style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;color:var(--white)">NBH</span>
    </button>
    <button onclick="answerNantesNBH('les_deux','${c.answer}')" style="background:var(--black2);border:2px solid var(--black4);border-radius:var(--radius);padding:18px 8px;cursor:pointer;text-align:center;transition:all .15s;display:flex;flex-direction:column;align-items:center;gap:6px">
      <span style="font-size:28px">❤️</span>
      <span style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;color:var(--white)">Les Deux</span>
    </button>`;
}

let nnbAnswered = false;
async function answerNantesNBH(choice, correct) {
  if(nnbAnswered) return; nnbAnswered = true;
  const c = gamesData.nantes_nbh?.content;
  const isCorrect = choice === correct;
  // Feedback visuel sur les boutons
  document.querySelectorAll('#nnb-buttons button').forEach(b => {
    b.style.pointerEvents = 'none'; b.style.opacity = '.4';
  });
  const btns = document.querySelectorAll('#nnb-buttons button');
  const idx = ['nantes','nbh','les_deux'].indexOf(choice);
  const correctIdx = ['nantes','nbh','les_deux'].indexOf(correct);
  if(idx >= 0) btns[idx].style.borderColor = isCorrect ? '#1a9e5e' : 'var(--red)';
  if(!isCorrect && correctIdx >= 0) { btns[correctIdx].style.borderColor = '#1a9e5e'; btns[correctIdx].style.opacity = '1'; }
  document.getElementById('nnb-expl').textContent = c.explication;
  document.getElementById('nnb-result').style.display = 'block';

  // Le serveur revérifie indépendamment le choix par rapport à la bonne réponse.
  const prevLevel = getLevel();
  let xpGain;
  if (window._demoMode) {
    xpGain = isCorrect ? 30 : 15;
    const today = new Date().toISOString().split('T')[0];
    profile = { ...profile, xp: profile.xp + xpGain, coins: (profile.coins||0) + xpGain, interactions: (profile.interactions||0) + 1, nantes_nbh_date: today };
  } else {
    const { data, error } = await db.rpc('submit_nantes_nbh_answer', { p_choice: choice });
    if (error) { showNotif('Oups, réponse non enregistrée.'); return; }
    profile = data.profile;
    xpGain = data.correct ? 30 : 15;
  }
  showNotif(`+${xpGain} XP ⚡  +${xpGain} 🐾`);
  const nextLevel = getLevel();
  if (prevLevel !== nextLevel) setTimeout(() => showNotif(`🏆 ${nextLevel.name} !`), 1600);
  updateUI();
}

// ── JEU AVANT / APRÈS ──────────────────────────────────────
let aaExplored = false;
let aaAnswered = false;

function initAvantApres() {
  aaExplored = false; aaAnswered = false;
  const c = gamesData.avant_apres?.content;
  if (!c) { console.warn('Pas de jeu Avant/Après actif'); closeGame(); return; }
  document.getElementById('aa-title').textContent = c.title || 'Avant / Après';
  document.getElementById('aa-label-avant').textContent = c.label_avant || 'Avant';
  document.getElementById('aa-label-apres').textContent = c.label_apres || 'Après';
  document.getElementById('aa-img-avant').src = c.image_avant;
  document.getElementById('aa-img-apres').src = c.image_apres;
  document.getElementById('aa-result').style.display = 'none';
  document.getElementById('aa-cta').style.display = 'block';
  document.getElementById('aa-clip').style.width = '50%';
  document.getElementById('aa-line').style.left = '50%';
  const revealBtn = document.getElementById('aa-reveal-btn');
  revealBtn.style.opacity = '.35'; revealBtn.style.pointerEvents = 'none';
  const touch = document.getElementById('aa-touch');
  const wrap = document.getElementById('aa-slider-wrap');
  function moveSlider(clientX) {
    const rect = wrap.getBoundingClientRect();
    let pct = (clientX - rect.left) / rect.width * 100;
    pct = Math.min(95, Math.max(5, pct));
    document.getElementById('aa-clip').style.width = pct + '%';
    document.getElementById('aa-line').style.left = pct + '%';
    if (!aaExplored && (pct < 20 || pct > 80)) {
      aaExplored = true;
      revealBtn.style.opacity = '1'; revealBtn.style.pointerEvents = 'auto';
    }
  }
  let dragging = false;
  touch.onmousedown = () => dragging = true;
  window.onmouseup = () => dragging = false;
  touch.onmousemove = e => { if(dragging) moveSlider(e.clientX); };
  touch.ontouchstart = e => moveSlider(e.touches[0].clientX);
  touch.ontouchmove = e => { e.preventDefault(); moveSlider(e.touches[0].clientX); };
}

async function revealAvantApres() {
  if(aaAnswered) return; aaAnswered = true;
  const c = gamesData.avant_apres?.content;
  document.getElementById('aa-cta').style.display = 'none';
  document.getElementById('aa-expl').textContent = c.explication;
  document.getElementById('aa-result').style.display = 'block';

  const prevLevel = getLevel();
  if (window._demoMode) {
    const today = new Date().toISOString().split('T')[0];
    profile = { ...profile, xp: profile.xp + 30, coins: (profile.coins||0) + 30, interactions: (profile.interactions||0) + 1, avant_apres_date: today };
  } else {
    const { data, error } = await db.rpc('claim_avant_apres');
    if (error) { showNotif('Oups, le gain n\'a pas pu être enregistré.'); return; }
    profile = data;
  }
  showNotif(`+30 XP ⚡  +30 🐾`);
  const nextLevel = getLevel();
  if (prevLevel !== nextLevel) setTimeout(() => showNotif(`🏆 ${nextLevel.name} !`), 1600);
  updateUI();
}

// ── TUTO ONBOARDING ────────────────────────────────────────
let tutoStep = 1;
const TUTO_STEPS = 4;

function showTuto() {
  showScreen('tuto');
  tutoStep = 1;
  updateTutoStep();
}

function nextTuto() {
  if (tutoStep < TUTO_STEPS) { tutoStep++; updateTutoStep(); }
  else skipTuto();
}

function prevTuto() {
  if (tutoStep > 1) { tutoStep--; updateTutoStep(); }
}

function skipTuto() {
  // Marque le tuto comme vu dans localStorage
  try { localStorage.setItem('hoop_tuto_done', '1'); } catch(e) {}
  showMain();
}

function updateTutoStep() {
  for (let i = 1; i <= TUTO_STEPS; i++) {
    document.getElementById('tuto-'+i)?.classList.toggle('active', i === tutoStep);
    document.getElementById('dot-'+i)?.classList.toggle('active', i === tutoStep);
  }
  const nextBtn = document.getElementById('tuto-next');
  if(nextBtn) nextBtn.textContent = tutoStep === TUTO_STEPS ? "C'EST PARTI ! 🏀" : 'SUIVANT →';
  const skipBtn = document.getElementById('tuto-skip');
  if(skipBtn) skipBtn.style.display = tutoStep === TUTO_STEPS ? 'none' : 'block';
  const prevBtn = document.getElementById('tuto-prev');
  if(prevBtn) prevBtn.style.display = tutoStep > 1 ? 'block' : 'none';
}
function checkBoiteAccess() {
  const boiteCard = document.getElementById('mc-boite');
  if (!boiteCard || !gamesData.boite_mystere) return;
  const today = new Date().toISOString().split('T')[0];

  // Déjà jouée — carte visible en mode consultation
  if (profile?.boite_date === today) {
    boiteCard.style.display = '';
    boiteCard.setAttribute('onclick', "openBoiteReadOnly()");
    const xpEl = document.getElementById('mx-boite');
    if(xpEl){ xpEl.textContent='Voir mon code'; xpEl.style.background='var(--black4)'; xpEl.style.color='var(--white-muted)'; }
    return;
  }

  // Pas encore jouée — visible uniquement si toutes missions faites
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
  if(allDone) boiteCard.setAttribute('onclick', "openGame('boite_mystere')");
}

function openBoiteReadOnly() {
  // Ouvre la boîte en mode consultation — montre le résultat sans canvas de grattage
  TABS.forEach(t => {
    const s = document.getElementById('screen-'+t);
    s.classList.remove('active');
    s.style.display = 'none';
  });
  document.getElementById('navbar').style.display = 'none';
  const screen = document.getElementById('game-boite_mystere');
  screen.style.display = 'flex';
  screen.classList.add('active');
  const c = gamesData.boite_mystere?.content;
  if (!c) return;
  document.getElementById('boite-sponsor-name').textContent = c.sponsor_name || '—';
  if (c.sponsor_logo) document.getElementById('boite-sponsor-logo').innerHTML = `<img src="${c.sponsor_logo}" style="max-height:50px;max-width:150px;object-fit:contain">`;
  // Cache le canvas, révèle directement le résultat persisté côté serveur
  // (voir users.boite_last_result dans supabase/03_boite_result_persistence.sql)
  const canvas = document.getElementById('scratch-canvas');
  if(canvas) canvas.style.display = 'none';
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

// Résultat décidé par le serveur pour la session de grattage en cours
// (voir open_boite_mystere dans supabase/02_migrate_missions.sql) — le
// client ne fait plus que rejouer l'animation sur ce résultat figé.
let _boiteResult = null;

async function initBoite() {
  const today = new Date().toISOString().split('T')[0];
  // Sécurité : si déjà joué aujourd'hui, ferme immédiatement
  if (profile?.boite_date === today) { closeGame(); return; }
  const c = gamesData.boite_mystere?.content;
  if (!c) return;
  document.getElementById('boite-sponsor-name').textContent = c.sponsor_name || '—';
  if (c.sponsor_logo) {
    document.getElementById('boite-sponsor-logo').innerHTML = `<img src="${c.sponsor_logo}" style="max-height:50px;max-width:150px;object-fit:contain">`;
  }

  // Le tirage au sort, l'enregistrement du gagnant et le verrouillage de la
  // mission du jour se font atomiquement côté serveur — impossible à rejouer
  // ou à falsifier depuis le navigateur.
  if (window._demoMode) {
    const won = Math.random() < (c.win_probability || 0.3);
    _boiteResult = { won, reward: won ? c.win_reward : c.lose_reward, code: (won ? c.win_code : c.lose_code) || '', sponsor_name: c.sponsor_name };
    profile = { ...profile, xp: profile.xp + (won ? 100 : 30), coins: (profile.coins||0) + (won ? 100 : 30), interactions: (profile.interactions||0) + 1, boite_date: today, boite_last_result: _boiteResult };
  } else {
    const { data, error } = await db.rpc('open_boite_mystere');
    if (error) {
      showNotif(error.message?.includes('ALREADY_PLAYED_TODAY') ? 'Tu as déjà gratté aujourd\'hui !' : 'Oups, impossible d\'ouvrir la boîte.');
      closeGame();
      return;
    }
    _boiteResult = data;
    profile = data.profile;
  }

  const won = _boiteResult.won;
  document.getElementById('scratch-result-icon').textContent = won ? '🏆' : '🎟️';
  document.getElementById('scratch-result-title').textContent = won ? 'Félicitations !' : 'Pas de chance...';
  document.getElementById('scratch-result-desc').textContent = _boiteResult.reward || '';
  document.getElementById('scratch-result-code').textContent = _boiteResult.code || '';
  document.getElementById('scratch-hint').textContent = 'Gratte avec le doigt pour révéler';
  document.getElementById('boite-claim-btn').style.display = 'none';
  const canvas = document.getElementById('scratch-canvas');
  if(canvas) canvas.style.display = 'block';
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
    // Le verrouillage de la mission du jour est désormais fait par le serveur
    // dès l'ouverture de la boîte (open_boite_mystere) — voir initBoite().
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI*2); ctx.fill();
    const d = ctx.getImageData(0,0,340,200).data;
    let t=0; for(let i=3;i<d.length;i+=4) if(d[i]===0) t++;
    if(t/(340*200)>0.4){
      canvas.style.display='none';
      document.getElementById('scratch-hint').textContent='🎉 Révélé !';
      document.getElementById('boite-claim-btn').style.display='block';
    }
  }
  canvas.onmousedown=e=>{scratching=true;scratch(e.offsetX,e.offsetY)};
  canvas.onmouseup=()=>scratching=false;
  canvas.onmousemove=e=>{if(scratching)scratch(e.offsetX,e.offsetY)};
  canvas.ontouchstart=e=>{e.preventDefault();const r=canvas.getBoundingClientRect();scratch(e.touches[0].clientX-r.left,e.touches[0].clientY-r.top)};
  canvas.ontouchmove=e=>{e.preventDefault();const r=canvas.getBoundingClientRect();scratch(e.touches[0].clientX-r.left,e.touches[0].clientY-r.top)};
}

function claimBoite() {
  // Le résultat, l'enregistrement du gagnant, l'XP et le verrouillage du jour
  // ont déjà été décidés et appliqués par le serveur à l'ouverture (initBoite).
  closeGame(); updateUI();
}

// ── PRONOSTIC ──────────────────────────────────────────────
let pronoHome = 0, pronoAway = 0;

function initPronostic() {
  const c = gamesData.pronostic?.content;
  if (!c) return;
  pronoHome = 75; pronoAway = 75;
  const teams = c.match.split(' vs ');
  document.getElementById('prono-match-name').textContent = c.match;
  document.getElementById('prono-date-label').textContent = c.date_label || '';
  if(teams[1]) document.getElementById('prono-away-name').textContent = teams[1].trim();
  document.getElementById('score-home').textContent = '75';
  document.getElementById('score-away').textContent = '75';
  document.getElementById('prono-input-ui').style.display = 'block';
  document.getElementById('prono-done-ui').style.display = 'none';
}

function adjustScore(side, delta) {
  if(side==='home'){ pronoHome=Math.max(0,pronoHome+delta); document.getElementById('score-home').textContent=pronoHome; }
  else { pronoAway=Math.max(0,pronoAway+delta); document.getElementById('score-away').textContent=pronoAway; }
}

async function submitPronostic() {
  const score = `${pronoHome}-${pronoAway}`;

  // Le serveur enregistre le pronostic, applique l'XP et verrouille la
  // mission du jour de façon atomique (voir supabase/02_migrate_missions.sql).
  const prevLevel = getLevel();
  if (window._demoMode) {
    const today = new Date().toISOString().split('T')[0];
    profile = { ...profile, xp: profile.xp + 25, coins: (profile.coins||0) + 25, interactions: (profile.interactions||0) + 1, pronostic_date: today, pronostic_score: score };
  } else {
    const { data, error } = await db.rpc('submit_pronostic', { p_score_home: pronoHome, p_score_away: pronoAway });
    if (error) {
      showNotif(error.message?.includes('ALREADY_PLAYED_TODAY') ? 'Tu as déjà pronostiqué aujourd\'hui !' : 'Oups, le pronostic n\'a pas pu être enregistré.');
      return;
    }
    profile = data.profile;
  }
  showNotif(`+25 XP ⚡  +25 🐾`);
  const nextLevel = getLevel();
  if (prevLevel !== nextLevel) setTimeout(() => showNotif(`🏆 ${nextLevel.name} !`), 1600);

  document.getElementById('prono-recap').textContent = score;
  document.getElementById('prono-input-ui').style.display = 'none';
  document.getElementById('prono-done-ui').style.display = 'block';
  updateUI();
}

async function checkPronoResult() {
  const resultCard = document.getElementById('mc-prono-result');
  if (!resultCard || !profile?.pronostic_date) { if(resultCard) resultCard.style.display='none'; return; }
  const yesterday = new Date(Date.now()-86400000).toISOString().split('T')[0];
  if (profile.pronostic_date !== yesterday) { resultCard.style.display='none'; return; }

  // Cherche le jeu pronostic d'hier avec résultat rempli
  const { data: games } = await db.from('games')
    .select('*').eq('type','pronostic').eq('date', yesterday);
  const yesterdayGame = games?.find(g => g.content?.score_domicile_final != null);
  if (!yesterdayGame) { resultCard.style.display='none'; return; }

  const c = yesterdayGame.content;
  const finalScore = `${c.score_domicile_final}-${c.score_exterieur_final}`;
  const [fh, fa] = finalScore.split('-').map(Number);

  // Charge tous les votes de ce match
  const { data: votes } = await db.from('pronostic_votes')
    .select('user_name, score, user_id')
    .eq('match_id', c.match_id || yesterdayGame.content.match_id);

  if (!votes || !votes.length) { resultCard.style.display='none'; return; }

  // Calcule l'écart pour chaque vote
  const ranked = votes.map(v => {
    const [vh, va] = v.score.split('-').map(Number);
    const ecart = Math.abs(vh - fh) + Math.abs(va - fa);
    return { ...v, ecart, exact: ecart === 0 };
  }).sort((a, b) => a.ecart - b.ecart);

  const myRank = ranked.findIndex(v => v.user_id === currentUser?.id) + 1;
  const myVote = ranked.find(v => v.user_id === currentUser?.id);
  const top3 = ranked.slice(0, 3);

  // Construit l'affichage
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

  // Mon rang si hors top 3
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

function openAvatarEdit() {
  const panel = document.getElementById('avatar-edit-panel');
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    // Sync les sélecteurs avec le profil actuel
    const sil = profile?.avatar_silhouette || 'A';
    const skin = profile?.avatar_skin || 'skin1';
    const hair = profile?.avatar_hair || 'hair1';
    ['A','B'].forEach(s => document.getElementById('edit-sil-'+s)?.classList.toggle('sel', s===sil));
    ['skin1','skin2','skin3','skin4'].forEach(s => {
      const el = document.getElementById('edit-skin-'+s);
      if(el) { el.classList.toggle('sel', s===skin); el.style.transform = s===skin ? 'scale(1.08)' : ''; el.style.borderColor = s===skin ? 'var(--red)' : 'var(--black4)'; }
    });
    ['hair1','hair2','hair3','hair4'].forEach(h => document.getElementById('edit-hair-'+h)?.classList.toggle('sel', h===hair));
  }
}

let editSilVal, editSkinVal, editHairVal;
function editSil(v) {
  editSilVal = v;
  ['A','B'].forEach(s => document.getElementById('edit-sil-'+s)?.classList.toggle('sel', s===v));
  // Prévisualise sur l'avatar principal
  const items = profile?.worn_items || [];
  const wrap = document.getElementById('avatar-svg');
  if(wrap) wrap.innerHTML = buildAvatarSVG(items.includes('echarpe'),items.includes('casquette'),items.includes('maillot'),v,editSkinVal||profile?.avatar_skin||'skin1',editHairVal||profile?.avatar_hair||'hair1');
}
function editSkin(v) {
  editSkinVal = v;
  ['skin1','skin2','skin3','skin4'].forEach(s => {
    const el = document.getElementById('edit-skin-'+s);
    if(el){ el.style.borderColor = s===v ? 'var(--red)' : 'var(--black4)'; el.style.transform = s===v ? 'scale(1.08)' : ''; }
  });
  const items = profile?.worn_items || [];
  const wrap = document.getElementById('avatar-svg');
  if(wrap) wrap.innerHTML = buildAvatarSVG(items.includes('echarpe'),items.includes('casquette'),items.includes('maillot'),editSilVal||profile?.avatar_silhouette||'A',v,editHairVal||profile?.avatar_hair||'hair1');
}
function editHair(v) {
  editHairVal = v;
  ['hair1','hair2','hair3','hair4'].forEach(h => document.getElementById('edit-hair-'+h)?.classList.toggle('sel', h===v));
  const items = profile?.worn_items || [];
  const wrap = document.getElementById('avatar-svg');
  if(wrap) wrap.innerHTML = buildAvatarSVG(items.includes('echarpe'),items.includes('casquette'),items.includes('maillot'),editSilVal||profile?.avatar_silhouette||'A',editSkinVal||profile?.avatar_skin||'skin1',v);
}

async function saveAvatarEdit() {
  const fields = {};
  if(editSilVal) fields.avatar_silhouette = editSilVal;
  if(editSkinVal) fields.avatar_skin = editSkinVal;
  if(editHairVal) fields.avatar_hair = editHairVal;
  if(Object.keys(fields).length) await updateProfile(fields);
  editSilVal = editSkinVal = editHairVal = null;
  document.getElementById('avatar-edit-panel').style.display = 'none';
  renderAvatar();
  showNotif('Avatar mis à jour ✓');
}

// ── DÉCONNEXION & SUPPRESSION ──────────────────────────────
async function signOut() {
  await db.auth.signOut();
  currentUser = null; profile = null;
  document.getElementById('navbar').style.display = 'none';
  showScreen('onboarding');
}

function confirmDeleteAccount() {
  document.getElementById('delete-modal').classList.add('show');
}

async function deleteAccount() {
  try {
    // Supprime les données utilisateur
    await db.from('pouls_votes').delete().eq('user_id', currentUser.id);
    await db.from('users').delete().eq('id', currentUser.id);
    // Supprime le compte auth via la fonction SQL
    await db.rpc('delete_user');
    await db.auth.signOut();
    currentUser = null; profile = null;
    document.getElementById('delete-modal').classList.remove('show');
    document.getElementById('navbar').style.display = 'none';
    showScreen('onboarding');
  } catch(e) {
    console.error('Delete error:', e);
    showNotif('Erreur. Réessaie');
  }
}

async function buyItem(id) {
  if (!profile) return;
  const item = UNLOCKABLES.find(u => u.id === id);
  if (!item) return;

  // Le serveur revérifie le coût, le solde de pièces et la possession
  // (catalogue répliqué dans buy_unlockable — voir supabase/02_migrate_missions.sql).
  if (window._demoMode) {
    const coins = profile.coins || 0;
    if (coins < item.cost) { showNotif('Pas assez de 🐾 Hermines'); return; }
    const owned = [...(profile.active_items || []), id];
    const worn = [...(profile.worn_items || []), id];
    profile = { ...profile, coins: coins - item.cost, active_items: owned, worn_items: worn };
  } else {
    const { data, error } = await db.rpc('buy_unlockable', { p_item_id: id });
    if (error) {
      const msg = error.message?.includes('NOT_ENOUGH_COINS') ? 'Pas assez de 🐾 Hermines'
        : error.message?.includes('ALREADY_OWNED') ? 'Tu possèdes déjà cet objet !'
        : 'Oups, achat impossible.';
      showNotif(msg);
      return;
    }
    profile = data;
  }

  showNotif(`${item.icon} ${item.name} débloqué !`);
  renderAvatar(); renderEquip(); renderNextUnlocks();
  ['coins-t','coins-m','coins-a'].forEach(elId => {
    const el = document.getElementById(elId); if(el) el.textContent = profile.coins || 0;
  });
}

// ── COUNTDOWN ──────────────────────────────────────────────
let _matchTarget = new Date('2026-06-06T20:00:00'); // fallback

function startCountdown() {
  const tick = () => {
    const diff = _matchTarget - new Date();
    if(diff <= 0) {
      [['cd-j','00'],['cd-h','00'],['cd-m','00'],['cd-s','00']].forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.textContent=v;});
      return;
    }
    const d=Math.floor(diff/86400000),h=Math.floor((diff%86400000)/3600000);
    const m=Math.floor((diff%3600000)/60000),s=Math.floor((diff%60000)/1000);
    const fmt=n=>String(n).padStart(2,'0');
    [['cd-j',d],['cd-h',h],['cd-m',m],['cd-s',s]].forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.textContent=fmt(v);});
  };
  tick(); setInterval(tick,1000);
}

// ── NOTIFS & MODALS ────────────────────────────────────────
function showNotif(txt) {
  const el=document.getElementById('notif'); document.getElementById('notif-txt').textContent=txt;
  el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2400);
}
function showUnlockModal(item) {
  document.getElementById('m-icon').textContent=item.icon;
  document.getElementById('m-title').textContent=item.name+' débloqué !';
  document.getElementById('m-desc').textContent=item.desc+' . Active-le dans Mon Perso.';
  document.getElementById('unlock-modal').classList.add('show');
}
function closeModal() { document.getElementById('unlock-modal').classList.remove('show'); }
