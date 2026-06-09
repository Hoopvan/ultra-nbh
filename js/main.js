import { startCountdown } from './utils.js';
import { closeModal, showUnlockModal } from './utils.js';
import { showLevelsModal, updateUI } from './ui.js';
import { showTab, showScreen } from './nav.js';
import { initAuth, signInWithGoogle, startDemoMode, signOut, confirmDeleteAccount, deleteAccount } from './auth.js';
import { goToAvatarCreate, setSil, setSkin, setHair, submitProfile } from './profile-create.js';
import { openAvatarEdit, editSil, editSkin, editHair, saveAvatarEdit, toggleWorn, buyItem } from './avatar.js';
import { nextTuto, prevTuto, skipTuto } from './tuto.js';
import { openGame, closeGame, openGameReadOnly } from './games/screens.js';
import { openBoiteReadOnly } from './games/boite.js';
import { selectEmotion, submitPouls } from './games/pouls.js';
import { answerVestiaire } from './games/vestiaire.js';
import { answerAnecdote } from './games/anecdote.js';
import { answerNantesNBH } from './games/nantes-nbh.js';
import { revealAvantApres } from './games/avant-apres.js';
import { adjustScore, submitPronostic } from './games/pronostic.js';
import { claimBoite } from './games/boite.js';

// Expose toutes les fonctions appelées depuis les onclick="..." du HTML
window.signInWithGoogle = signInWithGoogle;
window.startDemoMode = startDemoMode;
window.signOut = signOut;
window.confirmDeleteAccount = confirmDeleteAccount;
window.deleteAccount = deleteAccount;

window.goToAvatarCreate = goToAvatarCreate;
window.setSil = setSil;
window.setSkin = setSkin;
window.setHair = setHair;
window.submitProfile = submitProfile;

window.showTab = showTab;
window.showLevelsModal = showLevelsModal;
window.closeModal = closeModal;

window.nextTuto = nextTuto;
window.prevTuto = prevTuto;
window.skipTuto = skipTuto;

window.openGame = openGame;
window.closeGame = closeGame;
window.openGameReadOnly = openGameReadOnly;
window.openBoiteReadOnly = openBoiteReadOnly;

window.openAvatarEdit = openAvatarEdit;
window.editSil = editSil;
window.editSkin = editSkin;
window.editHair = editHair;
window.saveAvatarEdit = saveAvatarEdit;
window.toggleWorn = toggleWorn;
window.buyItem = buyItem;

window.selectEmotion = selectEmotion;
window.submitPouls = submitPouls;
window.answerVestiaire = answerVestiaire;
window.answerAnecdote = answerAnecdote;
window.answerNantesNBH = answerNantesNBH;
window.revealAvantApres = revealAvantApres;
window.adjustScore = adjustScore;
window.submitPronostic = submitPronostic;
window.claimBoite = claimBoite;

window.onload = () => {
  startCountdown();

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    const btn = document.getElementById('demo-btn');
    if (btn) btn.style.display = 'block';
  }

  initAuth();
};
