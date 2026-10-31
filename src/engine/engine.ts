import {
  Action,
  Card,
  CardDef,
  Config,
  Cost,
  Effect,
  Game,
  Kind,
  Llama,
  Offer,
  Payment,
  PendingOption,
  Player,
  Resource,
  Task,
  resources,
  ENGINE_VERSION,
  Profile,
} from './types';
import { ageNames, kindNames, resourceNames, profileFallback } from '../content/catalog';
import { fingerprint, validateConfig } from './config';
export const emptyResources = (): Llama['resources'] => ({
  food: 0,
  study: 0,
  chaos: 0,
  bomb: 0,
  evil: 0,
});
export function seedNumber(seed: string): number {
  let h = 2166136261;
  for (const c of seed) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0 || 1;
}
export function random(g: Game, bot = false): number {
  const key = bot ? 'botRng' : 'rng';
  let t = (g[key] += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  g[key] >>>= 0;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle<T>(g: Game, a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random(g) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function definition(g: Game, c: Card | string): CardDef {
  const id = typeof c === 'string' ? c : c.def;
  const d = g.config.cards.find((x) => x.id === id);
  if (!d) throw Error(`Carta desconocida: ${id}`);
  return d;
}
export function total(p: Player, r: Resource): number {
  return p.llamas.reduce((n, l) => n + l.resources[r], 0);
}
export function adults(p: Player): number {
  return p.llamas.filter((l) => l.age === 2 && l.kind !== 'holy').length;
}
export function log(
  g: Game,
  type: string,
  text: string,
  data?: Record<string, unknown>,
  parent?: number,
) {
  const id = g.events.length;
  g.events.push({
    id,
    turn: g.turn,
    round: g.round,
    actor: g.active,
    type,
    text,
    data,
    parent: parent ?? null,
  });
  return id;
}
export function newLlama(g: Game): Llama {
  return { id: `L${g.nextId++}`, age: 0, kind: null, resources: emptyResources() };
}
function locate(g: Game, id?: string) {
  for (const p of g.players) {
    const l = p.llamas.find((x) => x.id === id);
    if (l) return { p, l };
  }
  return null;
}
export function hasPower(g: Game, p: Player, key: string): boolean {
  return (
    p.powers.some((x) => x.key === key && (x.expires === null || x.expires === g.turn)) &&
    (key !== 'blessing' || p.llamas.some((l) => l.kind === 'holy' && l.age === 2))
  );
}
function hasResearch(g: Game, p: Player, key: string) {
  return (
    p.research.includes(key) &&
    (g.config.researchPersists || p.llamas.some((l) => l.kind === 'scholar' && l.age === 2))
  );
}
function feedSource(kind: Kind): string {
  return kind === 'glutton'
    ? 'food'
    : kind === 'scholar'
      ? 'study'
      : kind === 'crazy'
        ? 'chaos'
        : kind === 'holy'
          ? 'mushroom'
          : 'free';
}
function compatible(p: Player, l: Llama, kind: Kind) {
  return (
    (l.kind === kind || l.age === 0) &&
    !(kind === 'holy' && p.llamas.some((x) => x.kind === 'evil')) &&
    !(kind === 'evil' && p.llamas.some((x) => x.kind === 'holy'))
  );
}
function groupCompatible(p: Player, incoming: Llama, remove?: string) {
  return !p.llamas.some(
    (l) =>
      l.id !== remove &&
      ((l.kind === 'holy' && incoming.kind === 'evil') ||
        (l.kind === 'evil' && incoming.kind === 'holy')),
  );
}
function room(g: Game, p: Player, swap = false) {
  return swap || g.config.groupLimit === null || p.llamas.length < g.config.groupLimit;
}
function permission(g: Game, p: Player, l: Llama, source: string): string | null {
  if (p.id !== g.active) return null;
  if (!g.growthUsed) return 'global';
  if (
    ['food', 'study', 'chaos', 'free'].includes(source) &&
    hasPower(g, p, 'blessing') &&
    !g.grown.includes(l.id)
  )
    return 'blessing';
  if (source === 'banquet' && !g.exceptionCounts[`banquet:${l.id}`]) return 'banquet';
  if (source === 'explosion' && hasPower(g, p, 'thesis') && !g.grown.includes(l.id))
    return 'thesis';
  if (
    source === 'explosion' &&
    g.config.explosionExtra &&
    !g.grown.includes(l.id) &&
    !g.exceptionCounts.explosion
  )
    return 'explosion';
  return null;
}
function canFeed(g: Game, p: Player, l: Llama, kind: Kind, source: string) {
  return compatible(p, l, kind) && (l.age !== 0 || !!permission(g, p, l, source));
}
function grow(g: Game, p: Player, l: Llama, source: string, enabled = true) {
  if (l.age === 2 || !enabled) return;
  const permit = permission(g, p, l, source);
  if (!permit) return;
  l.age = (l.age + 1) as 1 | 2;
  if (permit === 'global') g.growthUsed = true;
  else {
    g.exceptionCounts[permit] = (g.exceptionCounts[permit] || 0) + 1;
    g.exceptionCounts[`${permit}:${l.id}`] = (g.exceptionCounts[`${permit}:${l.id}`] || 0) + 1;
    g.extraGrown.push(l.id);
  }
  g.grown.push(l.id);
  log(
    g,
    'growth',
    `${p.name}: ${l.id} crece a ${ageNames[l.age]} (${permit === 'global' ? 'subida del turno' : `permiso ${permit}`}).`,
    { llama: l.id, permission: permit },
  );
}
function checkWin(g: Game) {
  const winner = g.players.find((p) => adults(p) >= g.config.target);
  if (winner) {
    g.winner = winner.id;
    g.phase = 'finished';
    g.pending = null;
    g.queue = [];
    log(g, 'victory', `${winner.name} reúne ${adults(winner)} adultas y gana.`);
  }
}
function discard(g: Game, c: Card, cause = 'played') {
  const d = definition(g, c);
  if (d.category === 'power' && cause === 'activated') g.out.push(c);
  else if (g.config.deferredFeed && cause === 'feed')
    g.aside.push({ card: c, release: g.turn + 1 });
  else g.discard.push(c);
  log(
    g,
    'cardZone',
    `${d.name}: ${cause === 'feed' && g.config.deferredFeed ? 'apartada hasta el próximo turno' : 'sale de la mano'}.`,
    { card: c.id, cause },
  );
}
function draw(g: Game, p: Player, n: number) {
  let got = 0;
  for (let i = 0; i < n; i++) {
    if (!g.deck.length && g.discard.length) {
      g.deck = shuffle(g, g.discard.splice(0));
      log(g, 'recycle', 'Se baraja el descarte disponible.');
    }
    const c = g.deck.pop();
    if (!c) break;
    p.hand.push(c);
    got++;
    if (g.config.autoEvents && definition(g, c).category === 'event') {
      const d = definition(g, c);
      if (!d.cost || !Object.values(d.cost).some(Boolean)) {
        p.hand.pop();
        discard(g, c);
        g.queue.push({ op: 'autoEvent', player: p.id, card: c });
      }
    }
  }
  if (got)
    log(g, 'draw', `${p.name} roba ${got} carta${got === 1 ? '' : 's'}.`, {
      player: p.id,
      count: got,
    });
}
function beginActions(g: Game) {
  g.phase = 'actions';
  const p = g.players[g.active];
  draw(g, p, g.config.draw + (hasResearch(g, p, 'farm') ? g.config.farmDraw : 0));
  if (g.queue.length) g.phase = 'resolving';
  log(g, 'actions', 'Comienzan las acciones libres.');
}
function beginTurn(g: Game) {
  g.turn++;
  g.turnActions = 0;
  g.growthUsed = false;
  g.grown = [];
  g.extraGrown = [];
  g.exceptionCounts = {};
  g.extraScheduled = false;
  g.window = null;
  g.phase = 'recruit';
  const released = g.aside.filter((x) => x.release <= g.turn);
  g.aside = g.aside.filter((x) => x.release > g.turn);
  g.discard.push(...released.map((x) => x.card));
  for (const p of g.players)
    p.powers = p.powers.filter((x) => x.expires === null || x.expires >= g.turn);
  if (!g.extra) g.normalTurns++;
  log(g, 'turn', `Turno ${g.turn}: ${g.players[g.active].name}${g.extra ? ' (extra)' : ''}.`);
}
export function createGame(
  config: Config,
  players: { name: string; controller: 'human' | 'bot'; profile: Profile }[],
  seed = 'altiplano',
  start = 0,
): Game {
  const result = validateConfig(config);
  if (!result.config) throw Error(result.errors.join('\n'));
  if (players.length < 2 || players.length > 4) throw Error('Se necesitan 2 a 4 jugadores.');
  const g: Game = {
    version: ENGINE_VERSION,
    config: structuredClone(config),
    fingerprint: fingerprint(config),
    seed,
    rng: seedNumber(seed),
    botRng: seedNumber(seed + 'bot'),
    players: players.map((p, id) => ({
      ...p,
      id,
      profile: profileFallback(p.profile, config) ? 'breeder' : p.profile,
      hand: [],
      llamas: [],
      research: [],
      powers: [],
      used: {},
      raids: 0,
      crazyFeeds: 0,
    })),
    deck: [],
    discard: [],
    out: [],
    aside: [],
    market: [],
    plans: [],
    reserve: config.reserve,
    nextId: 1,
    turn: 0,
    round: 1,
    active: start,
    phase: 'recruit',
    growthUsed: false,
    grown: [],
    extraGrown: [],
    exceptionCounts: {},
    extra: false,
    extraScheduled: false,
    pendingExtra: [],
    queue: [],
    pending: null,
    winner: null,
    events: [],
    commands: [],
    exploratory: false,
    window: null,
    turnActions: 0,
    normalTurns: 0,
  };
  if (start < 0) g.active = Math.floor(random(g) * players.length);
  if (g.active >= players.length) throw Error('Asiento inicial inválido.');
  for (const d of config.cards) {
    const n = config.market && d.category === 'power' ? (d.copies ? 1 : 0) : d.copies;
    for (let i = 0; i < n; i++) {
      const card = { id: `C${g.nextId++}`, def: d.id };
      if (config.market && d.category === 'power') g.market.push(card);
      else g.deck.push(card);
    }
  }
  shuffle(g, g.deck);
  for (const p of g.players) {
    for (let i = 0; i < config.initialLlamas; i++) {
      if (g.reserve === 0) break;
      p.llamas.push(newLlama(g));
      if (g.reserve !== null) g.reserve--;
    }
    draw(g, p, config.initialHand);
  }
  beginTurn(g);
  return g;
}
export function costFor(g: Game, d: CardDef, a: Action): Cost {
  if (d.id === 'spit' && a.mode === 'bomb') return { bomb: d.cost.chaos ?? 1 };
  const cost = { ...d.cost };
  if (d.effects.some((e) => e.op === 'steal' && e.key === 'hand') && a.mode === 'select')
    cost.study = (cost.study || 0) + 1;
  if (d.id === 'reject' && g.config.rejectionCost)
    cost.chaos = (cost.chaos || 0) + g.config.rejectionCost;
  return cost;
}
export function defaultPayment(p: Player, cost: Cost): Payment | null {
  const pay: Payment = [];
  for (const r of resources) {
    let need = cost[r] || 0;
    for (const l of p.llamas) {
      const amount = Math.min(need, l.resources[r]);
      if (amount) {
        pay.push({ llama: l.id, resource: r, amount });
        need -= amount;
      }
    }
    if (need) return null;
  }
  return pay;
}
export function validatePayment(p: Player, cost: Cost, payment: Payment): string | null {
  const amounts: Record<string, number> = {};
  const sums: Cost = {};
  for (const x of payment) {
    if (!resources.includes(x.resource) || !Number.isInteger(x.amount) || x.amount <= 0)
      return 'Pago inválido.';
    const l = p.llamas.find((l) => l.id === x.llama);
    if (!l) return 'La fuente del pago ya no existe.';
    const key = x.llama + x.resource;
    amounts[key] = (amounts[key] || 0) + x.amount;
    if (amounts[key] > l.resources[x.resource])
      return `Falta ${resourceNames[x.resource]} en ${l.id}.`;
    sums[x.resource] = (sums[x.resource] || 0) + x.amount;
  }
  for (const r of resources)
    if ((sums[r] || 0) !== (cost[r] || 0))
      return `El pago de ${resourceNames[r]} no coincide con el coste.`;
  return null;
}
function pay(g: Game, p: Player, cost: Cost, payment?: Payment) {
  const chosen = payment ?? defaultPayment(p, cost);
  if (!chosen) throw Error('Faltan recursos.');
  const err = validatePayment(p, cost, chosen);
  if (err) throw Error(err);
  for (const x of chosen) p.llamas.find((l) => l.id === x.llama)!.resources[x.resource] -= x.amount;
  if (chosen.length)
    log(
      g,
      'payment',
      `${p.name} paga ${chosen.map((x) => `${x.amount} ${resourceNames[x.resource]} de ${x.llama}`).join(', ')}.`,
      { payment: chosen },
    );
}
export function requirementError(g: Game, p: Player, d: CardDef): string | null {
  const r = d.requirements,
    group = p.llamas.filter((l) => !r.kind || l.kind === r.kind);
  if (r.adults && group.filter((l) => l.age === 2).length < r.adults)
    return `Necesitas ${r.adults} adulta(s) ${r.kind ? kindNames[r.kind] : ''}.`;
  if (r.count && group.length < r.count) return `Necesitas ${r.count} llamas compatibles.`;
  if (r.secondKind && !p.llamas.some((l) => l.kind === r.secondKind && l.age >= 1))
    return `Necesitas una ${kindNames[r.secondKind]} joven o adulta.`;
  if (r.raids && p.raids < r.raids) return `Necesitas ${r.raids} saqueos exitosos.`;
  if (r.feeds && p.crazyFeeds < r.feeds) return `Necesitas ${r.feeds} alimentaciones de loca.`;
  if (d.limit && (p.used[d.id] || 0) >= d.limit)
    return 'Ya alcanzaste el límite de activaciones de esta carta.';
  if (d.category === 'research' && p.research.includes(d.effects[0]?.key || d.id))
    return 'Investigación única ya instalada.';
  return null;
}
function targetError(g: Game, p: Player, d: CardDef, a: Action): string | null {
  const own = p.llamas.find((l) => l.id === a.target);
  const enemy = g.players.find((x) => x.id === a.enemy && x.id !== p.id);
  const rival = enemy?.llamas.find((l) => l.id === (d.targets === 'pair' ? a.other : a.target));
  for (const e of d.effects) {
    if (e.op === 'feed') {
      if (!own) return 'Elige una llama propia.';
      if (!canFeed(g, p, own, e.kind!, feedSource(e.kind!)))
        return own.age === 0 && g.growthUsed
          ? 'Ya usaste la subida de este turno. La bebé necesita permiso.'
          : 'Tipo incompatible o incompatibilidad santa/malvada.';
      if (a.grow === false && own.age === 0) return 'Una bebé debe crecer para especializarse.';
    }
    if (e.op === 'explosion' && (!own || !canFeed(g, p, own, 'explosive', 'explosion')))
      return 'Elige una bebé con permiso o una explosiva propia.';
    if (e.op === 'steal' && e.key === 'raid') {
      if (!enemy || !rival) return 'Elige una llama rival.';
      if (a.mode === 'baby') {
        if (rival.age !== 0 || !room(g, p))
          return 'El objetivo debe ser una bebé y debe haber espacio.';
        const receiver = a.target === 'stolen' ? rival : own;
        if (!receiver || !canFeed(g, p, receiver, 'evil', 'raid'))
          return 'No hay receptora válida para activar malvada.';
      } else {
        if (!own || !canFeed(g, p, own, 'evil', 'raid'))
          return 'Elige una receptora propia compatible.';
        if (!resources.includes(a.mode as Resource) || rival.resources[a.mode as Resource] < 1)
          return 'Ese recurso no existe en el objetivo.';
      }
    }
    if (
      e.op === 'steal' &&
      e.key === 'conversion' &&
      (!rival || rival.age === 0 || !groupCompatible(p, rival) || !room(g, p))
    )
      return 'Elige una joven o adulta compatible y con espacio.';
    if (e.op === 'steal' && e.key === 'hand' && (!enemy || !enemy.hand.length))
      return 'El rival no tiene cartas.';
    if (e.op === 'age' && e.target === 'enemy' && (!rival || rival.age !== 2))
      return 'Elige una adulta rival.';
    if (e.op === 'return' && (!rival || rival.age !== 0)) return 'Elige una bebé rival.';
    if (
      e.op === 'swap' &&
      (!own ||
        !rival ||
        rival.age <= own.age ||
        !groupCompatible(p, rival, own.id) ||
        !groupCompatible(enemy!, own, rival.id))
    )
      return 'Intercambia por una rival mayor y respeta santa/malvada en ambos grupos.';
    if (e.op === 'connection' && e.key === 'chaos' && (!own || own.id === g.window?.llama))
      return 'Elige otra llama propia.';
    if (
      e.op === 'connection' &&
      e.key === 'leftovers' &&
      (!own || own.age !== 1 || own.id === g.window?.llama)
    )
      return 'Elige otra joven propia.';
  }
  for (const e of d.effects) {
    if (
      ['spend', 'transfer'].includes(e.op) &&
      (!own || !e.resource || own.resources[e.resource] < (e.amount ?? 1))
    )
      return 'Faltan recursos en la llama de origen.';
    if (e.op === 'transfer' && !p.llamas.some((l) => l.id !== own?.id))
      return 'No hay otra llama propia a la que transferir.';
  }
  if (d.targets === 'own' && !own) return 'Elige una llama propia.';
  if (d.triggers.includes('afterChaos') && g.window?.kind !== 'chaos')
    return 'Solo inmediatamente después de resolver loca.';
  if (d.triggers.includes('afterExplosion') && g.window?.kind !== 'explosion')
    return 'Solo desde la nueva mano tras explosión.';
  if (d.triggers.includes('afterFeed') && !['feed', 'chaos'].includes(g.window?.kind || ''))
    return 'Solo después de alimentar con carta.';
  if (d.id === 'meditate' && g.config.meditation === 'extra' && (g.extra || g.extraScheduled))
    return 'No se puede programar otro turno extra.';
  return null;
}
function needsFence(g: Game, d: CardDef, a: Action) {
  const enemy = g.players[a.enemy ?? -1];
  return (
    !!enemy &&
    hasResearch(g, enemy, 'fence') &&
    d.effects.some(
      (e) =>
        e.op === 'steal' && ((e.key === 'raid' && a.mode === 'baby') || e.key === 'conversion'),
    )
  );
}
export function actionError(g: Game, a: Action): string | null {
  if (g.phase === 'finished') return 'La partida terminó.';
  if (g.pending)
    return a.type === 'choose' && g.pending.options.some((x) => x.id === a.choice)
      ? null
      : 'Debes resolver la elección pendiente.';
  if (g.phase === 'resolving')
    return a.type === 'resume' ? null : 'La resolución está en pausa técnica.';
  const p = g.players[g.active];
  if (g.phase === 'recruit') {
    if (a.type === 'skipRecruit') return null;
    if (a.type !== 'recruit') return 'Primero incorpora una bebé u omite.';
    if (g.reserve === 0) return 'La reserva está vacía.';
    if (!room(g, p)) return 'No queda espacio en el grupo.';
    return null;
  }
  if (a.type === 'end') return null;
  if (a.type === 'abandon') {
    const plan = g.plans.find((x) => x.card.id === a.card && x.player === p.id);
    return plan &&
      g.normalTurns >= plan.readyRound &&
      requirementError(g, p, definition(g, plan.card))
      ? null
      : 'Solo se pierde un plan listo cuyos requisitos se perdieron.';
  }
  if (a.type === 'recover') {
    if (!hasPower(g, p, 'thesis') || g.window?.kind !== 'explosion')
      return 'La recuperación requiere Tesis después de Explosión.';
    if (!recoverable(g).some((c) => c.id === a.card)) return 'Carta no recuperable.';
    return validatePayment(
      p,
      { study: g.config.thesisRecovery },
      a.payment ?? defaultPayment(p, { study: g.config.thesisRecovery }) ?? [],
    );
  }
  const c =
    a.type === 'claim'
      ? g.market.find((c) => c.id === a.card)
      : a.type === 'activate'
        ? g.plans.find((x) => x.card.id === a.card && x.player === p.id)?.card
        : p.hand.find((c) => c.id === a.card);
  if (!c) return 'La carta no está disponible.';
  const d = definition(g, c);
  if (d.category === 'reaction') return 'Alarma solo se juega en una ventana de ataque.';
  if (a.type === 'activate') {
    const plan = g.plans.find((x) => x.card.id === c.id)!;
    if (g.normalTurns < plan.readyRound)
      return 'Preparación pendiente: debe transcurrir una vuelta normal completa.';
  }
  if (g.config.announce && d.category === 'power' && a.type !== 'activate') return null;
  const req = requirementError(g, p, d);
  if (req) return req;
  const target = targetError(g, p, d, a);
  if (target) return target;
  if (needsFence(g, d, a) && p.hand.filter((x) => x.def === d.id).length < g.config.fenceCopies)
    return `Valla exige ${g.config.fenceCopies} cartas iguales del ataque.`;
  const cost = costFor(g, d, a);
  if (!a.payment) {
    const missing = resources.find((r) => total(p, r) < (cost[r] || 0));
    if (missing) return `Falta ${resourceNames[missing]}.`;
  }
  return validatePayment(p, cost, a.payment ?? defaultPayment(p, cost) ?? []);
}
function templates(g: Game, c: Card, type: Action['type']): Action[] {
  const d = definition(g, c),
    p = g.players[g.active],
    base: Action = { type, card: c.id };
  if (g.config.announce && d.category === 'power' && type !== 'activate') return [base];
  const out: Action[] = [];
  const feed = d.effects.find((e) => e.op === 'feed');
  if (d.targets === 'none') return [base];
  if (d.targets === 'own') {
    for (const l of p.llamas) {
      out.push({ ...base, target: l.id });
      if (feed && l.age > 0 && l.age < 2) out.push({ ...base, target: l.id, grow: false });
    }
    return out;
  }
  for (const enemy of g.players.filter((x) => x.id !== p.id)) {
    if (d.effects.some((e) => e.op === 'steal' && e.key === 'hand')) {
      out.push(
        { ...base, enemy: enemy.id, mode: 'random' },
        { ...base, enemy: enemy.id, mode: 'select' },
      );
      continue;
    }
    for (const l of enemy.llamas) {
      if (d.effects.some((e) => e.op === 'steal' && e.key === 'raid')) {
        for (const own of p.llamas)
          for (const mode of ['baby', ...resources])
            out.push({ ...base, enemy: enemy.id, target: own.id, other: l.id, mode });
        out.push({ ...base, enemy: enemy.id, target: 'stolen', other: l.id, mode: 'baby' });
      } else if (d.targets === 'pair')
        for (const own of p.llamas)
          out.push({ ...base, enemy: enemy.id, target: own.id, other: l.id });
      else {
        out.push({ ...base, enemy: enemy.id, target: l.id });
        if (d.id === 'spit') out.push({ ...base, enemy: enemy.id, target: l.id, mode: 'bomb' });
      }
    }
  }
  return out;
}
export function actionLabel(g: Game, a: Action): string {
  if (a.type === 'abandon') return 'Descartar plan: requisitos perdidos';
  if (a.type === 'recruit') return 'Incorporar una bebé';
  if (a.type === 'skipRecruit') return 'Omitir incorporación';
  if (a.type === 'end') return 'Terminar turno';
  if (a.type === 'choose')
    return g.pending?.options.find((x) => x.id === a.choice)?.label || 'Elegir';
  if (a.type === 'resume') return 'Continuar resolución';
  if (a.type === 'recover')
    return `Recuperar ${
      definition(
        g,
        recoverable(g).find((c) => c.id === a.card)!,
      ).name
    }`;
  const c = [...g.players[g.active].hand, ...g.market, ...g.plans.map((x) => x.card)].find(
    (c) => c.id === a.card,
  );
  const d = c ? definition(g, c) : null;
  const target = locate(g, a.target),
    other = locate(g, a.other);
  return `${a.type === 'claim' ? 'Reclamar ' : a.type === 'activate' ? 'Activar ' : ''}${d?.name || 'Carta'}${target ? ` → ${target.p.name}: ${target.l.id} (${ageNames[target.l.age]} ${target.l.kind ? kindNames[target.l.kind] : ''})` : a.target === 'stolen' ? ' → especializar bebé robada' : ''}${other ? ` / ${other.p.name}: ${other.l.id}` : a.enemy !== undefined ? ` / ${g.players[a.enemy].name}` : ''}${a.mode ? ` · ${a.mode === 'baby' ? 'robar bebé' : a.mode === 'select' ? 'mirar y elegir' : a.mode === 'random' ? 'al azar' : resourceNames[a.mode as Resource] || a.mode}` : ''}${a.grow === false ? ' · acumular sin crecer' : ''}`;
}
export function legalActions(g: Game): Offer[] {
  let actions: Action[] = [];
  if (g.phase === 'finished') return [];
  if (g.pending) actions = g.pending.options.map((x) => ({ type: 'choose', choice: x.id }));
  else if (g.phase === 'resolving') actions = [{ type: 'resume' }];
  else if (g.phase === 'recruit') actions = [{ type: 'recruit' }, { type: 'skipRecruit' }];
  else {
    actions = [{ type: 'end' }];
    const p = g.players[g.active];
    for (const c of p.hand) actions.push(...templates(g, c, 'play'));
    for (const c of g.market) actions.push(...templates(g, c, 'claim'));
    for (const plan of g.plans.filter((x) => x.player === p.id)) {
      actions.push(...templates(g, plan.card, 'activate'));
      actions.push({ type: 'abandon', card: plan.card.id });
    }
    if (hasPower(g, p, 'thesis') && g.window?.kind === 'explosion')
      for (const c of recoverable(g)) actions.push({ type: 'recover', card: c.id });
  }
  return actions
    .filter((a) => !actionError(g, a))
    .map((action) => {
      const c = [...g.players[g.active].hand, ...g.market, ...g.plans.map((x) => x.card)].find(
        (c) => c.id === action.card,
      );
      const card = c ? definition(g, c) : undefined;
      return {
        action,
        label: actionLabel(g, action),
        card,
        cost:
          action.type === 'recover'
            ? { study: g.config.thesisRecovery }
            : card
              ? costFor(g, card, action)
              : {},
      };
    });
}
function prompt(
  g: Game,
  player: number,
  kind: string,
  title: string,
  options: PendingOption[],
  revealed?: Card[],
) {
  if (!options.length) return;
  g.pending = { player, kind, title, options, revealed };
}
function enqueue(g: Game, ...tasks: Task[]) {
  g.queue.unshift(...tasks);
}
function effectTask(e: Effect, player: number, a?: Action, c?: Card): Task {
  return {
    op: e.op,
    player,
    target: a?.target,
    enemy: a?.enemy,
    other: a?.other,
    card: c,
    amount: e.amount,
    resource: e.resource,
    kind: e.kind,
    key: e.key,
    permission: a?.grow === false ? 'noGrow' : undefined,
    effects: e.options?.flat(),
    values: undefined,
    ...(['choice', 'random'].includes(e.op) ? { key: JSON.stringify(e.options) } : {}),
  };
}
function tasksFor(d: CardDef, player: number, a: Action, c: Card): Task[] {
  return d.effects.map((e) => ({
    ...effectTask(e, player, a, c),
    ...(e.op === 'steal'
      ? { key: e.key === 'raid' ? `raid:${a.mode}` : e.key === 'hand' ? `hand:${a.mode}` : e.key }
      : {}),
  }));
}
function alarmWindow(g: Game, tasks: Task[], defender: number) {
  const p = g.players[defender];
  const alarms = p.hand.filter((c) => c.def === 'alarm');
  if (!alarms.length) {
    enqueue(g, ...tasks);
    return;
  }
  prompt(
    g,
    defender,
    'alarm',
    `${p.name}: ¿usar Alarma para cancelar el ataque? Los costes ya se pagaron.`,
    [
      { id: 'pass', label: 'Pasar: permitir el ataque', effects: tasks },
      ...alarms.map((c) => ({
        id: c.id,
        label: 'Usar Alarma de llama',
        effects: [{ op: 'block', player: defender, card: c }],
      })),
    ],
  );
  log(g, 'attackWindow', `Se abre una ventana de defensa para ${p.name}.`);
}
const chaosNames = [
  'Robar dos cartas',
  'Descartar una carta al azar',
  'Robar una carta rival al azar',
  'Ganar estudio 1',
  'Ganar comida 1',
  'Entender todo… y olvidarlo',
];
function chaosTask(p: number, llama: string, result: number): Task {
  return { op: 'chaosResult', player: p, target: llama, amount: result };
}
function weighted(g: Game, excluded: number[] = []): number {
  const weights = g.config.chaosWeights.map((w, i) => (excluded.includes(i) ? 0 : w));
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum === 0) {
    const available = weights.map((_, i) => i).filter((i) => !excluded.includes(i));
    return available[Math.floor(random(g) * available.length)];
  }
  let r = random(g) * sum;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}
function recoverable(g: Game) {
  return [...g.discard, ...(g.config.allowRecoverAside ? g.aside.map((x) => x.card) : [])].filter(
    (c) => definition(g, c).category !== 'power',
  );
}
function recover(g: Game, p: Player, id: string) {
  const c = recoverable(g).find((x) => x.id === id);
  if (!c) return;
  g.discard = g.discard.filter((x) => x.id !== id);
  g.aside = g.aside.filter((x) => x.card.id !== id);
  p.hand.push(c);
  log(g, 'recovery', `${p.name} recupera ${definition(g, c).name}.`, { card: c.id });
}
function moveLlama(g: Game, from: Player, to: Player, l: Llama, clear = false) {
  from.llamas = from.llamas.filter((x) => x.id !== l.id);
  if (clear) l.resources = emptyResources();
  to.llamas.push(l);
}
function perform(g: Game, t: Task) {
  const p = g.players[t.player],
    found = locate(g, t.target),
    own = p.llamas.find((l) => l.id === t.target),
    enemy = g.players[t.enemy ?? -1];
  switch (t.op) {
    case 'autoEvent': {
      if (!t.card) break;
      const d = definition(g, t.card);
      if (d.targets === 'own') {
        const targets = p.llamas.filter(
          (l) =>
            !d.effects.some((e) => e.op === 'explosion') ||
            canFeed(g, p, l, 'explosive', 'explosion'),
        );
        if (targets.length)
          prompt(
            g,
            p.id,
            'autoEvent',
            `Evento automático: ${d.name}. Elige objetivo.`,
            targets.map((l) => ({
              id: l.id,
              label: `${l.id} (${ageNames[l.age]})`,
              effects: tasksFor(d, p.id, { type: 'play', target: l.id }, t.card!),
            })),
          );
        else enqueue(g, ...tasksFor(d, p.id, { type: 'play' }, t.card));
      } else enqueue(g, ...tasksFor(d, p.id, { type: 'play' }, t.card));
      break;
    }
    case 'draw':
      draw(g, p, t.amount ?? 1);
      break;
    case 'discard':
      for (let i = 0; i < (t.amount ?? 1) && p.hand.length; i++) {
        const [c] = p.hand.splice(Math.floor(random(g) * p.hand.length), 1);
        discard(g, c, 'randomDiscard');
      }
      break;
    case 'feed': {
      const l = own;
      if (
        !l ||
        !t.kind ||
        !canFeed(
          g,
          p,
          l,
          t.kind,
          t.permission === 'banquet' ? 'banquet' : t.kind ? feedSource(t.kind) : 'free',
        )
      ) {
        log(g, 'fizzle', 'Se omite la alimentación: objetivo incompatible al resolver.');
        break;
      }
      const source = t.permission === 'banquet' ? 'banquet' : t.card ? feedSource(t.kind) : 'free';
      if (l.age === 0) l.kind = t.kind;
      if (t.resource) l.resources[t.resource] += t.amount ?? 1;
      grow(g, p, l, source, t.permission !== 'noGrow');
      log(g, 'feed', `${p.name} alimenta ${l.id} (${kindNames[t.kind]}).`, {
        llama: l.id,
        source,
        paid: !!t.card,
      });
      const next: Task[] = [];
      if (t.kind === 'glutton')
        next.push({
          op: 'draw',
          player: p.id,
          amount: l.age === 2 ? g.config.gluttonAdult : g.config.gluttonYoung,
        });
      if (t.kind === 'crazy') {
        p.crazyFeeds++;
        next.push({ op: 'chaos', player: p.id, target: l.id });
      }
      if (
        ['food', 'study', 'chaos', 'free', 'banquet'].includes(source) &&
        hasPower(g, p, 'blessing')
      )
        next.push({ op: 'draw', player: p.id, amount: 1 });
      if (t.card)
        next.push({
          op: 'setWindow',
          player: p.id,
          target: l.id,
          key: t.kind === 'crazy' ? 'chaos' : 'feed',
        });
      if (t.kind === 'glutton' && t.card && hasPower(g, p, 'banquet'))
        next.push({ op: 'banquetChoice', player: p.id });
      enqueue(g, ...next);
      break;
    }
    case 'chaos': {
      if (hasPower(g, p, 'revelation')) {
        const results: number[] = [];
        for (let i = 0; i < 3; i++) results.push(weighted(g, results));
        prompt(
          g,
          p.id,
          'revelation',
          'Revelación: elige el primer resultado. Después elegirás el segundo.',
          results.map((r) => ({
            id: String(r),
            label: chaosNames[r],
            effects: [
              chaosTask(p.id, t.target!, r),
              {
                op: 'chaosSecond',
                player: p.id,
                target: t.target,
                values: results.filter((x) => x !== r),
              },
            ],
          })),
        );
        log(
          g,
          'revelation',
          `Se revelan tres resultados: ${results.map((r) => chaosNames[r]).join(' · ')}.`,
        );
      } else enqueue(g, chaosTask(p.id, t.target!, weighted(g)));
      break;
    }
    case 'chaosSecond':
      prompt(
        g,
        p.id,
        'revelation',
        'Elige el segundo resultado de Revelación.',
        t.values!.map((r) => ({
          id: String(r),
          label: chaosNames[r],
          effects: [chaosTask(p.id, t.target!, r)],
        })),
      );
      break;
    case 'chaosResult': {
      const n = t.amount!;
      log(g, 'chaos', `${p.name}: ${chaosNames[n]}.`, { result: n, llama: t.target });
      g.window = {
        kind: 'chaos',
        llama: t.target,
        results: [...(g.window?.kind === 'chaos' ? g.window.results || [] : []), n],
      };
      if (n === 0) draw(g, p, 2);
      if (n === 1) enqueue(g, { op: 'discard', player: p.id, amount: 1 });
      if (n === 2) {
        const enemies = g.players.filter((x) => x.id !== p.id && x.hand.length);
        prompt(
          g,
          p.id,
          'chaosTarget',
          'Elige a quién robar una carta aleatoria.',
          enemies.map((x) => ({
            id: String(x.id),
            label: `${x.name} (${x.hand.length} cartas)`,
            effects: [{ op: 'chaosSteal', player: p.id, enemy: x.id }],
          })),
        );
      }
      if (n === 3 && own) own.resources.study++;
      if (n === 4 && own) own.resources.food++;
      break;
    }
    case 'chaosSteal': {
      if (!enemy?.hand.length) break;
      const tasks = [{ op: 'steal', player: p.id, enemy: enemy.id, key: 'hand:random' }];
      if (g.config.crazyProtected) alarmWindow(g, tasks, enemy.id);
      else enqueue(g, ...tasks);
      break;
    }
    case 'banquetChoice': {
      const options: PendingOption[] = [
        { id: 'skip', label: 'Omitir alimentación gratuita', effects: [] },
      ];
      for (const l of p.llamas)
        for (const kind of ['glutton', 'scholar', 'crazy'] as Kind[])
          if (canFeed(g, p, l, kind, 'banquet'))
            options.push({
              id: l.id + kind,
              label: `Alimentar ${l.id} como ${kindNames[kind]}`,
              effects: [
                {
                  op: 'feed',
                  player: p.id,
                  target: l.id,
                  kind,
                  resource: kind === 'glutton' ? 'food' : kind === 'scholar' ? 'study' : 'chaos',
                  amount: 1,
                  permission: 'banquet',
                },
              ],
            });
      prompt(
        g,
        p.id,
        'banquet',
        'Banquete: una alimentación gratuita. No genera otra gratuita.',
        options,
      );
      break;
    }
    case 'setWindow':
      g.window = {
        kind: t.key!,
        llama: t.target,
        results: t.key === 'chaos' ? g.window?.results : undefined,
      };
      break;
    case 'explosion': {
      const n = p.hand.length;
      for (const player of g.players) {
        const count = player.hand.length;
        for (const c of player.hand.splice(0)) discard(g, c, 'explosionDiscard');
        draw(g, player, count);
      }
      if (own && canFeed(g, p, own, 'explosive', 'explosion')) {
        if (own.age === 0) own.kind = 'explosive';
        own.resources.bomb++;
        grow(g, p, own, 'explosion', t.permission !== 'noGrow');
      }
      g.window = { kind: 'explosion' };
      log(
        g,
        'explosion',
        `Explosión: todos reemplazan sus manos. ${p.name} reemplazó ${n}; solo su explosiva puede crecer.`,
      );
      break;
    }
    case 'steal': {
      const [key, mode] = t.key?.split(':') || [];
      const rival = enemy?.llamas.find((l) => l.id === (t.other || t.target));
      if (key === 'raid') {
        if (!enemy || !rival) {
          log(g, 'fizzle', 'El objetivo del saqueo ya no existe.');
          break;
        }
        let receiver = t.target === 'stolen' ? rival : own;
        if (!receiver || !canFeed(g, p, receiver, 'evil', 'raid')) {
          log(g, 'fizzle', 'Saqueo omitido: receptora inválida.');
          break;
        }
        if (mode === 'baby') {
          if (rival.age !== 0 || !room(g, p)) break;
          moveLlama(g, enemy, p, rival);
        } else {
          const r = mode as Resource;
          if (!resources.includes(r) || rival.resources[r] < 1) break;
          rival.resources[r]--;
          receiver.resources[r]++;
        }
        if (receiver.age === 0) receiver.kind = 'evil';
        receiver.resources.evil++;
        grow(g, p, receiver, 'raid');
        p.raids++;
        log(g, 'raid', `${p.name} saquea con éxito a ${enemy.name}; activa ${receiver.id}.`, {
          player: p.id,
          mode,
        });
      } else if (key === 'conversion') {
        if (!enemy || !rival || rival.age === 0 || !groupCompatible(p, rival) || !room(g, p)) break;
        moveLlama(g, enemy, p, rival, true);
        log(g, 'conversion', `${p.name} convierte ${rival.id}; conserva edad, pierde recursos.`);
      } else if (key === 'hand' && enemy?.hand.length) {
        if (mode === 'select') {
          prompt(
            g,
            p.id,
            'selectCard',
            `Mano revelada de ${enemy.name}: elige una carta.`,
            enemy.hand.map((c) => ({
              id: c.id,
              label: definition(g, c).name,
              effects: [{ op: 'takeCard', player: p.id, enemy: enemy.id, card: c }],
            })),
            structuredClone(enemy.hand),
          );
        } else {
          const [c] = enemy.hand.splice(Math.floor(random(g) * enemy.hand.length), 1);
          p.hand.push(c);
          log(g, 'handTheft', `${p.name} roba una carta aleatoria a ${enemy.name}.`);
        }
      }
      break;
    }
    case 'takeCard': {
      const index = enemy?.hand.findIndex((c) => c.id === t.card?.id) ?? -1;
      if (index >= 0) {
        p.hand.push(enemy.hand.splice(index, 1)[0]);
        log(g, 'handTheft', `${p.name} elige una carta de la mano revelada.`);
      }
      break;
    }
    case 'age': {
      const l = found?.l;
      if (!l) break;
      if ((t.amount ?? -1) < 0) {
        l.age = Math.max(0, l.age + (t.amount ?? -1)) as 0 | 1 | 2;
        if (l.age === 0) l.kind = null;
        log(g, 'age', `${l.id} vuelve a ${ageNames[l.age]}.`);
      } else if (found?.p.id === p.id) grow(g, p, l, 'custom');
      break;
    }
    case 'return':
      if (found && found.l.age === 0) {
        found.p.llamas = found.p.llamas.filter((x) => x.id !== found.l.id);
        if (g.reserve !== null) g.reserve++;
        log(g, 'return', `${found.l.id} vuelve a la reserva sin recursos.`);
      }
      break;
    case 'swap': {
      const rival = enemy?.llamas.find((x) => x.id === t.other);
      if (
        !own ||
        !rival ||
        !enemy ||
        rival.age <= own.age ||
        !groupCompatible(p, rival, own.id) ||
        !groupCompatible(enemy, own, rival.id)
      )
        break;
      p.llamas = p.llamas.filter((x) => x.id !== own.id);
      enemy.llamas = enemy.llamas.filter((x) => x.id !== rival.id);
      own.resources = emptyResources();
      rival.resources = emptyResources();
      p.llamas.push(rival);
      enemy.llamas.push(own);
      log(
        g,
        'swap',
        `${p.name} intercambia ${own.id} por ${rival.id}. Ambas pierden recursos; no es crecimiento.`,
      );
      break;
    }
    case 'install': {
      const d = t.card ? definition(g, t.card) : null;
      if (['farm', 'fence'].includes(t.key!)) {
        if (!p.research.includes(t.key!)) p.research.push(t.key!);
      } else p.powers.push({ key: t.key!, expires: d?.duration === 'permanent' ? null : g.turn });
      log(g, 'install', `${p.name} activa ${d?.name || t.key}.`, { key: t.key, cost: d?.cost });
      break;
    }
    case 'extra':
      if (g.config.meditation === 'draw') draw(g, p, 2);
      else if (!g.extra && !g.extraScheduled) {
        g.pendingExtra.push(p.id);
        g.extraScheduled = true;
        log(g, 'extra', `${p.name} programa un turno extra.`);
      }
      break;
    case 'spend':
      if (own && t.resource && own.resources[t.resource] >= (t.amount ?? 1)) {
        own.resources[t.resource] -= t.amount ?? 1;
        log(
          g,
          'resourceSpent',
          `${p.name} gasta ${t.amount ?? 1} ${resourceNames[t.resource]} de ${own.id}.`,
        );
      }
      break;
    case 'transfer':
      if (own && t.resource && own.resources[t.resource] >= (t.amount ?? 1)) {
        prompt(
          g,
          p.id,
          'transfer',
          'Elige otra llama propia que recibirá los recursos. No alimenta.',
          p.llamas
            .filter((l) => l.id !== own.id)
            .map((l) => ({
              id: l.id,
              label: `Transferir a ${l.id}`,
              effects: [
                {
                  op: 'transferChosen',
                  player: p.id,
                  target: own.id,
                  other: l.id,
                  resource: t.resource,
                  amount: t.amount ?? 1,
                },
              ],
            })),
        );
      }
      break;
    case 'transferChosen': {
      const dest = p.llamas.find((l) => l.id === t.other);
      if (own && dest && t.resource && own.resources[t.resource] >= (t.amount ?? 1)) {
        own.resources[t.resource] -= t.amount ?? 1;
        dest.resources[t.resource] += t.amount ?? 1;
        log(
          g,
          'transfer',
          `Se transfieren ${t.amount ?? 1} ${resourceNames[t.resource]} de ${own.id} a ${dest.id}.`,
        );
      }
      break;
    }
    case 'resource':
      if (own && t.resource) own.resources[t.resource] += t.amount ?? 1;
      break;
    case 'recover':
      prompt(
        g,
        p.id,
        'recover',
        'Elige una carta no poderosa para recuperar.',
        recoverable(g)
          .filter((c) => c.id !== t.card?.id)
          .map((c) => ({
            id: c.id,
            label: definition(g, c).name,
            effects: [{ op: 'takeDiscard', player: p.id, card: c }],
          })),
      );
      break;
    case 'takeDiscard':
      if (t.card) recover(g, p, t.card.id);
      break;
    case 'connection': {
      if (t.key === 'chaos') {
        const results = g.window?.results || [];
        prompt(
          g,
          p.id,
          'repeat',
          'Elige un resultado resuelto de loca para repetir.',
          results.map((r, i) => ({
            id: String(i),
            label: chaosNames[r],
            effects: [chaosTask(p.id, t.target!, r), { op: 'clearWindow', player: p.id }],
          })),
        );
      }
      if (t.key === 'leftovers') {
        const source = locate(g, g.window?.llama)?.l;
        if (!source || !own) break;
        prompt(
          g,
          p.id,
          'moveResource',
          'Elige un recurso para mover. No alimenta.',
          resources
            .filter((r) => source.resources[r] > 0)
            .map((r) => ({
              id: r,
              label: resourceNames[r],
              effects: [
                { op: 'moveResource', player: p.id, target: source.id, other: own.id, resource: r },
              ],
            })),
        );
      }
      break;
    }
    case 'moveResource': {
      const dest = p.llamas.find((x) => x.id === t.other);
      if (own && dest && dest.age === 1 && own.resources[t.resource!] > 0) {
        own.resources[t.resource!]--;
        dest.resources[t.resource!]++;
      }
      g.window = null;
      break;
    }
    case 'clearWindow':
      g.window = null;
      break;
    case 'choice':
    case 'random': {
      const effects = JSON.parse(t.key!) as Effect[][];
      if (t.op === 'random') {
        const option = effects[Math.floor(random(g) * effects.length)];
        enqueue(
          g,
          ...option.map((e) =>
            effectTask(e, p.id, { type: 'play', target: t.target, enemy: t.enemy }, t.card),
          ),
        );
      } else
        prompt(
          g,
          p.id,
          'effectChoice',
          'Elige un efecto.',
          effects.map((arr, i) => ({
            id: String(i),
            label: arr.map((e) => `${e.op} ${e.amount ?? ''}`).join(' + '),
            effects: arr.map((e) =>
              effectTask(e, p.id, { type: 'play', target: t.target, enemy: t.enemy }, t.card),
            ),
          })),
        );
      break;
    }
    case 'social':
      log(g, 'social', `${p.name}: «Mmmprrr». Acción social registrada, sin efecto material.`);
      break;
    case 'block': {
      const i = p.hand.findIndex((c) => c.id === t.card?.id);
      if (i >= 0) {
        discard(g, p.hand.splice(i, 1)[0], 'reaction');
        log(g, 'blocked', `${p.name} usa Alarma: ataque cancelado. Los costes no se devuelven.`);
      }
      break;
    }
    case 'finishTurn': {
      if (g.config.handLimit !== null && p.hand.length > g.config.handLimit) {
        prompt(
          g,
          p.id,
          'handLimit',
          'Elige una carta para descartar hasta cumplir el límite de mano.',
          p.hand.map((c) => ({
            id: c.id,
            label: definition(g, c).name,
            effects: [
              { op: 'discardChosen', player: p.id, card: c },
              { op: 'finishTurn', player: p.id },
            ],
          })),
        );
        break;
      }
      const next = g.pendingExtra.shift();
      if (next !== undefined) {
        g.active = next;
        g.extra = true;
      } else {
        const prev = g.active;
        g.active = (g.active + 1) % g.players.length;
        g.extra = false;
        if (g.active <= prev) g.round++;
      }
      beginTurn(g);
      break;
    }
    case 'discardChosen': {
      const i = p.hand.findIndex((c) => c.id === t.card?.id);
      if (i >= 0) discard(g, p.hand.splice(i, 1)[0], 'handLimit');
      break;
    }
    default:
      throw Error(`Operación no soportada: ${t.op}`);
  }
}
function resolve(g: Game) {
  let budget = 200;
  while (g.queue.length && !g.pending && g.phase !== 'finished' && budget-- > 0) {
    const t = g.queue.shift()!;
    const parent = log(g, 'effect', `Resolver ${t.op}.`, { op: t.op, player: t.player }, t.parent);
    const before = g.events.length;
    perform(g, t);
    for (let i = before; i < g.events.length; i++)
      if (g.events[i].parent === null) g.events[i].parent = parent;
    checkWin(g);
  }
  if (g.phase !== 'finished' && g.phase !== 'recruit') {
    g.phase = g.queue.length || g.pending ? 'resolving' : 'actions';
  }
  if (budget <= 0 && g.queue.length)
    log(
      g,
      'technicalPause',
      'Resolución extensa pausada: continuar por bloques, sin recortar efectos.',
    );
}
export function dispatch(state: Game, action: Action): Game {
  const err = actionError(state, action);
  if (err) throw Error(err);
  const g = structuredClone(state);
  g.commands.push(structuredClone(action));
  const p = g.players[g.active];
  if (action.type === 'choose') {
    const pending = g.pending!;
    const option = pending.options.find((o) => o.id === action.choice)!;
    g.pending = null;
    log(
      g,
      'decision',
      `${g.players[pending.player].name}: ${pending.kind === 'selectCard' ? 'elige una carta revelada' : option.label}.`,
      { kind: pending.kind },
    );
    enqueue(g, ...option.effects);
    resolve(g);
    return g;
  }
  if (action.type === 'resume') {
    resolve(g);
    return g;
  }
  if (action.type === 'recruit' || action.type === 'skipRecruit') {
    if (action.type === 'recruit') {
      p.llamas.push(newLlama(g));
      if (g.reserve !== null) g.reserve--;
      log(g, 'recruit', `${p.name} incorpora una bebé.`);
    } else log(g, 'recruitSkip', `${p.name} omite incorporar una bebé.`);
    beginActions(g);
    resolve(g);
    return g;
  }
  if (action.type === 'end') {
    g.window = null;
    enqueue(g, { op: 'finishTurn', player: p.id });
    resolve(g);
    return g;
  }
  if (action.type === 'abandon') {
    const i = g.plans.findIndex((x) => x.card.id === action.card);
    const [plan] = g.plans.splice(i, 1);
    g.discard.push(plan.card);
    log(g, 'planFailed', 'Preparación fallida: se perdieron los requisitos.');
    return g;
  }
  if (action.type === 'recover') {
    pay(g, p, { study: g.config.thesisRecovery }, action.payment);
    recover(g, p, action.card!);
    checkWin(g);
    return g;
  }
  const c =
    action.type === 'claim'
      ? g.market.find((c) => c.id === action.card)!
      : action.type === 'activate'
        ? g.plans.find((x) => x.card.id === action.card)!.card
        : p.hand.find((c) => c.id === action.card)!;
  const d = definition(g, c);
  if (action.type === 'claim') g.market = g.market.filter((x) => x.id !== c.id);
  else if (action.type === 'activate') g.plans = g.plans.filter((x) => x.card.id !== c.id);
  else p.hand = p.hand.filter((x) => x.id !== c.id);
  if (g.config.announce && d.category === 'power' && action.type !== 'activate') {
    g.plans.push({ card: c, player: p.id, readyRound: g.normalTurns + g.players.length });
    log(
      g,
      'announce',
      `${p.name} anuncia ${d.name}. Deben transcurrir ${g.players.length} turnos normales.`,
    );
    return g;
  }
  pay(g, p, costFor(g, d, action), action.payment);
  const fence = needsFence(g, d, action);
  if (fence)
    for (let i = 1; i < g.config.fenceCopies; i++) {
      const index = p.hand.findIndex((x) => x.def === d.id);
      discard(g, p.hand.splice(index, 1)[0], 'fenceCost');
    }
  const event = log(g, 'play', `${p.name} juega ${d.name}.`, {
    card: c.id,
    definition: d.id,
    cost: costFor(g, d, action),
  });
  p.used[d.id] = (p.used[d.id] || 0) + 1;
  g.turnActions++;
  const previousWindow = g.window;
  g.window = null;
  const isFeed = d.effects.some((e) => e.op === 'feed');
  discard(g, c, d.category === 'power' ? 'activated' : isFeed ? 'feed' : 'played');
  if (d.category === 'connection') g.window = previousWindow;
  const tasks = tasksFor(d, p.id, action, c).map((t) => ({ ...t, parent: event }));
  if (d.reactionWindows.includes('alarm') && action.enemy !== undefined) {
    log(g, 'attack', `${p.name} ataca a ${g.players[action.enemy].name}.`, { kind: d.id });
    alarmWindow(g, tasks, action.enemy);
  } else enqueue(g, ...tasks);
  resolve(g);
  return g;
}
export function assertInvariants(g: Game) {
  const all = [
    ...g.deck,
    ...g.discard,
    ...g.out,
    ...g.aside.map((x) => x.card),
    ...g.market,
    ...g.plans.map((x) => x.card),
    ...g.players.flatMap((p) => p.hand),
  ];
  const expected = g.config.cards.reduce(
    (n, d) => n + (g.config.market && d.category === 'power' ? (d.copies ? 1 : 0) : d.copies),
    0,
  );
  if (all.length !== expected) throw Error(`Conservación de cartas: ${all.length}/${expected}`);
  if (new Set(all.map((c) => c.id)).size !== all.length) throw Error('Cartas duplicadas.');
  for (const d of g.config.cards) {
    const count = all.filter((c) => c.def === d.id).length;
    const wanted = g.config.market && d.category === 'power' ? (d.copies ? 1 : 0) : d.copies;
    if (count !== wanted) throw Error(`Copias de ${d.id}: ${count}/${wanted}`);
  }
  if (all.some((c) => typeof c.id !== 'string' || !g.config.cards.some((d) => d.id === c.def)))
    throw Error('Carta física desconocida.');
  if (g.reserve !== null && (!Number.isInteger(g.reserve) || g.reserve < 0))
    throw Error('Reserva inválida.');
  const llamaIds = new Set<string>();
  for (const p of g.players) {
    if (p.id !== g.players.indexOf(p)) throw Error('Asientos inválidos.');
    if (g.config.groupLimit !== null && p.llamas.length > g.config.groupLimit)
      throw Error('Límite de grupo excedido.');
    if (p.llamas.some((l) => l.kind === 'holy') && p.llamas.some((l) => l.kind === 'evil'))
      throw Error('Santa y malvada coexisten.');
    for (const l of p.llamas) {
      if (llamaIds.has(l.id)) throw Error('Llama duplicada.');
      llamaIds.add(l.id);
      if (
        ![0, 1, 2].includes(l.age) ||
        (l.kind !== null &&
          !['glutton', 'scholar', 'crazy', 'explosive', 'evil', 'holy'].includes(l.kind))
      )
        throw Error('Edad o tipo inválido.');
      if ((l.age === 0) !== (l.kind === null)) throw Error('Bebé especializada o joven sin tipo.');
      for (const r of resources)
        if (!Number.isInteger(l.resources[r]) || l.resources[r] < 0)
          throw Error('Recursos inválidos.');
    }
  }
  if (g.winner !== null && adults(g.players[g.winner]) < g.config.target)
    throw Error('Ganador inválido.');
  if (g.pending && g.phase !== 'resolving') throw Error('Elección fuera de resolución.');
}
