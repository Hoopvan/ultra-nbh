import { db, CURRENT_ORG_ID, TEAM_LABEL, TEAM_ORDER } from './config.js';
import { currentUser, profile, demoMode, setProfile } from './state.js';
import { updateUI } from './ui.js';
import { escapeHtml } from './utils.js';
import { getToday } from './date.js';

// Poids fixes PAR PALIER (pas par carte) : le tirage choisit d'abord une
// rareté selon ce ratio, puis une carte au hasard dans ce palier. Ça évite
// que le nombre de cartes définies par palier (ex. 8 bronze vs 2 gold)
// ne fausse les probabilités réelles.
const RARITY_WEIGHTS = { bronze: 10, silver: 4, gold: 1 };
const RARITY_LABEL   = { bronze: 'BRONZE', silver: 'ARGENT', gold: 'OR' };
const PACK_COST = 50;
const PACK_SIZE = 3;

let allCards = [];
let userCardsMap = {}; // card_id → { count, id (row uuid) }
let collectionTeamFilter = null;

export function getAllCards() {
  return allCards;
}

export function getUserCardsMap() {
  return userCardsMap;
}

function getAvailableTeams() {
  const present = new Set(allCards.map(c => c.team || 'autre'));
  const ordered = TEAM_ORDER.filter(t => present.has(t));
  present.forEach(t => { if (!ordered.includes(t)) ordered.push(t); });
  return ordered;
}

const DEMO_CARDS = [
  { id: 'demo-1', rarity: 'bronze', team: 'pro', player_name: 'Joueur Demo 1', position: 'Meneur', photo_url: '' },
  { id: 'demo-2', rarity: 'bronze', team: 'pro', player_name: 'Joueur Demo 2', position: 'Ailier', photo_url: '' },
  { id: 'demo-3', rarity: 'silver', team: 'pro', player_name: 'Joueur Demo 3', position: 'Pivot', photo_url: '' },
  { id: 'demo-4', rarity: 'gold', team: 'pro', player_name: 'Joueur Demo 4', position: 'Ailier fort', photo_url: '' },
];

export async function loadCards() {
  // Le mode demo bypasse Supabase partout ailleurs (pas de backend requis en local) ;
  // sans ce garde, l'appel reseau reel (credentials placeholder) reste en attente indefiniment.
  if (demoMode) { allCards = DEMO_CARDS; return; }
  const { data } = await db.from('cards').select('*').eq('active', true).eq('org_id', CURRENT_ORG_ID).order('sort_order');
  allCards = data || [];
}

export async function loadUserCards() {
  if (demoMode || !currentUser) return;
  const { data } = await db.from('user_cards').select('*').eq('user_id', currentUser.id).eq('org_id', CURRENT_ORG_ID);
  userCardsMap = {};
  (data || []).forEach(r => { userCardsMap[r.card_id] = r; });
}

export function updateCollectionChip() {
  const owned = Object.keys(userCardsMap).length;
  const total = allCards.length;
  const el = document.getElementById('collection-chip');
  if (el) el.textContent = total ? `${owned}/${total} cartes` : '—';
}

export async function openBoosterPack() {
  if (!allCards.length) {
    await loadCards();
    if (!allCards.length) { alert('Aucune carte disponible pour le moment !'); return; }
  }

  const coins = profile?.coins || 0;
  if (coins < PACK_COST) { showNotifCards(`Il te faut ${PACK_COST} 🐾 Hermines !`); return; }

  // Déduire les coins via RPC (même pattern que buy_unlockable)
  if (!demoMode && currentUser) {
    const { data, error } = await db.rpc('spend_coins', { p_amount: PACK_COST });
    if (error) {
      const msg = error.message?.includes('NOT_ENOUGH_COINS') ? `Il te faut ${PACK_COST} 🐾 Hermines !` : 'Oups, impossible d\'ouvrir le pack.';
      showNotifCards(msg); return;
    }
    if (data) setProfile(data);
  } else {
    setProfile({ ...profile, coins: coins - PACK_COST });
  }
  updateUI();

  const drawn = drawPack(allCards, PACK_SIZE);

  // Recharger les cartes déjà possédées (cas où loadUserCards n'a pas tourné au login)
  await loadUserCards();
  const newCardIds = new Set(drawn.filter(c => !userCardsMap[c.id]).map(c => c.id));
  await persistDrawnCards(drawn);

  updateCollectionChip();
  showPackOverlay(drawn, newCardIds);
}

