import { db, CURRENT_ORG_ID, TEAM_LABEL } from './config.js';
import { profile } from './state.js';
import { escapeHtml } from './utils.js';

export function isAdmin() {
  if (profile?.role === 'super_admin') return true;
  return profile?.role === 'org_admin' && profile?.org_id === CURRENT_ORG_ID;
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
window._adminUploadImage = uploadImage;
window._adminSwitchTab   = switchAdminTab;
window._adminDeleteCard  = deleteCard;
window._adminToggleCard  = toggleCardActive;
window._adminMoveCard    = moveCard;
window._adminCloseProno  = closeProno;

// ── Init ───────────────────────────────────────────────────────────────────

export async function initAdmin() {
  renderTypeGrid();
  document.getElementById('admin-form-area').innerHTML = '';
  await loadMissionList();
  wireCardForm();
}

function switchAdminTab(tab) {
  const isMissions = tab === 'missions';
  document.getElementById('admin-panel-missions').style.display = isMissions ? 'block' : 'none';
  document.getElementById('admin-panel-cards').style.display    = isMissions ? 'none'  : 'block';
  document.getElementById('admin-tab-missions').style.borderBottomColor = isMissions ? 'var(--red)' : 'transparent';
  document.getElementById('admin-tab-missions').style.color     = isMissions ? 'var(--white)' : 'var(--white-muted)';
  document.getElementById('admin-tab-cards').style.borderBottomColor    = isMissions ? 'transparent' : 'var(--red)';
  document.getElementById('admin-tab-cards').style.color        = isMissions ? 'var(--white-muted)' : 'var(--white)';
  if (!isMissions) loadCardList();
}

// ── Liste des missions ─────────────────────────────────────────────────────

async function loadMissionList() {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  let { data, error } = await db.from('games')
    .select('id, type, date, active, content, closed_at')
    .eq('org_id', CURRENT_ORG_ID)
    .or(`date.gte.${weekAgo},type.eq.boite_mystere`);

  if (error) {
    // Repli si la migration 29 (colonne closed_at) n'a pas encore été exécutée.
    ({ data } = await db.from('games')
      .select('id, type, date, active, content')
      .eq('org_id', CURRENT_ORG_ID)
      .or(`date.gte.${weekAgo},type.eq.boite_mystere`));
  }

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

    const hasFinalScore = m.content?.score_domicile_final != null && m.content?.score_exterieur_final != null;
    let pronoAction = '';
    if (m.type === 'pronostic' && hasFinalScore) {
      pronoAction = m.closed_at
        ? `<span style="font-size:10px;color:var(--white-muted);white-space:nowrap">✓ Clôturé</span>`
        : `<button class="admin-toggle" style="background:rgba(245,166,35,.15);border-color:rgba(245,166,35,.3);color:var(--gold)" onclick="window._adminCloseProno('${m.id}')">🏆 Clôturer</button>`;
    }

    return `${separator}<div class="admin-row">
      <div class="admin-row-info">
        ${dateCell}
        <span class="admin-row-type">${label}</span>
        ${preview ? `<span class="admin-row-preview">${escapeHtml(preview)}</span>` : ''}
      </div>
      <div class="admin-row-actions">
        ${pronoAction}
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

// ── Upload image → Supabase Storage ───────────────────────────────────────

async function uploadImage(fileInput, urlInputId) {
  const file = fileInput.files[0];
  if (!file) return;
  const previewEl = document.getElementById(urlInputId + '-preview');
  const urlEl     = document.getElementById(urlInputId);
  if (previewEl) previewEl.innerHTML = '<span style="font-size:12px;color:var(--white-muted)">⏳ Envoi en cours...</span>';

  const ext  = file.name.split('.').pop().toLowerCase();
  const path = `${CURRENT_ORG_ID}/${Date.now()}.${ext}`;
  const { error } = await db.storage.from('mission-images').upload(path, file, { cacheControl: '31536000', upsert: false });

  if (error) {
    if (previewEl) { previewEl.textContent = ''; const s = document.createElement('span'); s.style.cssText = 'font-size:12px;color:var(--red)'; s.textContent = 'Erreur upload'; previewEl.appendChild(s); }
    return;
  }
  const { data } = db.storage.from('mission-images').getPublicUrl(path);
  if (urlEl) urlEl.value = data.publicUrl;
  if (previewEl) previewEl.innerHTML = `<img src="${data.publicUrl}" style="max-width:100%;max-height:90px;border-radius:8px;object-fit:cover;margin-top:4px">`;
}

function imageField(id, label, optional = false) {
  return `<div class="admin-field">
    <label>${label}${optional ? ' <span style="font-weight:400;text-transform:none;letter-spacing:0">(optionnel)</span>' : ''}</label>
    <input type="file" accept="image/*" id="af-file-${id}" style="position:absolute;width:0;height:0;opacity:0;overflow:hidden" onchange="window._adminUploadImage(this,'af-${id}')">
    <label for="af-file-${id}" class="admin-img-btn">📷 Choisir depuis la galerie</label>
    <div id="af-${id}-preview"></div>
    <input type="url" id="af-${id}" placeholder="ou colle une URL directement" style="margin-top:6px">
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
        ${imageField('image-avant', 'Image Avant')}
        ${imageField('image-apres', 'Image Après')}
        <div class="admin-field"><label>Explication</label><textarea id="af-explication" rows="2"></textarea></div>`;

    case 'boite_mystere':
      return `
        <div class="admin-field"><label>Sponsor</label><input type="text" id="af-sponsor" placeholder="Décathlon Nantes"></div>
        ${imageField('sponsor-logo', 'Logo sponsor', true)}
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
        ${imageField('image-url', 'Photo mystère')}
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
    if (msgEl) { msgEl.textContent = ''; const s = document.createElement('span'); s.style.color = 'var(--red)'; s.textContent = 'Erreur enregistrement'; msgEl.appendChild(s); }
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

async function closeProno(id) {
  if (!confirm('Clôturer ce pronostic ? Les points seront distribués aux joueurs et cette action est définitive.')) return;
  const { error } = await db.rpc('close_pronostic_match', { p_game_id: id });
  if (error) {
    alert(error.message?.includes('ALREADY_CLOSED') ? 'Ce pronostic est déjà clôturé.' : 'Erreur lors de la clôture : ' + error.message);
    return;
  }
  await loadMissionList();
}

// ── GESTION CARTES ────────────────────────────────────────────────────────

let cardPhotoFile = null;
let cardPhotoUrl = null;
let adminCards = [];

function wireCardForm() {
  const photoBtn = document.getElementById('card-photo-btn');
  const fileInput = document.getElementById('card-photo-file');
  const preview = document.getElementById('card-photo-preview');
  const saveBtn = document.getElementById('card-save-btn');
  if (!photoBtn) return;

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    cardPhotoFile = file;
    preview.src = URL.createObjectURL(file);
    preview.style.display = 'block';
    photoBtn.textContent = '✅ ' + file.name;
  });
  saveBtn.addEventListener('click', saveCard);
}

