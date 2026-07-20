import { db, CURRENT_ORG_ID } from './config.js';
import { currentUser, demoMode } from './state.js';
import { escapeHtml, showNotif } from './utils.js';
import { getLevel } from './ui.js';
import { miniAvatarSVG, buildAvatarSVG } from './avatar.js';
import { showScreen } from './nav.js';
import { getAllCards, getUserCardsMap, buildCardFront, loadUserCards, updateCollectionChip } from './cards.js';

const SEL = 'id,name,xp,streak,avatar_skin,avatar_top,avatar_hair_color,avatar_eyes,avatar_mouth,avatar_facial_hair,avatar_clothe,worn_items';

let friends = [];
let requestsIn = [];
let requestsOut = [];
let tradesIn = [];
let tradesOut = [];
let currentFriendProfile = null;
let currentFriendCardsMap = {};
let tradeSelection = { my: null, their: null };

function mapError(error, map) {
  const msg = error?.message || '';
  for (const key in map) if (msg.includes(key)) return map[key];
  return 'Oups, une erreur est survenue.';
}

export async function getFriendIds() {
  if (demoMode || !currentUser) return [];
  const { data } = await db.from('friendships')
    .select('user_a,user_b')
    .or(`user_a.eq.${currentUser.id},user_b.eq.${currentUser.id}`);
  return (data || []).map(f => f.user_a === currentUser.id ? f.user_b : f.user_a);
}

const BADGE_IDS = ['friends-badge-t', 'friends-badge-m', 'friends-badge-a'];

export async function updateFriendsBadge() {
  const badges = BADGE_IDS.map(id => document.getElementById(id)).filter(Boolean);
  if (!badges.length) return;
  if (demoMode || !currentUser) { badges.forEach(b => { b.style.display = 'none'; }); return; }
  const [{ count: reqCount }, { count: tradeCount }] = await Promise.all([
    db.from('friend_requests').select('*', { count: 'exact', head: true }).eq('to_user', currentUser.id).eq('status', 'pending'),
    db.from('card_trades').select('*', { count: 'exact', head: true }).eq('to_user', currentUser.id).eq('status', 'pending'),
  ]);
  const total = (reqCount || 0) + (tradeCount || 0);
  badges.forEach(b => {
    b.textContent = total;
    b.style.display = total > 0 ? 'flex' : 'none';
  });
}

export async function openFriendsScreen() {
  showScreen('friends');
  await loadFriendsData();
}

function cardLabel(cardId) {
  const c = getAllCards().find(c => c.id === cardId);
  return c ? c.player_name : cardId;
}

async function loadFriendsData() {
  const codeEl = document.getElementById('my-friend-code');
  if (demoMode || !currentUser) {
    if (codeEl) codeEl.textContent = 'Indispo (démo)';
    return;
  }

  const { data: code } = await db.rpc('get_my_friend_code');
  if (codeEl) codeEl.textContent = code || '—';

  const [{ data: reqIn }, { data: reqOut }, { data: friendRows }, { data: tIn }, { data: tOut }] = await Promise.all([
    db.from('friend_requests').select('*').eq('to_user', currentUser.id).eq('status', 'pending'),
    db.from('friend_requests').select('*').eq('from_user', currentUser.id).eq('status', 'pending'),
    db.from('friendships').select('*').or(`user_a.eq.${currentUser.id},user_b.eq.${currentUser.id}`),
    db.from('card_trades').select('*').eq('to_user', currentUser.id).eq('status', 'pending'),
    db.from('card_trades').select('*').eq('from_user', currentUser.id).eq('status', 'pending'),
  ]);

  requestsIn = reqIn || [];
  requestsOut = reqOut || [];
  tradesIn = tIn || [];
  tradesOut = tOut || [];

  const friendIds = (friendRows || []).map(f => f.user_a === currentUser.id ? f.user_b : f.user_a);
  const otherIds = [
    ...requestsIn.map(r => r.from_user), ...requestsOut.map(r => r.to_user),
    ...tradesIn.map(t => t.from_user), ...tradesOut.map(t => t.to_user),
  ];
  const allIds = [...new Set([...friendIds, ...otherIds])];

  const usersById = {};
  if (allIds.length) {
    const { data: users } = await db.from('users').select(SEL).in('id', allIds);
    (users || []).forEach(u => { usersById[u.id] = u; });
  }

  friends = friendIds.map(id => usersById[id]).filter(Boolean);

  renderFriendRequests(usersById);
  renderTrades(usersById);
  await renderFriendsGrid();
  await renderFriendsXP();
  await renderFriendsProno();
  await updateFriendsBadge();
}

