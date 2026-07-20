import { startCountdown } from './utils.js';
import { closeModal } from './utils.js';
import { showLevelsModal } from './ui.js';
import { showTab, showScreen } from './nav.js';
import { loadOrgConfig, loadUnlockables, TABS } from './config.js';
import { demoMode, currentUser } from './state.js';
import { initAuth, signInWithGoogle, startDemoMode, signOut, confirmDeleteAccount, deleteAccount } from './auth.js';
import { subscribeToPush, unsubscribeFromPush, isPushSubscribed } from './push.js';
import { goToAvatarCreate, setCreateParam, submitProfile } from './profile-create.js';
import { openAvatarEdit, setEditParam, saveAvatarEdit, toggleWorn, buyItem } from './avatar.js';
import { initTuto, nextTuto, prevTuto, skipTuto } from './tuto.js';
import { initServerDate } from './date.js';
import { openGame, closeGame } from './games/screens.js';
import { initAdmin } from './admin.js';
import { loadCards, loadUserCards, openBoosterPack, openDailyFreeBooster, renderCollection, updateCollectionChip } from './cards.js';
import { submitTimeline } from './games/timeline.js';
import { selectEmotion, submitPouls } from './games/pouls.js';
import { revealAvantApres } from './games/avant-apres.js';
import { adjustScore, submitPronostic } from './games/pronostic.js';
import { claimBoite } from './games/boite.js';
import { renderFansGrid } from './community.js';
import { showNotif } from './utils.js';
import {
  openFriendsScreen, sendFriendRequest, respondToRequest, cancelRequest, removeCurrentFriend,
  openTradeComposer, closeTradeComposer, pickTradeCard, confirmTrade,
  respondTrade, cancelTrade, sendRequestToCurrentProfile,
} from './friends.js';

