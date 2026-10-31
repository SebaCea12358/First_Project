import { kindNames, resourceNames } from '../content/catalog';
import { Config, resources, CardDef, Effect } from './types';
const ops = [
  'draw',
  'discard',
  'feed',
  'resource',
  'age',
  'steal',
  'swap',
  'return',
  'install',
  'recover',
  'extra',
  'choice',
  'random',
  'explosion',
  'social',
  'connection',
  'transfer',
  'spend',
];
const kinds = ['glutton', 'scholar', 'crazy', 'explosive', 'evil', 'holy'];
export function validateConfig(input: unknown): {
  config: Config | null;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [],
    warnings: string[] = [];
  const c = input as Config;
  if (!c || typeof c !== 'object')
    return { config: null, errors: ['El archivo no es una configuración.'], warnings };
  if (c.version !== 1) errors.push('Versión de configuración incompatible.');
  if (typeof c.name !== 'string' || !c.name.trim()) errors.push('Falta el nombre.');
  for (const [key, min, max] of [
    ['initialHand', 0, 100],
    ['draw', 0, 100],
    ['target', 1, 50],
    ['initialLlamas', 0, 50],
    ['gluttonYoung', 0, 50],
    ['gluttonAdult', 0, 50],
    ['farmDraw', 0, 50],
    ['fenceCopies', 1, 5],
    ['rejectionCost', 0, 50],
    ['blessingPerLlama', 1, 1],
    ['banquetPerLlama', 1, 1],
    ['thesisRecovery', 0, 50],
  ] as const) {
    const v = c[key];
    if (!Number.isInteger(v) || v < min || v > max)
      errors.push(`${key}: entero entre ${min} y ${max}.`);
  }
  for (const key of ['reserve', 'groupLimit', 'handLimit'] as const)
    if (c[key] !== null && (!Number.isInteger(c[key]) || c[key]! < 0))
      errors.push(`${key}: entero no negativo o sin límite.`);
  if (c.groupLimit !== null && c.initialLlamas > c.groupLimit)
    errors.push('El grupo inicial supera su límite.');
  if (c.reserve !== null && c.initialLlamas * 4 > c.reserve)
    warnings.push('La reserva puede no alcanzar para cuatro grupos iniciales.');
  if (
    !Array.isArray(c.chaosWeights) ||
    c.chaosWeights.length !== 6 ||
    c.chaosWeights.some((x) => !Number.isFinite(x) || x < 0) ||
    c.chaosWeights.reduce((a, b) => a + b, 0) <= 0
  )
    errors.push(
      'La tabla de loca necesita seis pesos no negativos y suma positiva. Se normalizan explícitamente al sortear.',
    );
  for (const k of [
    'market',
    'announce',
    'explosionExtra',
    'deferredFeed',
    'autoEvents',
    'researchPersists',
    'crazyProtected',
    'allowRecoverAside',
  ] as const)
    if (typeof c[k] !== 'boolean') errors.push(`Opción ${k} inválida.`);
  if (!['extra', 'draw'].includes(c.meditation)) errors.push('Variante de meditación inválida.');
  if (
    !Array.isArray(c.rules) ||
    c.rules.some(
      (r) =>
        !r.id ||
        !r.description ||
        !r.source ||
        !['confirmed', 'provisional', 'experimental'].includes(r.status),
    )
  )
    errors.push('Metadatos de reglas inválidos.');
  if (!Array.isArray(c.cards) || !c.cards.length) errors.push('El catálogo está vacío.');
  const ids = new Set<string>();
  const checkEffects = (effects: Effect[], depth = 0) => {
    if (depth > 5 || !Array.isArray(effects) || effects.length > 30) {
      errors.push('Efectos inválidos o demasiado anidados.');
      return;
    }
    for (const e of effects) {
      if (!e || !ops.includes(e.op)) {
        errors.push('Operación de efecto no soportada.');
        continue;
      }
      if (
        e.amount !== undefined &&
        (!Number.isInteger(e.amount) ||
          Math.abs(e.amount) > 100 ||
          (e.op !== 'age' && e.amount < 0))
      )
        errors.push('Cantidad inválida.');
      if (e.resource && !resources.includes(e.resource)) errors.push('Recurso desconocido.');
      if (e.kind && !kinds.includes(e.kind)) errors.push('Tipo desconocido.');
      if (e.target && !['self', 'enemy'].includes(e.target)) errors.push('Destino desconocido.');
      if (e.op === 'feed' && !e.kind) errors.push('Alimentar requiere un tipo.');
      if (['resource', 'transfer', 'spend'].includes(e.op) && !e.resource)
        errors.push('Generar recursos requiere un recurso.');
      if (
        e.op === 'install' &&
        !['farm', 'fence', 'blessing', 'banquet', 'revelation', 'thesis'].includes(e.key || '')
      )
        errors.push('Efecto duradero desconocido.');
      if (e.op === 'steal' && !['raid', 'conversion', 'hand'].includes(e.key || ''))
        errors.push('Modo de robo no soportado.');
      if (e.op === 'connection' && !['chaos', 'leftovers'].includes(e.key || ''))
        errors.push('Conexión no soportada.');
      if (e.options) {
        if (e.options.length > 12) errors.push('Demasiadas alternativas.');
        e.options.forEach((x) => checkEffects(x, depth + 1));
      }
      if (['random', 'choice'].includes(e.op) && !e.options?.length)
        errors.push('Una elección necesita alternativas.');
    }
  };
  if (Array.isArray(c.cards))
    for (const card of c.cards) {
      if (
        !card ||
        typeof card.id !== 'string' ||
        !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(card.id) ||
        ids.has(card.id)
      ) {
        errors.push('IDs de carta inválidos o duplicados.');
        continue;
      }
      ids.add(card.id);
      if (!card.name || !Number.isInteger(card.copies) || card.copies < 0 || card.copies > 300)
        errors.push(`${card.id}: nombre o copias inválidas.`);
      if (
        !card.cost ||
        Object.entries(card.cost).some(
          ([k, v]) => !resources.includes(k as never) || !Number.isInteger(v) || v! < 0 || v! > 100,
        )
      )
        errors.push(`${card.id}: coste inválido.`);
      if (
        !card.requirements ||
        Object.entries(card.requirements).some(([k, v]) =>
          ['kind', 'secondKind'].includes(k)
            ? !kinds.includes(String(v))
            : !['adults', 'count', 'raids', 'feeds'].includes(k) ||
              !Number.isInteger(v) ||
              Number(v) < 0 ||
              Number(v) > 100,
        )
      )
        errors.push(`${card.id}: requisitos inválidos.`);
      if (
        !['resource', 'attack', 'reaction', 'research', 'power', 'event', 'connection'].includes(
          card.category,
        ) ||
        !['none', 'own', 'enemy', 'pair'].includes(card.targets) ||
        !['turn', 'permanent'].includes(card.duration) ||
        !Number.isInteger(card.limit) ||
        card.limit < 0
      )
        errors.push(`${card.id}: categoría, objetivos, duración o límite inválidos.`);
      if (
        !Array.isArray(card.triggers) ||
        !Array.isArray(card.modules) ||
        !Array.isArray(card.reactionWindows)
      )
        errors.push(`${card.id}: metadatos inválidos.`);
      checkEffects(card.effects);
    }
  if (Array.isArray(c.cards)) {
    const enabled = c.cards.filter((x) => x.copies > 0);
    if (!enabled.length) errors.push('El mazo necesita cartas.');
    if (
      enabled.some((x) => x.effects.some((e) => e.op === 'install' && e.key === 'revelation')) &&
      c.chaosWeights.filter((w) => w > 0).length < 3
    )
      errors.push('Revelación requiere tres resultados de loca con peso positivo.');
    const produced = new Set(
      enabled
        .flatMap((x) =>
          x.effects.filter((e) => e.op === 'feed' || e.op === 'resource').map((e) => e.resource),
        )
        .filter(Boolean),
    );
    if (enabled.some((x) => x.effects.some((e) => e.op === 'steal' && e.key === 'raid')))
      produced.add('evil');
    if (enabled.some((x) => x.effects.some((e) => e.op === 'explosion'))) produced.add('bomb');
    if (enabled.some((x) => x.effects.some((e) => e.kind === 'crazy'))) {
      if (c.chaosWeights[3] > 0) produced.add('study');
      if (c.chaosWeights[4] > 0) produced.add('food');
    }
    for (const card of enabled) {
      for (const r of Object.keys(card.cost))
        if (!produced.has(r as never))
          errors.push(`${card.name}: exige ${r}, sin fuente en el mazo.`);
      if (
        card.requirements.kind === 'holy' &&
        !enabled.some((x) => x.effects.some((e) => e.kind === 'holy'))
      )
        errors.push(`${card.name}: no hay forma de obtener santa.`);
    }
    if (c.cards.reduce((n, x) => n + x.copies, 0) > 1500)
      errors.push('Máximo técnico del catálogo: 1500 cartas físicas.');
    if (
      !enabled.some(
        (x) => x.effects.some((e) => e.op === 'feed') || ['raid', 'explosion'].includes(x.id),
      )
    )
      warnings.push('No hay una ruta de crecimiento: las partidas podrían quedar incompletas.');
  }
  if (c.announce)
    warnings.push(
      'Anuncio experimental: exige esperar una vuelta normal; perder requisitos descarta la poderosa.',
    );
  if (c.cards?.some((x) => x.id === 'thesis' && x.copies))
    warnings.push('Tesis es un prototipo para rediseñar, no una recomendación de balance.');
  return { config: errors.length ? null : structuredClone(c), errors, warnings };
}
export function fingerprint(c: Config): string {
  let h = 2166136261;
  for (const x of JSON.stringify(c)) {
    h ^= x.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
export function effectText(e: Effect): string {
  const names: Record<string, string> = {
    draw: 'Robar cartas',
    discard: 'Descartar al azar',
    feed: 'Alimentar',
    resource: 'Generar recurso',
    age: 'Cambiar edad con permiso',
    steal: 'Robar',
    swap: 'Intercambiar llamas',
    return: 'Devolver bebé',
    install: 'Instalar efecto',
    recover: 'Recuperar carta',
    extra: 'Turno extra',
    choice: 'Elegir efecto',
    random: 'Efecto aleatorio',
    explosion: 'Explosión global',
    social: 'Acción social',
    connection: 'Conexión',
    transfer: 'Transferir recurso',
    spend: 'Gastar recurso',
  };
  return `${names[e.op]}${e.kind ? ` (${kindNames[e.kind]})` : ''}${e.resource ? ` · ${resourceNames[e.resource]}` : ''}${e.amount !== undefined ? ` ${e.amount}` : ''}${e.key ? ` [${e.key}]` : ''}`;
}
export function derivedText(c: CardDef): string {
  return c.effects.map(effectText).join(' → ') || 'Reacción opcional de defensa';
}
