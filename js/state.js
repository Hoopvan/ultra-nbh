export let currentUser = null;
export let profile = null;
export function setCurrentUser(u) { currentUser = u; }
export function setProfile(p) { profile = p; }

export const gamesData = {
  pouls: null, vestiaire: null, anecdote: null,
  nantes_nbh: null, avant_apres: null, pronostic: null, boite_mystere: null,
  timeline: null, photo_mystere: null
};

export let demoMode = false;
export function setDemoMode(v) { demoMode = v; }
