const SUPABASE_URL = "{{SUPABASE_URL}}";
const SUPABASE_ANON_KEY = "{{SUPABASE_ANON_KEY}}";

const { createClient } = supabase;
export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const LEVELS = [
  {name:'Curieux',min:0,max:100},{name:'Supporter',min:100,max:300},
  {name:'Fidèle',min:300,max:600},{name:'Ultras',min:600,max:1000},
  {name:'Légende',min:1000,max:9999}
];

export const UNLOCKABLES = [
  {id:'couleurs',  icon:'🎨', name:'Couleurs NBH',  cost:50,  desc:'Tenue aux couleurs du club'},
  {id:'echarpe',   icon:'🧣', name:'Écharpe',       cost:80,  desc:'L\'écharpe officielle de l\'Hermine'},
  {id:'casquette', icon:'🧢', name:'Casquette',     cost:120, desc:'La casquette bleue marine NBH'},
  {id:'lunettes',  icon:'🕶️', name:'Lunettes',      cost:150, desc:'Style assuré en tribune'},
  {id:'maillot',   icon:'👕', name:'Maillot',       cost:200, desc:'Le maillot domicile du club'},
  {id:'bandeau',   icon:'🎽', name:'Bandeau',       cost:250, desc:'Bandeau NBH sur le front'},
];

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
