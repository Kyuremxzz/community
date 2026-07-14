'use strict';
/**
 * TaskForge — servidor HTTP + API REST (zero dependências, Node >= 22.5).
 * Rotas:
 *   POST /api/auth/register            { name, email, password }
 *   POST /api/auth/login               { email, password }
 *   POST /api/auth/logout
 *   GET  /api/me
 *   POST /api/me/subscribe             (assinatura simulada)
 *   GET  /api/me/squads
 *   GET  /api/projects
 *   POST /api/projects                 { title, description, difficulty, deadlineWeeks, roles[] }
 *   GET  /api/projects/:id
 *   POST /api/projects/:id/squads      { name? }
 *   GET  /api/squads/:id
 *   POST /api/slots/:id/join
 *   POST /api/slots/:id/leave
 *   POST /api/squads/:id/deliver       { repoUrl }
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { openDb, hashPassword, verifyPassword, createSquadForProject, recordProjectEntry } = require('./db');

const db = openDb();
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const WEEK_MS = 7 * 86400000;

const DIFFICULTIES = {
  iniciante: { weeks: [1], label: 'Iniciante' },
  intermediario: { weeks: [2], label: 'Intermediário' },
  avancado: { weeks: [3, 4], label: 'Avançado' },
};

const SQUAD_NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'];

/* ---------------- helpers ---------------- */

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 64 * 1024) {
        reject(new ApiError(413, 'too_large', 'Corpo da requisição grande demais.'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new ApiError(400, 'bad_json', 'JSON inválido.'));
      }
    });
    req.on('error', reject);
  });
}

function getUser(req) {
  const auth = req.headers.authorization || '';
  const m = /^Bearer\s+([a-f0-9]{48})$/i.exec(auth);
  if (!m) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.subscribed FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`
    )
    .get(m[1]);
  return row || null;
}

function requireUser(req) {
  const u = getUser(req);
  if (!u) throw new ApiError(401, 'unauthorized', 'Faça login para continuar.');
  return u;
}

function createSession(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)`).run(token, userId, Date.now());
  return token;
}

/**
 * Ids de projetos distintos que o usuário JÁ ENTROU alguma vez (histórico vitalício).
 * Usado para a regra do "1 projeto grátis": sair de uma vaga em formação não deve
 * "devolver" o crédito grátis, então isso é lido de project_entries (nunca apagado),
 * não de squad_slots (que reflete só a ocupação atual).
 */
function projectsJoinedBy(userId) {
  return db
    .prepare(`SELECT project_id AS pid FROM project_entries WHERE user_id = ?`)
    .all(userId)
    .map((r) => r.pid);
}

function userPublic(u) {
  const joined = projectsJoinedBy(u.id);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    subscribed: !!u.subscribed,
    projectsJoined: joined.length,
    freeProjectUsed: joined.length >= 1,
  };
}

function squadView(squadRow, userId) {
  const slots = db
    .prepare(
      `SELECT sl.id, sl.user_id, sl.filled_at, r.name AS role, u.name AS userName
         FROM squad_slots sl
         JOIN project_roles r ON r.id = sl.role_id
         LEFT JOIN users u ON u.id = sl.user_id
        WHERE sl.squad_id = ?
        ORDER BY sl.id`
    )
    .all(squadRow.id);
  const filled = slots.filter((s) => s.user_id != null).length;
  return {
    id: squadRow.id,
    projectId: squadRow.project_id,
    name: squadRow.name,
    status: squadRow.status,
    deadlineStartedAt: squadRow.deadline_started_at,
    deadlineEndsAt: squadRow.deadline_ends_at,
    repoUrl: squadRow.repo_url,
    deliveredAt: squadRow.delivered_at,
    deliveredLate: squadRow.delivered_at != null && squadRow.deadline_ends_at != null
      ? squadRow.delivered_at > squadRow.deadline_ends_at
      : false,
    slotsTotal: slots.length,
    slotsFilled: filled,
    isMember: userId != null && slots.some((s) => s.user_id === userId),
    slots: slots.map((s) => ({
      id: s.id,
      role: s.role,
      userId: s.user_id,
      userName: s.userName,
      filledAt: s.filled_at,
      mine: userId != null && s.user_id === userId,
    })),
  };
}

