export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export function safeImg(src, style = '') {
  const img = document.createElement('img');
  img.src = src;
  if (style) img.setAttribute('style', style);
  return img;
}

export function showNotif(txt) {
  const el = document.getElementById('notif');
  document.getElementById('notif-txt').textContent = txt;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2400);
}

export function showUnlockModal(item) {
  document.getElementById('m-icon').textContent = item.icon;
  document.getElementById('m-title').textContent = item.name + ' débloqué !';
  document.getElementById('m-desc').textContent = item.desc + ' . Active-le dans Mon Perso.';
  document.getElementById('unlock-modal').classList.add('show');
}

export function closeModal() {
  document.getElementById('unlock-modal').classList.remove('show');
}

export let _matchTarget = new Date('2026-06-06T20:00:00');
export function setMatchTarget(d) { _matchTarget = d; }

export function startCountdown() {
  const tick = () => {
    const diff = _matchTarget - new Date();
    if (diff <= 0) {
      [['cd-j','00'],['cd-h','00'],['cd-m','00'],['cd-s','00']].forEach(([id,v]) => {
        const el = document.getElementById(id); if (el) el.textContent = v;
      });
      return;
    }
    const d = Math.floor(diff/86400000), h = Math.floor((diff%86400000)/3600000);
    const m = Math.floor((diff%3600000)/60000), s = Math.floor((diff%60000)/1000);
    const fmt = n => String(n).padStart(2,'0');
    [['cd-j',d],['cd-h',h],['cd-m',m],['cd-s',s]].forEach(([id,v]) => {
      const el = document.getElementById(id); if (el) el.textContent = fmt(v);
    });
  };
  tick(); setInterval(tick, 1000);
}
