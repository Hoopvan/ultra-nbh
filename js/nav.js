import { TABS } from './config.js';
import { updateUI } from './ui.js';
import { loadCommunityData } from './community.js';
import { initTuto } from './tuto.js';
import { checkBoiteAccess } from './games/boite.js';
import { checkPronoResult } from './games/pronostic.js';
import { claimPwaInstallReward } from './games/pwa-install.js';
import { gamesData } from './state.js';
import { openGame } from './games/screens.js';
import { isInStandaloneMode } from './utils.js';

/* ── NAVBAR : creux SVG dynamique ─────────────────────────────────────
   Chaque path centre la notch sur l'onglet actif.
   Dimensions : viewBox 0 0 375 72 (max-width app = 430px → viewBox 375
   correspond à la largeur de référence du démo).
   Pour adapter à une largeur différente : recalculer les cx / lx / rx.
   ─────────────────────────────────────────────────────────────────────*/
const NAV_PATHS = {
  tribune:  'M0,0 L4.5,0 C36.5,0 62.5,17 62.5,38 C62.5,17 88.5,0 120.5,0 L375,0 L375,72 L0,72 Z',
  missions: 'M0,0 L129.5,0 C161.5,0 187.5,17 187.5,38 C187.5,17 213.5,0 245.5,0 L375,0 L375,72 L0,72 Z',
  avatar:   'M0,0 L254.5,0 C286.5,0 312.5,17 312.5,38 C312.5,17 338.5,0 370.5,0 L375,0 L375,72 L0,72 Z'
};
const NAV_ICONS  = { tribune: '🏟️', missions: '🎯', avatar: '👤' };
const NAV_LABELS = { tribune: 'Trocardière', missions: 'Missions', avatar: 'Mon Perso' };

function updateNavbar(tab) {
  const pathEl = document.getElementById('nav-path');
  if (pathEl) pathEl.setAttribute('d', NAV_PATHS[tab]);
  ['tribune','missions','avatar'].forEach(t => {
    const btn = document.getElementById('nav-'+t);
    if (!btn) return;
    const isActive = t === tab;
    btn.classList.toggle('active', isActive);
    btn.innerHTML = isActive
      ? `<span class="nav-circle">${NAV_ICONS[t]}</span><span class="nav-label">${NAV_LABELS[t]}</span>`
      : `<span class="nav-icon">${NAV_ICONS[t]}</span><span class="nav-label">${NAV_LABELS[t]}</span>`;
  });
}

export function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });
  const target = document.getElementById('screen-'+name);
  if (target) { target.style.display = 'flex'; target.classList.add('active'); }
  const appScreens = ['tribune','missions','avatar'];
  document.getElementById('navbar').style.display = appScreens.includes(name) ? 'flex' : 'none';
}

export function showTab(tab) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });
  const target = document.getElementById('screen-'+tab);
  if (target) { target.style.display = 'flex'; target.classList.add('active'); }
  document.getElementById('navbar').style.display = 'flex';
  updateNavbar(tab);
  updateUI();
  if (tab === 'tribune') loadCommunityData();
  if (tab === 'missions') {
    checkBoiteAccess(); checkPronoResult();
    if (isInStandaloneMode()) claimPwaInstallReward();
  }
}

export function showMain() {
  let tutoDone = false;
  try { tutoDone = localStorage.getItem('hoop_tuto_done') === '1'; } catch(e) {}
  if (!tutoDone) { showScreen('tuto'); initTuto(); return; }
  showTab('tribune');
}

// Retour depuis un jeu → onglet missions
document.addEventListener('game:closed', () => showTab('missions'));

// Fin du tuto → missions + auto-ouvre la première mission disponible
document.addEventListener('tuto:done', (e) => {
  showTab('missions');
  if (!e.detail?.replay) {
    const ORDER = ['pouls', 'vestiaire', 'anecdote', 'nantes_nbh', 'avant_apres', 'pronostic', 'timeline', 'photo_mystere'];
    const first = ORDER.find(t => gamesData[t] !== null);
    if (first) setTimeout(() => openGame(first), 500);
  }
});