function projectView(p, userId, withSquads) {
  const roles = db.prepare(`SELECT name FROM project_roles WHERE project_id = ? ORDER BY id`).all(p.id).map((r) => r.name);
  const squadRows = db.prepare(`SELECT * FROM squads WHERE project_id = ? ORDER BY id`).all(p.id);
  const squads = squadRows.map((s) => squadView(s, userId));
  const openSlots = squads.reduce(
    (acc, s) => acc + (s.status === 'forming' ? s.slotsTotal - s.slotsFilled : 0),
    0
  );
  const base = {
    id: p.id,
    title: p.title,
    description: p.description,
    difficulty: p.difficulty,
    difficultyLabel: DIFFICULTIES[p.difficulty]?.label || p.difficulty,
    deadlineWeeks: p.deadline_weeks,
    createdAt: p.created_at,
    roles,
    squadCount: squads.length,
    openSlots,
    isMember: userId != null && squads.some((s) => s.isMember),
  };
  if (withSquads) base.squads = squads;
  return base;
}

function getProjectOr404(id) {
  const p = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id);
  if (!p) throw new ApiError(404, 'not_found', 'Projeto não encontrado.');
  return p;
}

function getSquadOr404(id) {
  const s = db.prepare(`SELECT * FROM squads WHERE id = ?`).get(id);
  if (!s) throw new ApiError(404, 'not_found', 'Squad não encontrado.');
  return s;
}

/* ---------------- API handlers ---------------- */

const routes = [];
function route(method, pattern, handler) {
  routes.push({ method, pattern, handler });
}

route('POST', /^\/api\/auth\/register$/, async (req, res) => {
  const body = await readBody(req);
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (name.length < 2) throw new ApiError(400, 'invalid_name', 'Nome precisa de pelo menos 2 caracteres.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, 'invalid_email', 'E-mail inválido.');
  if (password.length < 6) throw new ApiError(400, 'invalid_password', 'Senha precisa de pelo menos 6 caracteres.');
  const exists = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email);
  if (exists) throw new ApiError(409, 'email_taken', 'Já existe uma conta com esse e-mail.');
  const r = db
    .prepare(`INSERT INTO users (name, email, password_hash, subscribed, created_at) VALUES (?, ?, ?, 0, ?)`)
    .run(name, email, hashPassword(password), Date.now());
  const id = Number(r.lastInsertRowid);
  const token = createSession(id);
  const u = db.prepare(`SELECT id, name, email, subscribed FROM users WHERE id = ?`).get(id);
  sendJson(res, 201, { token, user: userPublic(u) });
});

route('POST', /^\/api\/auth\/login$/, async (req, res) => {
  const body = await readBody(req);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const u = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email);
  if (!u || !verifyPassword(password, u.password_hash)) {
    throw new ApiError(401, 'bad_credentials', 'E-mail ou senha incorretos.');
  }
  const token = createSession(u.id);
  sendJson(res, 200, { token, user: userPublic(u) });
});

route('POST', /^\/api\/auth\/logout$/, async (req, res) => {
  const auth = req.headers.authorization || '';
  const m = /^Bearer\s+([a-f0-9]{48})$/i.exec(auth);
  if (m) db.prepare(`DELETE FROM sessions WHERE token = ?`).run(m[1]);
  sendJson(res, 200, { ok: true });
});

route('GET', /^\/api\/me$/, async (req, res) => {
  const u = requireUser(req);
  sendJson(res, 200, { user: userPublic(u) });
});

route('POST', /^\/api\/me\/subscribe$/, async (req, res) => {
  const u = requireUser(req);
  db.prepare(`UPDATE users SET subscribed = 1 WHERE id = ?`).run(u.id);
  const fresh = db.prepare(`SELECT id, name, email, subscribed FROM users WHERE id = ?`).get(u.id);
  sendJson(res, 200, { user: userPublic(fresh), message: 'Assinatura ativada (pagamento simulado no protótipo).' });
});

