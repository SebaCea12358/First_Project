import { Config, Game, Profile } from '../engine/types';
import { createGame, dispatch, assertInvariants, adults } from '../engine/engine';
import { decide, observe } from '../bots/policy';
export interface Result {
  preset: string;
  fingerprint: string;
  seed: string;
  rotation: number;
  winner: number | null;
  profile: string | null;
  status: 'completed' | 'censored' | 'interrupted';
  turns: number;
  actions: number;
  events: number;
  milliseconds: number;
  attacks: number;
  blocked: number;
  successfulAttacks: number;
  powersActivated: number;
  growth: number;
  leaderChanges: number;
  exploratory: boolean;
  snapshot: boolean;
}
export function simulate(
  config: Config,
  seed: string,
  profiles: Profile[],
  rotation = 0,
  budget = 2500,
  milliseconds = 15000,
  onProgress?: (r: Result) => void,
): Result {
  let g = createGame(
    config,
    profiles.map((_, i) => ({
      name: `Bot ${i + 1}`,
      controller: 'bot',
      profile: profiles[(i + rotation) % profiles.length],
    })),
    seed,
    0,
  );
  const start = performance.now();
  let n = 0,
    leader = -1,
    changes = 0;
  onProgress?.({ ...result(g, seed, rotation, 0, 0, 'interrupted'), snapshot: true });
  while (g.winner === null && n < budget && performance.now() - start < milliseconds) {
    const seat = g.pending?.player ?? g.active;
    const d = decide(observe(g, seat), g.botRng);
    g = dispatch(g, d.action);
    g.botRng = d.rng;
    assertInvariants(g);
    const scores = g.players.map(adults);
    const max = Math.max(...scores);
    const next = scores.filter((x) => x === max).length === 1 ? scores.indexOf(max) : -1;
    if (next !== leader && next !== -1) {
      if (leader !== -1) changes++;
      leader = next;
    }
    n++;
    if (n % 25 === 0)
      onProgress?.({
        ...result(g, seed, rotation, n, performance.now() - start, 'interrupted', changes),
        snapshot: true,
      });
  }
  return result(
    g,
    seed,
    rotation,
    n,
    performance.now() - start,
    g.winner !== null ? 'completed' : 'censored',
    changes,
  );
}
export function result(
  g: Game,
  seed: string,
  rotation: number,
  actions: number,
  milliseconds: number,
  status: Result['status'],
  leaderChanges = 0,
): Result {
  return {
    preset: g.config.name,
    fingerprint: g.fingerprint,
    seed,
    rotation,
    winner: g.winner,
    profile: g.winner === null ? null : g.players[g.winner].profile,
    status,
    turns: g.turn,
    actions,
    events: g.events.length,
    milliseconds,
    attacks: g.events.filter((e) => e.type === 'attack').length,
    blocked: g.events.filter((e) => e.type === 'blocked').length,
    successfulAttacks: g.events.filter((e) =>
      ['raid', 'conversion', 'swap', 'handTheft', 'return', 'age'].includes(e.type),
    ).length,
    powersActivated: g.events.filter(
      (e) => e.type === 'install' && !['farm', 'fence'].includes(String(e.data?.key)),
    ).length,
    growth: g.events.filter((e) => e.type === 'growth').length,
    leaderChanges,
    exploratory: g.exploratory,
    snapshot: false,
  };
}
export function csv(rows: Result[]): string {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]) as (keyof Result)[];
  return [
    keys.join(','),
    ...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? '')).join(',')),
  ].join('\n');
}