async function saveCard() {
  const name = document.getElementById('card-name-input').value.trim();
  if (!name) { alert('Nom requis'); return; }
  const saveBtn = document.getElementById('card-save-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Enregistrement…';

  let photoUrl = '';
  if (cardPhotoFile) {
    const slug = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const ext = cardPhotoFile.name.split('.').pop();
    const path = `cards/${slug}_${Date.now()}.${ext}`;
    const { error: upErr } = await db.storage.from('mission-images').upload(path, cardPhotoFile, { upsert: true });
    if (!upErr) {
      const { data: urlData } = db.storage.from('mission-images').getPublicUrl(path);
      photoUrl = urlData?.publicUrl || '';
    }
  }

  const nextOrder = adminCards.length > 0 ? Math.max(...adminCards.map(c => c.sort_order)) + 1 : 0;
  const id = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Date.now();
  const { error } = await db.from('cards').insert({
    id,
    org_id: CURRENT_ORG_ID,
    player_name: name,
    position: document.getElementById('card-pos-input').value.trim() || null,
    rarity: document.getElementById('card-rarity-input').value,
    team: document.getElementById('card-team-input').value,
    sort_order: nextOrder,
    photo_url: photoUrl,
    active: true,
  });

  saveBtn.disabled = false;
  saveBtn.textContent = 'ENREGISTRER LA CARTE';
  if (error) { console.error('saveCard error:', error); alert('Erreur lors de l\'enregistrement de la carte.'); return; }

  // Reset form
  document.getElementById('card-name-input').value = '';
  document.getElementById('card-pos-input').value = '';
  document.getElementById('card-rarity-input').value = 'bronze';
  document.getElementById('card-team-input').value = 'pro';
  document.getElementById('card-photo-preview').style.display = 'none';
  document.getElementById('card-photo-btn').textContent = '📷 Choisir une photo';
  cardPhotoFile = null;
  await loadCardList();
}

async function loadCardList() {
  const container = document.getElementById('admin-card-list');
  if (!container) return;
  container.innerHTML = '<div style="color:var(--white-muted);font-size:13px;padding:8px 0">Chargement…</div>';
  const { data: cards } = await db.from('cards').select('*').eq('org_id', CURRENT_ORG_ID).order('sort_order');
  adminCards = cards || [];
  if (!adminCards.length) { container.innerHTML = '<div style="color:var(--white-muted);font-size:13px;padding:8px 0">Aucune carte.</div>'; return; }

  const RARITY_COLOR = { bronze: '#cd7f32', silver: '#b8b8c8', gold: '#ffd700' };
  const btnStyle = 'background:var(--black3);border:1px solid var(--black5);border-radius:6px;padding:4px 7px;color:var(--white-muted);font-size:13px;cursor:pointer;line-height:1';

  container.innerHTML = adminCards.map((c, i) => {
    const isFirst = i === 0, isLast = i === adminCards.length - 1;
    const team = TEAM_LABEL[c.team] || c.team || '—';
    return `
    <div style="background:var(--black2);border:1px solid var(--black4);border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:6px;display:flex;align-items:center;gap:10px;${!c.active ? 'opacity:.4' : ''}">
      ${c.photo_url ? `<img src="${c.photo_url}" style="width:36px;height:50px;object-fit:cover;border-radius:6px;border:1px solid var(--black5);flex-shrink:0">` : '<div style="width:36px;height:50px;background:var(--black3);border-radius:6px;flex-shrink:0"></div>'}
      <div style="flex:1;min-width:0">
        <div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;font-size:15px;color:var(--white)">${escapeHtml(c.player_name)}</div>
        <div style="font-size:11px;color:var(--white-muted)">${escapeHtml(c.position || '—')} · <span style="color:${RARITY_COLOR[c.rarity] || '#fff'};font-weight:700">${escapeHtml(c.rarity.toUpperCase())}</span> · ${escapeHtml(team)}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:3px;flex-shrink:0">
        <button onclick="window._adminMoveCard('${c.id}','up')" style="${btnStyle}${isFirst ? ';opacity:.2;pointer-events:none' : ''}">▲</button>
        <button onclick="window._adminMoveCard('${c.id}','down')" style="${btnStyle}${isLast ? ';opacity:.2;pointer-events:none' : ''}">▼</button>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button onclick="window._adminToggleCard('${c.id}',${!c.active})" style="background:var(--black3);border:1px solid var(--black5);border-radius:6px;padding:5px 8px;color:var(--white-muted);font-size:11px;cursor:pointer">${c.active ? 'Masquer' : 'Afficher'}</button>
        <button onclick="window._adminDeleteCard('${c.id}')" style="background:rgba(232,25,44,.1);border:1px solid rgba(232,25,44,.2);border-radius:6px;padding:5px 8px;color:var(--red);font-size:11px;cursor:pointer">✕</button>
      </div>
    </div>`;
  }).join('');
}

async function moveCard(id, dir) {
  const idx = adminCards.findIndex(c => c.id === id);
  if (idx < 0) return;
  const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= adminCards.length) return;

  // Normalise en séquence continue puis permute les deux positions
  const updates = adminCards.map((c, i) => ({ id: c.id, sort_order: i }));
  updates[idx].sort_order = swapIdx;
  updates[swapIdx].sort_order = idx;

  await Promise.all(updates.map(u => db.from('cards').update({ sort_order: u.sort_order }).eq('id', u.id)));
  await loadCardList();
}

async function toggleCardActive(id, active) {
  await db.from('cards').update({ active }).eq('id', id);
  await loadCardList();
}

async function deleteCard(id) {
  if (!confirm('Supprimer cette carte ? Les collections des fans seront aussi nettoyées.')) return;
  const { error } = await db.rpc('delete_card_admin', { p_card_id: id });
  if (error) { console.error('deleteCard error:', error); alert('Erreur lors de la suppression : ' + error.message); return; }
  await loadCardList();
}
