import { describe, it, expect } from 'vitest';
import { presets, catalog } from '../src/content/catalog';
import { Action, Card, Config, Game, Kind } from '../src/engine/types';
import {
  adults,
  assertInvariants,
  createGame,
  dispatch,
  emptyResources,
  legalActions,
  newLlama,
  hasPower,
} from '../src/engine/engine';
import { decide, observe } from '../src/bots/policy';
import { fingerprint, validateConfig } from '../src/engine/config';
import { exportReplay, replay, stateHash, branchGame } from '../src/persistence/storage';
import { simulate } from '../src/simulation/run';
function rig(preset = 0): Game {
  const c = structuredClone(presets[preset]);
  c.initialHand = 0;
  c.draw = 0;
  const g = createGame(
    c,
    [
      { name: 'Ana', controller: 'human', profile: 'balanced' },
      { name: 'Bot', controller: 'bot', profile: 'aggressive' },
    ],
    'test',
  );
  g.phase = 'actions';
  g.players[0].llamas = [newLlama(g), newLlama(g)];
  g.players[1].llamas = [newLlama(g), newLlama(g)];
  return g;
}
function hand(g: Game, id: string, seat = 0): Card {
  const idx = g.deck.findIndex((c) => c.def === id);
  if (idx < 0) throw Error(`Sin carta ${id}`);
  const c = g.deck.splice(idx, 1)[0];
  g.players[seat].hand.push(c);
  return c;
}
function play(g: Game, id: string, extra: Partial<Action> = {}): Game {
  const c = hand(g, id);
  return dispatch(g, { type: 'play', card: c.id, ...extra });
}
function type(g: Game, seat: number, index: number, kind: Kind, age: 1 | 2 = 1) {
  const l = g.players[seat].llamas[index];
  l.kind = kind;
  l.age = age;
  return l;
}
function addCards(g: Game, ids: string[]) {
  for (const id of ids) {
    const def = structuredClone(catalog.find((c) => c.id === id)!);
    g.config.cards.push(def);
    for (let i = 0; i < def.copies; i++) g.deck.push({ id: `C${g.nextId++}`, def: id });
  }
  g.fingerprint = fingerprint(g.config);
}
describe('reglas confirmadas', () => {
  it('presets exactos: 100 y 116; referencias sin Tesis', () => {
    expect(presets[0].cards.reduce((n, c) => n + c.copies, 0)).toBe(100);
    expect(presets[1].cards.reduce((n, c) => n + c.copies, 0)).toBe(116);
    expect(presets.every((p) => !p.cards.some((c) => c.id === 'thesis'))).toBe(true);
  });
  it('dos comidas dan solo una subida; una nueva alimentación otro turno da adulta', () => {
    let g = rig(),
      id = g.players[0].llamas[0].id;
    g = play(g, 'food', { target: id });
    g = play(g, 'food', { target: id });
    expect(g.players[0].llamas[0]).toMatchObject({
      age: 1,
      kind: 'glutton',
      resources: { food: 2 },
    });
    expect(g.players[0].hand.length).toBe(2);
    g = dispatch(g, { type: 'end' });
    g = dispatch(g, { type: 'skipRecruit' });
    g = dispatch(g, { type: 'end' });
    g = dispatch(g, { type: 'skipRecruit' });
    expect(g.players[0].llamas[0].age).toBe(1);
    g = play(g, 'food', { target: id });
    expect(g.players[0].llamas[0].age).toBe(2);
    assertInvariants(g);
  });
  it('crecimiento global impide especializar otra bebé pero permite alimentar jóvenes', () => {
    let g = rig();
    type(g, 0, 1, 'scholar');
    g = play(g, 'food', { target: g.players[0].llamas[0].id });
    g = play(g, 'study', { target: g.players[0].llamas[1].id });
    expect(g.players[0].llamas.map((l) => l.age)).toEqual([1, 1]);
    expect(g.players[0].llamas[1].resources.study).toBe(1);
    const baby = newLlama(g);
    g.players[0].llamas.push(baby);
    const c = hand(g, 'study');
    expect(() => dispatch(g, { type: 'play', card: c.id, target: baby.id })).toThrow('Ya usaste');
    expect(g.players[0].llamas[2].kind).toBeNull();
  });
  it('se puede acumular voluntariamente sin crecer en joven', () => {
    let g = rig();
    const l = type(g, 0, 0, 'glutton');
    g = play(g, 'food', { target: l.id, grow: false });
    expect(g.growthUsed).toBe(false);
    expect(g.players[0].llamas[0].resources.food).toBe(1);
    expect(g.players[0].llamas[0].age).toBe(1);
  });
  it('gastar recursos no rejuvenece; fuentes diferentes cambian distribución', () => {
    let a = rig();
    type(a, 0, 0, 'scholar', 2);
    type(a, 0, 1, 'glutton', 2);
    a.players[0].llamas.forEach((l) => (l.resources.study = 2));
    const c = hand(a, 'farm');
    const b = dispatch(a, {
      type: 'play',
      card: c.id,
      payment: [{ llama: a.players[0].llamas[0].id, resource: 'study', amount: 2 }],
    });
    const d = dispatch(a, {
      type: 'play',
      card: c.id,
      payment: [{ llama: a.players[0].llamas[1].id, resource: 'study', amount: 2 }],
    });
    expect(b.players[0].llamas[0].age).toBe(2);
    expect(b.players[0].llamas.map((l) => l.resources.study)).not.toEqual(
      d.players[0].llamas.map((l) => l.resources.study),
    );
    assertInvariants(b);
  });
  it('explosión solo activa al dueño y reemplaza la mano después de pagar', () => {
    let g = rig();
    type(g, 1, 0, 'explosive');
    hand(g, 'alarm', 1);
    hand(g, 'food');
    const l = g.players[0].llamas[0];
    g = play(g, 'explosion', { target: l.id });
    expect(g.players[0].llamas[0].kind).toBe('explosive');
    expect(g.players[1].llamas[0].age).toBe(1);
    expect(g.players[0].hand).toHaveLength(1);
    expect(g.players[1].hand).toHaveLength(1);
    expect(g.pending).toBeNull();
    assertInvariants(g);
  });
  it('Alarma pausa realmente y un robo bloqueado no activa malvada', () => {
    let g = rig();
    const c = hand(g, 'raid');
    hand(g, 'alarm', 1);
    const own = g.players[0].llamas[0],
      rival = g.players[1].llamas[0];
    g = dispatch(g, {
      type: 'play',
      card: c.id,
      target: own.id,
      enemy: 1,
      other: rival.id,
      mode: 'baby',
    });
    expect(g.pending?.player).toBe(1);
    expect(g.players[1].llamas).toHaveLength(2);
    expect(g.growthUsed).toBe(false);
    const block = g.pending!.options.find((o) => o.id !== 'pass')!;
    g = dispatch(g, { type: 'choose', choice: block.id });
    expect(g.players[1].llamas).toHaveLength(2);
    expect(g.players[0].llamas[0].kind).toBeNull();
    expect(g.players[0].raids).toBe(0);
    assertInvariants(g);
  });
  it('pasar Alarma permite especializar la misma bebé robada', () => {
    let g = rig();
    hand(g, 'alarm', 1);
    const target = g.players[1].llamas[0].id;
    g = play(g, 'raid', { target: 'stolen', enemy: 1, other: target, mode: 'baby' });
    g = dispatch(g, { type: 'choose', choice: 'pass' });
    expect(g.players[0].llamas.find((l) => l.id === target)).toMatchObject({
      age: 1,
      kind: 'evil',
      resources: { evil: 1 },
    });
    expect(g.players[0].raids).toBe(1);
    assertInvariants(g);
  });
  it('robar carta no activa malvada y selectivo revela elección real', () => {
    let g = rig(1);
    const l = type(g, 0, 0, 'evil');
    l.resources.evil = 1;
    l.resources.study = 1;
    hand(g, 'food', 1);
    hand(g, 'study', 1);
    g = play(g, 'handTheft', { enemy: 1, mode: 'select' });
    expect(g.pending?.kind).toBe('selectCard');
    expect(g.pending?.options).toHaveLength(2);
    g = dispatch(g, { type: 'choose', choice: g.pending!.options[1].id });
    expect(g.players[0].llamas[0].age).toBe(1);
    expect(g.growthUsed).toBe(false);
    assertInvariants(g);
  });
  it('robar adulta completa victoria sin consumir subida', () => {
    let g = rig();
    g.config.target = 1;
    g.fingerprint = fingerprint(g.config);
    const own = type(g, 0, 0, 'evil');
    own.resources.evil = 2;
    const target = type(g, 1, 0, 'glutton', 2);
    g = play(g, 'conversion', { enemy: 1, target: target.id });
    expect(g.winner).toBe(0);
    expect(g.growthUsed).toBe(false);
    assertInvariants(g);
  });
  it('Valla cobra dos cartas y Alarma bloquea todo sin devolución', () => {
    let g = rig();
    g.players[1].research = ['fence'];
    hand(g, 'raid');
    hand(g, 'alarm', 1);
    g = play(g, 'raid', {
      enemy: 1,
      target: 'stolen',
      other: g.players[1].llamas[0].id,
      mode: 'baby',
    });
    expect(g.discard.filter((c) => c.def === 'raid')).toHaveLength(2);
    g = dispatch(g, {
      type: 'choose',
      choice: g.pending!.options.find((x) => x.id !== 'pass')!.id,
    });
    expect(g.players[0].llamas).toHaveLength(2);
    assertInvariants(g);
  });
  it('explosión extra no repite identidad ni habilita otras fuentes', () => {
    let g = rig();
    g.config.explosionExtra = true;
    g.fingerprint = fingerprint(g.config);
    const x = type(g, 0, 0, 'explosive'),
      y = type(g, 0, 1, 'explosive');
    g = play(g, 'explosion', { target: x.id });
    g = play(g, 'explosion', { target: y.id });
    expect(g.players[0].llamas.map((l) => l.age)).toEqual([2, 2]);
    expect(g.events.filter((e) => e.type === 'growth').map((e) => e.data?.permission)).toEqual([
      'global',
      'explosion',
    ]);
    assertInvariants(g);
  });
});
describe('rutas y ventanas', () => {
  it('santa no gana ni coexiste con malvada; Bendición se suspende', () => {
    let g = rig(2);
    const santa = type(g, 0, 0, 'holy', 2),
      other = type(g, 0, 1, 'scholar');
    g = play(g, 'blessing');
    expect(hasPower(g, g.players[0], 'blessing')).toBe(true);
    g.growthUsed = true;
    g = play(g, 'study', { target: other.id });
    expect(g.players[0].llamas[1].age).toBe(2);
    expect(adults(g.players[0])).toBe(1);
    const baby = newLlama(g);
    g.players[0].llamas.push(baby);
    const raid = hand(g, 'raid');
    expect(() =>
      dispatch(g, {
        type: 'play',
        card: raid.id,
        enemy: 1,
        target: 'stolen',
        other: g.players[1].llamas[0].id,
        mode: 'baby',
      }),
    ).toThrow();
    g.players[0].llamas[0].age = 1;
    expect(hasPower(g, g.players[0], 'blessing')).toBe(false);
    expect(g.players[0].powers[0].key).toBe('blessing');
    expect(santa.kind).toBe('holy');
    assertInvariants(g);
  });
  it('Bendición no hace crecer dos veces a la misma llama ni crea alimentación al robar', () => {
    let g = rig(2);
    type(g, 0, 0, 'holy', 2);
    const l = type(g, 0, 1, 'glutton');
    g = play(g, 'blessing');
    g = play(g, 'food', { target: l.id });
    const count = g.players[0].hand.length;
    g = play(g, 'food', { target: l.id });
    expect(g.events.filter((e) => e.type === 'growth')).toHaveLength(1);
    expect(g.players[0].hand.length).toBe(count + 2);
    expect(g.events.filter((e) => e.type === 'feed')).toHaveLength(2);
  });
  it('Banquete solo nace de alimentación pagada, el usuario elige y puede omitir', () => {
    let g = rig();
    addCards(g, ['banquet']);
    const x = type(g, 0, 0, 'glutton', 2),
      y = type(g, 0, 1, 'glutton');
    x.resources.food = 4;
    g = play(g, 'banquet');
    g = play(g, 'food', { target: x.id });
    expect(g.pending?.kind).toBe('banquet');
    const option = g.pending!.options.find((x) => x.id === y.id + 'glutton')!;
    g = dispatch(g, { type: 'choose', choice: option.id });
    expect(g.players[0].llamas[1].age).toBe(2);
    expect(g.pending).toBeNull();
    expect(g.events.filter((e) => e.type === 'feed')).toHaveLength(2);
    assertInvariants(g);
  });
  it('Revelación da tres resultados distintos y permite elegir dos en orden', () => {
    let g = rig(3);
    const l = type(g, 0, 0, 'crazy', 2);
    l.resources.chaos = 2;
    g.players[0].crazyFeeds = 3;
    g = play(g, 'revelation');
    g = play(g, 'chaos', { target: l.id });
    expect(g.pending?.kind).toBe('revelation');
    expect(new Set(g.pending!.options.map((o) => o.id)).size).toBe(3);
    const first = g.pending!.options.find((x) => x.id !== '2')!;
    g = dispatch(g, { type: 'choose', choice: first.id });
    expect(g.pending?.options).toHaveLength(2);
    const second = g.pending!.options.find((x) => x.id !== '2') || g.pending!.options[0];
    g = dispatch(g, { type: 'choose', choice: second.id });
    expect(g.events.filter((e) => e.type === 'chaos').map((e) => e.data?.result)).toEqual([
      Number(first.id),
      Number(second.id),
    ]);
    assertInvariants(g);
  });
  it('Gran Estafa es atómica y Valla no impide intercambio', () => {
    let g = rig(3);
    type(g, 0, 0, 'evil', 2);
    const own = type(g, 0, 1, 'glutton');
    const rival = type(g, 1, 0, 'scholar', 2);
    own.resources.food = 3;
    rival.resources.study = 4;
    g.players[0].raids = 2;
    g.players[1].research = ['fence'];
    g = play(g, 'scam', { target: own.id, enemy: 1, other: rival.id });
    expect(g.players[0].llamas.some((l) => l.id === rival.id)).toBe(true);
    expect(g.players[0].llamas.find((l) => l.id === rival.id)?.resources.study).toBe(0);
    expect(g.growthUsed).toBe(false);
    assertInvariants(g);
  });
  it('reciclaje diferido afecta solo alimentación, no descarte por explosión', () => {
    let g = rig();
    g.config.deferredFeed = true;
    g.fingerprint = fingerprint(g.config);
    const x = type(g, 0, 0, 'glutton'),
      y = type(g, 0, 1, 'explosive');
    g = play(g, 'food', { target: x.id });
    expect(g.aside).toHaveLength(1);
    const c = hand(g, 'study');
    g = play(g, 'explosion', { target: y.id });
    expect(g.aside).toHaveLength(1);
    expect(g.discard.some((x) => x.id === c.id)).toBe(true);
    g = dispatch(g, { type: 'end' });
    expect(g.aside).toHaveLength(0);
    assertInvariants(g);
  });
  it('meditación no adelanta la vuelta normal de una poderosa anunciada', () => {
    let g = rig(2);
    g.config.announce = true;
    g.fingerprint = fingerprint(g.config);
    type(g, 0, 0, 'holy', 2);
    g = play(g, 'blessing');
    const plan = g.plans[0];
    g = play(g, 'meditate');
    g = dispatch(g, { type: 'end' });
    expect(g.active).toBe(0);
    expect(g.extra).toBe(true);
    g = dispatch(g, { type: 'skipRecruit' });
    expect(legalActions(g).some((o) => o.action.type === 'activate')).toBe(false);
    expect(g.normalTurns).toBeLessThan(plan.readyRound);
    assertInvariants(g);
  });
  it('mercado tiene una copia de cada poderosa fuera del mazo', () => {
    const g = rig(4);
    expect(g.market.length).toBe(3);
    expect(g.deck.some((c) => definitionIsPower(g, c))).toBe(false);
    assertInvariants(g);
  });
});
function definitionIsPower(g: Game, c: Card) {
  return g.config.cards.find((d) => d.id === c.def)?.category === 'power';
}
describe('persistencia, edición e información', () => {
  it('carta nueva de robar dos se ejecuta y preset se aísla por copia', () => {
    let g = rig();
    const custom = {
      ...structuredClone(catalog.find((x) => x.id === 'sound')!),
      id: 'customDraw',
      name: 'Otro sorbo',
      copies: 2,
      effects: [{ op: 'draw' as const, amount: 2 }],
    };
    g.config.cards.push(custom);
    g.deck.push({ id: `C${g.nextId++}`, def: custom.id }, { id: `C${g.nextId++}`, def: custom.id });
    g.fingerprint = fingerprint(g.config);
    expect(validateConfig(g.config).errors).toEqual([]);
    g = play(g, 'customDraw');
    expect(g.players[0].hand.length).toBe(2);
    assertInvariants(g);
    expect(presets[0].cards.some((c) => c.id === 'customDraw')).toBe(false);
  });
  it('misma observación y RNG bot implican decisión idéntica pese a información oculta', () => {
    const a = rig();
    hand(a, 'food');
    hand(a, 'study');
    hand(a, 'food', 1);
    const b = structuredClone(a);
    b.deck.reverse();
    b.players[1].hand[0].def = 'alarm';
    const va = observe(a, 0),
      vb = observe(b, 0);
    expect(va).toEqual(vb);
    expect(decide(va, 44)).toEqual(decide(vb, 44));
    expect(JSON.stringify(va.deck)).not.toContain('food');
  });
  it('bot pasa cuando acumular ya no tiene utilidad; no elimina opciones humanas', () => {
    const g = rig();
    const l = type(g, 0, 0, 'glutton', 2);
    l.resources.food = 20;
    g.growthUsed = true;
    hand(g, 'food');
    expect(legalActions(g).some((o) => o.action.type === 'play')).toBe(true);
    expect(decide(observe(g, 0), 42).action.type).toBe('end');
  });
  it('replay exacto restaura RNG, pendientes y configuración y rechaza versiones', () => {
    let g = rig();
    const c = hand(g, 'chaos');
    const initial = structuredClone(g);
    g = dispatch(g, { type: 'play', card: c.id, target: g.players[0].llamas[0].id });
    while (g.pending) g = dispatch(g, { type: 'choose', choice: g.pending.options[0].id });
    const file = exportReplay(initial, g, []);
    expect(stateHash(replay(file))).toBe(stateHash(g));
    expect(() => replay({ ...file, version: 'incompatible' })).toThrow('incompatible');
  });
  it('JSON inválido y dependencia santa imposible se rechazan', () => {
    const c = structuredClone(presets[0]);
    c.cards[0].cost.food = -1;
    expect(validateConfig(c).errors.length).toBeGreaterThan(0);
    const d = structuredClone(presets[2]);
    d.cards = d.cards.filter((x) => x.id !== 'mushroom');
    expect(validateConfig(d).errors.join(' ')).toContain('santa');
  });
  it('ramas solo migran meta inequívoca y guardan marca exploratoria', () => {
    const g = rig(),
      c = { ...structuredClone(g.config), id: 'custom', name: 'Variante', target: 3 };
    expect(branchGame(g, c).exploratory).toBe(true);
    c.draw = 4;
    expect(() => branchGame(g, c)).toThrow('partida nueva');
  });
  it('simulaciones censuradas no inventan ganador', () => {
    const result = simulate(presets[0], 'short', ['breeder', 'aggressive'], 0, 1);
    expect(result.status).toBe('censored');
    expect(result.winner).toBeNull();
  });
  it('conservación e invariantes en varios presets y perfiles con semillas fijas', () => {
    for (const config of presets)
      for (const seed of ['puna', 'volcan']) {
        let g = createGame(
          config,
          ['breeder', 'aggressive', 'devout'].map((profile, i) => ({
            name: `Bot ${i}`,
            controller: 'bot' as const,
            profile: profile as 'breeder',
          })),
          seed,
        );
        for (let i = 0; i < 120 && g.winner === null; i++) {
          const d = decide(observe(g, g.pending?.player ?? g.active), g.botRng);
          g = dispatch(g, d.action);
          g.botRng = d.rng;
          assertInvariants(g);
        }
      }
  }, 30000);
});

