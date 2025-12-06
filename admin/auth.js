import { ADMIN_PASSWORD, SESSION_KEY } from './config.js';
import { el } from './dom.js';

export async function checkSession(showDashboard) {
  const session = sessionStorage.getItem(SESSION_KEY);
  if (session === 'authenticated') {
    await showDashboard();
    return true;
  }
  return false;
}

export async function login(password, showDashboard) {
  if (password === ADMIN_PASSWORD) {
    sessionStorage.setItem(SESSION_KEY, 'authenticated');
    await showDashboard();
    return true;
  }
  return false;
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  el.loginScreen.style.display = 'flex';
  el.adminDashboard.style.display = 'none';
  document.getElementById('password').value = '';
}
