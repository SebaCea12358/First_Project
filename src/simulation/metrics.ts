import { Game } from '../engine/types';
import { adults, dispatch, legalActions } from '../engine/engine';
import { Replay } from '../persistence/storage';
/** Reconstruye una serie pública sin exportar identidades de manos o mazo. */
export function timeline(initial: Game, commands: Replay['commands']) {
  let g = structuredClone(initial);
  const rows: Record<string, unknown>[] = [];
  const add = (index: number) => {
    const counts = legalActions(g).reduce<Record<string, number>>((m, o) => {
      const k = o.action.type;
      m[k] = (m[k] || 0) + 1;
      return m;
    }, {});
    rows.push({
      decision: index,
      turn: g.turn,
      round: g.round,
      extra: g.extra,
      active: g.active,
      phase: g.phase,
      winner: g.winner,
      legalCount: Object.values(counts).reduce((a, b) => a + b, 0),
      legalGroups: counts,
      players: g.players.map((p) => ({
        seat: p.id,
        handCount: p.hand.length,
        adults: adults(p),
        research: p.research,
        powers: p.powers,
        raids: p.raids,
        crazyFeeds: p.crazyFeeds,
        llamas: p.llamas,
      })),
      events: g.events.length,
      attacks: g.events.filter((e) => e.type === 'attack').length,
      blocked: g.events.filter((e) => e.type === 'blocked').length,
    });
  };
  add(0);
  for (const [i, a] of commands.entries()) {
    g = dispatch(g, a);
    add(i + 1);
  }
  return rows;
}
