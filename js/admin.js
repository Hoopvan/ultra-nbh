import { db, CURRENT_ORG_ID } from './config.js';
import { profile } from './state.js';

export function isAdmin() {
  return profile?.role === 'org_admin' || profile?.role === 'super_admin';
}

const TYPES = {
  pouls:         '⚡ Pouls',
  vestiaire:     '👕 Vestiaire',
  anecdote:      '💡 Anecdote',
  nantes_nbh:    '🏙️ Nantes/NBH',
  avant_apres:   '🔄 Avant/Après',
  pronostic:     '🎯 Pronostic',
  boite_mystere: '🎁 Boîte',
  timeline:      '📅 Timeline',
  photo_mystere: '📸 Photo',
};

// Exposés globalement pour les onclick inline des listes générées
window._adminSelectType  = selectType;
window._adminSave        = saveMission;
window._adminToggle      = toggleMissionActive;
window._adminDelete      = deleteMission;
window._adminUpdateDate  = updateMissionDate;

// ── Init ───────────────────────────────────────────────────────────────────

export async function initAdmin() {
  renderTypeGrid();
  document.getElementById('admin-form-area').innerHTML = '';
  await loadMissionList();
}

// ── Liste des missions ─────────────────────────────────────────────────────

async function loadMissionList() {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  const { data } = await db.from('games')
    .select('id, type, date, active, content')
    .eq('org_id', CURRENT_ORG_ID)
    .or(`date.gte.${weekAgo},type.eq.boite_mystere`);

  const el = document.getElementById('admin-mission-list');
  if (!el) return;

  if (!data?.length) {
    el.innerHTML = '<p style="color:var(--white-muted);text-align:center;padding:16px;font-size:13px">Aucune mission récente.</p>';
    return;
  }

  const rank = m => {
    if (m.date === today) return 0;
    if (m.type === 'boite_mystere') return 1;
    if (m.date > today) return 2;
    return 3;
  };
  data.sort((a, b) => {
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (!a.date || !b.date) return 0;
    if (ra === 2) return a.date < b.date ? -1 : 1;
    return a.date > b.date ? -1 : 1;
  });

  const GROUP_LABELS = ['Aujourd\'hui', 'Permanentes', 'À venir', 'Passées'];
  let lastRank = -1;

  el.innerHTML = data.map(m => {
    const r = rank(m);
    const separator = r !== lastRank
      ? `<div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--white-muted);margin:${lastRank === -1 ? '4' : '10'}px 0 4px">${GROUP_LABELS[r]}</div>`
      : '';
    lastRank = r;

    const label = TYPES[m.type] || m.type;
    const preview = (m.content?.match || m.content?.question || m.content?.sponsor_name || m.content?.title || '').substring(0, 30);
    const dateCell = m.type === 'boite_mystere'
      ? `<span class="admin-row-date">∞</span>`
      : `<input type="date" class="admin-date-input" value="${m.date}" onchange="window._adminUpdateDate('${m.id}',this.value)">`;
    return `${separator}<div class="admin-row">
      <div class="admin-row-info">
        ${dateCell}
        <span class="admin-row-type">${label}</span>
        ${preview ? `<span class="admin-row-preview">${preview}</span>` : ''}
      </div>
      <div class="admin-row-actions">
        <button class="admin-toggle ${m.active ? 'on' : 'off'}" onclick="window._adminToggle('${m.id}',${!m.active})">${m.active ? 'ON' : 'OFF'}</button>
        <button class="admin-del" onclick="window._adminDelete('${m.id}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}

// ── Grille de types ────────────────────────────────────────────────────────

function renderTypeGrid() {
  const el = document.getElementById('admin-type-grid');
  if (!el) return;
  el.innerHTML = Object.entries(TYPES).map(([type, label]) =>
    `<button class="admin-type-btn" data-type="${type}" onclick="window._adminSelectType('${type}')">${label}</button>`
  ).join('');
}

// ── Formulaire ─────────────────────────────────────────────────────────────

function selectType(type) {
  document.querySelectorAll('.admin-type-btn').forEach(b =>
    b.classList.toggle('sel', b.dataset.type === type)
  );
  const el = document.getElementById('admin-form-area');
  if (el) el.innerHTML = buildForm(type);
}

function buildForm(type) {
  const today = new Date().toISOString().split('T')[0];
  const hasDate = type !== 'boite_mystere';
  return `<div class="admin-form">
    <div class="admin-field-row" style="align-items:flex-end">
      ${hasDate
        ? `<div class="admin-field" style="flex:1;margin-bottom:0"><label>Date</label><input type="date" id="af-date" value="${today}"></div>`
        : `<input type="hidden" id="af-date" value="${today}">`}
      <div class="admin-field" style="flex-direction:row;align-items:center;gap:8px;margin-bottom:0;padding-bottom:10px">
        <input type="checkbox" id="af-active" checked style="width:16px;height:16px;accent-color:var(--red);cursor:pointer">
        <label for="af-active" style="margin:0;cursor:pointer;font-size:13px;color:var(--white)">Actif</label>
      </div>
    </div>
    ${typeFields(type)}
    <button class="btn-red" onclick="window._adminSave('${type}')" style="margin-top:16px;width:100%">ENREGISTRER</button>
    <div id="admin-save-msg" style="margin-top:8px;text-align:center;font-size:13px;min-height:20px"></div>
  </div>`;
}

function matchFields() {
  return `
    <div class="admin-field"><label>Match</label><input type="text" id="af-match" placeholder="NBH vs Adversaire"></div>
    <div class="admin-field"><label>Label date</label><input type="text" id="af-date-label" placeholder="Dimanche 15 juin"></div>
    <div class="admin-field"><label>Match ID (unique)</label><input type="text" id="af-match-id" placeholder="nbh-vs-adv-YYYYMMDD"></div>
    <div class="admin-field"><label>Date/heure du match</label><input type="datetime-local" id="af-match-datetime" style="min-width:0"></div>`;
}

function quizFields() {
  return `
    <div class="admin-field"><label>Question</label><textarea id="af-question" rows="3"></textarea></div>
    ${[0,1,2].map(i => `
      <div class="admin-field">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
          <input type="radio" name="af-correct" value="${i}" style="accent-color:var(--red);width:14px;height:14px;flex-shrink:0">
          <span>Réponse ${String.fromCharCode(65+i)} — <span style="color:var(--red)">cocher si correcte</span></span>
        </label>
        <input type="text" id="af-a${i}" placeholder="Texte de la réponse">
      </div>`).join('')}
    <div class="admin-field"><label>Explication</label><textarea id="af-explication" rows="2"></textarea></div>`;
}

function typeFields(type) {
  switch (type) {
    case 'pouls':
      return matchFields();

    case 'pronostic':
      return matchFields() + `
        <div class="admin-field" style="background:var(--black3);border-radius:8px;padding:10px">
          <label style="margin-bottom:6px">Après match — Score final (optionnel)</label>
          <div class="admin-field-row" style="margin-bottom:0">
            <div class="admin-field" style="flex:1;margin-bottom:0"><input type="number" id="af-score-home" placeholder="Score domicile" min="0"></div>
            <div class="admin-field" style="flex:1;margin-bottom:0"><input type="number" id="af-score-away" placeholder="Score visiteur" min="0"></div>
          </div>
        </div>`;

    case 'vestiaire':
      return `
        <div class="admin-field-row">
          <div class="admin-field" style="flex:0 0 70px;margin-bottom:0"><label>N°</label><input type="text" id="af-num" placeholder="7"></div>
          <div class="admin-field" style="flex:1;margin-bottom:0"><label>Nom du joueur</label><input type="text" id="af-name" placeholder="Jean Dupont"></div>
          <div class="admin-field" style="flex:0 0 90px;margin-bottom:0"><label>Poste</label><input type="text" id="af-pos" placeholder="Meneur"></div>
        </div>
        ${quizFields()}
        <div class="admin-field"><label>Instagram URL (optionnel)</label><input type="url" id="af-instagram" placeholder="https://www.instagram.com/p/..."></div>`;

    case 'anecdote':
      return `<div class="admin-field"><label>Sujet</label><input type="text" id="af-subject" placeholder="Ex : Palmarès du club"></div>` + quizFields();

    case 'nantes_nbh':
      return `
        <div class="admin-field"><label>Contexte (optionnel)</label><textarea id="af-context" rows="2" placeholder="Mise en situation..."></textarea></div>
        <div class="admin-field"><label>Question</label><textarea id="af-question" rows="3"></textarea></div>
        <div class="admin-field">
          <label>Bonne réponse</label>
          <select id="af-answer">
            <option value="nantes">🏙️ Nantes</option>
            <option value="nbh">🏀 NBH</option>
            <option value="les_deux">✌️ Les deux</option>
          </select>
        </div>
        <div class="admin-field"><label>Explication</label><textarea id="af-explication" rows="2"></textarea></div>`;

    case 'avant_apres':
      return `
        <div class="admin-field"><label>Titre</label><input type="text" id="af-title" placeholder="Ex : La Trocardière"></div>
        <div class="admin-field-row">
          <div class="admin-field" style="flex:1;margin-bottom:0"><label>Label Avant</label><input type="text" id="af-label-avant" placeholder="Années 90"></div>
          <div class="admin-field" style="flex:1;margin-bottom:0"><label>Label Après</label><input type="text" id="af-label-apres" placeholder="Aujourd'hui"></div>
        </div>
        <div class="admin-field"><label>URL image Avant</label><input type="url" id="af-image-avant" placeholder="https://..."></div>
        <div class="admin-field"><label>URL image Après</label><input type="url" id="af-image-apres" placeholder="https://..."></div>
        <div class="admin-field"><label>Explication</label><textarea id="af-explication" rows="2"></textarea></div>`;

    case 'boite_mystere':
      return `
        <div class="admin-field"><label>Sponsor</label><input type="text" id="af-sponsor" placeholder="Décathlon Nantes"></div>
        <div class="admin-field"><label>URL logo sponsor (optionnel)</label><input type="url" id="af-sponsor-logo" placeholder="https://..."></div>
        <div class="admin-field"><label>Probabilité de gain (0.0 → 1.0)</label><input type="number" id="af-prob" value="0.2" min="0" max="1" step="0.05"></div>
        <div class="admin-field"><label>Message gagnant</label><input type="text" id="af-win-reward" placeholder="10% de réduction sur tout le rayon basket"></div>
        <div class="admin-field"><label>Code gagnant (optionnel)</label><input type="text" id="af-win-code" placeholder="HOOPWIN10"></div>
        <div class="admin-field"><label>Message perdant</label><input type="text" id="af-lose-reward" placeholder="Pas de chance... Reviens demain !"></div>
        <div class="admin-field"><label>Code perdant (optionnel)</label><input type="text" id="af-lose-code"></div>`;

    case 'timeline':
      return `
        <div class="admin-field"><label>Question</label><textarea id="af-question" rows="2" placeholder="Remets ces moments dans l'ordre chronologique !"></textarea></div>
        ${[1,2,3,4].map(i => `
          <div class="admin-field-row">
            <div class="admin-field" style="flex:3;margin-bottom:0"><label>Événement ${i}</label><input type="text" id="af-ev-text-${i}" placeholder="Ex : Fondation du club"></div>
            <div class="admin-field" style="flex:1;margin-bottom:0"><label>Année</label><input type="number" id="af-ev-year-${i}" placeholder="1987"></div>
          </div>`).join('')}
        <div class="admin-field" style="margin-top:10px"><label>Explication</label><textarea id="af-explication" rows="2"></textarea></div>`;

    case 'photo_mystere':
      return `
        <div class="admin-field"><label>Question</label><textarea id="af-question" rows="2" placeholder="Quel joueur se cache derrière cette photo ?"></textarea></div>
        <div class="admin-field"><label>URL de la photo</label><input type="url" id="af-image-url" placeholder="https://..."></div>
        ${[1,2,3,4].map(i => `<div class="admin-field"><label>Option ${i}</label><input type="text" id="af-opt-${i}" placeholder="Choix ${i}"></div>`).join('')}
        <div class="admin-field"><label>Bonne réponse (copie exacte d'une option)</label><input type="text" id="af-answer" placeholder="Nom exact de la bonne réponse"></div>
        <div class="admin-field"><label>Explication</label><textarea id="af-explication" rows="2"></textarea></div>`;

    default:
      return '';
  }
}

// ── Collecte des valeurs du formulaire ────────────────────────────────────

function v(id) { return (document.getElementById(id)?.value || '').trim(); }

function buildContent(type) {
  switch (type) {
    case 'pouls':
      return { match: v('af-match'), date_label: v('af-date-label'), match_id: v('af-match-id'), match_datetime: v('af-match-datetime') || undefined };

    case 'pronostic': {
      const c = { match: v('af-match'), date_label: v('af-date-label'), match_id: v('af-match-id'), match_datetime: v('af-match-datetime') || undefined };
      const sh = v('af-score-home'), sa = v('af-score-away');
      if (sh && sa) { c.score_domicile_final = +sh; c.score_exterieur_final = +sa; }
      return c;
    }

    case 'vestiaire': {
      const correct = +(document.querySelector('input[name="af-correct"]:checked')?.value ?? -1);
      return {
        num: v('af-num'), name: v('af-name'), pos: v('af-pos'),
        question: v('af-question'),
        answers: [0,1,2].map(i => ({ text: v(`af-a${i}`), correct: i === correct })),
        explication: v('af-explication'),
        ...(v('af-instagram') ? { instagram_url: v('af-instagram') } : {}),
      };
    }

    case 'anecdote': {
      const correct = +(document.querySelector('input[name="af-correct"]:checked')?.value ?? -1);
      return {
        subject: v('af-subject'), question: v('af-question'),
        answers: [0,1,2].map(i => ({ text: v(`af-a${i}`), correct: i === correct })),
        explication: v('af-explication'),
      };
    }

    case 'nantes_nbh':
      return { context: v('af-context') || undefined, question: v('af-question'), answer: v('af-answer'), explication: v('af-explication') };

    case 'avant_apres':
      return { title: v('af-title'), label_avant: v('af-label-avant'), label_apres: v('af-label-apres'), image_avant: v('af-image-avant'), image_apres: v('af-image-apres'), explication: v('af-explication') };

    case 'boite_mystere':
      return {
        sponsor_name: v('af-sponsor'), sponsor_logo: v('af-sponsor-logo') || undefined,
        win_probability: parseFloat(v('af-prob') || '0.2'),
        win_reward: v('af-win-reward'), win_code: v('af-win-code') || undefined,
        lose_reward: v('af-lose-reward'), lose_code: v('af-lose-code') || undefined,
      };

    case 'timeline':
      return {
        question: v('af-question'),
        events: [1,2,3,4].map(i => ({ id: i, text: v(`af-ev-text-${i}`), year: parseInt(v(`af-ev-year-${i}`) || '0') })).filter(e => e.text),
        explication: v('af-explication'),
      };

    case 'photo_mystere':
      return {
        question: v('af-question'), image_url: v('af-image-url'),
        options: [1,2,3,4].map(i => v(`af-opt-${i}`)).filter(Boolean),
        answer: v('af-answer'), explication: v('af-explication'),
      };

    default: return {};
  }
}

// ── Actions CRUD ───────────────────────────────────────────────────────────

async function saveMission(type) {
  const msgEl = document.getElementById('admin-save-msg');
  const date = v('af-date') || new Date().toISOString().split('T')[0];
  const active = document.getElementById('af-active')?.checked ?? true;
  const content = buildContent(type);

  const { error } = await db.from('games').insert({ org_id: CURRENT_ORG_ID, type, date, active, content });

  if (error) {
    if (msgEl) msgEl.innerHTML = `<span style="color:var(--red)">Erreur : ${error.message}</span>`;
    return;
  }
  if (msgEl) msgEl.innerHTML = '<span style="color:#4caf50">✓ Mission enregistrée !</span>';
  await loadMissionList();
  setTimeout(() => { if (msgEl) msgEl.innerHTML = ''; }, 3000);
}

async function updateMissionDate(id, date) {
  await db.from('games').update({ date }).eq('id', id).eq('org_id', CURRENT_ORG_ID);
  await loadMissionList();
}

async function toggleMissionActive(id, active) {
  await db.from('games').update({ active }).eq('id', id).eq('org_id', CURRENT_ORG_ID);
  await loadMissionList();
}

async function deleteMission(id) {
  if (!confirm('Supprimer cette mission ?')) return;
  await db.from('games').delete().eq('id', id).eq('org_id', CURRENT_ORG_ID);
  await loadMissionList();
}
