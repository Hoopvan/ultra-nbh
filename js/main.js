import { startCountdown } from './utils.js';
import { closeModal } from './utils.js';
import { showLevelsModal } from './ui.js';
import { showTab } from './nav.js';
import { initAuth, signInWithGoogle, startDemoMode, signOut, confirmDeleteAccount, deleteAccount } from './auth.js';
import { goToAvatarCreate, setSil, setSkin, setHair, submitProfile } from './profile-create.js';
import { openAvatarEdit, editSil, editSkin, editHair, saveAvatarEdit, toggleWorn, buyItem } from './avatar.js';
import { nextTuto, prevTuto, skipTuto } from './tuto.js';
import { openGame, closeGame } from './games/screens.js';
import { selectEmotion, submitPouls } from './games/pouls.js';
import { revealAvantApres } from './games/avant-apres.js';
import { adjustScore, submitPronostic } from './games/pronostic.js';
import { claimBoite } from './games/boite.js';

function wireEvents() {
  // Onboarding
  document.getElementById('signin-btn').addEventListener('click', signInWithGoogle);
  document.getElementById('demo-btn').addEventListener('click', startDemoMode);

  // Création profil
  document.getElementById('name-submit-btn').addEventListener('click', goToAvatarCreate);
  document.getElementById('sil-A').addEventListener('click', () => setSil('A'));
  document.getElementById('sil-B').addEventListener('click', () => setSil('B'));
  ['skin1', 'skin2', 'skin3', 'skin4'].forEach(s =>
    document.getElementById(`skin-${s}`).addEventListener('click', () => setSkin(s))
  );
  ['hair1', 'hair2', 'hair3', 'hair4'].forEach(h =>
    document.getElementById(`hair-${h}`).addEventListener('click', () => setHair(h))
  );
  document.getElementById('submit-profile-btn').addEventListener('click', submitProfile);

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
  ['pouls', 'vestiaire', 'anecdote'].forEach(t =>
    document.getElementById(`mc-${t}`).addEventListener('click', () => openGame(t))
  );
  document.getElementById('mc-nantes-nbh').addEventListener('click', () => openGame('nantes_nbh'));
  document.getElementById('mc-avant-apres').addEventListener('click', () => openGame('avant_apres'));
  document.getElementById('mc-pronostic').addEventListener('click', () => openGame('pronostic'));
  document.getElementById('mc-boite').addEventListener('click', () => openGame('boite_mystere'));

  // Fermeture jeux
  document.querySelectorAll('.game-back-btn').forEach(btn => btn.addEventListener('click', closeGame));
  document.getElementById('v-continue').addEventListener('click', closeGame);
  document.getElementById('anec-continue').addEventListener('click', closeGame);
  document.getElementById('pouls-result-back').addEventListener('click', closeGame);
  document.getElementById('nnb-result-back').addEventListener('click', closeGame);
  document.getElementById('aa-result-back').addEventListener('click', closeGame);
  document.getElementById('prono-done-back').addEventListener('click', closeGame);

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

  // Édition avatar
  document.getElementById('open-avatar-edit-btn').addEventListener('click', openAvatarEdit);
  document.getElementById('edit-sil-A').addEventListener('click', () => editSil('A'));
  document.getElementById('edit-sil-B').addEventListener('click', () => editSil('B'));
  ['skin1', 'skin2', 'skin3', 'skin4'].forEach(s =>
    document.getElementById(`edit-skin-${s}`).addEventListener('click', () => editSkin(s))
  );
  ['hair1', 'hair2', 'hair3', 'hair4'].forEach(h =>
    document.getElementById(`edit-hair-${h}`).addEventListener('click', () => editHair(h))
  );
  document.getElementById('save-avatar-edit-btn').addEventListener('click', saveAvatarEdit);

  // Équipements (délégation pour items générés dynamiquement)
  document.getElementById('equip-grid').addEventListener('click', e => {
    const toggleEl = e.target.closest('[data-toggle-item]');
    if (toggleEl) { toggleWorn(toggleEl.dataset.toggleItem); return; }
    const buyEl = e.target.closest('[data-buy-item]');
    if (buyEl) buyItem(buyEl.dataset.buyItem);
  });

  // Paramètres
  document.getElementById('signout-btn').addEventListener('click', signOut);
  document.getElementById('confirm-delete-btn').addEventListener('click', confirmDeleteAccount);
  document.getElementById('delete-account-confirm-btn').addEventListener('click', deleteAccount);
  document.getElementById('delete-modal-cancel-btn').addEventListener('click', () =>
    document.getElementById('delete-modal').classList.remove('show')
  );

  // Modals
  document.getElementById('unlock-modal-close-btn').addEventListener('click', closeModal);
  document.getElementById('levels-modal-close-btn').addEventListener('click', () =>
    document.getElementById('levels-modal').classList.remove('show')
  );
}

window.onload = () => {
  startCountdown();

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    const btn = document.getElementById('demo-btn');
    if (btn) btn.style.display = 'block';
  }

  wireEvents();
  initAuth();
};
