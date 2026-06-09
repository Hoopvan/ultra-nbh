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
  {id:'couleurs',icon:'🎨',name:'Couleurs NBH',cost:50,desc:'Les couleurs officielles du club sur ton avatar'},
  {id:'echarpe',icon:'🧣',name:'Écharpe',cost:80,desc:'L\'écharpe officielle de l\'Hermine'},
  {id:'casquette',icon:'🧢',name:'Casquette',cost:120,desc:'La casquette bleue marine'},
  {id:'maillot',icon:'👕',name:'Maillot',cost:200,desc:'Le maillot domicile du club'},
  {id:'badge',icon:'🏅',name:'Badge Fondateur',cost:300,desc:'Membre fondateur de la communauté'},
  {id:'couronne',icon:'👑',name:'Couronne',cost:500,desc:'Légende de l\'Hermine'}
];

export const SKINS = {skin1:'#f5c89a',skin2:'#d4956a',skin3:'#a0673a',skin4:'#6b3a1f'};

export const TABS = ['tribune','missions','avatar'];