describe('conexiones, prototipos y extensiones del constructor', () => {
  it('Tesis recupera pagando estudio, incluida la explosión; nunca gratis', () => {
    let g = rig();
    addCards(g, ['thesis']);
    const scholar = type(g, 0, 0, 'scholar', 2);
    scholar.resources.study = 5;
    const bomb = type(g, 0, 1, 'explosive');
    bomb.resources.bomb = 1;
    g = play(g, 'thesis');
    g = play(g, 'explosion', { target: bomb.id });
    const explosion = g.discard.find((c) => c.def === 'explosion')!;
    expect(explosion).toBeTruthy();
    const before = g.players[0].llamas[0].resources.study;
    g = dispatch(g, { type: 'recover', card: explosion.id });
    expect(g.players[0].llamas[0].resources.study).toBe(before - 1);
    expect(g.players[0].hand.some((c) => c.id === explosion.id)).toBe(true);
    assertInvariants(g);
  });
  it('Hongo compartido repite una vez en otra llama y no se dispara a sí mismo', () => {
    let g = rig();
    addCards(g, ['sharedMushroom']);
    const x = type(g, 0, 0, 'crazy'),
      y = type(g, 0, 1, 'scholar');
    x.resources.food = 1;
    g.config.chaosWeights = [0, 0, 0, 1, 0, 0];
    g.fingerprint = fingerprint(g.config);
    g = play(g, 'chaos', { target: x.id });
    g = play(g, 'sharedMushroom', { target: y.id });
    expect(g.pending?.kind).toBe('repeat');
    g = dispatch(g, { type: 'choose', choice: g.pending!.options[0].id });
    expect(g.players[0].llamas[1].resources.study).toBe(1);
    expect(g.players[0].llamas[1].age).toBe(1);
    expect(g.window).toBeNull();
    assertInvariants(g);
  });
  it('Sobras mueve sin alimentar y Eso estaba en mi tesis solo funciona desde la nueva mano', () => {
    let g = rig();
    addCards(g, ['leftovers', 'inMyThesis']);
    const x = type(g, 0, 0, 'glutton'),
      y = type(g, 0, 1, 'scholar');
    y.resources.study = 2;
    g = play(g, 'food', { target: x.id });
    g = play(g, 'leftovers', { target: y.id });
    g = dispatch(g, { type: 'choose', choice: 'food' });
    expect(g.players[0].llamas[1].resources.food).toBe(1);
    expect(g.events.filter((e) => e.type === 'feed')).toHaveLength(1);
    const c = hand(g, 'inMyThesis');
    expect(() => dispatch(g, { type: 'play', card: c.id })).toThrow('nueva mano');
    g.window = { kind: 'explosion' };
    g = dispatch(g, { type: 'play', card: c.id });
    expect(g.pending?.kind).toBe('recover');
    expect(g.pending?.options.some((x) => x.id === c.id)).toBe(false);
    g = dispatch(g, { type: 'choose', choice: g.pending!.options[0].id });
    expect(g.players[0].llamas[1].resources.study).toBe(1);
    assertInvariants(g);
  });
  it('recuperación puede tomar carta apartada solo en variante explícita', () => {
    let g = rig();
    addCards(g, ['thesis']);
    const x = type(g, 0, 0, 'glutton');
    type(g, 0, 1, 'scholar', 2).resources.study = 2;
    g.config.deferredFeed = true;
    g.config.allowRecoverAside = true;
    g.fingerprint = fingerprint(g.config);
    g = play(g, 'food', { target: x.id });
    const c = g.aside[0].card;
    g.players[0].powers.push({ key: 'thesis', expires: g.turn });
    g.window = { kind: 'explosion' };
    g = dispatch(g, { type: 'recover', card: c.id });
    expect(g.aside).toHaveLength(0);
    expect(g.players[0].hand.some((x) => x.id === c.id)).toBe(true);
    assertInvariants(g);
  });
  it('constructor de transferencia y gasto respeta cantidades y no alimenta', () => {
    let g = rig();
    const c = {
      ...structuredClone(catalog[0]),
      id: 'transferCard',
      name: 'Mudanza',
      copies: 1,
      effects: [{ op: 'transfer' as const, resource: 'food' as const, amount: 2 }],
    };
    g.config.cards.push(c);
    g.deck.push({ id: `C${g.nextId++}`, def: c.id });
    g.fingerprint = fingerprint(g.config);
    const x = type(g, 0, 0, 'glutton'),
      y = type(g, 0, 1, 'scholar');
    x.resources.food = 3;
    g = play(g, c.id, { target: x.id });
    g = dispatch(g, { type: 'choose', choice: y.id });
    expect(g.players[0].llamas.map((l) => l.resources.food)).toEqual([1, 2]);
    expect(g.events.filter((e) => e.type === 'feed')).toHaveLength(0);
    assertInvariants(g);
  });
  it('nueva carta de alimentación conserva Bendición y duplica Saqueo sin depender del nombre', () => {
    let g = rig(2);
    const c = { ...structuredClone(catalog[0]), id: 'betterFood', name: 'Empanada', copies: 1 };
    g.config.cards.push(c);
    g.deck.push({ id: `C${g.nextId++}`, def: c.id });
    g.fingerprint = fingerprint(g.config);
    type(g, 0, 0, 'holy', 2);
    const x = type(g, 0, 1, 'glutton');
    g.players[0].powers.push({ key: 'blessing', expires: null });
    g.growthUsed = true;
    g = play(g, c.id, { target: x.id });
    expect(g.players[0].llamas[1].age).toBe(2);
    expect(g.players[0].hand).toHaveLength(2);
    assertInvariants(g);
  });
  it('un objetivo invalidado omite solo la parte imposible, sin devolver costes', () => {
    let g = rig();
    type(g, 0, 0, 'evil');
    const target = g.players[1].llamas[0];
    target.resources.food = 1;
    hand(g, 'alarm', 1);
    g = play(g, 'raid', {
      target: g.players[0].llamas[0].id,
      other: target.id,
      enemy: 1,
      mode: 'food',
    });
    g.players[1].llamas[0].resources.food = 0;
    g = dispatch(g, { type: 'choose', choice: 'pass' });
    expect(g.players[0].raids).toBe(0);
    expect(g.players[0].llamas[0].resources.evil).toBe(0);
    expect(g.discard.some((c) => c.def === 'raid')).toBe(true);
    assertInvariants(g);
  });
  it('plan fallido se descarta mediante comando reproducible; turno extra no adelanta preparación', () => {
    let g = rig(2);
    g.config.announce = true;
    g.fingerprint = fingerprint(g.config);
    type(g, 0, 0, 'holy', 2);
    g = play(g, 'blessing');
    const plan = g.plans[0];
    g.normalTurns = plan.readyRound;
    g.players[0].llamas[0].age = 1;
    const initial = structuredClone(g);
    g = dispatch(g, { type: 'abandon', card: plan.card.id });
    expect(g.plans).toHaveLength(0);
    expect(g.discard.some((c) => c.id === plan.card.id)).toBe(true);
    expect(stateHash(replay(exportReplay(initial, g, [])))).toBe(stateHash(g));
    assertInvariants(g);
  });
  it('recursión técnica cede control sin truncar una cadena', () => {
    let g = rig();
    g.queue = Array.from({ length: 450 }, () => ({ op: 'social', player: 0 }));
    g.phase = 'resolving';
    g = dispatch(g, { type: 'resume' });
    expect(g.queue.length).toBe(250);
    expect(g.phase).toBe('resolving');
    g = dispatch(g, { type: 'resume' });
    g = dispatch(g, { type: 'resume' });
    expect(g.queue).toHaveLength(0);
    expect(g.events.filter((e) => e.type === 'social')).toHaveLength(450);
    expect(g.phase).toBe('actions');
  });
  it('los siete perfiles se ejecutan con fallback explícito y sin acceso oculto', () => {
    for (const profile of [
      'balanced',
      'breeder',
      'aggressive',
      'researcher',
      'glutton',
      'chaotic',
      'devout',
    ] as const) {
      let g = createGame(
        presets[3],
        [
          { name: 'A', controller: 'bot', profile },
          { name: 'B', controller: 'bot', profile: 'balanced' },
        ],
        `perfil-${profile}`,
      );
      for (let n = 0; n < 50; n++) {
        const d = decide(observe(g, g.pending?.player ?? g.active), g.botRng);
        g = dispatch(g, d.action);
        g.botRng = d.rng;
        assertInvariants(g);
      }
    }
  });
});
