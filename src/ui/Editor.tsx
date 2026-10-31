import { useState } from 'react';
import { CardDef, Config, Effect, Kind, Operation, Resource, resources } from '../engine/types';
import { catalog, kindNames, resourceNames } from '../content/catalog';
import { derivedText, validateConfig } from '../engine/config';
import { download } from '../persistence/storage';
interface Props {
  config: Config;
  onSave: (c: Config) => void;
  onPlay: (c: Config) => void;
  onBranch: (c: Config) => void;
}
export function Editor({ config, onSave, onPlay, onBranch }: Props) {
  const [draft, setDraft] = useState<Config>(() => ({
    ...structuredClone(config),
    id: `custom-${Date.now()}`,
    name: `${config.name} · mi variante`,
  }));
  const [selected, setSelected] = useState(draft.cards[0].id);
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState('cards');
  const card = draft.cards.find((x) => x.id === selected)!;
  const validation = validateConfig(draft);
  const update = (patch: Partial<Config>) => setDraft((d) => ({ ...d, ...patch }));
  const updateCard = (patch: Partial<CardDef>) =>
    setDraft((d) => ({
      ...d,
      cards: d.cards.map((x) => (x.id === selected ? { ...x, ...patch } : x)),
    }));
  const editEffect = (i: number, patch: Partial<Effect>) =>
    updateCard({ effects: card.effects.map((e, j) => (i === j ? { ...e, ...patch } : e)) });
  const importFile = async (file: File) => {
    try {
      const value = JSON.parse(await file.text());
      if (value.format === 'llamas-card') {
        const c = value.card;
        const result = validateConfig({
          ...draft,
          cards: [...draft.cards.filter((x) => x.id !== c.id), c],
        });
        if (!result.config) throw Error(result.errors.join(' '));
        setDraft(result.config);
        setSelected(c.id);
      } else {
        const result = validateConfig(value);
        if (!result.config) throw Error(result.errors.join(' '));
        setDraft({ ...result.config, id: `custom-${Date.now()}` });
        setSelected(result.config.cards[0].id);
      }
      setMessage('Importación validada.');
    } catch (e) {
      setMessage(String(e));
    }
  };
  return (
    <div className="editor">
      <div className="section-heading">
        <div>
          <span className="eyebrow">TALLER LIBRE</span>
          <h1>Una idea. Otra partida.</h1>
          <p>Estás editando una copia. Las referencias y la partida actual conservan sus reglas.</p>
        </div>
        <div className="row">
          <label className="button secondary">
            Importar JSON
            <input
              hidden
              type="file"
              accept=".json"
              onChange={(e) => e.target.files?.[0] && void importFile(e.target.files[0])}
            />
          </label>
          <button className="secondary" onClick={() => download(`${draft.id}.json`, draft)}>
            Exportar variante
          </button>
        </div>
      </div>
      <div className="toolbar">
        <label className="grow">
          Nombre de variante
          <input value={draft.name} onChange={(e) => update({ name: e.target.value })} />
        </label>
        <button
          disabled={!!validation.errors.length}
          onClick={() => {
            onSave(draft);
            setMessage('Variante guardada en este navegador.');
          }}
        >
          Guardar variante
        </button>
        <button disabled={!!validation.errors.length} onClick={() => onPlay(draft)}>
          Usar en partida nueva
        </button>
        <button
          className="secondary"
          disabled={!!validation.errors.length}
          onClick={() => {
            try {
              onBranch(draft);
              setMessage('Rama exploratoria creada.');
            } catch (e) {
              setMessage(String(e));
            }
          }}
        >
          Crear rama estable
        </button>
      </div>
      <div className="subnav">
        {[
          ['cards', 'Cartas y efectos'],
          ['parameters', 'Parámetros'],
          ['modules', 'Módulos'],
        ].map(([id, text]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {text}
          </button>
        ))}
      </div>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {validation.errors.length > 0 && (
        <div role="alert" className="notice error">
          {validation.errors.map((s, i) => (
            <p key={i}>{s}</p>
          ))}
        </div>
      )}
      {validation.warnings.length > 0 && (
        <details className="notice">
          <summary>{validation.warnings.length} advertencia(s) experimental(es)</summary>
          {validation.warnings.map((s, i) => (
            <p key={i}>{s}</p>
          ))}
        </details>
      )}
      {tab === 'cards' && (
        <div className="editor-grid">
          <aside className="panel card-list">
            <h3>Mazo · {draft.cards.reduce((n, c) => n + c.copies, 0)} copias</h3>
            {draft.cards.map((c) => (
              <button
                key={c.id}
                className={c.id === selected ? 'selected' : ''}
                onClick={() => setSelected(c.id)}
              >
                <span>{c.name}</span>
                <b>{c.copies}</b>
              </button>
            ))}
            <button
              onClick={() => {
                const id = `card_${Date.now()}`;
                const c: CardDef = {
                  ...structuredClone(catalog[13]),
                  id,
                  name: 'Robar dos',
                  copies: 2,
                  category: 'event',
                  modules: [],
                  text: 'Roba dos cartas.',
                  effects: [{ op: 'draw', amount: 2 }],
                };
                update({ cards: [...draft.cards, c] });
                setSelected(id);
              }}
            >
              ＋ Crear carta
            </button>
            <label>
              Añadir del catálogo
              <select
                value=""
                onChange={(e) => {
                  const c = structuredClone(catalog.find((x) => x.id === e.target.value)!);
                  update({ cards: [...draft.cards, c] });
                  setSelected(c.id);
                }}
              >
                <option value="">Elegir carta…</option>
                {catalog
                  .filter((c) => !draft.cards.some((x) => x.id === c.id))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
          </aside>
          <div className="panel form-panel">
            <div className="row spread">
              <h2>{card.name}</h2>
              <button
                className="secondary"
                onClick={() => {
                  const c = {
                    ...structuredClone(card),
                    id: `card_${Date.now()}`,
                    name: `${card.name} (copia)`,
                  };
                  update({ cards: [...draft.cards, c] });
                  setSelected(c.id);
                }}
              >
                Duplicar carta
              </button>
            </div>
            <small>ID estable: {card.id}</small>
            <div className="form-grid">
              <label>
                Nombre
                <input value={card.name} onChange={(e) => updateCard({ name: e.target.value })} />
              </label>
              <label>
                Copias
                <input
                  aria-label="Copias"
                  type="number"
                  min="0"
                  max="300"
                  value={card.copies}
                  onChange={(e) => updateCard({ copies: Number(e.target.value) })}
                />
              </label>
              <label>
                Categoría
                <select
                  value={card.category}
                  onChange={(e) => updateCard({ category: e.target.value as CardDef['category'] })}
                >
                  {[
                    'resource',
                    'attack',
                    'reaction',
                    'research',
                    'power',
                    'event',
                    'connection',
                  ].map((x, i) => (
                    <option key={x} value={x}>
                      {
                        [
                          'Recurso',
                          'Ataque',
                          'Reacción',
                          'Investigación',
                          'Poderosa',
                          'Evento',
                          'Conexión',
                        ][i]
                      }
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Objetivos
                <select
                  value={card.targets}
                  onChange={(e) => updateCard({ targets: e.target.value as CardDef['targets'] })}
                >
                  {[
                    ['none', 'Sin objetivo'],
                    ['own', 'Llama propia'],
                    ['enemy', 'Objetivo rival'],
                    ['pair', 'Propia y rival'],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Duración
                <select
                  value={card.duration}
                  onChange={(e) => updateCard({ duration: e.target.value as CardDef['duration'] })}
                >
                  <option value="turn">Resto del turno</option>
                  <option value="permanent">Permanente</option>
                </select>
              </label>
              <label>
                Límite por partida (0 = sin límite)
                <input
                  type="number"
                  min="0"
                  value={card.limit}
                  onChange={(e) => updateCard({ limit: Number(e.target.value) })}
                />
              </label>
            </div>
            <label>
              Ambientación
              <input value={card.flavor} onChange={(e) => updateCard({ flavor: e.target.value })} />
            </label>
            <label>
              Descripción editorial
              <textarea value={card.text} onChange={(e) => updateCard({ text: e.target.value })} />
            </label>
            <div className="notice">
              Efecto ejecutable (siempre visible en mesa): <b>{derivedText(card)}</b>. La
              descripción editorial no cambia la lógica.
            </div>
            <h3>Coste · recursos de cualquier llama propia</h3>
            <div className="form-grid compact">
              {resources.map((r) => (
                <label key={r}>
                  {resourceNames[r]}
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={card.cost[r] || 0}
                    onChange={(e) =>
                      updateCard({ cost: { ...card.cost, [r]: Number(e.target.value) } })
                    }
                  />
                </label>
              ))}
            </div>
            <h3>Requisitos</h3>
            <div className="form-grid">
              <label>
                Tipo requerido
                <select
                  value={card.requirements.kind || ''}
                  onChange={(e) =>
                    updateCard({
                      requirements: {
                        ...card.requirements,
                        kind: (e.target.value as Kind) || undefined,
                      },
                    })
                  }
                >
                  <option value="">Cualquier tipo</option>
                  {Object.entries(kindNames).map(([k, n]) => (
                    <option key={k} value={k}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              {[
                ['adults', 'Adultas'],
                ['count', 'Llamas del tipo'],
                ['raids', 'Saqueos exitosos'],
                ['feeds', 'Alimentaciones de loca'],
              ].map(([k, n]) => (
                <label key={k}>
                  {n}
                  <input
                    type="number"
                    min="0"
                    value={card.requirements[k as 'adults'] || 0}
                    onChange={(e) =>
                      updateCard({
                        requirements: { ...card.requirements, [k]: Number(e.target.value) },
                      })
                    }
                  />
                </label>
              ))}
              <label>
                Segundo tipo joven/adulto
                <select
                  value={card.requirements.secondKind || ''}
                  onChange={(e) =>
                    updateCard({
                      requirements: {
                        ...card.requirements,
                        secondKind: (e.target.value as Kind) || undefined,
                      },
                    })
                  }
                >
                  <option value="">Ninguno</option>
                  {Object.entries(kindNames).map(([k, n]) => (
                    <option key={k} value={k}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <h3>Constructor de efectos</h3>
            <p className="muted">
              Las operaciones se ejecutan en orden. Una mecánica inédita requiere ampliar el motor;
              nunca se ejecuta JavaScript importado.
            </p>
            {card.effects.map((effect, i) => (
              <div className="effect-row" key={i}>
                <label>
                  Operación
                  <select
                    value={effect.op}
                    onChange={(e) => {
                      const op = e.target.value as Operation;
                      if (
                        [
                          'feed',
                          'resource',
                          'spend',
                          'transfer',
                          'explosion',
                          'connection',
                        ].includes(op)
                      )
                        updateCard({ targets: 'own' });
                      editEffect(i, {
                        op,
                        ...(op === 'feed'
                          ? { kind: 'glutton' as Kind, resource: 'food' as Resource }
                          : {}),
                        ...(['random', 'choice'].includes(op)
                          ? {
                              options: [
                                [{ op: 'draw', amount: 1 }],
                                [{ op: 'resource', resource: 'study', amount: 1 }],
                              ],
                            }
                          : {}),
                        ...(op === 'install' ? { key: 'farm' } : {}),
                        ...(op === 'steal' ? { key: 'raid' } : {}),
                        ...(op === 'connection' ? { key: 'chaos' } : {}),
                      });
                    }}
                  >
                    {[
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
                    ].map((v, j) => (
                      <option key={v} value={v}>
                        {
                          [
                            'Robar cartas',
                            'Descartar al azar',
                            'Alimentar',
                            'Generar recurso',
                            'Cambiar edad (respeta permiso)',
                            'Robar / transferir',
                            'Intercambiar llamas',
                            'Devolver bebé',
                            'Instalar efecto',
                            'Recuperar carta',
                            'Turno extra',
                            'Elección',
                            'Selección aleatoria',
                            'Explosión',
                            'Acción social',
                            'Conexión',
                            'Transferir recursos',
                            'Gastar recursos',
                          ][j]
                        }
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Cantidad
                  <input
                    type="number"
                    min={effect.op === 'age' ? -2 : 0}
                    value={effect.amount ?? 1}
                    onChange={(e) => editEffect(i, { amount: Number(e.target.value) })}
                  />
                </label>
                {['feed', 'resource', 'transfer', 'spend'].includes(effect.op) && (
                  <label>
                    Recurso
                    <select
                      value={effect.resource || 'food'}
                      onChange={(e) => editEffect(i, { resource: e.target.value as Resource })}
                    >
                      {resources.map((r) => (
                        <option key={r} value={r}>
                          {resourceNames[r]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {effect.op === 'feed' && (
                  <label>
                    Tipo
                    <select
                      value={effect.kind || 'glutton'}
                      onChange={(e) => editEffect(i, { kind: e.target.value as Kind })}
                    >
                      {Object.entries(kindNames).map(([k, n]) => (
                        <option key={k} value={k}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {['steal', 'install', 'connection'].includes(effect.op) && (
                  <label>
                    Modo
                    <select
                      value={effect.key || ''}
                      onChange={(e) => editEffect(i, { key: e.target.value })}
                    >
                      <option value="">Elegir…</option>
                      {(effect.op === 'steal'
                        ? ['raid', 'conversion', 'hand']
                        : effect.op === 'install'
                          ? ['farm', 'fence', 'blessing', 'banquet', 'revelation', 'thesis']
                          : ['chaos', 'leftovers']
                      ).map((k) => (
                        <option key={k}>{k}</option>
                      ))}
                    </select>
                  </label>
                )}
                <button
                  className="icon-button"
                  aria-label="Quitar efecto"
                  onClick={() => updateCard({ effects: card.effects.filter((_, j) => i !== j) })}
                >
                  ×
                </button>
                {effect.options && (
                  <div className="nested-effects">
                    {effect.options.map((option, j) => (
                      <label key={j}>
                        Alternativa {j + 1} · robar cartas
                        <input
                          type="number"
                          min="0"
                          value={option[0]?.amount ?? 1}
                          onChange={(e) =>
                            editEffect(i, {
                              options: effect.options!.map((a, k) =>
                                k === j ? [{ op: 'draw', amount: Number(e.target.value) }] : a,
                              ),
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="row">
              <button
                className="secondary"
                onClick={() =>
                  updateCard({ effects: [...card.effects, { op: 'draw', amount: 1 }] })
                }
              >
                ＋ Efecto
              </button>
              <button
                className="secondary"
                onClick={() =>
                  download(`${card.id}.json`, { format: 'llamas-card', version: 1, card })
                }
              >
                Exportar carta
              </button>
              <button className="danger" onClick={() => updateCard({ copies: 0 })}>
                Quitar del mazo (0 copias)
              </button>
            </div>
            <details>
              <summary>Ventanas, disparadores y módulos</summary>
              <div className="form-grid">
                <label>
                  Ventana de defensa
                  <select
                    value={card.reactionWindows.includes('alarm') ? 'alarm' : ''}
                    onChange={(e) =>
                      updateCard({ reactionWindows: e.target.value ? ['alarm'] : [] })
                    }
                  >
                    <option value="">Sin Alarma</option>
                    <option value="alarm">Ataque bloqueable con Alarma</option>
                  </select>
                </label>
                <label>
                  Disparador
                  <select
                    value={card.triggers[0] || ''}
                    onChange={(e) =>
                      updateCard({ triggers: e.target.value ? [e.target.value] : [] })
                    }
                  >
                    <option value="">Sin restricción</option>
                    {[
                      ['afterChaos', 'Después de loca'],
                      ['afterExplosion', 'Después de explosión, nueva mano'],
                      ['afterFeed', 'Después de alimentación pagada'],
                    ].map(([v, n]) => (
                      <option key={v} value={v}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Módulos (separados por coma)
                  <input
                    value={card.modules.join(',')}
                    onChange={(e) =>
                      updateCard({ modules: e.target.value.split(',').filter(Boolean) })
                    }
                  />
                </label>
              </div>
            </details>
          </div>
        </div>
      )}
      {tab === 'parameters' && (
        <div className="panel form-panel">
          <h2>Convenciones provisionales</h2>
          <div className="form-grid">
            {[
              ['initialHand', 'Mano inicial'],
              ['draw', 'Robo por turno'],
              ['target', 'Adultas para ganar'],
              ['initialLlamas', 'Bebés iniciales'],
              ['gluttonYoung', 'Robo glotona joven'],
              ['gluttonAdult', 'Robo glotona adulta'],
              ['farmDraw', 'Robo extra de Granja'],
              ['fenceCopies', 'Cartas exigidas por Valla'],
              ['rejectionCost', 'Coste adicional de Rechazo (caos)'],
              ['thesisRecovery', 'Recuperar con Tesis (estudio)'],
            ].map(([k, n]) => (
              <label key={k}>
                {n}
                <input
                  type="number"
                  min={k === 'target' || k === 'fenceCopies' ? 1 : 0}
                  value={draft[k as 'target']}
                  onChange={(e) => update({ [k]: Number(e.target.value) })}
                />
              </label>
            ))}
            {[
              ['reserve', 'Reserva finita'],
              ['groupLimit', 'Límite de grupo'],
              ['handLimit', 'Límite de mano'],
            ].map(([k, n]) => (
              <label key={k}>
                {n} (vacío = sin límite)
                <input
                  type="number"
                  min="0"
                  value={draft[k as 'reserve'] ?? ''}
                  onChange={(e) =>
                    update({ [k]: e.target.value === '' ? null : Number(e.target.value) })
                  }
                />
              </label>
            ))}
          </div>
          <h3>Tabla de loca · pesos normalizados al sortear</h3>
          <div className="form-grid">
            {[
              'Robar dos',
              'Descartar una',
              'Robar a rival',
              'Ganar estudio',
              'Ganar comida',
              'Nada mecánico',
            ].map((n, i) => (
              <label key={n}>
                {n}
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={draft.chaosWeights[i]}
                  onChange={(e) =>
                    update({
                      chaosWeights: draft.chaosWeights.map((x, j) =>
                        i === j ? Number(e.target.value) : x,
                      ),
                    })
                  }
                />
                <small>
                  {(
                    (100 * draft.chaosWeights[i]) /
                    draft.chaosWeights.reduce((a, b) => a + b, 0)
                  ).toFixed(1)}
                  %
                </small>
              </label>
            ))}
          </div>
        </div>
      )}
      {tab === 'modules' && (
        <div className="panel form-panel">
          <h2>Excepciones explícitas</h2>
          <p>
            Habilitar una ruta añade sus cartas. No modifica las reglas base de las otras rutas.
          </p>
          <div className="form-grid">
            {[
              ['holy', 'Santa y Bendición'],
              ['banquet', 'Banquete'],
              ['scam', 'Gran Estafa'],
              ['revelation', 'Revelación'],
              ['thesis', 'Tesis · prototipo'],
              ['connections', 'Conexiones'],
              ['interaction', 'Más interacción'],
            ].map(([id, n]) => {
              const enabled = draft.cards.some((c) => c.modules.includes(id) && c.copies > 0);
              return (
                <label className="check" key={id}>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => {
                      const additions = catalog.filter((c) => c.modules.includes(id));
                      update({
                        cards: [
                          ...draft.cards.filter((c) => !c.modules.includes(id)),
                          ...structuredClone(additions).map((c) => ({
                            ...c,
                            copies: e.target.checked ? c.copies : 0,
                          })),
                        ],
                      });
                    }}
                  />
                  {n}
                </label>
              );
            })}
            {[
              ['market', 'Poderosas comunes visibles (una copia fuera del mazo)'],
              ['announce', 'Anunciar poderosas con una vuelta de anticipación'],
              ['explosionExtra', 'Explosión: una subida extra, sin repetir llama'],
              ['deferredFeed', 'Apartar cartas usadas para alimentar hasta próximo turno'],
              ['autoEvents', 'Eventos se activan automáticamente al robar'],
              ['researchPersists', 'Investigaciones persisten sin estudiosa'],
              ['crazyProtected', 'Robo de loca abre Alarma'],
              ['allowRecoverAside', 'Recuperación explícita admite cartas apartadas'],
            ].map(([k, n]) => (
              <label className="check" key={k}>
                <input
                  type="checkbox"
                  checked={Boolean(draft[k as 'market'])}
                  onChange={(e) => update({ [k]: e.target.checked })}
                />
                {n}
              </label>
            ))}
            <label>
              Meditación
              <select
                value={draft.meditation}
                onChange={(e) => update({ meditation: e.target.value as Config['meditation'] })}
              >
                <option value="extra">Turno extra</option>
                <option value="draw">Robar dos cartas</option>
              </select>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
