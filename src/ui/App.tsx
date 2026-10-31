import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Action,
  Card,
  Config,
  Game,
  Llama,
  Offer,
  Payment,
  Profile,
  Resource,
  resources,
} from '../engine/types';
import {
  actionError,
  adults,
  createGame,
  defaultPayment,
  definition,
  dispatch,
  hasPower,
  legalActions,
  requirementError,
} from '../engine/engine';
import {
  ageNames,
  kindIcons,
  kindNames,
  presets,
  profileFallback,
  profileNames,
  resourceNames,
} from '../content/catalog';
import { derivedText, validateConfig } from '../engine/config';
import { decide, observe, BotDecision } from '../bots/policy';
import {
  branchGame,
  download,
  exportReplay,
  loadLocal,
  Note,
  Replay,
  replay,
  saveLocal,
  validateGame,
} from '../persistence/storage';
import { timeline } from '../simulation/metrics';
import { csv, Result } from '../simulation/run';
import { Editor } from './Editor';
interface Saved {
  initial: Game;
  game: Game;
  notes: Note[];
  telemetry: Timing[];
}
interface Timing {
  turn: number;
  seat: number;
  kind: 'human' | 'bot';
  ms: number;
  legal: number;
  considered: number;
  decision?: BotDecision;
}
function LlamaTile({
  llama,
  selected,
  onClick,
}: {
  llama: Llama;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={`llama-tile ${llama.kind || 'baby'} ${selected ? 'selected' : ''}`}
      onClick={onClick}
      disabled={!onClick}
    >
      <div className="llama-top">
        <span className="age-tag">{ageNames[llama.age]}</span>
        <span className="llama-id">{llama.id}</span>
      </div>
      <div className="llama-art" aria-hidden="true">
        <span className="ear left" />
        <span className="ear right" />
        <span className="face">• ᴥ •</span>
        <span className="accessory">{llama.kind ? kindIcons[llama.kind] : '✦'}</span>
      </div>
      <b>{llama.kind ? kindNames[llama.kind] : 'Sin especializar'}</b>
      <div className="resource-chips">
        {resources
          .filter((r) => llama.resources[r] > 0)
          .map((r) => (
            <span key={r} title={resourceNames[r]}>
              {{ food: '🍎', study: '📚', chaos: '🍃', bomb: '💥', evil: '😈' }[r]}{' '}
              {llama.resources[r]}
            </span>
          ))}
        {!resources.some((r) => llama.resources[r]) && <span className="muted">Sin recursos</span>}
      </div>
    </button>
  );
}
function CardFace({
  card,
  game,
  selected,
  onClick,
  disabled,
}: {
  card: Card;
  game: Game;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const d = definition(game, card);
  return (
    <button
      className={`playing-card ${d.category} ${selected ? 'selected' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="card-category">
        {
          {
            resource: 'ALIMENTACIÓN',
            attack: 'SABOTAJE',
            reaction: 'REACCIÓN',
            research: 'INVESTIGACIÓN',
            power: 'PODEROSA',
            event: 'EVENTO',
            connection: 'CONEXIÓN',
          }[d.category]
        }
      </span>
      <span className="card-symbol">
        {d.effects[0]?.kind
          ? kindIcons[d.effects[0].kind]
          : {
              raid: '😈',
              explosion: '💥',
              alarm: '🔔',
              spit: '💧',
              conversion: '🌀',
              farm: '🌾',
              fence: '⚡',
              meditate: '🧘',
              handTheft: '🃏',
              reject: '↩',
              blessing: '☀️',
            }[d.id] || '✦'}
      </span>
      <strong>{d.name}</strong>
      <span className="card-description">{d.text}</span>
      <span className="card-flavor">{d.flavor}</span>
      <span className="card-code">
        {card.id} · {d.id}
      </span>
    </button>
  );
}
export default function App() {
  const [replayData, setReplayData] = useState<Replay | null>(null);
  const [replayIndex, setReplayIndex] = useState(0);
  const [replaySeat, setReplaySeat] = useState(0);
  const [customs, setCustoms] = useState<Config[]>(() => loadLocal('presets', []));
  const [tab, setTab] = useState('table');
  const [setup, setSetup] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState('base');
  const allPresets = [...presets, ...customs];
  const config = allPresets.find((x) => x.id === selectedPreset) || presets[0];
  const [count, setCount] = useState(3);
  const [human, setHuman] = useState(0);
  const [profiles, setProfiles] = useState<Profile[]>([
    'balanced',
    'breeder',
    'aggressive',
    'researcher',
  ]);
  const [seed, setSeed] = useState('altiplano-1');
  const [start, setStart] = useState(0);
  const [game, setGame] = useState<Game | null>(null);
  const [initial, setInitial] = useState<Game | null>(null);
  const [past, setPast] = useState<Game[]>([]);
  const [future, setFuture] = useState<Game[]>([]);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(800);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [targetIndex, setTargetIndex] = useState(0);
  const [payment, setPayment] = useState<Payment>([]);
  const [selectedLlama, setSelectedLlama] = useState('');
  const [error, setError] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [note, setNote] = useState('');
  const [tag, setTag] = useState('divertido');
  const [botInfo, setBotInfo] = useState<BotDecision | null>(null);
  const [telemetry, setTelemetry] = useState<Timing[]>([]);
  const [reveal, setReveal] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [running, setRunning] = useState(false);
  const [compare, setCompare] = useState('interaction');
  const [budget, setBudget] = useState(600);
  const [batchSeeds, setBatchSeeds] = useState('lote-0,lote-1');
  const [editorConfig, setEditorConfig] = useState<Config>(presets[0]);
  const [editorKey, setEditorKey] = useState(0);
  const worker = useRef<Worker | null>(null);
  const batchProgress = useRef<Result | null>(null);
  const decisionStart = useRef(performance.now());
  const actions = useMemo(() => (game ? legalActions(game) : []), [game]);
  const decisionSeat = game ? (game.pending?.player ?? game.active) : 0;
  const player = game?.players[game.active];
  const humanPlayer = game?.players.find((p) => p.controller === 'human');
  const viewSeat = replayData
    ? replaySeat
    : (humanPlayer?.id ?? (reveal ? game?.active : undefined));
  const myTurn = !replayData && !!game && game.players[decisionSeat].controller === 'human';
  const selectedOffers = actions.filter((o) => o.action.card === selectedCard);
  const selectedOffer = selectedOffers[Math.min(targetIndex, selectedOffers.length - 1)];
  const selectedDef =
    game && selectedCard
      ? [...game.players[game.active].hand, ...game.market, ...game.plans.map((x) => x.card)].find(
          (x) => x.id === selectedCard,
        )
      : undefined;
  const execute = (action: Action, isBot = false, decision?: BotDecision) => {
    if (!game || replayData) return;
    try {
      const before = performance.now();
      const next = dispatch(game, action);
      if (decision) next.botRng = decision.rng;
      setPast((p) => [...p, game]);
      setFuture([]);
      setGame(next);
      setError('');
      setSelectedCard(null);
      setTargetIndex(0);
      setSelectedLlama('');
      setTelemetry((t) => [
        ...t,
        {
          turn: game.turn,
          seat: decisionSeat,
          kind: isBot ? 'bot' : 'human',
          ms: isBot ? performance.now() - before : performance.now() - decisionStart.current,
          legal: actions.length,
          considered: decision?.consideredCount ?? actions.length,
          ...(decision ? { decision } : {}),
        },
      ]);
      decisionStart.current = performance.now();
      if (decision)
        setBotInfo(
          reveal
            ? decision
            : {
                ...decision,
                explanation: `Perfil ${profileNames[game.players[decisionSeat].profile]}: ${game.pending?.kind === 'selectCard' ? 'elige una carta de la mano que pudo ver legalmente' : decision.alternatives[0]?.label}. Valor heurístico ${decision.alternatives[0]?.score.toFixed(1)}; ${decision.consideredCount} opciones consideradas de ${decision.legalCount} legales. No es una probabilidad de victoria.`,
                alternatives: decision.alternatives.map((a, i) => ({
                  ...a,
                  label: `Alternativa ${i + 1} (detalles privados del bot)`,
                })),
              },
        );
    } catch (e) {
      setError(String(e));
    }
  };
  const botStep = () => {
    if (!game || myTurn || replayData || game.phase === 'finished') return;
    try {
      const at = performance.now();
      const d = decide(observe(game, decisionSeat), game.botRng);
      const elapsed = performance.now() - at;
      execute(d.action, true, d);
      setTelemetry((t) => {
        const copy = [...t];
        if (copy.length) copy[copy.length - 1] = { ...copy[copy.length - 1], ms: elapsed };
        return copy;
      });
    } catch (e) {
      setError(String(e));
      setPaused(true);
    }
  };
  useEffect(() => {
    if (!game || paused || myTurn || game.phase === 'finished' || setup || tab !== 'table') return;
    const timer = setTimeout(botStep, speed);
    return () => clearTimeout(timer);
  }, [game, paused, speed, setup, tab]);
  useEffect(() => {
    if (selectedOffer && player) setPayment(defaultPayment(player, selectedOffer.cost) || []);
  }, [selectedCard, targetIndex, game?.turn]);
  useEffect(() => {
    if (game && initial)
      try {
        saveLocal('autosave', { game, initial, notes, telemetry });
      } catch {
        setError('El almacenamiento está lleno: exporta la partida para conservarla.');
      }
  }, [game, initial, notes]);
  useEffect(() => () => worker.current?.terminate(), []);
  const newGame = (c = config) => {
    try {
      setReplayData(null);
      const g = createGame(
        c,
        Array.from({ length: count }, (_, i) => ({
          name: i === human ? 'Tú' : `Llama ${i + 1}`,
          controller: i === human ? ('human' as const) : ('bot' as const),
          profile: profiles[i],
        })),
        seed,
        start,
      );
      setGame(g);
      setInitial(structuredClone(g));
      setPast([]);
      setFuture([]);
      setNotes([]);
      setTelemetry([]);
      setReveal(false);
      setPaused(false);
      setSetup(false);
      setTab('table');
      setSelectedCard(null);
      setBotInfo(null);
      setError('');
      decisionStart.current = performance.now();
    } catch (e) {
      setError(String(e));
    }
  };
  const savePreset = (c: Config) => {
    setCustoms((old) => {
      const next = [...old.filter((p) => p.id !== c.id), structuredClone(c)];
      saveLocal('presets', next);
      return next;
    });
    setSelectedPreset(c.id);
  };
  const openEditor = (c: Config) => {
    setEditorConfig(c);
    setEditorKey((k) => k + 1);
    setTab('editor');
    setSetup(false);
  };
  const load = (saved: Saved) => {
    setReplayData(null);
    const g = validateGame(saved.game);
    const i = validateGame(saved.initial);
    setGame(g);
    setInitial(i);
    setNotes(saved.notes || []);
    setTelemetry(saved.telemetry || []);
    setPast([]);
    setFuture([]);
    setSetup(false);
    setTab('table');
    setPaused(true);
    setReveal(false);
    setSelectedCard(null);
    setError('');
  };
  const loadFile = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (data.format === 'llamas-replay') {
        const g = replay(data);
        load({ game: g, initial: data.initial, notes: data.notes || [], telemetry: [] });
        setReplayData(data);
        setReplayIndex(data.commands.length);
        setReplaySeat(0);
        setError('Replay reproducido y verificado: el estado final coincide.');
      } else load(data);
    } catch (e) {
      setError(String(e));
    }
  };
  const undo = () => {
    if (!game || !past.length) return;
    const previous = structuredClone(past[past.length - 1]);
    previous.exploratory = true;
    setFuture((f) => [game, ...f]);
    setGame(previous);
    setPast((p) => p.slice(0, -1));
    setPaused(true);
    setSelectedCard(null);
  };
  const redo = () => {
    if (!game || !future.length) return;
    const next = structuredClone(future[0]);
    next.exploratory = true;
    setPast((p) => [...p, game]);
    setGame(next);
    setFuture((f) => f.slice(1));
    setSelectedCard(null);
  };
  const preserveOrigin = (): boolean => {
    if (!game || !initial) return false;
    try {
      const origins = loadLocal<Saved[]>('branch-origins', []);
      saveLocal('branch-origins', [...origins, { game, initial, notes, telemetry }]);
      return true;
    } catch {
      setError(
        'No se pudo conservar el origen de la rama. Exporta la partida y libera almacenamiento.',
      );
      return false;
    }
  };
  const takeover = (seat: number) => {
    if (!game || replayData || !preserveOrigin()) return;
    const next = structuredClone(game);
    next.exploratory = true;
    next.players = next.players.map((p) => ({
      ...p,
      controller: p.id === seat ? 'human' : 'bot',
      name: p.id === seat ? 'Tú' : `Llama ${p.id + 1}`,
    }));
    setGame(next);
    setInitial(structuredClone(next));
    setPast([]);
    setFuture([]);
    setPaused(true);
    setReveal(false);
    setSelectedCard(null);
    setError(
      'Control cambiado. El replay de esta rama comienza en este estado; la sesión es exploratoria.',
    );
  };
  const beginBatch = () => {
    const c2 = allPresets.find((x) => x.id === compare) || presets[1];
    setResults([]);
    setRunning(true);
    worker.current?.terminate();
    const w = new Worker(new URL('../simulation/worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    w.onmessage = (e) => {
      if (e.data.progress) batchProgress.current = e.data.progress;
      if (e.data.row) {
        setResults((r) => [...r, e.data.row]);
        batchProgress.current = null;
      }
      if (e.data.done || e.data.error) {
        setRunning(false);
        w.terminate();
        if (e.data.error) setError(e.data.error);
      }
    };
    w.onerror = (e) => {
      setError(e.message);
      setRunning(false);
      w.terminate();
    };
    w.postMessage({
      configs: [config, c2],
      seeds: batchSeeds
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
      profiles: ['breeder', 'aggressive', 'researcher'],
      budget,
    });
  };
  const changePayment = (llama: string, resource: Resource, amount: number) =>
    setPayment((old) => [
      ...old.filter((x) => !(x.llama === llama && x.resource === resource)),
      ...(amount > 0 ? [{ llama, resource, amount }] : []),
    ]);
  const seekReplay = (index: number) => {
    if (!replayData) return;
    try {
      let g = structuredClone(replayData.initial);
      for (const a of replayData.commands.slice(0, index)) g = dispatch(g, a);
      setGame(g);
      setReplayIndex(index);
      setReveal(false);
      setSelectedCard(null);
    } catch (e) {
      setError(String(e));
    }
  };
  const publicEvents = game?.events.filter((e) => !['effect', 'cardZone'].includes(e.type)) || [];
  return (
    <>
      <header className="app-header">
        <button
          className="brand"
          onClick={() => {
            setTab('table');
          }}
        >
          <span className="brand-mark">♞</span>
          <span>
            Llamas <i>en llamas</i>
            <small>LABORATORIO DE CARTAS</small>
          </span>
        </button>
        <nav aria-label="Principal">
          {[
            ['table', 'La mesa'],
            ['editor', 'Taller de variantes'],
            ['rules', 'Reglas'],
            ['lab', 'Laboratorio'],
          ].map(([id, label]) => (
            <button
              key={id}
              className={tab === id ? 'active' : ''}
              onClick={() => {
                if (id === 'editor') openEditor(game?.config || config);
                else {
                  setTab(id);
                  if (id !== 'table') setSetup(false);
                }
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        <button
          className="new-game secondary"
          onClick={() => {
            setSetup(true);
            setTab('table');
          }}
        >
          ＋ Nueva partida
        </button>
      </header>
      <main>
        {error && (
          <div className="notice error" role="alert">
            <span>{error}</span>
            <button className="icon-button" onClick={() => setError('')}>
              ×
            </button>
          </div>
        )}
        {tab === 'table' && (setup || !game) && (
          <section className="welcome">
            <div className="welcome-copy">
              <span className="eyebrow">TERNURA. SABOTAJE. CIENCIA MUY DUDOSA.</span>
              <h1>
                Cría llamas.
                <br />
                Provoca <em>el caos.</em>
                <br />
                Prueba otra vez.
              </h1>
              <p>
                Un laboratorio jugable para descubrir qué pasa cuando una llama estudia, otra roba y
                una tercera se come la bibliografía.
              </p>
              <div className="hero-llamas">
                <span>🦙</span>
                <span>🍃</span>
                <span>🦙</span>
                <span>💥</span>
              </div>
              <div className="welcome-note">
                <b>Una regla que cambia todo.</b>
                <p>
                  Solo una subida de edad por turno en la base. Alimentar de nuevo sigue siendo
                  legal: acumula recursos, encadena efectos y prepara tu siguiente jugada.
                </p>
              </div>
            </div>
            <div className="panel setup-panel">
              <span className="eyebrow">PREPARAR LA MESA</span>
              <h2>Una nueva historia absurda</h2>
              <label>
                Variante
                <select
                  aria-label="Variante"
                  value={selectedPreset}
                  onChange={(e) => setSelectedPreset(e.target.value)}
                >
                  {allPresets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="preset-summary">
                <b>{config.name}</b>
                <p>
                  {config.cards.reduce(
                    (n, c) => n + (config.market && c.category === 'power' ? 0 : c.copies),
                    0,
                  )}{' '}
                  cartas en mazo · {config.target} adultas para ganar
                </p>
                <small>
                  {config.id === 'base'
                    ? 'Cinco tipos originales. Sin poderosas ni excepciones de crecimiento.'
                    : 'Variante de trabajo: consulta sus reglas y cartas antes de jugar.'}
                </small>
              </div>
              <div className="form-grid">
                <label>
                  Participantes
                  <select
                    aria-label="Participantes"
                    value={count}
                    onChange={(e) => {
                      setCount(Number(e.target.value));
                      if (human >= Number(e.target.value)) setHuman(0);
                    }}
                  >
                    {[2, 3, 4].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Tu asiento
                  <select
                    aria-label="Tu asiento"
                    value={human}
                    onChange={(e) => setHuman(Number(e.target.value))}
                  >
                    <option value={-1}>Espectador · todos bots</option>
                    {Array.from({ length: count }, (_, i) => (
                      <option key={i} value={i}>
                        Asiento {i + 1}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Semilla
                  <input
                    aria-label="Semilla"
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                  />
                </label>
                <label>
                  Comienza
                  <select value={start} onChange={(e) => setStart(Number(e.target.value))}>
                    <option value={-1}>Asiento al azar</option>
                    {Array.from({ length: count }, (_, i) => (
                      <option key={i} value={i}>
                        Asiento {i + 1}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                className="text-button"
                onClick={() => {
                  const nums = crypto.getRandomValues(new Uint32Array(2));
                  setSeed(`${nums[0]}-${nums[1]}`);
                }}
              >
                Generar otra semilla
              </button>
              <div className="bot-setup">
                {Array.from(
                  { length: count },
                  (_, i) =>
                    i !== human && (
                      <label key={i}>
                        Bot del asiento {i + 1}
                        <select
                          aria-label={`Perfil bot ${i + 1}`}
                          value={profiles[i]}
                          onChange={(e) =>
                            setProfiles((p) =>
                              p.map((x, j) => (i === j ? (e.target.value as Profile) : x)),
                            )
                          }
                        >
                          {Object.entries(profileNames).map(([k, n]) => (
                            <option key={k} value={k}>
                              {n}
                            </option>
                          ))}
                        </select>
                        {profileFallback(profiles[i], config) && (
                          <small className="warning">{profileFallback(profiles[i], config)}</small>
                        )}
                      </label>
                    ),
                )}
              </div>
              <button className="start-button" onClick={() => newGame()}>
                Sentarse a jugar <span>→</span>
              </button>
              <div className="row">
                <button
                  className="text-button"
                  onClick={() => {
                    try {
                      const saved = loadLocal<Saved | null>('autosave', null);
                      if (!saved) throw Error('No hay partida guardada.');
                      load(saved);
                    } catch (e) {
                      setError(String(e));
                    }
                  }}
                >
                  Continuar guardada
                </button>
                <label className="text-button">
                  Importar partida / replay
                  <input
                    hidden
                    type="file"
                    accept=".json"
                    onChange={(e) => e.target.files?.[0] && void loadFile(e.target.files[0])}
                  />
                </label>
                {game && (
                  <button className="text-button" onClick={() => setSetup(false)}>
                    Volver a mi mesa
                  </button>
                )}
              </div>
            </div>
          </section>
        )}
        {tab === 'table' && !setup && game && (
          <>
            {replayData && (
              <section className="replay-controls panel" aria-label="Reproducir replay">
                <div>
                  <span className="eyebrow">REPLAY VERIFICADO · SOLO LECTURA</span>
                  <b>
                    Decisión {replayIndex} de {replayData.commands.length}
                  </b>
                </div>
                <div className="row wrap">
                  <button className="secondary" onClick={() => seekReplay(0)}>
                    Volver al inicio
                  </button>
                  <button
                    className="secondary"
                    disabled={replayIndex === 0}
                    onClick={() => seekReplay(replayIndex - 1)}
                  >
                    Anterior decisión
                  </button>
                  <button
                    className="secondary"
                    disabled={replayIndex === replayData.commands.length}
                    onClick={() => seekReplay(replayIndex + 1)}
                  >
                    Siguiente decisión
                  </button>
                  <label>
                    Ver desde asiento
                    <select
                      value={replaySeat}
                      onChange={(e) => {
                        setReplaySeat(Number(e.target.value));
                        setSelectedCard(null);
                      }}
                    >
                      {game.players.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    onClick={() => {
                      if (!preserveOrigin()) return;
                      const g = structuredClone(game);
                      g.exploratory = true;
                      setReplayData(null);
                      setGame(g);
                      setInitial(structuredClone(g));
                      setPast([]);
                      setFuture([]);
                    }}
                  >
                    Continuar como rama exploratoria
                  </button>
                </div>
              </section>
            )}
            <div className="game-heading">
              <div>
                <span className="eyebrow">
                  {game.config.name.toUpperCase()} {game.exploratory ? '· EXPLORATORIA' : ''}
                </span>
                <h1>
                  {game.winner !== null
                    ? `${game.players[game.winner].name} ganó la partida`
                    : game.pending
                      ? `${game.players[decisionSeat].name}, hay una decisión`
                      : myTurn
                        ? 'Tu turno. Haz una buena locura.'
                        : `${player!.name} está pensando…`}
                </h1>
              </div>
              <div className="game-badges">
                <span>
                  Vuelta <b>{game.round}</b>
                </span>
                <span>
                  Turno{' '}
                  <b>
                    {game.turn}
                    {game.extra ? ' +' : ''}
                  </b>
                </span>
                <span>
                  Mazo <b>{game.deck.length}</b>
                </span>
                <span>
                  Descarte <b>{game.discard.length}</b>
                </span>
                <span className={game.growthUsed ? 'spent' : 'ready'}>
                  {game.growthUsed ? 'Subida usada' : '1 subida disponible'}
                </span>
              </div>
            </div>
            <div className="game-layout">
              <div className="table-column">
                <div className="rivals">
                  {game.players
                    .filter((p) => p.id !== viewSeat)
                    .map((p) => (
                      <section
                        key={p.id}
                        className={`herd panel ${game.active === p.id ? 'current' : ''}`}
                      >
                        <div className="herd-heading">
                          <div>
                            <b>{p.name}</b>
                            <span>
                              {p.controller === 'bot' ? profileNames[p.profile] : 'Persona'} ·{' '}
                              {adults(p)}/{game.config.target} adultas
                            </span>
                          </div>
                          <div className="card-backs" title={`${p.hand.length} cartas ocultas`}>
                            <span>▨ ▨ ▨</span>
                            <b>{p.hand.length}</b>
                          </div>
                        </div>
                        <div className="llama-row">
                          {p.llamas.map((l) => (
                            <LlamaTile key={l.id} llama={l} />
                          ))}
                          {!p.llamas.length && (
                            <div className="empty-herd">
                              El altiplano espera a su primera llama.
                            </div>
                          )}
                        </div>
                        {p.research.length > 0 && (
                          <p className="installed">
                            {p.research
                              .map((k) => (k === 'farm' ? '🌾 Granja' : '⚡ Valla'))
                              .join(' · ')}
                          </p>
                        )}
                        {p.powers.map((x, i) => (
                          <small className="power-chip" key={i}>
                            {x.key} {hasPower(game, p, x.key) ? 'activo' : 'suspendido'}
                          </small>
                        ))}
                        {reveal && (
                          <details>
                            <summary>Mano revelada · sesión exploratoria</summary>
                            <div className="mini-hand">
                              {p.hand.map((c) => (
                                <span key={c.id}>{definition(game, c).name}</span>
                              ))}
                            </div>
                          </details>
                        )}
                      </section>
                    ))}
                </div>
                <div className="table-divider">
                  <span>✦ ALTIPLANO EXPERIMENTAL ✦</span>
                </div>
                {viewSeat !== undefined && (
                  <section
                    className={`herd own-herd panel ${game.active === viewSeat ? 'current' : ''}`}
                  >
                    <div className="herd-heading">
                      <div>
                        <b>
                          {game.players[viewSeat].name} <small>· tu grupo</small>
                        </b>
                        <span>
                          {adults(game.players[viewSeat])}/{game.config.target} adultas para ganar ·
                          reserva {game.reserve ?? 'sin límite'}
                        </span>
                      </div>
                      <div className="installed">
                        {game.players[viewSeat].research.map((k) => (
                          <span key={k}>{k === 'farm' ? '🌾 Granja' : '⚡ Valla'}</span>
                        ))}
                        {game.players[viewSeat].powers.map((p, i) => (
                          <span key={i} className="power-chip">
                            {p.key}{' '}
                            {hasPower(game, game.players[viewSeat], p.key)
                              ? 'activo'
                              : 'suspendido'}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="llama-row">
                      {game.players[viewSeat].llamas.map((l) => (
                        <LlamaTile
                          key={l.id}
                          llama={l}
                          selected={selectedLlama === l.id}
                          onClick={() => {
                            setSelectedLlama(l.id);
                            const index = selectedOffers.findIndex((o) => o.action.target === l.id);
                            if (index >= 0) setTargetIndex(index);
                          }}
                        />
                      ))}
                      {!game.players[viewSeat].llamas.length && (
                        <div className="empty-herd">
                          Empieza incorporando una bebé. Todo gran desastre tiene un comienzo
                          pequeño.
                        </div>
                      )}
                    </div>
                  </section>
                )}
                {game.phase === 'recruit' && myTurn && (
                  <div className="recruit-banner">
                    <div>
                      <b>Una bebé quiere unirse a tu grupo.</b>
                      <p>Una incorporación gratis por turno. También puedes omitirla.</p>
                    </div>
                    <div className="row">
                      <button
                        disabled={!!actionError(game, { type: 'recruit' })}
                        onClick={() => execute({ type: 'recruit' })}
                      >
                        Incorporar bebé
                      </button>
                      <button
                        className="secondary"
                        onClick={() => execute({ type: 'skipRecruit' })}
                      >
                        Omitir
                      </button>
                    </div>
                  </div>
                )}
                {game.pending && (
                  <section className="choice-panel" aria-label="Decisión pendiente">
                    <span className="eyebrow">
                      {game.pending.kind === 'alarm' ? 'VENTANA DE DEFENSA' : 'RESOLVER ELECCIÓN'}
                    </span>
                    <h2>{game.pending.title}</h2>
                    {myTurn || (!!replayData && decisionSeat === viewSeat) ? (
                      <div className="choice-options">
                        {game.pending.options.map((o) => (
                          <button
                            key={o.id}
                            disabled={!!replayData}
                            onClick={() => execute({ type: 'choose', choice: o.id })}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p>
                        Decide {game.players[decisionSeat].name}.{' '}
                        {paused ? 'Bots en pausa.' : 'La mesa espera su respuesta.'}
                      </p>
                    )}
                  </section>
                )}
                {game.phase === 'resolving' && !game.pending && myTurn && (
                  <div className="notice">
                    <p>
                      Resolución extensa pausada. Puedes inspeccionar el estado antes de continuar.
                    </p>
                    <button onClick={() => execute({ type: 'resume' })}>
                      Continuar resolución
                    </button>
                  </div>
                )}
                {game.market.length > 0 && (
                  <section className="market panel">
                    <h3>
                      Recompensas comunes ·{' '}
                      {game.config.announce
                        ? 'se anuncian antes de activarse'
                        : 'primero en cumplir requisitos'}
                    </h3>
                    <div className="row wrap">
                      {game.market.map((c) => (
                        <button
                          className={selectedCard === c.id ? 'selected' : 'secondary'}
                          key={c.id}
                          onClick={() => {
                            setSelectedCard(c.id);
                            setTargetIndex(0);
                          }}
                        >
                          {definition(game, c).name}
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                {!!game.plans.length && (
                  <section className="panel market">
                    <h3>Poderosas anunciadas</h3>
                    {game.plans.map((p) => (
                      <button
                        key={p.card.id}
                        className="secondary"
                        onClick={() => {
                          setSelectedCard(p.card.id);
                          setTargetIndex(0);
                        }}
                      >
                        {game.players[p.player].name}: {definition(game, p.card).name} ·{' '}
                        {game.normalTurns >= p.readyRound
                          ? 'Lista para intentar activar'
                          : `espera ${p.readyRound - game.normalTurns} turno(s) normales`}
                      </button>
                    ))}
                  </section>
                )}
                {viewSeat !== undefined && (
                  <section className="hand-section">
                    <div className="section-heading">
                      <div>
                        <span className="eyebrow">TUS POSIBILIDADES</span>
                        <h2>
                          La mano <small>{game.players[viewSeat].hand.length} cartas</small>
                        </h2>
                      </div>
                      {myTurn && game.phase === 'actions' && (
                        <button className="secondary" onClick={() => execute({ type: 'end' })}>
                          Terminar turno →
                        </button>
                      )}
                    </div>
                    <div className="hand">
                      {game.players[viewSeat].hand.map((c) => (
                        <CardFace
                          key={c.id}
                          card={c}
                          game={game}
                          selected={selectedCard === c.id}
                          onClick={() => {
                            setSelectedCard(c.id);
                            setTargetIndex(0);
                          }}
                        />
                      ))}
                    </div>
                  </section>
                )}
                {selectedCard && selectedDef && (
                  <section className="action-panel panel" aria-label="Preparar jugada">
                    <div className="row spread">
                      <h2>{definition(game, selectedDef).name}</h2>
                      <button className="icon-button" onClick={() => setSelectedCard(null)}>
                        ×
                      </button>
                    </div>
                    <p>{definition(game, selectedDef).text}</p>
                    <small>Lógica ejecutable: {derivedText(definition(game, selectedDef))}</small>
                    {myTurn && selectedOffers.length > 0 ? (
                      <>
                        <label>
                          Modo y objetivos
                          <select
                            aria-label="Modo y objetivos"
                            value={Math.min(targetIndex, selectedOffers.length - 1)}
                            onChange={(e) => setTargetIndex(Number(e.target.value))}
                          >
                            {selectedOffers.map((o, i) => (
                              <option key={i} value={i}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        {Object.values(selectedOffer?.cost || {}).some(Boolean) && (
                          <div className="payment">
                            <h3>Elegir fuentes de pago</h3>
                            <p>
                              Coste:{' '}
                              {Object.entries(selectedOffer.cost)
                                .filter(([, n]) => n)
                                .map(([r, n]) => `${n} ${resourceNames[r as Resource]}`)
                                .join(' + ')}
                            </p>
                            {resources
                              .filter((r) => (selectedOffer.cost[r] || 0) > 0)
                              .map((r) => (
                                <div key={r} className="row wrap">
                                  {player!.llamas
                                    .filter((l) => l.resources[r])
                                    .map((l) => (
                                      <label key={l.id}>
                                        {l.id} · {resourceNames[r]} ({l.resources[r]})
                                        <input
                                          aria-label={`Pago ${l.id} ${r}`}
                                          type="number"
                                          min="0"
                                          max={l.resources[r]}
                                          value={
                                            payment.find(
                                              (x) => x.llama === l.id && x.resource === r,
                                            )?.amount || 0
                                          }
                                          onChange={(e) =>
                                            changePayment(l.id, r, Number(e.target.value))
                                          }
                                        />
                                      </label>
                                    ))}
                                </div>
                              ))}
                          </div>
                        )}
                        <p className="notice">
                          {selectedOffer.label}. Los efectos aleatorios se conocerán al resolver.{' '}
                          {game.config.announce &&
                          definition(game, selectedDef).category === 'power' &&
                          selectedOffer.action.type !== 'activate'
                            ? 'Anunciar reserva la carta; todavía no paga ni activa su efecto.'
                            : ''}
                        </p>
                        <button
                          disabled={!!actionError(game, { ...selectedOffer.action, payment })}
                          onClick={() => execute({ ...selectedOffer.action, payment })}
                        >
                          {selectedOffer.action.type === 'abandon'
                            ? 'Descartar plan fallido'
                            : 'Confirmar jugada'}
                        </button>
                        {actionError(game, { ...selectedOffer.action, payment }) && (
                          <p className="warning">
                            {actionError(game, { ...selectedOffer.action, payment })}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="notice">
                        {!myTurn
                          ? 'Espera tu turno para jugar.'
                          : definition(game, selectedDef).category === 'reaction'
                            ? 'Alarma se ofrece cuando un ataque abre una ventana de defensa.'
                            : requirementError(game, player!, definition(game, selectedDef)) ||
                              (game.growthUsed && player!.llamas.every((l) => l.age === 0)
                                ? 'Ya usaste la subida de este turno; una bebé necesita permiso para especializarse.'
                                : 'No hay objetivos o recursos compatibles ahora. Revisa costes, tipos y ventanas de la carta.')}
                      </p>
                    )}
                  </section>
                )}
                {game.winner !== null && (
                  <div className="victory">
                    <span>🏆</span>
                    <h2>Una victoria muy bien criada.</h2>
                    <p>
                      {game.players[game.winner].name} conserva {adults(game.players[game.winner])}{' '}
                      adultas simultáneas.
                    </p>
                    <button onClick={() => openEditor(game.config)}>
                      Clonar variante y volver a probar
                    </button>
                    <button
                      className="secondary"
                      onClick={() => {
                        setSetup(true);
                      }}
                    >
                      Otra partida
                    </button>
                  </div>
                )}
              </div>
              <aside className="sidebar">
                <section className="panel controls">
                  <span className="eyebrow">RITMO DE LA MESA</span>
                  <div className="row">
                    <button className="secondary" onClick={() => setPaused(!paused)}>
                      {paused ? '▶ Reanudar bots' : 'Ⅱ Pausar bots'}
                    </button>
                    <button
                      className="secondary"
                      disabled={!!replayData || myTurn || game.phase === 'finished'}
                      onClick={() => {
                        setPaused(true);
                        botStep();
                      }}
                    >
                      Un paso
                    </button>
                  </div>
                  <label>
                    Tiempo entre decisiones
                    <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
                      <option value={100}>Rápido · 0,1 s</option>
                      <option value={800}>Tranquilo · 0,8 s</option>
                      <option value={1800}>Observar · 1,8 s</option>
                    </select>
                  </label>
                  <small>Las decisiones humanas nunca se saltan.</small>
                </section>
                <section className="panel history">
                  <div className="row spread">
                    <h3>Lo que acaba de pasar</h3>
                    <span>↳</span>
                  </div>
                  <div className="history-feed" role="log">
                    {publicEvents
                      .slice(-35)
                      .reverse()
                      .map((e) => (
                        <div key={e.id} className={`history-event ${e.type}`}>
                          <span>T{e.turn}</span>
                          <p>{e.text}</p>
                        </div>
                      ))}
                  </div>
                </section>
                <section className="panel note-panel">
                  <h3>¿Cómo se sintió?</h3>
                  <select
                    aria-label="Tipo de nota"
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                  >
                    {['divertido', 'confuso', 'espera larga', 'quiero cambiar este coste'].map(
                      (t) => (
                        <option key={t}>{t}</option>
                      ),
                    )}
                  </select>
                  <textarea
                    aria-label="Nota de experiencia"
                    placeholder="Esta combinación merece otra partida…"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <button
                    className="secondary"
                    onClick={() => {
                      setNotes((n) => [
                        ...n,
                        { turn: game.turn, event: game.events.length - 1, tag, text: note },
                      ]);
                      setNote('');
                    }}
                  >
                    Guardar nota · turno {game.turn}
                  </button>
                  <small>{notes.length} notas guardadas</small>
                </section>
                <details className="panel">
                  <summary>Por qué decidió el bot</summary>
                  <p>{botInfo?.explanation || 'Todavía no hay decisiones de bot.'}</p>
                  {botInfo?.alternatives.map((a, i) => (
                    <p key={i}>
                      {a.score.toFixed(1)} · {a.label}
                    </p>
                  ))}
                </details>
                <details className="panel">
                  <summary>Guardar y exportar</summary>
                  <div className="stack">
                    <button
                      className="secondary"
                      onClick={() => {
                        saveLocal('manual', { game, initial, notes, telemetry });
                        setError('Partida guardada.');
                      }}
                    >
                      Guardar partida
                    </button>
                    <button
                      className="secondary"
                      onClick={() => {
                        try {
                          const s = loadLocal<Saved | null>('manual', null);
                          if (!s) throw Error('No hay guardado manual.');
                          load(s);
                        } catch (e) {
                          setError(String(e));
                        }
                      }}
                    >
                      Cargar guardado manual
                    </button>
                    <button
                      className="secondary"
                      onClick={() =>
                        download('llamas-partida.json', { game, initial, notes, telemetry })
                      }
                    >
                      Exportar partida completa
                    </button>
                    <button
                      className="secondary"
                      onClick={() =>
                        initial &&
                        download('llamas-replay.json', exportReplay(initial, game, notes))
                      }
                    >
                      Exportar replay completo
                    </button>
                    <button
                      className="secondary"
                      onClick={() => {
                        if (initial)
                          download('llamas-serie-publica.json', {
                            fingerprint: game.fingerprint,
                            exploratory: game.exploratory,
                            series: timeline(initial, game.commands.slice(initial.commands.length)),
                            notes,
                          });
                      }}
                    >
                      Exportar serie pública y notas
                    </button>
                    <button
                      className="secondary"
                      onClick={() => download('llamas-reglas.json', game.config)}
                    >
                      Exportar reglas
                    </button>
                    <button
                      className="secondary"
                      onClick={() => {
                        const origins = loadLocal<Saved[]>('branch-origins', []);
                        if (origins.length)
                          download('llamas-origen-rama.json', origins[origins.length - 1]);
                        else setError('Todavía no hay una rama con origen guardado.');
                      }}
                    >
                      Exportar origen de la última rama
                    </button>
                    <label className="button secondary">
                      Importar partida / replay
                      <input
                        type="file"
                        hidden
                        accept=".json"
                        onChange={(e) => e.target.files?.[0] && void loadFile(e.target.files[0])}
                      />
                    </label>
                    <small>
                      Los archivos completos contienen información oculta. No los uses para espiar
                      una partida en curso.
                    </small>
                  </div>
                </details>
                <details className="panel">
                  <summary>Inspector de laboratorio</summary>
                  <p>
                    Deshacer o revelar marca la sesión como exploratoria. Las observaciones del bot
                    siguen filtradas.
                  </p>
                  <div className="row">
                    <button disabled={!!replayData || !past.length} onClick={undo}>
                      Deshacer
                    </button>
                    <button disabled={!!replayData || !future.length} onClick={redo}>
                      Repetir
                    </button>
                  </div>
                  <button
                    className="secondary"
                    disabled={!!replayData}
                    onClick={() => {
                      setReveal(!reveal);
                      setGame((g) => (g ? { ...g, exploratory: true } : g));
                    }}
                  >
                    Revelar / ocultar manos
                  </button>
                  <label>
                    Tomar control de un asiento
                    <select
                      disabled={!!replayData}
                      value=""
                      onChange={(e) => takeover(Number(e.target.value))}
                    >
                      <option value="">Elegir…</option>
                      {game.players.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p>
                    Huella {game.fingerprint} · semilla {game.seed}
                  </p>
                  <p>
                    Apartadas: {game.aside.length} · fuera del circuito: {game.out.length}
                  </p>
                  <p>{actions.length} opciones legales (antes del filtro del bot).</p>
                  <p>
                    {telemetry
                      .filter((t) => t.kind === 'human')
                      .reduce((n, t) => n + t.ms, 0)
                      .toFixed(0)}{' '}
                    ms de decisión humana ·{' '}
                    {telemetry
                      .filter((t) => t.kind === 'bot')
                      .reduce((n, t) => n + t.ms, 0)
                      .toFixed(1)}{' '}
                    ms de cómputo bot. Animaciones/espera: {speed} ms por decisión automática.
                  </p>
                  <details>
                    <summary>Eventos y causas públicos</summary>
                    <pre>{JSON.stringify(game.events.slice(-60), null, 2)}</pre>
                  </details>
                </details>
              </aside>
            </div>
          </>
        )}
        {tab === 'editor' && (
          <Editor
            key={editorKey}
            config={editorConfig}
            onSave={savePreset}
            onPlay={(c) => {
              savePreset(c);
              newGame(c);
            }}
            onBranch={(c) => {
              if (!game) throw Error('Primero inicia una partida.');
              const g = branchGame(game, c);
              if (!preserveOrigin())
                throw Error('No se creó la rama: su origen no pudo guardarse.');
              setReplayData(null);
              setGame(g);
              setInitial(structuredClone(g));
              setPast([]);
              setFuture([]);
              setPaused(true);
            }}
          />
        )}
        {tab === 'rules' && (
          <section className="rules-page">
            <div className="section-heading">
              <div>
                <span className="eyebrow">REGLAS DE ESTA PARTIDA</span>
                <h1>Un poco de orden para tanto caos.</h1>
                <p>
                  {(game?.config || config).name} · reglas versionadas · los módulos son
                  experimentos, no promesas de balance.
                </p>
              </div>
              <button onClick={() => openEditor(game?.config || config)}>Clonar y editar</button>
            </div>
            <div className="rule-cards">
              {(game?.config || config).rules.map((r) => (
                <article className="panel" key={r.id}>
                  <span className={`rule-status ${r.status}`}>
                    {
                      {
                        confirmed: 'Confirmada',
                        provisional: 'Provisional',
                        experimental: 'Experimental',
                      }[r.status]
                    }{' '}
                    · {r.source}
                  </span>
                  <h3>{r.id}</h3>
                  <p>{r.description}</p>
                </article>
              ))}
            </div>
            <div className="panel">
              <h2>Opciones activas</h2>
              <p>
                Meta: {(game?.config || config).target} adultas · mano inicial{' '}
                {(game?.config || config).initialHand} · robo {(game?.config || config).draw} ·
                Granja/Valla{' '}
                {(game?.config || config).researchPersists
                  ? 'persisten'
                  : 'requieren estudiosa adulta'}
                .
              </p>
              <p>
                Poderosas{' '}
                {(game?.config || config).market ? 'visibles fuera del mazo' : 'desde la mano'} ·
                anuncio {(game?.config || config).announce ? 'activo' : 'inactivo'} · explosión
                extra {(game?.config || config).explosionExtra ? 'activa' : 'inactiva'} · cartas de
                alimentación{' '}
                {(game?.config || config).deferredFeed
                  ? 'apartadas hasta próximo turno'
                  : 'al descarte inmediatamente'}{' '}
                · eventos{' '}
                {(game?.config || config).autoEvents ? 'automáticos al robar' : 'desde la mano'}.
              </p>
              <p>
                Las probabilidades de loca se normalizan a partir de los pesos editados. Los regalos
                no alimentan. Alarma{' '}
                {(game?.config || config).crazyProtected ? 'protege' : 'no protege'} el robo de
                loca.
              </p>
              <p>
                Ejemplo base: dos Comidas a la misma bebé en un turno producen una glotona joven con
                dos comidas y dos robos; la segunda alimentación no la hace adulta. En otro turno
                necesita una alimentación nueva.
              </p>
              <p>
                Alarma protege el grupo y la mano. La protección por vecindad no está implementada.
              </p>
            </div>
            <h2>Catálogo de la variante</h2>
            <div className="rule-cards">
              {(game?.config || config).cards
                .filter((c) => c.copies)
                .map((c) => (
                  <article key={c.id} className="panel">
                    <small>
                      {c.copies} copias · {c.category}
                    </small>
                    <h3>{c.name}</h3>
                    <p>{c.text}</p>
                    <small>Efecto ejecutable: {derivedText(c)}</small>
                  </article>
                ))}
            </div>
          </section>
        )}
        {tab === 'lab' && (
          <section className="lab-page">
            <span className="eyebrow">MESA DE PRUEBAS</span>
            <h1>Compara variantes, conserva las dudas.</h1>
            <p>
              Semillas compartidas, rotación de los tres asientos y el mismo motor de la mesa. Las
              métricas describen lo ocurrido; no miden diversión ni prometen balance.
            </p>
            <div className="panel form-panel">
              <div className="form-grid">
                <label>
                  Variante A
                  <select
                    value={selectedPreset}
                    onChange={(e) => setSelectedPreset(e.target.value)}
                  >
                    {allPresets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Variante B
                  <select value={compare} onChange={(e) => setCompare(e.target.value)}>
                    {allPresets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Semillas, separadas por coma
                  <input value={batchSeeds} onChange={(e) => setBatchSeeds(e.target.value)} />
                </label>
                <label>
                  Presupuesto por partida (decisiones)
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={budget}
                    onChange={(e) =>
                      setBudget(Math.max(1, Math.min(10000, Number(e.target.value))))
                    }
                  />
                </label>
              </div>
              <p>
                Perfiles: Criador, Agresivo e Investigador. Máximo de 15 s por partida. Invariantes
                comprobados tras cada decisión. Las partidas censuradas no tienen ganador y no
                cuentan como derrotas.
              </p>
              <div className="row">
                <button disabled={running} onClick={beginBatch}>
                  Ejecutar comparación
                </button>
                <button
                  className="secondary"
                  disabled={!running}
                  onClick={() => {
                    worker.current?.terminate();
                    if (batchProgress.current) {
                      setResults((r) => [
                        ...r,
                        {
                          ...batchProgress.current!,
                          status: 'interrupted',
                          winner: null,
                          profile: null,
                          snapshot: true,
                        },
                      ]);
                      batchProgress.current = null;
                    }
                    setRunning(false);
                    setError(
                      'Lote interrumpido. Se conserva su último avance conocido como interrupted (snapshot), sin victoria ni derrota; los resultados completados se conservan.',
                    );
                  }}
                >
                  Interrumpir lote
                </button>
                <button
                  className="secondary"
                  disabled={!results.length}
                  onClick={() => download('llamas-comparacion.csv', csv(results), 'text/csv')}
                >
                  Exportar CSV
                </button>
                <button
                  className="secondary"
                  disabled={!results.length}
                  onClick={() =>
                    download('llamas-comparacion.json', {
                      results,
                      configs: [config, allPresets.find((p) => p.id === compare)],
                      budget,
                      seeds: batchSeeds,
                    })
                  }
                >
                  Exportar lote JSON
                </button>
              </div>
            </div>
            <h2>
              {running ? 'Simulando en segundo plano…' : `${results.length} partidas registradas`}
            </h2>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {[
                      'Variante',
                      'Semilla',
                      'Rotación',
                      'Resultado',
                      'Ganador',
                      'Turnos',
                      'Ataques / bloqueos',
                      'Subidas',
                      'Cambios de líder',
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i}>
                      <td>{r.preset}</td>
                      <td>{r.seed}</td>
                      <td>{r.rotation + 1}</td>
                      <td>{r.status}</td>
                      <td>{r.profile ?? '—'}</td>
                      <td>{r.turns}</td>
                      <td>
                        {r.attacks} / {r.blocked}
                      </td>
                      <td>{r.growth}</td>
                      <td>{r.leaderChanges}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="panel">
              <h3>Laboratorio interactivo</h3>
              <p>
                En la mesa puedes observar bots, pausar, avanzar una decisión, tomar control,
                revelar manos, deshacer y repetir. Estas acciones marcan la sesión como
                exploratoria. Editar una variante propone una partida nueva; las ramas solo migran
                cambios inequívocos de meta de victoria.
              </p>
              <button
                onClick={() => {
                  setHuman(-1);
                  setSetup(true);
                  setTab('table');
                }}
              >
                Preparar partida entre bots
              </button>
            </div>
          </section>
        )}
      </main>
      <footer>
        HECHO PARA PROBAR, NO PARA DAR NADA POR DEFINITIVO.{' '}
        <span>Sin cuentas · Sin IA remota · Todo en tu navegador</span>
      </footer>
    </>
  );
}
