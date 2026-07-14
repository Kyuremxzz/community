'use strict';
/** Testes de integração da API TaskForge (node --test, zero dependências). */
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const tmpDb = path.join(os.tmpdir(), `taskforge-test-${process.pid}-${Date.now()}.db`);
process.env.TASKFORGE_DB = tmpDb;

const { server } = require('../server/server');

let base;

before(async () => {
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(tmpDb + suffix); } catch {}
  }
});

async function api(method, pathname, { token, body } = {}) {
  const res = await fetch(base + pathname, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

test('registro cria usuário e devolve token', async () => {
  const r = await api('POST', '/api/auth/register', {
    body: { name: 'Novato Um', email: 'novato1@test.dev', password: 'senha123' },
  });
  assert.equal(r.status, 201);
  assert.ok(r.json.token);
  assert.equal(r.json.user.freeProjectUsed, false);
  assert.equal(r.json.user.subscribed, false);
});

test('registro rejeita e-mail duplicado e senha curta', async () => {
  const dup = await api('POST', '/api/auth/register', {
    body: { name: 'Novato Um', email: 'novato1@test.dev', password: 'senha123' },
  });
  assert.equal(dup.status, 409);
  const short = await api('POST', '/api/auth/register', {
    body: { name: 'X Y', email: 'curto@test.dev', password: '123' },
  });
  assert.equal(short.status, 400);
});

test('login com credenciais corretas e incorretas', async () => {
  const ok = await api('POST', '/api/auth/login', {
    body: { email: 'demo@taskforge.dev', password: 'demo123' },
  });
  assert.equal(ok.status, 200);
  assert.ok(ok.json.token);
  const bad = await api('POST', '/api/auth/login', {
    body: { email: 'demo@taskforge.dev', password: 'errada' },
  });
  assert.equal(bad.status, 401);
});

test('rotas protegidas exigem token', async () => {
  const r = await api('GET', '/api/me');
  assert.equal(r.status, 401);
});

test('catálogo lista projetos do seed com funções por projeto', async () => {
  const r = await api('GET', '/api/projects');
  assert.equal(r.status, 200);
  assert.ok(r.json.projects.length >= 6);
  const roleSets = r.json.projects.map((p) => p.roles.join(','));
  // Funções variam por projeto (não são lista fixa do sistema)
  assert.ok(new Set(roleSets).size > 1);
  const p1 = r.json.projects.find((p) => p.title === 'Pixel Pomodoro');
  assert.equal(p1.difficulty, 'iniciante');
  assert.equal(p1.deadlineWeeks, 1);
});

test('fluxo completo: entrar na vaga, completar squad, prazo começa, entregar', async () => {
  const reg = await api('POST', '/api/auth/register', {
    body: { name: 'Fluxo Total', email: 'fluxo@test.dev', password: 'senha123' },
  });
  const token = reg.json.token;

  // Pixel Pomodoro tem 1 de 2 vagas ocupadas no seed
  const list = await api('GET', '/api/projects');
  const proj = list.json.projects.find((p) => p.title === 'Pixel Pomodoro');
  const detail = await api('GET', `/api/projects/${proj.id}`, { token });
  const squad = detail.json.project.squads[0];
  assert.equal(squad.status, 'forming');
  const free = squad.slots.find((s) => s.userId == null);
  assert.ok(free);

  const join = await api('POST', `/api/slots/${free.id}/join`, { token });
  assert.equal(join.status, 200);
  assert.equal(join.json.deadlineStarted, true, 'squad completo deve iniciar o prazo');
  assert.equal(join.json.squad.status, 'active');
  const expected = 7 * 86400000;
  const delta = join.json.squad.deadlineEndsAt - join.json.squad.deadlineStartedAt;
  assert.equal(delta, expected, 'prazo de projeto iniciante = 1 semana');

  // sair depois de ativo é proibido
  const mySlot = join.json.squad.slots.find((s) => s.mine);
  const leave = await api('POST', `/api/slots/${mySlot.id}/leave`, { token });
  assert.equal(leave.status, 409);

  // entrega: URL inválida rejeitada, GitHub aceita
  const badUrl = await api('POST', `/api/squads/${squad.id}/deliver`, {
    token, body: { repoUrl: 'https://gitlab.com/x/y' },
  });
  assert.equal(badUrl.status, 400);
  const deliver = await api('POST', `/api/squads/${squad.id}/deliver`, {
    token, body: { repoUrl: 'https://github.com/fluxo/pixel-pomodoro' },
  });
  assert.equal(deliver.status, 200);
  assert.equal(deliver.json.showGithubTutorial, true);
  assert.equal(deliver.json.squad.status, 'delivered');
  assert.equal(deliver.json.squad.deliveredLate, false);

  // entregar duas vezes é proibido
  const again = await api('POST', `/api/squads/${squad.id}/deliver`, {
    token, body: { repoUrl: 'https://github.com/fluxo/outro' },
  });
  assert.equal(again.status, 409);
});

test('paywall: segundo projeto exige assinatura; assinar libera', async () => {
  const reg = await api('POST', '/api/auth/register', {
    body: { name: 'Pagante Teste', email: 'pagante@test.dev', password: 'senha123' },
  });
  const token = reg.json.token;

  const list = await api('GET', '/api/projects');
  const p2 = list.json.projects.find((p) => p.title === 'API de Receitas');
  const p4 = list.json.projects.find((p) => p.title === 'Chat em Tempo Real');

  // 1º projeto: grátis
  const d2 = await api('GET', `/api/projects/${p2.id}`, { token });
  const freeSlot2 = d2.json.project.squads[0].slots.find((s) => s.userId == null);
  const j1 = await api('POST', `/api/slots/${freeSlot2.id}/join`, { token });
  assert.equal(j1.status, 200);

  const me = await api('GET', '/api/me', { token });
  assert.equal(me.json.user.freeProjectUsed, true);

  // 2º projeto: bloqueado com 402
  const d4 = await api('GET', `/api/projects/${p4.id}`, { token });
  const freeSlot4 = d4.json.project.squads[0].slots.find((s) => s.userId == null);
  const j2 = await api('POST', `/api/slots/${freeSlot4.id}/join`, { token });
  assert.equal(j2.status, 402);
  assert.equal(j2.json.error.code, 'paywall');

  // mesma vaga no MESMO projeto (outro squad) não é "novo projeto"
  const newSquad = await api('POST', `/api/projects/${p2.id}/squads`, { token, body: {} });
  assert.equal(newSquad.status, 201);

  // assinar libera o segundo projeto
  const sub = await api('POST', '/api/me/subscribe', { token });
  assert.equal(sub.json.user.subscribed, true);
  const j3 = await api('POST', `/api/slots/${freeSlot4.id}/join`, { token });
  assert.equal(j3.status, 200);
});

test('vaga ocupada não pode ser tomada; mesmo usuário não ocupa 2 vagas no squad', async () => {
  const a = await api('POST', '/api/auth/register', {
    body: { name: 'User A', email: 'usera@test.dev', password: 'senha123' },
  });
  const b = await api('POST', '/api/auth/register', {
    body: { name: 'User B', email: 'userb@test.dev', password: 'senha123' },
  });

  const list = await api('GET', '/api/projects');
  const p5 = list.json.projects.find((p) => p.title === 'Marketplace Solidário');
  const d = await api('GET', `/api/projects/${p5.id}`);
  const slots = d.json.project.squads[0].slots.filter((s) => s.userId == null);
  assert.ok(slots.length >= 2);

  const jA = await api('POST', `/api/slots/${slots[0].id}/join`, { token: a.json.token });
  assert.equal(jA.status, 200);
  const jB = await api('POST', `/api/slots/${slots[0].id}/join`, { token: b.json.token });
  assert.equal(jB.status, 409);
  const jA2 = await api('POST', `/api/slots/${slots[1].id}/join`, { token: a.json.token });
  assert.equal(jA2.status, 409);
  assert.equal(jA2.json.error.code, 'already_in_squad');
});

test('criar projeto define funções próprias e valida prazo por dificuldade', async () => {
  const reg = await api('POST', '/api/auth/register', {
    body: { name: 'Criadora', email: 'criadora@test.dev', password: 'senha123' },
  });
  const token = reg.json.token;

  const bad = await api('POST', '/api/projects', {
    token,
    body: { title: 'Projeto X', description: 'descrição válida aqui', difficulty: 'iniciante', deadlineWeeks: 3, roles: ['A', 'B'] },
  });
  assert.equal(bad.status, 400);

  const ok = await api('POST', '/api/projects', {
    token,
    body: {
      title: 'Compilador de Brincadeira',
      description: 'Mini linguagem com parser e VM de brinquedo.',
      difficulty: 'avancado',
      deadlineWeeks: 3,
      roles: ['Parser', 'VM', 'Docs'],
    },
  });
  assert.equal(ok.status, 201);
  assert.deepEqual(ok.json.project.roles, ['Parser', 'VM', 'Docs']);
  assert.equal(ok.json.project.squads[0].slotsTotal, 3);
  assert.equal(ok.json.project.deadlineWeeks, 3);

  // deadlineWeeks decimal deve ser rejeitado com 400, não cair num default silencioso
  const decimal = await api('POST', '/api/projects', {
    token,
    body: { title: 'Projeto Decimal', description: 'descrição válida aqui', difficulty: 'avancado', deadlineWeeks: 3.5, roles: ['A', 'B'] },
  });
  assert.equal(decimal.status, 400);
  assert.equal(decimal.json.error.code, 'invalid_deadline');

  // deadlineWeeks fora do conjunto permitido para a dificuldade também é 400
  const outOfSet = await api('POST', '/api/projects', {
    token,
    body: { title: 'Projeto Fora', description: 'descrição válida aqui', difficulty: 'avancado', deadlineWeeks: 5, roles: ['A', 'B'] },
  });
  assert.equal(outOfSet.status, 400);

  // omitir deadlineWeeks usa o padrão da dificuldade, sem erro
  const omitted = await api('POST', '/api/projects', {
    token,
    body: { title: 'Projeto Padrão', description: 'descrição válida aqui', difficulty: 'iniciante', roles: ['A', 'B'] },
  });
  assert.equal(omitted.status, 201);
  assert.equal(omitted.json.project.deadlineWeeks, 1);

  const badRoles = await api('POST', '/api/projects', {
    token,
    body: { title: 'Projeto Y', description: 'descrição válida aqui', difficulty: 'iniciante', deadlineWeeks: 1, roles: ['Solo'] },
  });
  assert.equal(badRoles.status, 400);

  // roles duplicadas são rejeitadas (não deduplicadas silenciosamente)
  const dupRoles = await api('POST', '/api/projects', {
    token,
    body: { title: 'Projeto Duplicado', description: 'descrição válida aqui', difficulty: 'iniciante', deadlineWeeks: 1, roles: ['Frontend', 'Frontend', 'Backend'] },
  });
  assert.equal(dupRoles.status, 400);
  assert.equal(dupRoles.json.error.code, 'invalid_roles');

  // deadlineWeeks precisa ser number de verdade — booleano/string numérica não é aceito por coerção
  const boolWeeks = await api('POST', '/api/projects', {
    token,
    body: { title: 'Projeto Booleano', description: 'descrição válida aqui', difficulty: 'iniciante', deadlineWeeks: true, roles: ['A', 'B'] },
  });
  assert.equal(boolWeeks.status, 400);
  assert.equal(boolWeeks.json.error.code, 'invalid_deadline');
});

test('não-membro não entrega; squad em formação não entrega', async () => {
  const reg = await api('POST', '/api/auth/register', {
    body: { name: 'Intruso', email: 'intruso@test.dev', password: 'senha123' },
  });
  const token = reg.json.token;
  const list = await api('GET', '/api/projects');
  const p3 = list.json.projects.find((p) => p.title === 'Placar de Torneios');
  const d = await api('GET', `/api/projects/${p3.id}`);
  const squadActive = d.json.project.squads.find((s) => s.status === 'active');
  const r = await api('POST', `/api/squads/${squadActive.id}/deliver`, {
    token, body: { repoUrl: 'https://github.com/x/y' },
  });
  assert.equal(r.status, 403);
});

test('paywall é vitalício: sair de uma vaga em formação não devolve o projeto grátis', async () => {
  // Usa projetos criados na hora (2 vagas cada) para não depender do estado
  // que outros testes já deixaram nos projetos do seed.
  const reg = await api('POST', '/api/auth/register', {
    body: { name: 'Escapista', email: 'escapista@test.dev', password: 'senha123' },
  });
  const token = reg.json.token;

  const projA = await api('POST', '/api/projects', {
    token, body: { title: 'Projeto Fuga A', description: 'projeto isolado para teste de paywall', difficulty: 'iniciante', roles: ['Um', 'Dois'] },
  });
  const projB = await api('POST', '/api/projects', {
    token, body: { title: 'Projeto Fuga B', description: 'projeto isolado para teste de paywall', difficulty: 'iniciante', roles: ['Um', 'Dois'] },
  });
  assert.equal(projA.status, 201);
  assert.equal(projB.status, 201);
  const slotA = projA.json.project.squads[0].slots[0];
  const slotB = projB.json.project.squads[0].slots[0];

  // ocupa uma vaga no projeto A (grátis) e depois sai (squad ainda em formação, só 1/2 vagas)
  const j1 = await api('POST', `/api/slots/${slotA.id}/join`, { token });
  assert.equal(j1.status, 200);
  const mySlot = j1.json.squad.slots.find((s) => s.mine);
  const leave = await api('POST', `/api/slots/${mySlot.id}/leave`, { token });
  assert.equal(leave.status, 200);

  const me = await api('GET', '/api/me', { token });
  assert.equal(me.json.user.freeProjectUsed, true, 'crédito grátis já foi consumido, mesmo tendo saído da vaga');

  // tentar entrar de graça num projeto B (nunca visitado) deve ser bloqueado
  const j2 = await api('POST', `/api/slots/${slotB.id}/join`, { token });
  assert.equal(j2.status, 402);
  assert.equal(j2.json.error.code, 'paywall');

  // voltar a entrar no MESMO projeto A (já visitado) continua liberado sem assinatura
  const j3 = await api('POST', `/api/slots/${slotA.id}/join`, { token });
  assert.equal(j3.status, 200, 'reentrar num projeto já visitado não deve ser cobrado de novo');
});

test('entrega só aceita host github.com exato, sem userinfo e com exatamente owner/repo', async () => {
  // Projeto isolado com 2 vagas preenchidas por 2 usuários distintos, para chegar a squad 'active'.
  const owner = await api('POST', '/api/auth/register', {
    body: { name: 'Repo Rigoroso', email: 'repo-rigoroso@test.dev', password: 'senha123' },
  });
  const mate = await api('POST', '/api/auth/register', {
    body: { name: 'Colega Repo', email: 'colega-repo@test.dev', password: 'senha123' },
  });
  const ownerToken = owner.json.token;

  const proj = await api('POST', '/api/projects', {
    token: ownerToken, body: { title: 'Projeto Entrega Rigorosa', description: 'projeto isolado para teste de repoUrl', difficulty: 'iniciante', roles: ['Um', 'Dois'] },
  });
  const [slot1, slot2] = proj.json.project.squads[0].slots;
  const j1 = await api('POST', `/api/slots/${slot1.id}/join`, { token: ownerToken });
  const j2 = await api('POST', `/api/slots/${slot2.id}/join`, { token: mate.json.token });
  assert.equal(j2.status, 200);
  assert.equal(j2.json.squad.status, 'active', 'squad com 2/2 vagas deveria estar ativo');
  const squadId = j2.json.squad.id;

  const cases = [
    'https://gist.github.com/owner/repo',
    'https://github.com/owner/repo/extra',
    'https://github.com/owner',
    'https://user:pw@github.com/owner/repo',
    'http://github.com/owner/repo',
    'https://github.com.evil.io/owner/repo',
  ];
  for (const repoUrl of cases) {
    const r = await api('POST', `/api/squads/${squadId}/deliver`, { token: ownerToken, body: { repoUrl } });
    assert.equal(r.status, 400, `deveria rejeitar ${repoUrl}`);
  }

  const ok = await api('POST', `/api/squads/${squadId}/deliver`, {
    token: ownerToken, body: { repoUrl: 'https://github.com/owner/repo' },
  });
  assert.equal(ok.status, 200);
});

test('static: path traversal fora de public/ é bloqueado', async () => {
  const res = await fetch(base + '/..%2f..%2fserver%2fserver.js');
  assert.ok([403, 404].includes(res.status), `esperado 403/404, veio ${res.status}`);
  const text = await res.text();
  assert.ok(!text.includes('require('), 'não deve vazar o código-fonte do servidor');
});
