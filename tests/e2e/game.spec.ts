import { test, expect, Page } from '@playwright/test';
import { presets, catalog } from '../../src/content/catalog';
import {
  createGame,
  newLlama,
  legalActions,
  dispatch,
  assertInvariants,
} from '../../src/engine/engine';
import { decide, observe } from '../../src/bots/policy';
import { Config, Game, Kind } from '../../src/engine/types';
import { fingerprint } from '../../src/engine/config';
import { exportReplay } from '../../src/persistence/storage';
function rig(preset = 0) {
  const c = structuredClone(presets[preset]);
  c.initialHand = 0;
  c.draw = 0;
  const g = createGame(
    c,
    [
      { name: 'Tú', controller: 'human', profile: 'balanced' },
      { name: 'Bot', controller: 'bot', profile: 'aggressive' },
    ],
    'browser',
  );
  g.phase = 'actions';
  g.players.forEach((p) => (p.llamas = [newLlama(g), newLlama(g)]));
  return g;
}
function give(g: Game, id: string, seat = 0) {
  const i = g.deck.findIndex((c) => c.def === id);
  if (i < 0) throw Error(id);
  const [c] = g.deck.splice(i, 1);
  g.players[seat].hand.push(c);
  return c;
}
function kind(g: Game, seat: number, index: number, k: Kind, age: 1 | 2 = 1) {
  const l = g.players[seat].llamas[index];
  l.kind = k;
  l.age = age;
  return l;
}
async function load(page: Page, g: Game) {
  assertInvariants(g);
  await page.evaluate((data) => localStorage.setItem('llamas:autosave', JSON.stringify(data)), {
    game: g,
    initial: structuredClone(g),
    notes: [],
    telemetry: [],
  });
  await page.getByRole('button', { name: 'Continuar guardada', exact: true }).click();
}
async function play(page: Page, g: Game, cardId: string, index = 0) {
  await page
    .locator('.playing-card')
    .filter({ has: page.locator('.card-code', { hasText: cardId + ' ·' }) })
    .click();
  const panel = page.getByRole('region', { name: 'Preparar jugada' });
  await panel.getByLabel('Modo y objetivos').selectOption(String(index));
  await panel.getByRole('button', { name: 'Confirmar jugada' }).click();
}
async function saved(page: Page): Promise<Game> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('llamas:autosave')!).game);
}