function wireEvents() {
  // Onboarding
  document.getElementById('signin-btn').addEventListener('click', signInWithGoogle);
  document.getElementById('demo-btn').addEventListener('click', () => {
    startDemoMode();
    document.querySelectorAll('.open-friends-btn').forEach(btn => { btn.style.display = 'none'; });
  });

  // Consentement RGPD
  const signinBtn = document.getElementById('signin-btn');
  const consentCb = document.getElementById('consent-cb');
  try {
    if (localStorage.getItem('hoop_rgpd') === '1') {
      document.getElementById('consent-wrap').style.display = 'none';
      signinBtn.disabled = false;
      signinBtn.style.opacity = '';
      signinBtn.style.cursor = '';
    } else {
      consentCb.addEventListener('change', () => {
        signinBtn.disabled = !consentCb.checked;
        signinBtn.style.opacity = consentCb.checked ? '' : '0.4';
        signinBtn.style.cursor = consentCb.checked ? '' : 'not-allowed';
      });
    }
  } catch(e) {}

  // Navigation politique de confidentialité
  document.getElementById('privacy-link-ob').addEventListener('click', () => showScreen('privacy'));

  // Accordéon installation
  document.getElementById('install-expand-btn').addEventListener('click', () => {
    const panel = document.getElementById('install-instructions');
    const arrow = document.getElementById('install-expand-arrow');
    const open = panel.style.display !== 'none';
    panel.style.display = open ? 'none' : 'block';
    if (arrow) arrow.textContent = open ? '▼' : '▲';
  });
  document.getElementById('privacy-settings-btn').addEventListener('click', () => showScreen('privacy'));
  document.getElementById('replay-tuto-btn').addEventListener('click', () => {
    try { localStorage.removeItem('hoop_tuto_done'); } catch(e) {}
    showScreen('tuto');
    initTuto(true);
  });
  document.getElementById('privacy-back-btn').addEventListener('click', () => {
    if (currentUser) showTab('avatar'); else showScreen('onboarding');
  });

  // Création profil
  document.getElementById('name-submit-btn').addEventListener('click', goToAvatarCreate);
  document.getElementById('submit-profile-btn').addEventListener('click', submitProfile);
  document.getElementById('create-av-scroll').addEventListener('click', e => {
    const btn = e.target.closest('[data-param]');
    if (btn) setCreateParam(btn.dataset.param, btn.dataset.value);
  });

  // Tuto
  document.getElementById('tuto-prev').addEventListener('click', prevTuto);
  document.getElementById('tuto-skip').addEventListener('click', skipTuto);
  document.getElementById('tuto-next').addEventListener('click', nextTuto);

  // Navigation principale
  document.getElementById('nav-tribune').addEventListener('click', () => showTab('tribune'));
  document.getElementById('nav-missions').addEventListener('click', () => showTab('missions'));
  document.getElementById('nav-avatar').addEventListener('click', () => showTab('avatar'));
  document.getElementById('m-lvl-label').addEventListener('click', showLevelsModal);

  // Missions
  document.getElementById('mc-free-booster').addEventListener('click', openDailyFreeBooster);
  ['pouls', 'vestiaire', 'anecdote'].forEach(t =>
    document.getElementById(`mc-${t}`).addEventListener('click', () => openGame(t))
  );
  document.getElementById('mc-nantes-nbh').addEventListener('click', () => openGame('nantes_nbh'));
  document.getElementById('mc-avant-apres').addEventListener('click', () => openGame('avant_apres'));
  document.getElementById('mc-pronostic').addEventListener('click', () => openGame('pronostic'));
  document.getElementById('mc-boite').addEventListener('click', () => openGame('boite_mystere'));
  document.getElementById('mc-timeline').addEventListener('click', () => openGame('timeline'));
  document.getElementById('mc-photo-mystere').addEventListener('click', () => openGame('photo_mystere'));

  // Fermeture jeux
  document.querySelectorAll('.game-back-btn').forEach(btn => btn.addEventListener('click', closeGame));
  document.getElementById('v-continue').addEventListener('click', closeGame);
  document.getElementById('anec-continue').addEventListener('click', closeGame);
  document.getElementById('pouls-result-back').addEventListener('click', closeGame);
  document.getElementById('nnb-result-back').addEventListener('click', closeGame);
  document.getElementById('aa-result-back').addEventListener('click', closeGame);
  document.getElementById('prono-done-back').addEventListener('click', closeGame);
  document.getElementById('tl-continue').addEventListener('click', closeGame);
  document.getElementById('pm-continue').addEventListener('click', closeGame);

  // Jeu Pouls
  document.querySelectorAll('.emotion-btn').forEach(btn =>
    btn.addEventListener('click', e =>
      selectEmotion(e.currentTarget, e.currentTarget.dataset.emoji, e.currentTarget.dataset.label)
    )
  );
  document.getElementById('pouls-submit').addEventListener('click', submitPouls);

  // Jeu Avant/Après
  document.getElementById('aa-reveal-btn').addEventListener('click', revealAvantApres);

  // Jeu Pronostic
  document.querySelectorAll('[data-team][data-delta]').forEach(btn =>
    btn.addEventListener('click', e =>
      adjustScore(e.currentTarget.dataset.team, +e.currentTarget.dataset.delta)
    )
  );
  document.getElementById('prono-submit-btn').addEventListener('click', submitPronostic);

  // Boîte Mystère
  document.getElementById('boite-claim-btn').addEventListener('click', claimBoite);
  document.getElementById('tl-submit').addEventListener('click', submitTimeline);

  // Édition avatar
  document.getElementById('open-avatar-edit-btn').addEventListener('click', openAvatarEdit);
  document.getElementById('save-avatar-edit-btn').addEventListener('click', saveAvatarEdit);
  document.getElementById('avatar-edit-content').addEventListener('click', e => {
    const btn = e.target.closest('[data-param]');
    if (btn) setEditParam(btn.dataset.param, btn.dataset.value);
  });

  // Équipements (délégation pour items générés dynamiquement)
  document.getElementById('equip-grid').addEventListener('click', e => {
    const toggleEl = e.target.closest('[data-toggle-item]');
    if (toggleEl) { toggleWorn(toggleEl.dataset.toggleItem); return; }
    const buyEl = e.target.closest('[data-buy-item]');
    if (buyEl) buyItem(buyEl.dataset.buyItem);
  });

  // Boosters & Collection
  document.getElementById('buy-booster-btn').addEventListener('click', openBoosterPack);
  document.getElementById('open-collection-btn').addEventListener('click', () => {
    renderCollection();
    showScreen('collection');
  });
  document.getElementById('collection-back-btn').addEventListener('click', () => showTab('avatar'));

  // Classement Club / Amis (onglet Tribune)
  document.getElementById('classement-toggle-club').addEventListener('click', () => renderFansGrid('club'));
  document.getElementById('classement-toggle-amis').addEventListener('click', () => renderFansGrid('amis'));

  // Amis — accessible depuis les 3 onglets, comme les paramètres
  document.querySelectorAll('.open-friends-btn').forEach(btn => btn.addEventListener('click', openFriendsScreen));
  document.getElementById('friends-back-btn').addEventListener('click', () => showTab('tribune'));
  document.getElementById('friend-add-btn').addEventListener('click', sendFriendRequest);
  document.getElementById('copy-friend-code-btn').addEventListener('click', () => {
    const code = document.getElementById('my-friend-code').textContent;
    if (!code || code.includes('·')) return;
    navigator.clipboard?.writeText(code).then(() => showNotif('Code copié !')).catch(() => {});
  });
  document.getElementById('screen-friends').addEventListener('click', e => {
    const acceptReq = e.target.closest('[data-accept-request]');
    if (acceptReq) { respondToRequest(acceptReq.dataset.acceptRequest, true); return; }
    const declineReq = e.target.closest('[data-decline-request]');
    if (declineReq) { respondToRequest(declineReq.dataset.declineRequest, false); return; }
    const cancelReq = e.target.closest('[data-cancel-request]');
    if (cancelReq) { cancelRequest(cancelReq.dataset.cancelRequest); return; }
    const acceptTrade = e.target.closest('[data-accept-trade]');
    if (acceptTrade) { respondTrade(acceptTrade.dataset.acceptTrade, true); return; }
    const declineTrade = e.target.closest('[data-decline-trade]');
    if (declineTrade) { respondTrade(declineTrade.dataset.declineTrade, false); return; }
    const cancelTradeEl = e.target.closest('[data-cancel-trade]');
    if (cancelTradeEl) { cancelTrade(cancelTradeEl.dataset.cancelTrade); return; }
    const rankingToggle = e.target.closest('[data-ranking-toggle]');
    if (rankingToggle) {
      const body = document.getElementById(rankingToggle.dataset.rankingToggle);
      if (!body) return;
      const expand = body.style.display === 'none';
      body.style.display = expand ? 'flex' : 'none';
      rankingToggle.classList.toggle('expanded', expand);
    }
  });

  // Profil d'un ami
  document.getElementById('friend-profile-back-btn').addEventListener('click', () => showScreen('friends'));
  document.getElementById('friend-profile-remove-btn').addEventListener('click', removeCurrentFriend);
  document.getElementById('friend-profile-trade-btn').addEventListener('click', openTradeComposer);
  document.getElementById('friend-profile-add-btn').addEventListener('click', sendRequestToCurrentProfile);

  // Compositeur d'échange
  document.getElementById('trade-composer-close-btn').addEventListener('click', closeTradeComposer);
  document.getElementById('trade-confirm-btn').addEventListener('click', confirmTrade);
  document.getElementById('overlay-trade-composer').addEventListener('click', e => {
    const myPick = e.target.closest('[data-pick-my]');
    if (myPick) { pickTradeCard('my', myPick.dataset.pickMy); return; }
    const theirPick = e.target.closest('[data-pick-their]');
    if (theirPick) pickTradeCard('their', theirPick.dataset.pickTheir);
  });

  // Paramètres — accessible depuis les 3 onglets, retour vers l'onglet d'origine
  let settingsOriginTab = 'avatar';
  document.querySelectorAll('.open-settings-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const active = document.querySelector('.screen.active');
      if (active && TABS.includes(active.id.replace('screen-', ''))) {
        settingsOriginTab = active.id.replace('screen-', '');
      }
      showScreen('settings');
    });
  });
  document.getElementById('settings-back-btn').addEventListener('click', () => showTab(settingsOriginTab));
  document.getElementById('booster-close-btn').addEventListener('click', () => {
    document.getElementById('overlay-booster').style.display = 'none';
    renderCollection();
    showScreen('collection');
  });
  document.getElementById('booster-reopen-btn').addEventListener('click', openBoosterPack);
  document.getElementById('booster-back-btn').addEventListener('click', () => {
    document.getElementById('overlay-booster').style.display = 'none';
    showTab('avatar');
  });

  // Admin
  document.getElementById('admin-btn').addEventListener('click', () => {
    showScreen('admin');
    initAdmin();
  });
  document.getElementById('admin-back-btn').addEventListener('click', () => showTab('avatar'));

  // Paramètres
  document.getElementById('signout-btn').addEventListener('click', signOut);
  document.getElementById('confirm-delete-btn').addEventListener('click', confirmDeleteAccount);
  document.getElementById('delete-account-confirm-btn').addEventListener('click', deleteAccount);
  document.getElementById('delete-modal-cancel-btn').addEventListener('click', () => {
    document.getElementById('delete-modal').classList.remove('show');
    document.getElementById('delete-confirm-input').value = '';
    const btn = document.getElementById('delete-account-confirm-btn');
    btn.disabled = true; btn.style.opacity = '.4'; btn.style.cursor = 'not-allowed';
  });
  document.getElementById('delete-confirm-input').addEventListener('input', e => {
    const ok = e.target.value.trim().toUpperCase() === 'SUPPRIMER';
    const btn = document.getElementById('delete-account-confirm-btn');
    btn.disabled = !ok;
    btn.style.opacity = ok ? '1' : '.4';
    btn.style.cursor = ok ? 'pointer' : 'not-allowed';
  });

  // Modals
  document.getElementById('unlock-modal-close-btn').addEventListener('click', closeModal);
  document.getElementById('levels-modal-close-btn').addEventListener('click', () =>
    document.getElementById('levels-modal').classList.remove('show')
  );
}