route('GET', /^\/api\/me\/squads$/, async (req, res) => {
  const u = requireUser(req);
  const rows = db
    .prepare(
      `SELECT DISTINCT sq.* FROM squads sq JOIN squad_slots sl ON sl.squad_id = sq.id WHERE sl.user_id = ? ORDER BY sq.id DESC`
    )
    .all(u.id);
  const out = rows.map((sq) => {
    const p = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(sq.project_id);
    return { squad: squadView(sq, u.id), project: projectView(p, u.id, false) };
  });
  sendJson(res, 200, { squads: out });
});

route('GET', /^\/api\/projects$/, async (req, res) => {
  const u = getUser(req);
  const rows = db.prepare(`SELECT * FROM projects ORDER BY id`).all();
  sendJson(res, 200, { projects: rows.map((p) => projectView(p, u?.id ?? null, false)) });
});

route('POST', /^\/api\/projects$/, async (req, res) => {
  const u = requireUser(req);
  const body = await readBody(req);
  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  const difficulty = String(body.difficulty || '');
  const rolesRaw = Array.isArray(body.roles) ? body.roles : [];

  if (title.length < 3) throw new ApiError(400, 'invalid_title', 'Título precisa de pelo menos 3 caracteres.');
  if (description.length < 10) throw new ApiError(400, 'invalid_description', 'Descrição precisa de pelo menos 10 caracteres.');
  const diff = DIFFICULTIES[difficulty];
  if (!diff) throw new ApiError(400, 'invalid_difficulty', 'Dificuldade deve ser iniciante, intermediario ou avancado.');

  // deadlineWeeks é opcional (usa o padrão da dificuldade); se enviado, tem que
  // ser um inteiro válido para essa dificuldade — nunca cai num default silencioso.
  let deadlineWeeks;
  if (body.deadlineWeeks === undefined || body.deadlineWeeks === null || body.deadlineWeeks === '') {
    deadlineWeeks = diff.weeks[0];
  } else if (typeof body.deadlineWeeks === 'number' && Number.isInteger(body.deadlineWeeks)) {
    deadlineWeeks = body.deadlineWeeks;
  } else {
    throw new ApiError(400, 'invalid_deadline', 'Prazo precisa ser um número inteiro de semanas.');
  }
  if (!diff.weeks.includes(deadlineWeeks)) {
    throw new ApiError(400, 'invalid_deadline', `Prazo para ${difficulty}: ${diff.weeks.join(' ou ')} semana(s).`);
  }
  const rolesTrimmed = rolesRaw.map((r) => String(r).trim()).filter(Boolean);
  const roles = [...new Set(rolesTrimmed)];
  if (roles.length !== rolesTrimmed.length) {
    throw new ApiError(400, 'invalid_roles', 'Funções não podem se repetir.');
  }
  if (roles.length < 2 || roles.length > 6) {
    throw new ApiError(400, 'invalid_roles', 'Defina entre 2 e 6 funções para o projeto.');
  }
  if (roles.some((r) => r.length > 14)) {
    throw new ApiError(400, 'invalid_roles', 'Nome de função pode ter no máximo 14 caracteres.');
  }

  const now = Date.now();
  const r = db
    .prepare(`INSERT INTO projects (title, description, difficulty, deadline_weeks, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(title, description, difficulty, deadlineWeeks, u.id, now);
  const projectId = Number(r.lastInsertRowid);
  const insRole = db.prepare(`INSERT INTO project_roles (project_id, name) VALUES (?, ?)`);
  for (const role of roles) insRole.run(projectId, role);
  createSquadForProject(db, projectId, 'Squad Alpha', now);

  const p = getProjectOr404(projectId);
  sendJson(res, 201, { project: projectView(p, u.id, true) });
});

route('GET', /^\/api\/projects\/(\d+)$/, async (req, res, m) => {
  const u = getUser(req);
  const p = getProjectOr404(Number(m[1]));
  sendJson(res, 200, { project: projectView(p, u?.id ?? null, true) });
});

route('POST', /^\/api\/projects\/(\d+)\/squads$/, async (req, res, m) => {
  const u = requireUser(req);
  const body = await readBody(req);
  const p = getProjectOr404(Number(m[1]));
  const count = db.prepare(`SELECT COUNT(*) AS n FROM squads WHERE project_id = ?`).get(p.id).n;
  let name = String(body.name || '').trim();
  if (!name) name = `Squad ${SQUAD_NAMES[count % SQUAD_NAMES.length]}`;
  if (name.length > 24) throw new ApiError(400, 'invalid_name', 'Nome do squad pode ter no máximo 24 caracteres.');
  const squadId = createSquadForProject(db, p.id, name, Date.now());
  const sq = getSquadOr404(squadId);
  sendJson(res, 201, { squad: squadView(sq, u.id) });
});

route('GET', /^\/api\/squads\/(\d+)$/, async (req, res, m) => {
  const u = getUser(req);
  const sq = getSquadOr404(Number(m[1]));
  const p = getProjectOr404(sq.project_id);
  sendJson(res, 200, { squad: squadView(sq, u?.id ?? null), project: projectView(p, u?.id ?? null, false) });
});

route('POST', /^\/api\/slots\/(\d+)\/join$/, async (req, res, m) => {
  const u = requireUser(req);
  const slot = db.prepare(`SELECT * FROM squad_slots WHERE id = ?`).get(Number(m[1]));
  if (!slot) throw new ApiError(404, 'not_found', 'Vaga não encontrada.');
  const sq = getSquadOr404(slot.squad_id);
  const p = getProjectOr404(sq.project_id);

  if (sq.status !== 'forming') throw new ApiError(409, 'squad_locked', 'Esse squad já fechou a formação.');
  if (slot.user_id != null) throw new ApiError(409, 'slot_taken', 'Essa vaga já foi ocupada.');

  const inSquad = db
    .prepare(`SELECT id FROM squad_slots WHERE squad_id = ? AND user_id = ?`)
    .get(sq.id, u.id);
  if (inSquad) throw new ApiError(409, 'already_in_squad', 'Você já ocupa uma vaga nesse squad.');

  // Regra do projeto grátis: 1º projeto liberado; novos projetos exigem assinatura.
  const joined = projectsJoinedBy(u.id);
  const isNewProject = !joined.includes(p.id);
  if (isNewProject && joined.length >= 1 && !u.subscribed) {
    throw new ApiError(402, 'paywall', 'Seu projeto grátis já foi usado. Assine para entrar em novos projetos.');
  }

  const now = Date.now();
  const upd = db
    .prepare(`UPDATE squad_slots SET user_id = ?, filled_at = ? WHERE id = ? AND user_id IS NULL`)
    .run(u.id, now, slot.id);
  if (upd.changes === 0) throw new ApiError(409, 'slot_taken', 'Essa vaga acabou de ser ocupada.');
  recordProjectEntry(db, u.id, p.id, now);

  // Squad completo? Prazo começa a contar agora.
  const remaining = db
    .prepare(`SELECT COUNT(*) AS n FROM squad_slots WHERE squad_id = ? AND user_id IS NULL`)
    .get(sq.id).n;
  let started = false;
  if (remaining === 0) {
    db.prepare(`UPDATE squads SET status = 'active', deadline_started_at = ?, deadline_ends_at = ? WHERE id = ?`)
      .run(now, now + p.deadline_weeks * WEEK_MS, sq.id);
    started = true;
  }

  const fresh = getSquadOr404(sq.id);
  sendJson(res, 200, {
    squad: squadView(fresh, u.id),
    deadlineStarted: started,
    message: started
      ? 'Squad completo! O prazo começou a contar agora.'
      : 'Vaga ocupada. O prazo começa quando o squad estiver completo.',
  });
});

route('POST', /^\/api\/slots\/(\d+)\/leave$/, async (req, res, m) => {
  const u = requireUser(req);
  const slot = db.prepare(`SELECT * FROM squad_slots WHERE id = ?`).get(Number(m[1]));
  if (!slot) throw new ApiError(404, 'not_found', 'Vaga não encontrada.');
  if (slot.user_id !== u.id) throw new ApiError(403, 'not_yours', 'Essa vaga não é sua.');
  const sq = getSquadOr404(slot.squad_id);
  if (sq.status !== 'forming') {
    throw new ApiError(409, 'squad_locked', 'O squad já está com prazo correndo; não dá para sair.');
  }
  db.prepare(`UPDATE squad_slots SET user_id = NULL, filled_at = NULL WHERE id = ?`).run(slot.id);
  sendJson(res, 200, { squad: squadView(getSquadOr404(sq.id), u.id) });
});

route('POST', /^\/api\/squads\/(\d+)\/deliver$/, async (req, res, m) => {
  const u = requireUser(req);
  const body = await readBody(req);
  const sq = getSquadOr404(Number(m[1]));

  const member = db.prepare(`SELECT id FROM squad_slots WHERE squad_id = ? AND user_id = ?`).get(sq.id, u.id);
  if (!member) throw new ApiError(403, 'not_member', 'Só membros do squad podem entregar.');
  if (sq.status === 'delivered') throw new ApiError(409, 'already_delivered', 'Esse squad já entregou.');
  if (sq.status !== 'active') throw new ApiError(409, 'not_active', 'O squad ainda não está completo — nada a entregar.');

  const repoUrl = String(body.repoUrl || '').trim();
  let ok = false;
  try {
    const parsed = new URL(repoUrl);
    const segments = parsed.pathname.split('/').filter(Boolean);
    ok =
      parsed.protocol === 'https:' &&
      parsed.hostname.toLowerCase() === 'github.com' &&
      !parsed.username &&
      !parsed.password &&
      segments.length === 2 &&
      segments.every((s) => /^[\w.-]+$/.test(s));
  } catch { ok = false; }
  if (!ok) {
    throw new ApiError(400, 'invalid_repo', 'Envie a URL https de um repositório do GitHub, no formato https://github.com/usuario/repo.');
  }

  const now = Date.now();
  db.prepare(`UPDATE squads SET status = 'delivered', repo_url = ?, delivered_at = ? WHERE id = ?`)
    .run(repoUrl, now, sq.id);
  const fresh = getSquadOr404(sq.id);
  sendJson(res, 200, {
    squad: squadView(fresh, u.id),
    showGithubTutorial: true,
    message: 'Entrega registrada! Veja como adicionar seus colegas como colaboradores no GitHub.',
  });
});

/* ---------------- static files ---------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/') rel = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) {
    sendJson(res, 403, { error: { code: 'forbidden', message: 'Caminho inválido.' } });
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback: rotas de app caem no index.html
      if (!path.extname(rel)) {
        fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, index) => {
          if (err2) return sendJson(res, 404, { error: { code: 'not_found', message: 'Não encontrado.' } });
          res.writeHead(200, { 'Content-Type': MIME['.html'] });
          res.end(index);
        });
        return;
      }
      return sendJson(res, 404, { error: { code: 'not_found', message: 'Não encontrado.' } });
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

/* ---------------- server ---------------- */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  try {
    if (pathname.startsWith('/api/')) {
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const m = r.pattern.exec(pathname);
        if (m) {
          await r.handler(req, res, m);
          return;
        }
      }
      throw new ApiError(404, 'not_found', 'Rota não encontrada.');
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      throw new ApiError(405, 'method_not_allowed', 'Método não permitido.');
    }
    serveStatic(req, res, pathname);
  } catch (err) {
    if (err instanceof ApiError) {
      sendJson(res, err.status, { error: { code: err.code, message: err.message } });
    } else {
      console.error(err);
      sendJson(res, 500, { error: { code: 'internal', message: 'Erro interno.' } });
    }
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`TaskForge rodando em http://localhost:${PORT}`);
  });
}

module.exports = { server };
