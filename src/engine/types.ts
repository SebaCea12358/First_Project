export const ENGINE_VERSION = '1.0.0';
export const resources = ['food', 'study', 'chaos', 'bomb', 'evil'] as const;
export type Resource = (typeof resources)[number];
export type Kind = 'glutton' | 'scholar' | 'crazy' | 'explosive' | 'evil' | 'holy';
export type Age = 0 | 1 | 2;
export type Profile =
  'balanced' | 'breeder' | 'aggressive' | 'researcher' | 'glutton' | 'chaotic' | 'devout';
export type Cost = Partial<Record<Resource, number>>;
export type Payment = { llama: string; resource: Resource; amount: number }[];
export type Operation =
  | 'draw'
  | 'discard'
  | 'feed'
  | 'resource'
  | 'age'
  | 'steal'
  | 'swap'
  | 'return'
  | 'install'
  | 'recover'
  | 'extra'
  | 'choice'
  | 'random'
  | 'explosion'
  | 'social'
  | 'connection'
  | 'transfer'
  | 'spend';
export interface Effect {
  op: Operation;
  amount?: number;
  resource?: Resource;
  kind?: Kind;
  key?: string;
  options?: Effect[][];
  target?: 'self' | 'enemy';
}
export interface Requirements {
  kind?: Kind;
  adults?: number;
  count?: number;
  secondKind?: Kind;
  raids?: number;
  feeds?: number;
}
export interface CardDef {
  id: string;
  name: string;
  flavor: string;
  text: string;
  category: 'resource' | 'attack' | 'reaction' | 'research' | 'power' | 'event' | 'connection';
  copies: number;
  cost: Cost;
  requirements: Requirements;
  targets: 'none' | 'own' | 'enemy' | 'pair';
  effects: Effect[];
  triggers: string[];
  duration: 'turn' | 'permanent';
  reactionWindows: string[];
  modules: string[];
  limit: number;
}
export interface Rule {
  id: string;
  description: string;
  status: 'confirmed' | 'provisional' | 'experimental';
  source: string;
}
export interface Config {
  version: 1;
  id: string;
  name: string;
  reference: string;
  cards: CardDef[];
  rules: Rule[];
  initialHand: number;
  draw: number;
  target: number;
  initialLlamas: number;
  reserve: number | null;
  groupLimit: number | null;
  handLimit: number | null;
  gluttonYoung: number;
  gluttonAdult: number;
  farmDraw: number;
  fenceCopies: number;
  meditation: 'extra' | 'draw';
  rejectionCost: number;
  market: boolean;
  announce: boolean;
  explosionExtra: boolean;
  deferredFeed: boolean;
  autoEvents: boolean;
  researchPersists: boolean;
  crazyProtected: boolean;
  chaosWeights: number[];
  blessingPerLlama: number;
  banquetPerLlama: number;
  thesisRecovery: number;
  allowRecoverAside: boolean;
}
export interface Card {
  id: string;
  def: string;
}
export interface Llama {
  id: string;
  age: Age;
  kind: Kind | null;
  resources: Record<Resource, number>;
}
export interface Player {
  id: number;
  name: string;
  controller: 'human' | 'bot';
  profile: Profile;
  hand: Card[];
  llamas: Llama[];
  research: string[];
  powers: { key: string; expires: number | null }[];
  used: Record<string, number>;
  raids: number;
  crazyFeeds: number;
}
export interface Event {
  id: number;
  turn: number;
  round: number;
  actor: number;
  type: string;
  text: string;
  parent: number | null;
  data?: Record<string, unknown>;
}
export interface PendingOption {
  id: string;
  label: string;
  effects: Task[];
}
export interface Pending {
  player: number;
  kind: string;
  title: string;
  options: PendingOption[];
  revealed?: Card[];
}
export interface Task {
  op: string;
  player: number;
  target?: string;
  enemy?: number;
  other?: string;
  card?: Card;
  amount?: number;
  resource?: Resource;
  kind?: Kind;
  key?: string;
  permission?: string;
  parent?: number;
  effects?: Effect[];
  values?: number[];
}
export interface Action {
  type:
    | 'recruit'
    | 'skipRecruit'
    | 'play'
    | 'end'
    | 'choose'
    | 'recover'
    | 'claim'
    | 'activate'
    | 'resume'
    | 'abandon';
  card?: string;
  target?: string;
  enemy?: number;
  other?: string;
  mode?: string;
  payment?: Payment;
  choice?: string;
  grow?: boolean;
}
export interface Plan {
  card: Card;
  player: number;
  readyRound: number;
}
export interface Game {
  version: string;
  config: Config;
  fingerprint: string;
  seed: string;
  rng: number;
  botRng: number;
  players: Player[];
  deck: Card[];
  discard: Card[];
  aside: { card: Card; release: number }[];
  out: Card[];
  market: Card[];
  plans: Plan[];
  reserve: number | null;
  nextId: number;
  turn: number;
  round: number;
  active: number;
  phase: 'recruit' | 'actions' | 'resolving' | 'finished';
  growthUsed: boolean;
  grown: string[];
  extraGrown: string[];
  exceptionCounts: Record<string, number>;
  extra: boolean;
  extraScheduled: boolean;
  pendingExtra: number[];
  queue: Task[];
  pending: Pending | null;
  winner: number | null;
  events: Event[];
  commands: Action[];
  exploratory: boolean;
  window: { kind: string; llama?: string; results?: number[] } | null;
  turnActions: number;
  normalTurns: number;
}
export interface Offer {
  action: Action;
  label: string;
  card?: CardDef;
  cost: Cost;
}
