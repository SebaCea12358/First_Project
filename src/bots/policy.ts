import { Action, Game, Offer, Profile, Payment, resources } from '../engine/types';
import { adults, legalActions, total } from '../engine/engine';
export interface BotDecision {
  action: Action;
  explanation: string;
  alternatives: { label: string; score: number }[];
  legalCount: number;
  consideredCount: number;
  rng: number;
}
/** La única entrada del bot. No contiene manos rivales, mazo ordenado ni RNG del juego. */
export function observe(g: Game, seat: number): Game {
  const v = structuredClone(g);
  v.rng = 0;
  v.botRng = 0;
  v.seed = 'oculta';
  v.deck = v.deck.map((_, i) => ({ id: `hidden-deck-${i}`, def: 'hidden' }));
  for (const p of v.players)
    if (p.id !== seat)
      p.hand = p.hand.map((_, i) => ({ id: `hidden-${p.id}-${i}`, def: 'hidden' }));
  v.commands = [];
  if (v.pending?.player !== seat && v.pending) {
    v.pending.options = [];
    delete v.pending.revealed;
  }
  return v;
}
function next(rng: number): [number, number] {
  let x = rng + 0x6d2b79f5;
  let t = Math.imul(x ^ (x >>> 15), x | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, x >>> 0];
}
function score(v: Game, o: Offer, profile: Profile): number {
  const a = o.action,
    p = v.players[v.pending?.player ?? v.active];
  if (a.type === 'end') return 0;
  if (a.type === 'recruit') return 40;
  if (a.type === 'skipRecruit') return -1;
  if (a.type === 'resume') return 50;
  if (a.type === 'recover') return 3;
  if (a.type === 'choose') {
    const option = v.pending!.options.find((x) => x.id === a.choice)!;
    if (v.pending!.kind === 'alarm') return a.choice === 'pass' ? -2 : 8;
    if (a.choice === 'skip') return -1;
    return option.effects.reduce(
      (n, e) =>
        n +
        (e.op === 'feed'
          ? 12
          : e.op === 'draw'
            ? 6
            : e.op === 'chaosResult'
              ? [7, -4, 5, 4, 3, 0][e.amount!]
              : e.op === 'takeCard'
                ? 5
                : 2),
      0,
    );
  }
  const d = o.card;
  if (!d) return -3;
  let value = 0;
  const l = p.llamas.find((x) => x.id === a.target);
  const enemy = v.players[a.enemy ?? -1];
  const target = enemy?.llamas.find((x) => x.id === (a.other || a.target));
  for (const e of d.effects) {
    if (e.op === 'feed' || e.op === 'explosion') {
      const canGrow =
        l &&
        l.age < 2 &&
        (!v.growthUsed ||
          (p.powers.some((x) => x.key === 'blessing') &&
            p.llamas.some((x) => x.kind === 'holy' && x.age === 2) &&
            !v.grown.includes(l.id)));
      value += canGrow ? (l?.age === 1 ? 22 : 17) : 0;
      const resource = e.resource || 'bomb';
      const stock = total(p, resource);
      value += Math.max(-8, 5 - stock * 1.8);
      if (e.kind === 'glutton') value += Math.max(-4, 3 - p.hand.length * 0.12);
      if (a.grow === false) value -= 6;
      const desired =
        profile === 'researcher'
          ? 'scholar'
          : profile === 'glutton'
            ? 'glutton'
            : profile === 'chaotic'
              ? 'crazy'
              : profile === 'devout'
                ? 'holy'
                : null;
      if (desired && e.kind === desired) value += canGrow ? 9 : Math.max(0, 3 - stock);
      if (profile === 'devout' && e.kind === 'evil') value -= 20;
      if (profile === 'breeder' && canGrow) value += 7;
    } else if (e.op === 'steal' || e.op === 'swap' || e.op === 'age' || e.op === 'return') {
      value += target ? (target.age === 2 ? 16 : target.age === 1 ? 7 : 5) : 3;
      if (e.key === 'raid' && !v.growthUsed) value += 12;
      if (profile === 'aggressive') value += 7;
      if (enemy && adults(enemy) >= v.config.target - 1) value += 15;
      if (e.key === 'hand') value -= 2;
      if (target && target.id === a.target && target.kind === 'holy') value += 3;
    } else if (e.op === 'install')
      value += d.category === 'power' ? 25 : profile === 'researcher' ? 18 : 12;
    else if (e.op === 'draw') value += (e.amount ?? 1) * 3;
    else if (e.op === 'extra') value += 15;
    else if (e.op === 'social') value -= 2;
    else value += 2;
  }
  value -= Object.values(o.cost).reduce((n, x) => n + (x || 0) * 2, 0);
  value -= Math.max(0, v.turnActions - 20) * 0.8;
  return value;
}
export function decide(view: Game, rng: number): BotDecision {
  const seat = view.pending?.player ?? view.active;
  const offers = legalActions(view);
  if (!offers.length) throw Error('Sin decisiones legales.');
  const profile = view.players[seat].profile;
  // Solo la política reduce opciones equivalentes; la API humana conserva todas las cartas/objetivos.
  const seen = new Set<string>();
  const candidates = offers.filter((o) => {
    const k = JSON.stringify({ ...o.action, card: o.card?.id || o.action.card });
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const ranked = candidates
    .map((o) => {
      let r;
      [r, rng] = next(rng);
      return { o, score: score(view, o, profile), tie: r };
    })
    .sort((a, b) => b.score - a.score || b.tie - a.tie);
  const best = ranked[0];
  const action = { ...best.o.action };
  if (Object.values(best.o.cost).some(Boolean)) {
    const payment: Payment = [];
    for (const r of resources) {
      let need = best.o.cost[r] || 0;
      const sources = [...view.players[seat].llamas].sort(
        (a, b) => b.resources[r] + b.age * 0.5 - (a.resources[r] + a.age * 0.5),
      );
      for (const l of sources) {
        const amount = Math.min(need, l.resources[r]);
        if (amount) {
          payment.push({ llama: l.id, resource: r, amount });
          need -= amount;
        }
      }
    }
    action.payment = payment;
  }
  return {
    action,
    explanation: `${best.o.label}: valor heurístico ${best.score.toFixed(1)}; perfil ${profile}. Consideré ${candidates.length} de ${offers.length} opciones legales. No es una probabilidad de victoria.`,
    alternatives: ranked.slice(0, 4).map((x) => ({ label: x.o.label, score: x.score })),
    legalCount: offers.length,
    consideredCount: candidates.length,
    rng,
  };
}
