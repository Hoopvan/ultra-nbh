const SUPABASE_URL = "{{SUPABASE_URL}}";
const SUPABASE_ANON_KEY = "{{SUPABASE_ANON_KEY}}";
const ORG_SLUG = "{{ORG_SLUG}}";

/* Garde : évite le crash quand les placeholders ne sont pas substitués
   (dev local sans .env). Le client est créé avec des valeurs factices —
   toutes les requêtes échoueront silencieusement, le mode démo bypasse
   Supabase de toute façon. */
const _url = SUPABASE_URL.startsWith('{{') ? 'https://placeholder.supabase.co' : SUPABASE_URL;
const _key = SUPABASE_ANON_KEY.startsWith('{{') ? 'placeholder-key' : SUPABASE_ANON_KEY;

const { createClient } = supabase;
export const db = createClient(_url, _key, {
  auth: { flowType: 'implicit' }
});

export let CURRENT_ORG_ID = null;
export let orgConfig = {};

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function hexBrighten(hex, factor) {
  const r = Math.min(255, Math.round(parseInt(hex.slice(1,3), 16) * (1 + factor)));
  const g = Math.min(255, Math.round(parseInt(hex.slice(3,5), 16) * (1 + factor)));
  const b = Math.min(255, Math.round(parseInt(hex.slice(5,7), 16) * (1 + factor)));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

export async function loadOrgConfig() {
  const { data: org, error: orgErr } = await db.from('organizations').select('id, slug, name').eq('slug', ORG_SLUG).single();
  if (!org) { console.error('Organisation introuvable :', ORG_SLUG, orgErr); return; }
  CURRENT_ORG_ID = org.id;

  const { data: cfg, error: cfgErr } = await db.from('org_config').select('*').eq('org_id', org.id).single();
  if (!cfg) { console.error('org_config introuvable pour', org.id, cfgErr); return; }
  orgConfig = cfg;

  // CSS brand tokens — override depuis la base de données org_config
  const root = document.documentElement.style;
  if (cfg.primary_color) {
    root.setProperty('--brand-primary',     cfg.primary_color);
    root.setProperty('--brand-primary-dim', hexToRgba(cfg.primary_color, 0.12));
    root.setProperty('--brand-primary-mid', hexToRgba(cfg.primary_color, 0.25));
    /* compat anciens inline styles */
    root.setProperty('--red',     cfg.primary_color);
    root.setProperty('--red-dim', hexToRgba(cfg.primary_color, 0.12));
    root.setProperty('--red-mid', hexToRgba(cfg.primary_color, 0.25));
  }
  if (cfg.secondary_color) {
    root.setProperty('--brand-secondary',     cfg.secondary_color);
    root.setProperty('--brand-secondary-dim', hexToRgba(cfg.secondary_color, 0.10));
    /* compat anciens inline styles */
    root.setProperty('--navy',        cfg.secondary_color);
    root.setProperty('--navy-bright', hexBrighten(cfg.secondary_color, 0.5));
  }
  if (cfg.bg_color)     root.setProperty('--brand-bg', cfg.bg_color);
  if (cfg.accent_color) root.setProperty('--brand-accent', cfg.accent_color);
  if (cfg.accent_color) root.setProperty('--gold', cfg.accent_color);

  // Titre de page et meta PWA
  const appName = cfg.app_name || org.name;
  document.title = appName;
  const appleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (appleMeta) appleMeta.content = appName;

  // Logo : si logo_url fourni et valide https, remplace les logos texte et l'image mascotte
  if (cfg.logo_url && cfg.logo_url.startsWith('https://')) {
    document.querySelectorAll('.loading-logo, .ob-logo').forEach(el => {
      el.textContent = '';
      const img = document.createElement('img');
      img.src = cfg.logo_url;
      img.alt = appName;
      img.setAttribute('style', 'max-height:56px;max-width:180px;object-fit:contain');
      el.appendChild(img);
    });
    const mascot = document.querySelector('.ob-mascot img');
    if (mascot) mascot.src = cfg.logo_url;
  }

  // Nom du club (onboarding)
  const subEl = document.querySelector('.ob-sub');
  if (subEl) subEl.textContent = org.name;

  // Tagline (onboarding)
  if (cfg.tagline) {
    const tagEl = document.querySelector('.ob-tagline');
    if (tagEl) tagEl.textContent = cfg.tagline;
  }

  // Remplacement des références texte au nom de l'app
  ['.name-sub', '#tuto-5 p'].forEach(sel => {
    const el = document.querySelector(sel);
    if (el) el.textContent = el.textContent.replace(/Hoop NBH/g, appName);
  });
}

export const LEVELS = [
  {name:'Curieux',   min:0,    max:100,  reward:null},
  {name:'Supporter', min:100,  max:300,  reward:'🎁 Tirage au sort mensuel pour gagner une écharpe'},
  {name:'Fidèle',    min:300,  max:600,  reward:'🎟️ Code promo -20% sur la billetterie'},
  {name:'Ultras',    min:600,  max:1000, reward:'🛍️ Code promo -20% sur la boutique'},
  {name:'Légende',   min:1000, max:9999, reward:'🖼️ Poster de l\'équipe dédicacé'},
];

export let UNLOCKABLES = [];

export async function loadUnlockables() {
  const { data, error } = await db.from('unlockables')
    .select('id, icon, name, cost, description, sort_order')
    .eq('org_id', CURRENT_ORG_ID)
    .eq('active', true)
    .order('sort_order');
  if (error) { console.error('loadUnlockables error:', error); return; }
  UNLOCKABLES = (data || []).map(u => ({ id: u.id, icon: u.icon, name: u.name, cost: u.cost, desc: u.description }));
}

export const AVATAR_SKINS = [
  {id:'light',     label:'Clair',  color:'#f5c89a'},
  {id:'tanned',    label:'Doré',   color:'#d4956a'},
  {id:'brown',     label:'Brun',   color:'#a0673a'},
  {id:'darkBrown', label:'Foncé',  color:'#6b3a1f'},
];

export const AVATAR_TOPS = [
  {id:'hijab',      label:'Hijab'},
  {id:'shortFlat',  label:'Court'},
  {id:'shortCurly', label:'Curly'},
  {id:'sides',      label:'Rasé'},
  {id:'theCaesar',  label:'Très court'},
  {id:'bob',        label:'Carré'},
  {id:'straight01', label:'Lisse'},
  {id:'bigHair',    label:'Long'},
];

export const AVATAR_HAIR_COLORS = [
  {id:'brown',      label:'Brun',  color:'#5a3a1a'},
  {id:'black',      label:'Noir',  color:'#1a1a1a'},
  {id:'blonde',     label:'Blond', color:'#d4a843'},
  {id:'red',        label:'Roux',  color:'#b5330a'},
  {id:'silverGray', label:'Gris',  color:'#aaaaaa'},
];

export const AVATAR_EYES = [
  {id:'default',   label:'Neutre'},
  {id:'happy',     label:'Heureux 😊'},
  {id:'surprised', label:'Étonné 😲'},
  {id:'eyeRoll',   label:'Au ciel 🙄'},
];

export const AVATAR_MOUTHS = [
  {id:'smile',   label:'Sourire'},
  {id:'default', label:'Neutre'},
  {id:'serious', label:'Sérieux'},
  {id:'twinkle', label:'Malicieux'},
  {id:'grimace', label:'Grimace'},
];

export const AVATAR_FACIAL_HAIRS = [
  {id:'',                label:'Aucune'},
  {id:'beardLight',      label:'3 jours'},
  {id:'beardMajestic',   label:'Barbe'},
  {id:'moustacheMagnum', label:'Moustache'},
];

export const AVATAR_CLOTHES = [
  {id:'shirtCrewNeck', label:'T-shirt'},
  {id:'shirtVNeck',    label:'Col V'},
  {id:'hoodie',        label:'Hoodie'},
  {id:'overall',       label:'Salopette'},
];

export const TABS = ['tribune','missions','avatar'];

export const TEAM_LABEL = { pro: 'Pro', espoir: 'Espoir', asso: 'Asso', admin: 'Admin', autre: 'Autre' };
export const TEAM_ORDER = ['pro', 'espoir', 'asso', 'admin', 'autre'];