test('mesa real: una persona y dos bots completan partida desde configuración', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Taller de variantes', exact: true }).click();
  await page.getByRole('button', { name: 'Parámetros', exact: true }).click();
  await page.getByLabel('Adultas para ganar').fill('1');
  await page.getByRole('button', { name: 'Usar en partida nueva' }).click();
  await page.getByLabel('Tiempo entre decisiones').selectOption('100');
  let winner = false;
  for (let step = 0; step < 350; step++) {
    const g = await saved(page);
    if (g.winner !== null) {
      winner = true;
      break;
    }
    const seat = g.pending?.player ?? g.active;
    if (g.players[seat].controller === 'human') {
      const d = decide(observe(g, seat), 555 + step);
      const a = d.action;
      if (a.type === 'recruit')
        await page.getByRole('button', { name: 'Incorporar bebé', exact: true }).click();
      else if (a.type === 'skipRecruit')
        await page.getByRole('button', { name: 'Omitir', exact: true }).click();
      else if (a.type === 'end')
        await page.getByRole('button', { name: 'Terminar turno →', exact: true }).click();
      else if (a.type === 'choose') {
        const label = g.pending!.options.find((o) => o.id === a.choice)!.label;
        await page.getByRole('button', { name: label, exact: true }).click();
      } else if (a.type === 'play') {
        const opts = legalActions(g).filter((o) => o.action.card === a.card);
        await play(
          page,
          g,
          a.card!,
          opts.findIndex(
            (o) => JSON.stringify(o.action) === JSON.stringify({ ...a, payment: undefined }),
          ),
        );
      } else throw Error(`Acción inesperada ${a.type}`);
    } else await page.waitForTimeout(70);
  }
  expect(winner).toBe(true);
  await expect(page.getByRole('heading', { name: 'Una victoria muy bien criada.' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('pago desde fuentes diferentes en la mesa', async ({ page }) => {
  await page.goto('/');
  let g = rig();
  kind(g, 0, 0, 'scholar', 2).resources.study = 2;
  kind(g, 0, 1, 'glutton').resources.study = 2;
  const farm = give(g, 'farm');
  give(g, 'alarm');
  await load(page, g);
  await page.locator('.playing-card').filter({ hasText: 'Granja especializada' }).click();
  const panel = page.getByRole('region', { name: 'Preparar jugada' });
  await panel.getByLabel(`Pago ${g.players[0].llamas[0].id} study`).fill('0');
  await panel.getByLabel(`Pago ${g.players[0].llamas[1].id} study`).fill('2');
  await panel.getByRole('button', { name: 'Confirmar jugada' }).click();
  g = await saved(page);
  expect(g.players[0].llamas[0].resources.study).toBe(2);
  expect(g.players[0].llamas[1].resources.study).toBe(0);
});

test('defensa real: cancelar y pasar, manteniendo los costes', async ({ page }) => {
  await page.goto('/');
  for (const block of [true, false]) {
    let g = rig();
    kind(g, 1, 0, 'evil').resources.chaos = 1;
    give(g, 'alarm', 0);
    const baby = g.players[0].llamas[0];
    const raid = give(g, 'raid', 1);
    g.active = 1;
    g = dispatch(g, {
      type: 'play',
      card: raid.id,
      enemy: 0,
      target: g.players[1].llamas[0].id,
      other: baby.id,
      mode: 'baby',
    });
    if (block) await load(page, g);
    else {
      await page.getByRole('button', { name: '＋ Nueva partida', exact: true }).click();
      await load(page, g);
    }
    await expect(page.getByRole('heading', { name: /¿usar Alarma/ })).toBeVisible();
    await page
      .getByRole('button', {
        name: block ? 'Usar Alarma de llama' : 'Pasar: permitir el ataque',
        exact: true,
      })
      .click();
    const next = await saved(page);
    expect(next.players[0].llamas.some((x) => x.id === baby.id)).toBe(block);
    expect(next.players[1].raids).toBe(block ? 0 : 1);
    expect(next.pending).toBeNull();
  }
});

test('Revelación y robo selectivo ofrecen decisiones verdaderas', async ({ page }) => {
  await page.goto('/');
  let g = rig(3);
  kind(g, 0, 0, 'crazy', 2).resources.chaos = 2;
  g.players[0].crazyFeeds = 3;
  const revelation = give(g, 'revelation');
  const chaos = give(g, 'chaos');
  g = dispatch(g, { type: 'play', card: revelation.id });
  await load(page, g);
  await play(page, g, chaos.id);
  await expect(page.getByRole('heading', { name: /elige el primer resultado/ })).toBeVisible();
  await page
    .getByRole('region', { name: 'Decisión pendiente' })
    .getByRole('button')
    .filter({ hasText: /^(?!Robar una carta rival)/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: /segundo resultado/ })).toBeVisible();
  await page
    .getByRole('region', { name: 'Decisión pendiente' })
    .getByRole('button')
    .filter({ hasText: /^(?!Robar una carta rival)/ })
    .first()
    .click();
  g = await saved(page);
  expect(g.events.filter((e) => e.type === 'chaos')).toHaveLength(2);
  await page.getByRole('button', { name: '＋ Nueva partida', exact: true }).click();
  g = rig(1);
  const l = kind(g, 0, 0, 'evil');
  l.resources.evil = 1;
  l.resources.study = 1;
  give(g, 'food', 1);
  give(g, 'study', 1);
  const theft = give(g, 'handTheft');
  await load(page, g);
  const offers = legalActions(g).filter((o) => o.action.card === theft.id);
  const idx = offers.findIndex((o) => o.action.mode === 'select');
  await play(page, g, theft.id, idx);
  await expect(page.getByRole('heading', { name: /Mano revelada/ })).toBeVisible();
  await page
    .getByRole('region', { name: 'Decisión pendiente' })
    .getByRole('button', { name: 'Estudio', exact: true })
    .click();
  expect((await saved(page)).players[0].hand.some((c) => c.def === 'study')).toBe(true);
});

test('taller: clonar, editar costes/copias, quitar y crear Robar dos; partida editable', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Taller de variantes', exact: true }).click();
  await page.getByLabel('Copias', { exact: true }).fill('12');
  await page.getByLabel('comida', { exact: true }).fill('1');
  await page.locator('.card-list button').filter({ hasText: 'Escupir' }).click();
  await page.getByRole('button', { name: 'Quitar del mazo (0 copias)', exact: true }).click();
  await page.getByRole('button', { name: '＋ Crear carta', exact: true }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Dos ideas brillantes');
  await page.getByRole('button', { name: 'Guardar variante', exact: true }).click();
  const config = (await page.evaluate(
    () => JSON.parse(localStorage.getItem('llamas:presets')!)[0],
  )) as Config;
  expect(config.cards[0].copies).toBe(12);
  expect(config.cards[0].cost.food).toBe(1);
  expect(config.cards.find((c) => c.id === 'spit')?.copies).toBe(0);
  expect(config.cards.at(-1)?.effects).toEqual([{ op: 'draw', amount: 2 }]);
  await page.getByRole('button', { name: 'Usar en partida nueva', exact: true }).click();
  await page.getByRole('button', { name: '＋ Nueva partida', exact: true }).click();
  const g = createGame(
    { ...config, initialHand: 0, draw: 0 },
    [
      { name: 'Tú', controller: 'human', profile: 'balanced' },
      { name: 'Bot', controller: 'bot', profile: 'balanced' },
    ],
    'custom',
  );
  g.phase = 'actions';
  const c = give(g, config.cards.at(-1)!.id);
  await load(page, g);
  await play(page, g, c.id);
  expect((await saved(page)).players[0].hand.length).toBe(2);
  await page.getByRole('button', { name: 'Taller de variantes', exact: true }).click();
  await page.getByRole('button', { name: /Estudio18/ }).count();
});

test('guardar, recargar, replay exacto, deshacer/repetir y tomar control', async ({ page }) => {
  await page.goto('/');
  let g = rig();
  const c = give(g, 'food');
  const initial = structuredClone(g);
  await load(page, g);
  await play(page, g, c.id);
  g = await saved(page);
  await page.getByText('Inspector de laboratorio', { exact: true }).click();
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  expect((await saved(page)).players[0].llamas[0].age).toBe(0);
  await page.getByRole('button', { name: 'Repetir', exact: true }).click();
  expect((await saved(page)).players[0].llamas[0].age).toBe(1);
  await page.reload();
  await page.getByRole('button', { name: 'Continuar guardada', exact: true }).click();
  expect((await saved(page)).players[0].llamas[0].age).toBe(1);
  await page.getByText('Guardar y exportar', { exact: true }).click();
  const file = exportReplay(initial, g, []);
  await page
    .locator('input[type=file]')
    .last()
    .setInputFiles({
      name: 'replay.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(file)),
    });
  await expect(page.getByRole('alert')).toContainText('Replay reproducido y verificado');
  await page.getByRole('button', { name: 'Volver al inicio', exact: true }).click();
  expect((await saved(page)).players[0].llamas[0].age).toBe(0);
  await page.getByRole('button', { name: 'Siguiente decisión', exact: true }).click();
  expect((await saved(page)).players[0].llamas[0].age).toBe(1);
  await page.getByRole('button', { name: 'Continuar como rama exploratoria', exact: true }).click();
  await page.getByText('Inspector de laboratorio', { exact: true }).click();
  await page.getByLabel('Tomar control de un asiento').selectOption('1');
  expect((await saved(page)).exploratory).toBe(true);
  expect((await saved(page)).players[1].controller).toBe('human');
});

test('santa y excepción: dos llamas crecen y rejuvenecer suspende Bendición', async ({ page }) => {
  await page.goto('/');
  let g = rig(2);
  kind(g, 0, 0, 'holy', 2);
  const x = kind(g, 0, 1, 'scholar');
  const y = newLlama(g);
  y.kind = 'glutton';
  y.age = 1;
  g.players[0].llamas.push(y);
  const blessing = give(g, 'blessing');
  const study = give(g, 'study');
  const food = give(g, 'food');
  g = dispatch(g, { type: 'play', card: blessing.id });
  await load(page, g);
  await play(page, g, study.id);
  g = await saved(page);
  expect(g.players[0].llamas[1].age).toBe(2);
  await play(page, g, food.id);
  g = await saved(page);
  expect(g.players[0].llamas[2].age).toBe(2);
  expect(g.events.filter((e) => e.type === 'growth').map((e) => e.data?.permission)).toEqual([
    'global',
    'blessing',
  ]);
  await page.getByRole('button', { name: '＋ Nueva partida', exact: true }).click();
  g.active = 1;
  kind(g, 1, 0, 'crazy').resources.chaos = 1;
  const spit = give(g, 'spit', 1);
  g = dispatch(g, { type: 'play', card: spit.id, enemy: 0, target: g.players[0].llamas[0].id });
  await load(page, g);
  await expect(page.locator('.own-herd .power-chip')).toContainText('suspendido');
});

test('espectador pausa/paso y lote con CSV sin bloquear interfaz', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Tu asiento').selectOption('-1');
  await page.getByRole('button', { name: /Sentarse a jugar/ }).click();
  await page.getByRole('button', { name: 'Ⅱ Pausar bots', exact: true }).click();
  const before = (await saved(page)).commands.length;
  await page.getByRole('button', { name: 'Un paso', exact: true }).click();
  expect((await saved(page)).commands.length).toBe(before + 1);
  await page.getByRole('button', { name: 'Laboratorio', exact: true }).click();
  await page.getByLabel('Presupuesto por partida').fill('10');
  await page.getByLabel('Semillas, separadas por coma').fill('e2e');
  await page.getByRole('button', { name: 'Ejecutar comparación', exact: true }).click();
  await expect(page.getByRole('heading', { name: '6 partidas registradas' })).toBeVisible({
    timeout: 30000,
  });
  const promise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV', exact: true }).click();
  expect((await promise).suggestedFilename()).toBe('llamas-comparacion.csv');
});

test('captura de mesa y layout pequeño sin errores de página', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Sentarse a jugar/ }).click();
  await page.getByRole('button', { name: 'Incorporar bebé', exact: true }).click();
  await page.screenshot({ path: 'test-results/mesa-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'La mesa', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/mesa-mobile.png', fullPage: true });
});

test('cadena larga de alimentaciones desde la UI sin límite humano artificial', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto('/');
  const g = rig();
  kind(g, 0, 0, 'glutton', 2);
  g.config.cards.forEach((c) => (c.copies = c.id === 'food' ? 100 : 0));
  g.deck = g.deck.filter((c) => c.def === 'food');
  for (let i = 18; i < 100; i++) g.deck.push({ id: `C${g.nextId++}`, def: 'food' });
  g.fingerprint = fingerprint(g.config);
  for (let i = 0; i < 15; i++) give(g, 'food');
  await load(page, g);
  for (let i = 0; i < 30; i++) {
    const state = await saved(page);
    const c = state.players[0].hand.find((c) => c.def === 'food');
    expect(c).toBeTruthy();
    await play(page, state, c!.id);
  }
  const final = await saved(page);
  expect(final.events.filter((e) => e.type === 'feed')).toHaveLength(30);
  expect(final.players[0].llamas[0].resources.food).toBe(30);
  await expect(page.getByRole('button', { name: 'Terminar turno →', exact: true })).toBeVisible();
});
