import { db, CURRENT_ORG_ID } from '../config.js';
import { gamesData } from '../state.js';
import { setMatchTarget } from '../utils.js';

export async function loadGames() {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const { data } = await db.from('games')
    .select('*')
    .eq('org_id', CURRENT_ORG_ID)
    .eq('active', true)
    .or(`date.gte.${weekAgo},type.eq.boite_mystere`)
    .order('date', { ascending: false });

  if (!data) return;

  const now = new Date().toISOString();
  const upcomingPouls = data.filter(g => g.type === 'pouls' && g.content?.match_datetime && g.content.match_datetime > now);
  gamesData.pouls = upcomingPouls.length > 0
    ? upcomingPouls[upcomingPouls.length - 1]
    : data.find(g => g.type === 'pouls') || null;

  gamesData.vestiaire = data.find(g => g.type === 'vestiaire' && g.date === today) || null;
  gamesData.anecdote = data.find(g => g.type === 'anecdote' && g.date === today) || null;
  gamesData.nantes_nbh = data.find(g => g.type === 'nantes_nbh' && g.date === today) || null;
  gamesData.avant_apres = data.find(g => g.type === 'avant_apres' && g.date === today) || null;
  gamesData.pronostic = data.find(g => g.type === 'pronostic' && g.date === today) || null;
  gamesData.boite_mystere = data.find(g => g.type === 'boite_mystere' && g.active) || null;
  gamesData.timeline      = data.find(g => g.type === 'timeline'      && g.date === today) || null;
  gamesData.photo_mystere = data.find(g => g.type === 'photo_mystere' && g.date === today) || null;

  if (gamesData.pouls) {
    const c = gamesData.pouls.content;
    const el = document.getElementById('pouls-match-info-text');
    if (el) el.textContent = `${c.match} · ${c.date_label}`;
    if (c.match_datetime) setMatchTarget(new Date(c.match_datetime));
  }

  if (gamesData.vestiaire) {
    const c = gamesData.vestiaire.content;
    const num = document.getElementById('v-num'); if (num) num.textContent = c.num;
    const name = document.getElementById('v-name'); if (name) name.textContent = c.name;
    const pos = document.getElementById('v-pos'); if (pos) pos.textContent = c.pos;
    const q = document.getElementById('v-question-text'); if (q) q.textContent = c.question;
  }
}