export async function openDailyFreeBooster() {
  if (!allCards.length) {
    await loadCards();
    if (!allCards.length) { alert('Aucune carte disponible pour le moment !'); return; }
  }

  const today = getToday();
  if (profile?.free_booster_date === today) {
    showNotifCards('Reviens demain pour ta prochaine carte !');
    return;
  }

  if (!demoMode && currentUser) {
    const { data, error } = await db.rpc('claim_daily_free_booster');
    if (error) {
      showNotifCards(error.message?.includes('ALREADY_CLAIMED_TODAY') ? 'Reviens demain pour ta prochaine carte !' : 'Oups, impossible d\'ouvrir le booster.');
      return;
    }
    setProfile(data.profile);
  } else {
    setProfile({ ...profile, free_booster_date: today });
  }
  updateUI();

  const drawn = drawPack(allCards, 1);

  await loadUserCards();
  const newCardIds = new Set(drawn.filter(c => !userCardsMap[c.id]).map(c => c.id));
  await persistDrawnCards(drawn);

  updateCollectionChip();
  showPackOverlay(drawn, newCardIds);
}

async function persistDrawnCards(drawn) {
  if (!demoMode && currentUser) {
    for (const card of drawn) {
      const existing = userCardsMap[card.id];
      if (existing) {
        const newCount = (existing.count || 1) + 1;
        const { error } = await db.from('user_cards')
          .update({ count: newCount })
          .eq('user_id', currentUser.id)
          .eq('card_id', card.id);
        if (!error) userCardsMap[card.id] = { ...existing, count: newCount };
        else { console.error('user_cards update error:', error); showNotifCards('Oups, erreur lors de l\'enregistrement.'); }
      } else {
        const { error } = await db.from('user_cards')
          .insert({ user_id: currentUser.id, card_id: card.id, count: 1, org_id: CURRENT_ORG_ID });
        if (!error) userCardsMap[card.id] = { card_id: card.id, count: 1 };
        else { console.error('user_cards insert error:', error); showNotifCards('Oups, erreur lors de l\'enregistrement.'); }
      }
    }
  } else {
    drawn.forEach(c => {
      userCardsMap[c.id] = userCardsMap[c.id]
        ? { ...userCardsMap[c.id], count: userCardsMap[c.id].count + 1 }
        : { card_id: c.id, count: 1 };
    });
  }
}

function pickRarity() {
  const total = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
    r -= weight;
    if (r < 0) return rarity;
  }
  return Object.keys(RARITY_WEIGHTS).pop();
}

function drawPack(cards, count) {
  const rarities = Object.keys(RARITY_WEIGHTS);
  const byRarity = {};
  rarities.forEach(r => { byRarity[r] = []; });
  cards.forEach(c => { (byRarity[c.rarity] || byRarity[rarities[0]]).push(c); });

  const usedIds = new Set();
  const drawn = [];

  for (let i = 0; i < count; i++) {
    // Repli si le club n'a aucune carte dans la rareté tirée
    let pool = byRarity[pickRarity()];
    if (!pool.length) pool = rarities.map(r => byRarity[r]).find(p => p.length) || cards;

    // Pas de doublon dans le même pack tant que le palier le permet
    let available = pool.filter(c => !usedIds.has(c.id));
    if (!available.length) available = pool;

    const card = available[Math.floor(Math.random() * available.length)];
    usedIds.add(card.id);
    drawn.push(card);
  }

  return drawn;
}

function showPackOverlay(drawn, newCardIds = new Set()) {
  const overlay = document.getElementById('overlay-booster');
  const title = document.getElementById('booster-title');
  const row = document.getElementById('booster-cards-row');
  const msg = document.getElementById('booster-reveal-msg');
  const closeBtn = document.getElementById('booster-close-btn');
  const reopenBtn = document.getElementById('booster-reopen-btn');
  const backBtn = document.getElementById('booster-back-btn');
  const hint = document.getElementById('booster-tap-hint');
  const single = drawn.length === 1;

  msg.textContent = '';
  closeBtn.style.display = 'none';
  reopenBtn.style.display = 'none';
  backBtn.style.display = 'none';
  if (title) title.textContent = single ? 'CARTE GRATUITE 🃏' : 'PACK DÉCOUVERTE 🃏';
  hint.textContent = single ? 'Ta carte arrive…' : 'Tes cartes arrivent…';
  overlay.style.display = 'flex';

  // Render face-down cards, avec une petite arrivée en cascade
  // Largeur calculée depuis la place dispo (overlay padding 24px de chaque cote) :
  // sur un petit ecran (iPhone SE/mini 320-375px), 3 cartes de 100px fixes + gaps
  // depassaient l'ecran. Le ratio 100:145 est conserve via CARD_H derive de CARD_W.
  const gap = 14;
  const available = Math.min(window.innerWidth, 430) - 48;
  const CARD_W = Math.max(64, Math.min(100, (available - gap * (drawn.length - 1)) / drawn.length));
  const CARD_H = Math.round(CARD_W * 1.45);
  row.style.gap = gap + 'px';
  row.innerHTML = drawn.map((_, i) => `
    <div class="card-wrap card-deal" style="width:${CARD_W}px;height:${CARD_H}px;animation-delay:${i * 120}ms">
      <div class="card-inner">
        <div class="card-face card-back-face">
          <div class="card-back-emblem"><span class="ball">🏀</span><span class="word">HOOP.</span></div>
        </div>
        <div class="card-face card-front-face"></div>
      </div>
    </div>
  `).join('');

  const cardEls = row.querySelectorAll('.card-wrap');
  let hasGold = false;

  // Flip cards one by one
  drawn.forEach((card, i) => {
    setTimeout(() => {
      const wrap = cardEls[i];
      wrap.classList.add(`card-rarity-${card.rarity}`);
      wrap.querySelector('.card-front-face').innerHTML = buildCardFront(card, newCardIds.has(card.id));
      wrap.querySelector('.card-inner').classList.add('flipped');
      setTimeout(() => wrap.classList.add('card-pop'), 550);

      if (card.rarity === 'gold' && !hasGold) {
        hasGold = true;
        setTimeout(() => {
          msg.innerHTML = '✨ <span style="color:#FFD700;font-weight:900">CARTE OR !</span> ✨';
        }, 300);
      }

      if (i === drawn.length - 1) {
        setTimeout(() => {
          hint.textContent = '';
          if (!hasGold) msg.textContent = drawn.some(c => c.rarity === 'silver') ? '🥈 Belle prise !' : (single ? 'Carte débloquée !' : 'Pack ouvert !');
          closeBtn.style.display = 'block';
          reopenBtn.style.display = 'block';
          backBtn.style.display = 'block';
        }, 600);
      }
    }, 700 * (i + 1));
  });
}

