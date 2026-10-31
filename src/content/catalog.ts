import { CardDef, Config, Effect, Kind, Resource, Rule } from '../engine/types';
export const kindNames: Record<Kind, string> = {
  glutton: 'Glotona',
  scholar: 'Estudiosa',
  crazy: 'Loca',
  explosive: 'Explosiva',
  evil: 'Malvada',
  holy: 'Santa',
};
export const kindIcons: Record<Kind, string> = {
  glutton: '🍎',
  scholar: '📚',
  crazy: '🍃',
  explosive: '💥',
  evil: '😈',
  holy: '🍄',
};
export const resourceNames: Record<Resource, string> = {
  food: 'comida',
  study: 'estudio',
  chaos: 'caos',
  bomb: 'bomba',
  evil: 'maldad',
};
export const ageNames = ['Bebé', 'Joven', 'Adulta'];
const card = (
  id: string,
  name: string,
  copies: number,
  text: string,
  effects: Effect[],
  extra: Partial<CardDef> = {},
): CardDef => ({
  id,
  name,
  copies,
  text,
  effects,
  flavor: 'La vida en el altiplano nunca fue tan tranquila.',
  category: 'event',
  cost: {},
  requirements: {},
  targets: 'none',
  triggers: [],
  duration: 'turn',
  reactionWindows: [],
  modules: [],
  limit: 0,
  ...extra,
});
export const catalog: CardDef[] = [
  card(
    'food',
    'Comida',
    18,
    'Agrega comida 1; alimenta una glotona y roba una carta.',
    [{ op: 'feed', kind: 'glutton', resource: 'food', amount: 1 }],
    { category: 'resource', targets: 'own', flavor: 'Otra porción. Por razones científicas.' },
  ),
  card(
    'study',
    'Estudio',
    18,
    'Agrega estudio 1; alimenta una estudiosa.',
    [{ op: 'feed', kind: 'scholar', resource: 'study', amount: 1 }],
    { category: 'resource', targets: 'own', flavor: 'La bibliografía también se mastica.' },
  ),
  card(
    'chaos',
    'Hierba de la loca',
    18,
    'Agrega caos 1; alimenta una loca y resuelve su tabla.',
    [{ op: 'feed', kind: 'crazy', resource: 'chaos', amount: 1 }],
    { category: 'resource', targets: 'own', flavor: 'Has entendido todo. Casi.' },
  ),
  card(
    'raid',
    'Saqueo',
    14,
    'Roba una bebé o un recurso. Si funciona, genera maldad 1 y activa una malvada.',
    [{ op: 'steal', key: 'raid' }],
    { category: 'attack', targets: 'pair', reactionWindows: ['alarm'] },
  ),
  card(
    'explosion',
    'Explosión',
    10,
    'Todos reemplazan la mano restante. Activa solo una explosiva propia.',
    [{ op: 'explosion' }],
    { targets: 'own', flavor: 'Estaba así cuando llegué.' },
  ),
  card(
    'spit',
    'Escupir',
    8,
    'Paga caos 1 o bomba 1. Una adulta rival vuelve a joven conservando recursos.',
    [{ op: 'age', amount: -1, target: 'enemy' }],
    { category: 'attack', cost: { chaos: 1 }, targets: 'enemy', reactionWindows: ['alarm'] },
  ),
  card(
    'conversion',
    'Conversión',
    4,
    'Paga maldad 2. Roba una joven o adulta; conserva edad y pierde recursos.',
    [{ op: 'steal', key: 'conversion' }],
    { category: 'attack', cost: { evil: 2 }, targets: 'enemy', reactionWindows: ['alarm'] },
  ),
  card(
    'alarm',
    'Alarma de llama',
    6,
    'Descarta para cancelar un ataque a tu grupo o mano. No cancela explosiones globales.',
    [],
    { category: 'reaction', reactionWindows: ['attack'] },
  ),
  card(
    'farm',
    'Granja especializada',
    2,
    'Estudiosa adulta + estudio 2. Roba una carta extra al inicio de tus siguientes turnos.',
    [{ op: 'install', key: 'farm' }],
    {
      category: 'research',
      cost: { study: 2 },
      requirements: { kind: 'scholar', adults: 1 },
      duration: 'permanent',
      limit: 1,
    },
  ),
  card(
    'fence',
    'Valla eléctrica',
    2,
    'Estudiosa adulta + estudio 2. Robar una llama exige dos cartas iguales del ataque.',
    [{ op: 'install', key: 'fence' }],
    {
      category: 'research',
      cost: { study: 2 },
      requirements: { kind: 'scholar', adults: 1 },
      duration: 'permanent',
      limit: 1,
    },
  ),
  card(
    'meditate',
    'Llamitas meditando',
    4,
    'Programa un turno extra completo; solo uno por turno normal, nunca desde un extra.',
    [{ op: 'extra' }],
    { modules: ['interaction'] },
  ),
  card(
    'reject',
    'Rechazo llamístico',
    4,
    'Devuelve una bebé rival a la reserva. Alarma puede bloquear.',
    [{ op: 'return' }],
    { category: 'attack', targets: 'enemy', reactionWindows: ['alarm'], modules: ['interaction'] },
  ),
  card(
    'handTheft',
    'Robo de cartas',
    6,
    'Maldad 1: roba una carta al azar. Con estudio 1 adicional, mira y elige.',
    [{ op: 'steal', key: 'hand' }],
    {
      category: 'attack',
      targets: 'enemy',
      cost: { evil: 1 },
      reactionWindows: ['alarm'],
      modules: ['interaction'],
    },
  ),
  card(
    'sound',
    'Sonido de llama',
    2,
    'Una acción social sin efecto material ni micrófono.',
    [{ op: 'social' }],
    { modules: ['interaction'], flavor: 'Mmmprrr. Elocuente.' },
  ),
  card(
    'mushroom',
    'Hongo de la verdad inconveniente',
    6,
    'Especializa una bebé en santa o alimenta una santa. No produce ofrendas.',
    [{ op: 'feed', kind: 'holy', amount: 0 }],
    { category: 'resource', targets: 'own', modules: ['holy'] },
  ),
  card(
    'blessing',
    'Bendición de la Santa Llama',
    2,
    'Santa adulta. Mientras la conserves, comida/estudio/caos roban +1 y permiten crecer una vez por llama y turno.',
    [{ op: 'install', key: 'blessing' }],
    {
      category: 'power',
      requirements: { kind: 'holy', adults: 1 },
      duration: 'permanent',
      modules: ['holy'],
      limit: 1,
    },
  ),
  card(
    'banquet',
    'Banquete del Fin del Mundo',
    2,
    'Dos glotonas, una adulta; comida 4. Cada alimentación pagada de glotona permite otra gratuita, sin recursión.',
    [{ op: 'install', key: 'banquet' }],
    {
      category: 'power',
      cost: { food: 4 },
      requirements: { kind: 'glutton', adults: 1, count: 2 },
      modules: ['banquet'],
      limit: 1,
    },
  ),
  card(
    'scam',
    'Gran Estafa Llamística',
    2,
    'Malvada adulta y dos saqueos previos. Intercambia una propia por una rival mayor; ambas pierden recursos.',
    [{ op: 'swap' }],
    {
      category: 'power',
      requirements: { kind: 'evil', adults: 1, raids: 2 },
      targets: 'pair',
      reactionWindows: ['alarm'],
      modules: ['scam'],
      limit: 1,
    },
  ),
  card(
    'revelation',
    'Revelación de dudosa procedencia',
    2,
    'Loca adulta, tres alimentaciones de loca y caos 2. Revela tres resultados distintos: elige dos y su orden.',
    [{ op: 'install', key: 'revelation' }],
    {
      category: 'power',
      cost: { chaos: 2 },
      requirements: { kind: 'crazy', adults: 1, feeds: 3 },
      modules: ['revelation'],
      limit: 1,
    },
  ),
  card(
    'thesis',
    'Tesis sobre combustión espontánea',
    2,
    'Prototipo: estudiosa adulta, explosiva joven; estudio 2 + bomba 1. Crecimiento adicional por explosión y recuperación pagando estudio.',
    [{ op: 'install', key: 'thesis' }],
    {
      category: 'power',
      cost: { study: 2, bomb: 1 },
      requirements: { kind: 'scholar', adults: 1, secondKind: 'explosive' },
      modules: ['thesis'],
      limit: 1,
    },
  ),
  card(
    'sharedMushroom',
    'Hongo compartido',
    4,
    'Después de loca, comida 1: repite un resultado en otro objetivo. No se dispara a sí mismo.',
    [{ op: 'connection', key: 'chaos' }],
    {
      category: 'connection',
      cost: { food: 1 },
      targets: 'own',
      triggers: ['afterChaos'],
      modules: ['connections'],
    },
  ),
  card(
    'inMyThesis',
    'Eso estaba en mi tesis',
    4,
    'Desde la nueva mano tras Explosión: estudio 1, recupera otra carta no poderosa.',
    [{ op: 'recover', amount: 1 }],
    {
      category: 'connection',
      cost: { study: 1 },
      triggers: ['afterExplosion'],
      modules: ['connections'],
    },
  ),
  card(
    'leftovers',
    'Sobras benditas',
    4,
    'Después de alimentar con carta, mueve un recurso de esa llama a otra joven propia. No alimenta.',
    [{ op: 'connection', key: 'leftovers' }],
    { category: 'connection', targets: 'own', triggers: ['afterFeed'], modules: ['connections'] },
  ),
];
export const rules: Rule[] = [
  {
    id: 'growth.global',
    description:
      'Una sola subida de edad entre todas tus llamas por turno. Seguir alimentando es legal.',
    status: 'confirmed',
    source: '§4.1',
  },
  {
    id: 'growth.activation',
    description:
      'Bebé → joven especializada → adulta. Recursos almacenados no crecen solos y gastarlos no rejuvenece.',
    status: 'confirmed',
    source: '§4.1',
  },
  {
    id: 'victory.simultaneous',
    description: 'La victoria exige adultas simultáneas, nunca un total histórico.',
    status: 'confirmed',
    source: '§4.3',
  },
  {
    id: 'explosion.owner',
    description: 'Solo la explosiva elegida por el dueño de la explosión puede crecer.',
    status: 'confirmed',
    source: '§4.2',
  },
  {
    id: 'evil.activation',
    description: 'Solo robar una bebé o un recurso con éxito activa malvada; robar cartas no.',
    status: 'confirmed',
    source: '§4.2',
  },
  {
    id: 'baby.compatibility',
    description: 'Una bebé solo recibe una especialización cuando tiene permiso para crecer.',
    status: 'provisional',
    source: '§5',
  },
  {
    id: 'turn.order',
    description:
      'Incorporación opcional → robo → acciones libres → fin voluntario. Una bebé gratis por turno.',
    status: 'provisional',
    source: '§5',
  },
  {
    id: 'cost.herd',
    description: 'Paga desde cualquier llama propia, eligiendo las fuentes. Recursos no negativos.',
    status: 'provisional',
    source: '§5',
  },
  {
    id: 'victory.atomic',
    description: 'Se comprueba victoria tras cada efecto atómico y su ventana preventiva.',
    status: 'provisional',
    source: '§5',
  },
  {
    id: 'research.persistence',
    description: 'Granja y Valla son únicas; por defecto persisten al perder estudiosa.',
    status: 'provisional',
    source: '§6.1',
  },
  {
    id: 'chaos.table',
    description:
      'Tabla de seis resultados con pesos editables; regalos no alimentan. Robo de loca sin Alarma por defecto.',
    status: 'experimental',
    source: '§6.3',
  },
  {
    id: 'holy.route',
    description:
      'Santa no cuenta para ganar ni coexiste con malvada. Bendición se suspende sin santa adulta.',
    status: 'experimental',
    source: '§7.1',
  },
  {
    id: 'powers.routes',
    description:
      'Poderosas: dos copias, una activación por jugador; cartas usadas fuera del circuito.',
    status: 'experimental',
    source: '§7',
  },
  {
    id: 'laboratory.variants',
    description:
      'Mercado, anuncio con vuelta de espera, explosión extra y reciclaje diferido son opciones separadas.',
    status: 'experimental',
    source: '§8',
  },
];
function preset(id: string, name: string, modules: string[], extra: Partial<Config> = {}): Config {
  return {
    version: 1,
    id,
    name,
    reference: id,
    cards: structuredClone(
      catalog.filter((c) => !c.modules.length || c.modules.every((m) => modules.includes(m))),
    ),
    rules: structuredClone(rules),
    initialHand: 6,
    draw: 2,
    target: 5,
    initialLlamas: 0,
    reserve: null,
    groupLimit: null,
    handLimit: null,
    gluttonYoung: 1,
    gluttonAdult: 1,
    farmDraw: 1,
    fenceCopies: 2,
    meditation: 'extra',
    rejectionCost: 0,
    market: false,
    announce: false,
    explosionExtra: false,
    deferredFeed: false,
    autoEvents: false,
    researchPersists: true,
    crazyProtected: false,
    chaosWeights: [1, 1, 1, 1, 1, 1],
    blessingPerLlama: 1,
    banquetPerLlama: 1,
    thesisRecovery: 1,
    allowRecoverAside: false,
    ...extra,
  };
}
export const presets: Config[] = [
  preset('base', 'Base de trabajo', []),
  preset('interaction', 'Más interacción', ['interaction']),
  preset('holy', 'Ruta santa', ['interaction', 'holy']),
  preset('routes', 'Rutas alternativas', ['interaction', 'holy', 'scam', 'revelation']),
  preset('market', 'Recompensas visibles', ['interaction', 'holy', 'scam', 'revelation'], {
    market: true,
  }),
];
export const profileNames = {
  balanced: 'Equilibrado',
  breeder: 'Criador',
  aggressive: 'Agresivo',
  researcher: 'Investigador',
  glutton: 'Glotón',
  chaotic: 'Caótico',
  devout: 'Devoto',
};
export function profileFallback(profile: string, c: Config): string | null {
  const required = profile === 'researcher' ? 'scholar' : profile === 'glutton' ? 'glutton' : null;
  if (
    required &&
    !c.cards.some((x) => x.copies && x.effects.some((e) => e.op === 'feed' && e.kind === required))
  )
    return 'Perfil sin ruta de alimentación: se usará Criador.';
  if (profile === 'devout' && !c.cards.some((x) => x.id === 'mushroom' && x.copies))
    return 'Devoto sin ruta santa: se usará Criador.';
  if (
    profile === 'chaotic' &&
    !c.cards.some((x) => x.effects.some((e) => e.kind === 'crazy') && x.copies)
  )
    return 'Caótico sin loca: se usará Equilibrado.';
  return null;
}
