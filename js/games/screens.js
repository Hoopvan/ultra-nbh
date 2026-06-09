import { gamesData, profile } from '../state.js';
import { initVestiaire } from './vestiaire.js';
import { initAnecdote } from './anecdote.js';
import { initNantesNBH } from './nantes-nbh.js';
import { initAvantApres } from './avant-apres.js';
import { initPronostic } from './pronostic.js';
import { initBoite } from './boite.js';

export function openGame(name) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });
  document.getElementById('navbar').style.display = 'none';
  const gameScreen = document.getElementById('game-'+name);
  if (gameScreen) { gameScreen.style.display = 'flex'; gameScreen.classList.add('active'); }

  if (name === 'vestiaire') initVestiaire();
  if (name === 'anecdote') initAnecdote();
  if (name === 'nantes_nbh') initNantesNBH();
  if (name === 'avant_apres') initAvantApres();
  if (name === 'pronostic') initPronostic();
  if (name === 'boite_mystere') initBoite();
}

export function closeGame() {
  document.querySelectorAll('.game-screen').forEach(g => {
    g.classList.remove('active');
    g.style.display = 'none';
    g.querySelector('.readonly-badge')?.remove();
  });
  const pvu = document.getElementById('pouls-vote-ui'); if (pvu) pvu.style.display = 'block';
  const pru = document.getElementById('pouls-result-ui'); if (pru) pru.classList.remove('show');
  document.querySelectorAll('.emotion-btn').forEach(b => b.classList.remove('sel'));
  // nav.js écoute cet événement pour retourner à l'onglet missions
  document.dispatchEvent(new CustomEvent('game:closed'));
}

export function openGameReadOnly(name) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });
  document.getElementById('navbar').style.display = 'none';
  const screen = document.getElementById('game-'+name);
  if (screen) { screen.style.display = 'flex'; screen.classList.add('active'); }

  if (name === 'vestiaire') initVestiaire();
  if (name === 'anecdote') initAnecdote();
  if (name === 'nantes_nbh') initNantesNBH();
  if (name === 'avant_apres') initAvantApres();
  if (name === 'pronostic') {
    initPronostic();
    if (profile?.pronostic_score) {
      const [h, a] = profile.pronostic_score.split('-').map(Number);
      const pronoHome = isNaN(h) ? 75 : h;
      const pronoAway = isNaN(a) ? 75 : a;
      const sh = document.getElementById('score-home'); if (sh) sh.textContent = pronoHome;
      const sa = document.getElementById('score-away'); if (sa) sa.textContent = pronoAway;
    }
  }

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
    const scroll = screen?.querySelector('.game-scroll');
    if (scroll && !scroll.querySelector('.readonly-badge')) {
      const badge = document.createElement('div');
      badge.className = 'readonly-badge';
      badge.style.cssText = 'background:var(--black3);border:1px solid var(--black5);border-radius:var(--radius-sm);padding:8px 14px;font-size:12px;color:var(--white-muted);text-align:center;margin-bottom:12px';
      badge.textContent = '👁️ Déjà complétée — consultation uniquement.';
      scroll.prepend(badge);
    }
  }, 100);
}