function toggleSection(wrapId, listId, items, rowHtml) {
  const wrap = document.getElementById(wrapId);
  const list = document.getElementById(listId);
  if (!wrap || !list) return;
  if (items.length) {
    wrap.style.display = '';
    list.innerHTML = items.map(rowHtml).join('');
  } else {
    wrap.style.display = 'none';
  }
}

function renderFriendRequests(usersById) {
  toggleSection('friend-requests-in-wrap', 'friend-requests-in', requestsIn, r => {
    const u = usersById[r.from_user];
    return `<div class="friend-request-row">
      <div class="friend-request-info">
        <div class="friend-request-name">${escapeHtml(u?.name || 'Fan')}</div>
      </div>
      <button class="friend-action-btn friend-action-accept" data-accept-request="${r.id}">Accepter</button>
      <button class="friend-action-btn friend-action-decline" data-decline-request="${r.id}">Refuser</button>
    </div>`;
  });

  toggleSection('friend-requests-out-wrap', 'friend-requests-out', requestsOut, r => {
    const u = usersById[r.to_user];
    return `<div class="friend-request-row">
      <div class="friend-request-info">
        <div class="friend-request-name">${escapeHtml(u?.name || 'Fan')}</div>
        <div class="friend-request-sub">En attente...</div>
      </div>
      <button class="friend-action-btn friend-action-decline" data-cancel-request="${r.id}">Annuler</button>
    </div>`;
  });
}

function renderTrades(usersById) {
  toggleSection('friend-trades-in-wrap', 'friend-trades-in', tradesIn, t => {
    const u = usersById[t.from_user];
    return `<div class="friend-request-row">
      <div class="friend-request-info">
        <div class="friend-request-name">${escapeHtml(u?.name || 'Fan')}</div>
        <div class="friend-request-sub">Te propose ${escapeHtml(cardLabel(t.from_card_id))} contre ta carte ${escapeHtml(cardLabel(t.to_card_id))}</div>
      </div>
      <button class="friend-action-btn friend-action-accept" data-accept-trade="${t.id}">Accepter</button>
      <button class="friend-action-btn friend-action-decline" data-decline-trade="${t.id}">Refuser</button>
    </div>`;
  });

  toggleSection('friend-trades-out-wrap', 'friend-trades-out', tradesOut, t => {
    const u = usersById[t.to_user];
    return `<div class="friend-request-row">
      <div class="friend-request-info">
        <div class="friend-request-name">${escapeHtml(u?.name || 'Fan')}</div>
        <div class="friend-request-sub">Ta carte ${escapeHtml(cardLabel(t.from_card_id))} contre ${escapeHtml(cardLabel(t.to_card_id))}</div>
      </div>
      <button class="friend-action-btn friend-action-decline" data-cancel-trade="${t.id}">Annuler</button>
    </div>`;
  });
}

