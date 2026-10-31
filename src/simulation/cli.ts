import { presets } from '../content/catalog';
import { simulate, csv } from './run';
import { validateConfig } from '../engine/config';
import { readFileSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
const budget = Number(args[args.indexOf('--budget') + 1]) || 1200;
const count = Number(args[args.indexOf('--seeds') + 1]) || 2;
const imported = args.includes('--config')
  ? validateConfig(JSON.parse(readFileSync(args[args.indexOf('--config') + 1], 'utf8')))
  : null;
if (imported && !imported.config) throw Error(imported.errors.join('\n'));
const selected = imported?.config
  ? [imported.config]
  : presets.filter(
      (p) => !args.includes('--preset') || p.id === args[args.indexOf('--preset') + 1],
    );
if (!selected.length) throw Error('Preset desconocido.');
const results = [];
for (const c of selected)
  for (let s = 0; s < count; s++)
    for (let rotation = 0; rotation < 3; rotation++) {
      const r = simulate(c, `lote-${s}`, ['breeder', 'aggressive', 'researcher'], rotation, budget);
      results.push(r);
      console.log(
        `${c.name} / ${r.seed} / rotación ${rotation}: ${r.status}, ganador ${r.winner ?? '—'}, ${r.turns} turnos`,
      );
    }
writeFileSync('simulation-results.csv', csv(results));
console.log(
  'Resultados: simulation-results.csv. Las censuradas no tienen ganador ni se cuentan como derrota.',
);
