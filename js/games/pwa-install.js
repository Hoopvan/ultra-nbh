import { db } from '../config.js';
import { profile, demoMode, setProfile } from '../state.js';
import { showNotif } from '../utils.js';
import { getLevel, updateUI } from '../ui.js';
import { getToday } from '../date.js';

const XP_REWARD = 100;
const COINS_REWARD = 200;

export async function claimPwaInstallReward() {
  if (!profile || profile.pwa_install_date) return;

  const prevLevel = getLevel();
  const today = getToday();

  if (demoMode) {
    setProfile({ ...profile, xp: profile.xp + XP_REWARD, coins: (profile.coins||0) + COINS_REWARD, interactions: (profile.interactions||0) + 1, pwa_install_date: today });
  } else {
    const { data, error } = await db.rpc('claim_pwa_install_reward');
    if (error) return;
    setProfile(data.profile);
  }

  showNotif(`📲 App installée ! +${XP_REWARD} XP ⚡  +${COINS_REWARD} 🐾`);
  const nextLevel = getLevel();
  if (prevLevel !== nextLevel) setTimeout(() => showNotif(`🏆 ${nextLevel.name} !`), 1600);
  updateUI();
}
