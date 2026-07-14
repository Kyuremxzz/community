'use strict';
/* TaskForge — cliente da API. Define window.Api. */
(function () {
  const TOKEN_KEY = 'taskforge_token';

  function token() {
    return localStorage.getItem(TOKEN_KEY);
  }

  async function call(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const t = token();
    if (t) headers.Authorization = 'Bearer ' + t;
    const res = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let json = {};
    try { json = await res.json(); } catch { /* respostas sem corpo */ }
    if (!res.ok) {
      const err = new Error(json.error?.message || 'Erro na requisição.');
      err.status = res.status;
      err.code = json.error?.code || 'unknown';
      throw err;
    }
    return json;
  }

  window.Api = {
    hasToken: () => !!token(),
    setToken: (t) => localStorage.setItem(TOKEN_KEY, t),
    clearToken: () => localStorage.removeItem(TOKEN_KEY),

    register: (name, email, password) => call('POST', '/api/auth/register', { name, email, password }),
    login: (email, password) => call('POST', '/api/auth/login', { email, password }),
    logout: () => call('POST', '/api/auth/logout', {}),
    me: () => call('GET', '/api/me'),
    subscribe: () => call('POST', '/api/me/subscribe', {}),
    mySquads: () => call('GET', '/api/me/squads'),

    projects: () => call('GET', '/api/projects'),
    project: (id) => call('GET', '/api/projects/' + id),
    createProject: (data) => call('POST', '/api/projects', data),
    addSquad: (projectId, name) => call('POST', `/api/projects/${projectId}/squads`, { name }),

    squad: (id) => call('GET', '/api/squads/' + id),
    joinSlot: (slotId) => call('POST', `/api/slots/${slotId}/join`, {}),
    leaveSlot: (slotId) => call('POST', `/api/slots/${slotId}/leave`, {}),
    deliver: (squadId, repoUrl) => call('POST', `/api/squads/${squadId}/deliver`, { repoUrl }),
  };
})();