async function renderFriendsGrid() {
  const grid = document.getElementById('friends-grid');
  const empty = document.getElementById('friends-empty');
  if (!grid) return;
  if (!friends.length) {
    grid.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';
  const avatarSVGs = await Promise.all(friends.map(f => miniAvatarSVG(f)));
  grid.innerHTML = friends.map((f, i) => `
    <div class="fan-tile friend-tile">
      <div class="fan-tile-avatar">${avatarSVGs[i]}</div>
      <div class="fan-tile-name">${escapeHtml(f.name.substring(0, 8))}</div>
    </div>`).join('');
  grid.querySelectorAll('.friend-tile').forEach((tile, i) => {
    tile.addEventListener('click', () => openProfile(friends[i]));
  });
}

async function renderFriendsXP() {
  const grid = document.getElementById('friends-xp-ranking');
  if (!grid) return;
  if (demoMode || !currentUser) { grid.innerHTML = ''; return; }
  if (!friends.length) {
    grid.innerHTML = '<div style="font-size:12px;color:var(--brand-text-muted);padding:8px 0">Ajoute des amis pour voir ce classement !</div>';
    return;
  }

  const ids = [...friends.map(f => f.id), currentUser.id];
  const { data } = await db.from('users').select('id,name,xp').in('id', ids).order('xp', { ascending: false });
  grid.innerHTML = (data || []).map((u, i) => `
    <div class="friend-request-row">
      <div style="font-family:var(--font-display);font-weight:800;color:var(--brand-text-muted);width:20px;flex-shrink:0">${i + 1}</div>
      <div class="friend-request-info">
        <div class="friend-request-name">${escapeHtml(u.name)}${u.id === currentUser.id ? ' (toi)' : ''}</div>
      </div>
      <div style="font-family:var(--font-display);font-weight:800;color:var(--brand-primary)">${u.xp} XP</div>
    </div>`).join('');
}

async function renderFriendsProno() {
  const grid = document.getElementById('friends-prono-ranking');
  if (!grid) return;
  if (demoMode || !currentUser) { grid.innerHTML = ''; return; }

  const ids = [...friends.map(f => f.id), currentUser.id];
  const { data, error } = await db.from('users').select('id,name,pronostic_points').in('id', ids).order('pronostic_points', { ascending: false });
  if (error || !data) {
    grid.innerHTML = '<div style="font-size:12px;color:var(--brand-text-muted);padding:8px 0">Classement indisponible pour l\'instant</div>';
    return;
  }
  if (!friends.length) {
    grid.innerHTML = '<div style="font-size:12px;color:var(--brand-text-muted);padding:8px 0">Ajoute des amis pour voir ce classement !</div>';
    return;
  }
  grid.innerHTML = data.map((u, i) => `
    <div class="friend-request-row">
      <div style="font-family:var(--font-display);font-weight:800;color:var(--brand-text-muted);width:20px;flex-shrink:0">${i + 1}</div>
      <div class="friend-request-info">
        <div class="friend-request-name">${escapeHtml(u.name)}${u.id === currentUser.id ? ' (toi)' : ''}</div>
      </div>
      <div style="font-family:var(--font-display);font-weight:800;color:var(--brand-primary)">${u.pronostic_points || 0} pts</div>
    </div>`).join('');
}

export async function sendFriendRequest() {
  const input = document.getElementById('friend-code-input');
  const code = input?.value.trim();
  if (!code) return;
  if (demoMode) { showNotif('Indisponible en mode démo'); return; }

  const { data, error } = await db.rpc('send_friend_request', { p_code: code });
  if (error) {
    showNotif(mapError(error, {
      CODE_NOT_FOUND: 'Code introuvable',
      CANNOT_ADD_SELF: "Tu ne peux pas t'ajouter toi-même !",
      DIFFERENT_ORG: 'Ce code appartient à un autre club',
      ALREADY_FRIENDS: 'Vous êtes déjà amis',
      REQUEST_ALREADY_SENT: 'Demande déjà envoyée',
    }));
    return;
  }
  input.value = '';
  showNotif(data?.auto_accepted ? '🎉 Vous êtes maintenant amis !' : 'Demande envoyée !');
  await loadFriendsData();
}

export async function respondToRequest(id, accept) {
  const { error } = await db.rpc('respond_friend_request', { p_request_id: id, p_accept: accept });
  if (error) { showNotif('Oups, une erreur est survenue.'); return; }
  showNotif(accept ? '🎉 Nouvel ami ajouté !' : 'Demande refusée');
  await loadFriendsData();
}

export async function cancelRequest(id) {
  const { error } = await db.rpc('cancel_friend_request', { p_request_id: id });
  if (error) { showNotif('Oups, une erreur est survenue.'); return; }
  await loadFriendsData();
}

export async function removeCurrentFriend() {
  if (!currentFriendProfile) return;
  const { error } = await db.rpc('remove_friend', { p_friend_id: currentFriendProfile.id });
  if (error) { showNotif('Oups, une erreur est survenue.'); return; }
  showNotif('Ami retiré');
  showScreen('friends');
  await loadFriendsData();
}

export async function openProfile(user) {
  if (!user || user.id === currentUser?.id) return;
  currentFriendProfile = user;
  showScreen('friend-profile');

  const nameEl = document.getElementById('friend-profile-name');
  const subEl = document.getElementById('friend-profile-sub');
  const avEl = document.getElementById('friend-profile-avatar');
  const removeBtn = document.getElementById('friend-profile-remove-btn');
  const tradeBtn = document.getElementById('friend-profile-trade-btn');
  const addBtn = document.getElementById('friend-profile-add-btn');
  const grid = document.getElementById('friend-collection-grid');
  const locked = document.getElementById('friend-collection-locked');
  const bioEl = document.getElementById('friend-profile-bio');

  if (nameEl) nameEl.textContent = user.name;
  if (subEl) subEl.textContent = `${getLevel(user.xp).name} · ${user.xp} XP · 🔥 ${user.streak}j`;
  if (avEl) avEl.innerHTML = await buildAvatarSVG(user, 96);
  if (addBtn) { addBtn.disabled = false; addBtn.textContent = '➕ Ajouter en ami'; }

  if (bioEl) {
    bioEl.style.display = 'none';
    if (!demoMode) {
      // Requête isolée (pas dans le SEL partagé des listes) : si la migration
      // bio n'a pas encore tourné, seul cet affichage échoue silencieusement,
      // pas tout le classement.
      const { data: bioData } = await db.from('users').select('bio').eq('id', user.id).single();
      if (bioData?.bio) { bioEl.textContent = bioData.bio; bioEl.style.display = ''; }
    }
  }

  const isFriend = !demoMode && currentUser ? (await getFriendIds()).includes(user.id) : false;

  if (removeBtn) removeBtn.style.display = isFriend ? '' : 'none';
  if (tradeBtn) tradeBtn.style.display = isFriend ? '' : 'none';
  if (addBtn) addBtn.style.display = isFriend ? 'none' : '';

  if (!isFriend) {
    if (grid) grid.innerHTML = '';
    if (locked) locked.style.display = '';
    currentFriendCardsMap = {};
    return;
  }
  if (locked) locked.style.display = 'none';
  if (!grid) return;
  if (demoMode) { grid.innerHTML = ''; currentFriendCardsMap = {}; return; }

  const { data: theirCards } = await db.from('user_cards').select('*').eq('user_id', user.id).eq('org_id', CURRENT_ORG_ID);
  currentFriendCardsMap = {};
  (theirCards || []).forEach(r => { currentFriendCardsMap[r.card_id] = r; });

  const allCards = getAllCards();
  grid.innerHTML = allCards.map(card => {
    const have = currentFriendCardsMap[card.id];
    if (have) {
      return `<div>
        <div class="card-wrap card-rarity-${card.rarity}" style="height:145px">
          <div class="card-inner flipped">
            <div class="card-face card-back-face"></div>
            <div class="card-face card-front-face">${buildCardFront(card)}</div>
          </div>
        </div>
        ${have.count > 1 ? `<div style="text-align:center;font-size:10px;color:var(--brand-text-muted);margin-top:4px">×${have.count}</div>` : ''}
      </div>`;
    }
    return `<div class="card-slot-empty" style="height:145px"><div style="font-size:28px;opacity:.2">?</div></div>`;
  }).join('');
}

export async function sendRequestToCurrentProfile() {
  if (!currentFriendProfile) return;
  if (demoMode) { showNotif('Indisponible en mode démo'); return; }

  const { data, error } = await db.rpc('send_friend_request_by_id', { p_target_user_id: currentFriendProfile.id });
  if (error) {
    showNotif(mapError(error, {
      CANNOT_ADD_SELF: "Tu ne peux pas t'ajouter toi-même !",
      DIFFERENT_ORG: 'Ce fan appartient à un autre club',
      ALREADY_FRIENDS: 'Vous êtes déjà amis',
      REQUEST_ALREADY_SENT: 'Demande déjà envoyée',
    }));
    return;
  }

  const addBtn = document.getElementById('friend-profile-add-btn');
  if (data?.auto_accepted) {
    showNotif('🎉 Vous êtes maintenant amis !');
    await openProfile(currentFriendProfile);
  } else {
    showNotif('Demande envoyée !');
    if (addBtn) { addBtn.disabled = true; addBtn.textContent = 'Demande envoyée ✓'; }
  }
}

export function openTradeComposer() {
  if (!currentFriendProfile) return;
  tradeSelection = { my: null, their: null };
  const overlay = document.getElementById('overlay-trade-composer');
  if (!overlay) return;
  overlay.style.display = 'flex';

  const myCards = getAllCards().filter(c => (getUserCardsMap()[c.id]?.count || 0) >= 1);
  const theirCards = getAllCards().filter(c => (currentFriendCardsMap[c.id]?.count || 0) >= 1);

  const myEl = document.getElementById('trade-my-cards');
  const theirEl = document.getElementById('trade-their-cards');
  if (myEl) myEl.innerHTML = myCards.length
    ? myCards.map(c => {
        const count = getUserCardsMap()[c.id]?.count || 0;
        return `<div class="trade-card-pick" data-pick-my="${c.id}">${buildCardFront(c)}<div class="trade-card-count${count === 1 ? ' trade-card-count-warn' : ''}">×${count}</div></div>`;
      }).join('')
    : '<div style="color:var(--on-dark-muted);font-size:12px;padding:8px">Aucune carte à proposer</div>';
  if (theirEl) theirEl.innerHTML = theirCards.length
    ? theirCards.map(c => {
        const count = currentFriendCardsMap[c.id]?.count || 0;
        return `<div class="trade-card-pick" data-pick-their="${c.id}">${buildCardFront(c)}<div class="trade-card-count">×${count}</div></div>`;
      }).join('')
    : '<div style="color:var(--on-dark-muted);font-size:12px;padding:8px">Aucune carte disponible</div>';

  updateTradeConfirmState();
}

export function pickTradeCard(side, cardId) {
  tradeSelection[side] = cardId;
  const attr = side === 'my' ? 'pickMy' : 'pickTheir';
  document.querySelectorAll(`[data-pick-${side}]`).forEach(el => {
    el.classList.toggle('picked', el.dataset[attr] === cardId);
  });
  updateTradeConfirmState();
}

function updateTradeConfirmState() {
  const btn = document.getElementById('trade-confirm-btn');
  if (btn) btn.disabled = !(tradeSelection.my && tradeSelection.their);
}

export function closeTradeComposer() {
  const overlay = document.getElementById('overlay-trade-composer');
  if (overlay) overlay.style.display = 'none';
}

export async function confirmTrade() {
  if (!currentFriendProfile || !tradeSelection.my || !tradeSelection.their) return;
  const { error } = await db.rpc('propose_card_trade', {
    p_to_user: currentFriendProfile.id,
    p_from_card_id: tradeSelection.my,
    p_to_card_id: tradeSelection.their,
  });
  if (error) {
    showNotif(mapError(error, {
      NOT_FRIENDS: 'Vous devez être amis pour échanger',
      CARD_NOT_OWNED: 'Tu ne possèdes plus cette carte',
      TARGET_CARD_NOT_OWNED: 'Ton ami ne possède plus cette carte',
      SAME_CARD: 'Choisis deux cartes différentes',
    }));
    return;
  }
  closeTradeComposer();
  showNotif("Proposition d'échange envoyée !");
  await loadFriendsData();
}

export async function respondTrade(id, accept) {
  const { error } = await db.rpc('respond_card_trade', { p_trade_id: id, p_accept: accept });
  if (error) {
    showNotif(mapError(error, {
      FROM_CARD_NO_LONGER_OWNED: "La carte proposée n'est plus disponible",
      TO_CARD_NO_LONGER_OWNED: "Cette carte n'est plus disponible",
      NOT_FRIENDS_ANYMORE: "Vous n'êtes plus amis",
    }));
    await loadFriendsData();
    return;
  }
  showNotif(accept ? '🔄 Échange effectué !' : 'Échange refusé');
  if (accept) { await loadUserCards(); updateCollectionChip(); }
  await loadFriendsData();
}

export async function cancelTrade(id) {
  const { error } = await db.rpc('cancel_card_trade', { p_trade_id: id });
  if (error) { showNotif('Oups, une erreur est survenue.'); return; }
  await loadFriendsData();
}
