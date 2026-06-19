import { TABS } from './config.js';
import { updateUI } from './ui.js';
import { loadCommunityData } from './community.js';
import { initTuto } from './tuto.js';
import { checkBoiteAccess } from './games/boite.js';
import { checkPronoResult } from './games/pronostic.js';

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
  ['tribune','missions','avatar'].forEach(t => {
    document.getElementById('nav-'+t)?.classList.toggle('active', t===tab);
  });
  updateUI();
  if (tab === 'tribune') loadCommunityData();
  if (tab === 'missions') { checkBoiteAccess(); checkPronoResult(); }
}

export function showMain() {
  let tutoDone = false;
  try { tutoDone = localStorage.getItem('hoop_tuto_done') === '1'; } catch(e) {}
  if (!tutoDone) { showScreen('tuto'); initTuto(); return; }
  showTab('tribune');
}

// Retour depuis un jeu → onglet missions
document.addEventListener('game:closed', () => showTab('missions'));

// Fin du tuto → onglet missions (meilleur départ pour un nouveau fan)
document.addEventListener('tuto:done', () => showTab('missions'));
