import { Action, Config, Game, ENGINE_VERSION } from '../engine/types';
import { createGame, dispatch, assertInvariants } from '../engine/engine';
import { fingerprint, validateConfig } from '../engine/config';
export interface Replay {
  format: 'llamas-replay';
  version: string;
  initial: Game;
  commands: Action[];
  finalFingerprint: string;
  exploratory: boolean;
  notes: Note[];
}
export interface Note {
  turn: number;
  event: number;
  tag: string;
  text: string;
}
export function exportReplay(initial: Game, current: Game, notes: Note[]): Replay {
  return {
    format: 'llamas-replay',
    version: ENGINE_VERSION,
    initial: structuredClone(initial),
    commands: structuredClone(current.commands.slice(initial.commands.length)),
    finalFingerprint: stateHash(current),
    exploratory: current.exploratory,
    notes,
  };
}
export function stateHash(g: Game): string {
  const copy = structuredClone(g);
  copy.exploratory = false;
  copy.botRng = 0;
  return fingerprint(copy as unknown as Config);
}
export function replay(r: Replay): Game {
  if (r.format !== 'llamas-replay' || r.version !== ENGINE_VERSION)
    throw Error('Replay de versión incompatible.');
  validateGame(r.initial);
  let g = structuredClone(r.initial);
  for (const a of r.commands) {
    g = dispatch(g, a);
    assertInvariants(g);
  }
  if (stateHash(g) !== r.finalFingerprint)
    throw Error('El replay no coincide con el estado final.');
  g.exploratory = r.exploratory;
  return g;
}
export function validateGame(value: unknown): Game {
  const g = value as Game;
  if (!g || g.version !== ENGINE_VERSION) throw Error('Partida de versión incompatible.');
  const c = validateConfig(g.config);
  if (!c.config) throw Error(c.errors.join('\n'));
  if (g.fingerprint !== fingerprint(g.config))
    throw Error('La configuración guardada no coincide con su huella.');
  if (
    !Array.isArray(g.players) ||
    g.players.length < 2 ||
    g.players.length > 4 ||
    !Number.isInteger(g.active) ||
    g.active < 0 ||
    g.active >= g.players.length ||
    !Array.isArray(g.events) ||
    !Array.isArray(g.commands) ||
    !['recruit', 'actions', 'resolving', 'finished'].includes(g.phase) ||
    !Number.isFinite(g.rng) ||
    !Number.isFinite(g.botRng)
  )
    throw Error('Estructura de partida inválida.');
  assertInvariants(g);
  return structuredClone(g);
}
export function download(name: string, data: unknown, type = 'application/json') {
  const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function saveLocal(key: string, data: unknown) {
  localStorage.setItem(`llamas:${key}`, JSON.stringify(data));
}
export function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`llamas:${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
export function branchGame(game: Game, config: Config): Game {
  if (game.pending || game.queue.length || game.phase === 'resolving')
    throw Error('Espera un estado estable antes de crear una rama.');
  const a = {
    ...game.config,
    id: '',
    name: '',
    target: config.target,
    reference: config.reference,
  };
  const b = { ...config, id: '', name: '' };
  if (JSON.stringify(a) !== JSON.stringify(b))
    throw Error(
      'Esta modificación cambia catálogo o reglas de estado: inicia una partida nueva. Solo la meta de victoria puede migrarse sin ambigüedad.',
    );
  const g = structuredClone(game);
  g.config = structuredClone(config);
  g.fingerprint = fingerprint(config);
  g.exploratory = true;
  const winner = g.players.find(
    (p) => p.llamas.filter((l) => l.age === 2 && l.kind !== 'holy').length >= config.target,
  );
  if (winner) {
    g.winner = winner.id;
    g.phase = 'finished';
  }
  return g;
}
export { createGame };