// Gestion installation PWA
let deferredInstallPrompt = null;

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}

function isInStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
}

function initInstallUI() {
  if (isInStandaloneMode()) return; // déjà installée

  if (isIOS()) {
    return; // Les instructions iOS sont toujours visibles dans le tuto et les paramètres
  }

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstallPrompt = e;

    const btn = document.getElementById('install-btn');
    if (btn) { btn.style.display = 'flex'; }
    const tutoBtn = document.getElementById('tuto-install-android');
    if (tutoBtn) tutoBtn.style.display = 'block';
  });
}

async function wireNotifBtn() {
  const btn = document.getElementById('notif-btn');
  if (!btn) return;

  const pushSupported = 'Notification' in window && 'PushManager' in window;

  const setSubscribed = () => {
    btn.innerHTML = '<span style="font-size:18px">🔕</span> Désactiver les notifications';
    btn.style.opacity = '0.7';
    btn.disabled = false;
  };
  const setUnsubscribed = () => {
    btn.innerHTML = '<span style="font-size:18px">🔔</span> Activer les notifications';
    btn.style.opacity = '';
    btn.disabled = false;
  };
  const setBlocked = () => {
    btn.innerHTML = '<span style="font-size:18px">🔕</span> Notifications bloquées';
    btn.style.opacity = '0.5';
    btn.disabled = true;
  };
  const setUnavailable = (msg) => {
    btn.innerHTML = `<span style="font-size:18px">🔔</span> ${msg}`;
    btn.style.opacity = '0.4';
    btn.disabled = true;
  };

  if (!pushSupported) {
    const iosNoStandalone = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone && !window.matchMedia('(display-mode: standalone)').matches;
    setUnavailable(iosNoStandalone ? "Notifs disponibles via l'app installée" : 'Notifications non disponibles');
    if (iosNoStandalone) {
      const hint = document.getElementById('notif-install-hint');
      if (hint) hint.style.display = 'block';
    }
    return;
  }
  if (Notification.permission === 'denied') { setBlocked(); return; }
  if (await isPushSubscribed()) setSubscribed(); else setUnsubscribed();

  btn.addEventListener('click', async () => {
    if (demoMode) { setUnavailable('Notifications (mode démo)'); return; }
    btn.disabled = true;
    try {
      if (await isPushSubscribed()) {
        await unsubscribeFromPush();
        setUnsubscribed();
      } else {
        await subscribeToPush();
        if (Notification.permission === 'granted') setSubscribed();
        else if (Notification.permission === 'denied') setBlocked();
        else setUnsubscribed();
      }
    } catch (err) {
      console.error('Erreur toggle notifications:', err);
      if (Notification.permission === 'denied') setBlocked();
      else if (await isPushSubscribed()) setSubscribed();
      else setUnsubscribed();
    }
  });
}

function wireInstall() {
  document.getElementById('install-btn')?.addEventListener('click', triggerInstall);
  document.getElementById('tuto-install-btn')?.addEventListener('click', triggerInstall);
}

async function triggerInstall() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  if (outcome === 'accepted') {
    document.getElementById('install-btn').style.display = 'none';
    document.getElementById('tuto-install-android').style.display = 'none';
  }
  deferredInstallPrompt = null;
}

window.onload = async () => {
  await loadOrgConfig();
  await loadUnlockables();
  initAuth(); // en premier — critique pour le callback OAuth
  startCountdown();

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    const btn = document.getElementById('demo-btn');
    if (btn) btn.style.display = 'block';
  }

  await initServerDate();
  wireEvents();
  try { initInstallUI(); wireInstall(); await wireNotifBtn(); } catch(e) { console.warn('install UI error', e); }
  try { await loadCards(); await loadUserCards(); updateCollectionChip(); } catch(e) { console.warn('cards error', e); }
};