export function buildCardFront(card, isNew = false) {
  return `
    <div style="position:relative;flex:1;overflow:hidden;min-height:0">
      <img class="card-photo" src="${escapeHtml(card.photo_url || '')}" alt="${escapeHtml(card.player_name)}" loading="lazy" onerror="this.style.display='none'">
      <div class="card-rarity-badge">${RARITY_LABEL[card.rarity] || 'BRONZE'}</div>
      ${isNew ? '<div class="card-new-badge">✨ Nouveau</div>' : ''}
    </div>
    <div class="card-info">
      <div class="card-name">${escapeHtml(card.player_name)}</div>
      ${card.position ? `<div class="card-pos">${escapeHtml(card.position)}</div>` : ''}
    </div>
  `;
}

export function renderCollection() {
  const grid = document.getElementById('collection-grid');
  const countEl = document.getElementById('collection-count');
  const tabsEl = document.getElementById('collection-tabs');
  if (!grid) return;

  const teams = getAvailableTeams();
  if (!collectionTeamFilter || !teams.includes(collectionTeamFilter)) {
    collectionTeamFilter = teams[0] || null;
  }

  if (tabsEl) {
    tabsEl.innerHTML = teams.length > 1 ? teams.map(t => `
      <button class="collection-tab${t === collectionTeamFilter ? ' active' : ''}" data-team="${t}">${escapeHtml(TEAM_LABEL[t] || t)}</button>
    `).join('') : '';
    tabsEl.querySelectorAll('[data-team]').forEach(btn => {
      btn.addEventListener('click', () => { collectionTeamFilter = btn.dataset.team; renderCollection(); });
    });
  }

  const owned = Object.keys(userCardsMap).length;
  const total = allCards.length;
  if (countEl) countEl.textContent = `${owned}/${total}`;

  const CARD_W = '100%', CARD_H = 145;
  const shownCards = collectionTeamFilter ? allCards.filter(c => (c.team || 'autre') === collectionTeamFilter) : allCards;

  grid.innerHTML = shownCards.map(card => {
    const have = userCardsMap[card.id];
    if (have) {
      return `
        <div>
          <div class="card-wrap card-rarity-${card.rarity}" style="height:${CARD_H}px">
            <div class="card-inner flipped">
              <div class="card-face card-back-face"></div>
              <div class="card-face card-front-face">${buildCardFront(card)}</div>
            </div>
          </div>
          ${have.count > 1 ? `<div style="text-align:center;font-size:10px;color:var(--white-muted);margin-top:4px">×${have.count}</div>` : ''}
        </div>`;
    } else {
      return `
        <div class="card-slot-empty" style="height:${CARD_H}px">
          <div style="font-size:28px;opacity:.2">?</div>
          <div style="font-size:9px;color:var(--white-muted);opacity:.4;margin-top:2px;font-weight:700;text-transform:uppercase">${RARITY_LABEL[card.rarity] || ''}</div>
        </div>`;
    }
  }).join('');
}

function showNotifCards(msg) {
  const n = document.createElement('div');
  n.textContent = msg;
  Object.assign(n.style, {
    position:'fixed',bottom:'100px',left:'50%',transform:'translateX(-50%)',
    background:'var(--black3)',color:'var(--white)',padding:'10px 18px',
    borderRadius:'20px',fontSize:'13px',zIndex:'9999',whiteSpace:'nowrap',
    border:'1px solid var(--black5)',pointerEvents:'none'
  });
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 2500);
}
