import { db } from './config.js';
import { currentUser, profile, demoMode } from './state.js';
import { updateProfile } from './profile.js';
import { showScreen, showTab } from './nav.js';

const RARITY_WEIGHTS = { bronze: 10, silver: 4, gold: 1 };
const RARITY_LABEL   = { bronze: 'BRONZE', silver: 'ARGENT', gold: 'OR' };
const PACK_COST = 50;
const PACK_SIZE = 3;

let allCards = [];
let userCardsMap = {}; // card_id → { count, id (row uuid) }

export async function loadCards() {
  const { data } = await db.from('cards').select('*').eq('active', true).order('sort_order');
  allCards = data || [];
}

export async function loadUserCards() {
  if (demoMode || !currentUser) return;
  const { data } = await db.from('user_cards').select('*').eq('user_id', currentUser.id);
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

  // Deduct coins optimistically
  await updateProfile({ coins: coins - PACK_COST });

  const drawn = drawPack(allCards, PACK_SIZE);

  // Persist drawn cards
  if (!demoMode && currentUser) {
    for (const card of drawn) {
      const existing = userCardsMap[card.id];
      if (existing) {
        await db.from('user_cards').update({ count: existing.count + 1 }).eq('id', existing.id);
        userCardsMap[card.id] = { ...existing, count: existing.count + 1 };
      } else {
        const { data } = await db.from('user_cards')
          .insert({ user_id: currentUser.id, card_id: card.id, count: 1 })
          .select().single();
        if (data) userCardsMap[card.id] = data;
      }
    }
  } else {
    // Demo: just update local map
    drawn.forEach(c => {
      userCardsMap[c.id] = userCardsMap[c.id]
        ? { ...userCardsMap[c.id], count: userCardsMap[c.id].count + 1 }
        : { card_id: c.id, count: 1 };
    });
  }

  updateCollectionChip();
  showPackOverlay(drawn);
}

function drawPack(cards, count) {
  const pool = cards.flatMap(c => Array(RARITY_WEIGHTS[c.rarity] || 10).fill(c));
  return Array.from({ length: count }, () => pool[Math.floor(Math.random() * pool.length)]);
}

function showPackOverlay(drawn) {
  const overlay = document.getElementById('overlay-booster');
  const row = document.getElementById('booster-cards-row');
  const msg = document.getElementById('booster-reveal-msg');
  const closeBtn = document.getElementById('booster-close-btn');
  const backBtn = document.getElementById('booster-back-btn');
  const hint = document.getElementById('booster-tap-hint');

  msg.textContent = '';
  closeBtn.style.display = 'none';
  backBtn.style.display = 'none';
  hint.textContent = 'Tes cartes arrivent…';
  overlay.style.display = 'flex';

  // Render 3 face-down cards
  const CARD_W = 100, CARD_H = 145;
  row.innerHTML = drawn.map(() => `
    <div class="card-wrap" style="width:${CARD_W}px;height:${CARD_H}px">
      <div class="card-inner">
        <div class="card-face card-back-face">
          <span style="font-family:'Barlow Condensed',sans-serif;font-size:26px;font-weight:900;color:rgba(255,255,255,.12);letter-spacing:-1px">HOOP.</span>
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
      wrap.querySelector('.card-front-face').innerHTML = buildCardFront(card);
      wrap.querySelector('.card-inner').classList.add('flipped');

      if (card.rarity === 'gold' && !hasGold) {
        hasGold = true;
        setTimeout(() => {
          msg.innerHTML = '✨ <span style="color:#FFD700;font-weight:900">CARTE OR !</span> ✨';
        }, 300);
      }

      if (i === drawn.length - 1) {
        setTimeout(() => {
          hint.textContent = '';
          if (!hasGold) msg.textContent = drawn.some(c => c.rarity === 'silver') ? '🥈 Belle prise !' : 'Pack ouvert !';
          closeBtn.style.display = 'block';
          backBtn.style.display = 'block';
        }, 600);
      }
    }, 700 * (i + 1));
  });
}

function buildCardFront(card) {
  return `
    <div style="position:relative;flex:1;overflow:hidden;min-height:0">
      <img class="card-photo" src="${card.photo_url || ''}" alt="${card.player_name}" loading="lazy" onerror="this.style.display='none'">
      <div class="card-rarity-badge">${RARITY_LABEL[card.rarity] || 'BRONZE'}</div>
    </div>
    <div class="card-info">
      <div class="card-name">${card.player_name}</div>
      ${card.position ? `<div class="card-pos">${card.position}</div>` : ''}
    </div>
  `;
}

export function renderCollection() {
  const grid = document.getElementById('collection-grid');
  const countEl = document.getElementById('collection-count');
  if (!grid) return;

  const owned = Object.keys(userCardsMap).length;
  const total = allCards.length;
  if (countEl) countEl.textContent = `${owned}/${total}`;

  const CARD_W = '100%', CARD_H = 145;

  grid.innerHTML = allCards.map(card => {
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
