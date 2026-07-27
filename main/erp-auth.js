// main/erp-auth.js
// Autenticação JWT compartilhada com a API do ERP (login em /auth/login).
const ERP_BASE_URL = "http://192.168.1.10:8081";
const ERP_AUTH_USER = "admin";
const ERP_AUTH_PASSWORD = "senhaapibartz";

let cachedToken = null;
let cachedTokenExpiresAt = 0;

async function getErpToken(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedToken && now < cachedTokenExpiresAt) {
    return cachedToken;
  }

  const url = `${ERP_BASE_URL}/auth/login?username=${encodeURIComponent(ERP_AUTH_USER)}&password=${encodeURIComponent(ERP_AUTH_PASSWORD)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha no login da API do ERP (HTTP ${response.status})`);
  }

  cachedToken = (await response.text()).trim();
  // Renova um pouco antes do token expirar (token dura 12h no servidor).
  cachedTokenExpiresAt = now + 11 * 60 * 60 * 1000;
  return cachedToken;
}

async function erpFetch(url, options = {}) {
  let token = await getErpToken();
  let response = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
  });

  // Se o token expirou/for inválido, tenta logar de novo uma vez.
  if (response.status === 401 || response.status === 403) {
    token = await getErpToken(true);
    response = await fetch(url, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
    });
  }

  return response;
}

async function readErpJsonArray(response) {
  if (response.status === 204) return [];
  if (!response.ok) return [];
  const data = await response.json();
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.content)) return data.content;
  if (data) return [data];
  return [];
}

module.exports = { ERP_BASE_URL, getErpToken, erpFetch, readErpJsonArray };
