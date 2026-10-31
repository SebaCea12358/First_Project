# Llamas en llamas

Laboratorio local de un juego de cartas: juega contra bots, observa partidas, clona variantes y cambia cartas sin editar el motor. Aplicación en español con TypeScript, React y Vite. Sin backend, cuentas, claves ni servicios de IA. Los bots son heurísticas locales.

## Ejecutar

Requiere Node.js 22.12+ (validado con Node 24.19) y npm.

```sh
cd /workspace/First_Project
npm ci
npm run dev
```

Abre la dirección que Vite indique en tu navegador local. Las dependencias se descargan durante `npm ci`; el juego no hace peticiones externas y puede usarse sin Internet una vez instalado. `npm run build` genera `dist/`.

## Jugar y probar otra variante

1. Selecciona uno de los cinco presets de referencia, tu asiento y los perfiles de los bots. Elige semilla para repetir el azar o genera una nueva. Por defecto: una persona y dos bots.
2. Incorpora una bebé u omite la incorporación. Selecciona una carta de la mano, elige modo/objetivos y distribuye los recursos del pago. Confirma la jugada.
3. Las defensas y elecciones detienen el motor hasta responder. Puedes seguir alimentando después de usar la subida global. Termina el turno cuando quieras.
4. En **Taller de variantes**, se crea una copia de la referencia. Cambia copias, costes, requisitos, efectos, parámetros o módulos; guarda y pulsa **Usar en partida nueva**. Los cambios no modifican la partida en curso.
5. **Crear carta** empieza con una carta de robar dos. El constructor edita operaciones soportadas, no ejecuta código importado. La lógica ejecutable se muestra junto a la descripción editorial para distinguirlas.

Presets: **Base de trabajo** (100 cartas), **Más interacción** (116), **Ruta santa**, **Rutas alternativas** y **Recompensas visibles**. El **Taller libre** es una copia editable de cualquiera de ellos. Ninguno se declara equilibrado.

## Guardados, replays y laboratorio

- Guardado automático y manual en `localStorage`, además de exportación/importación JSON. Dependen del navegador y del origen/puerto; exporta archivos para respaldar tu trabajo. Si el almacenamiento se llena, la mesa informa el fallo.
- Las partidas guardan una copia completa de reglas y catálogo. Las referencias del taller permanecen intactas.
- Importar un replay verifica la versión y reproduce sus comandos hasta comprobar la huella final. El visor permite volver al inicio, avanzar/retroceder y ver desde un asiento. Solo muestra la mano de ese asiento y las elecciones que le pertenecen. Puedes continuar creando una rama exploratoria.
- Los archivos completos de partida/replay incluyen secretos del juego. La serie pública exporta evolución de grupos, recursos, cantidades de cartas, acciones, ataques y notas sin identidades de cartas de manos rivales ni orden de mazo.
- El inspector permite deshacer/repetir (con RNG y elecciones), revelar manos y tomar control. Marca esas sesiones como **exploratorias**. Tomar control inicia un nuevo segmento de replay desde el estado actual.
- Editar mientras juegas propone una nueva partida. Crear una rama desde un estado estable solo admite cambios inequívocos de meta de victoria; otros cambios requieren comenzar de nuevo. Los originales se conservan automáticamente; puedes exportar el origen de la última rama desde Guardar y exportar.
- **Laboratorio** compara dos variantes en un Web Worker con semillas compartidas y rotación de perfiles en los asientos. Permite interrumpir y exportar CSV/JSON. Un registro `interrupted` con `snapshot: true` representa el último avance conocido, no una partida terminada. `censored` significa que se agotó el presupuesto sin ganador.

## Validación

```sh
npm test
npm run build
npm run test:e2e
npm run simulate -- --seeds 2 --budget 700
npm run simulate -- --preset base --seeds 1 --budget 400
npm run simulate -- --config docs/presets/holy.json --seeds 1 --budget 700
```

Playwright usa `/usr/bin/chromium` en este entorno. En otro sistema, instala Chromium y define `CHROMIUM_PATH` con la ruta de su ejecutable, o adapta `playwright.config.ts` para usar un navegador instalado por Playwright. En entornos con sandbox de procesos/red, iniciar Vite o Chromium puede requerir el permiso de ejecución correspondiente.

Los JSON de referencia están en `docs/presets/` y hay una carta importable en `docs/examples/dos-ideas.json`. Puedes pasar un preset exportado desde el taller mediante `--config archivo.json`. La simulación escribe `simulation-results.csv`. Por defecto compara los cinco presets con tres bots (Criador, Agresivo, Investigador), dos semillas y las tres rotaciones de los perfiles en los asientos. Cada partida tiene un presupuesto de decisiones y 15 segundos. Comprueba invariantes después de cada comando. Una partida inconclusa nunca recibe un ganador artificial.

Pruebas y decisiones: [docs/validacion.md](docs/validacion.md), [docs/decisiones.md](docs/decisiones.md). Especificación recibida: [docs/especificacion.md](docs/especificacion.md).

## Estructura y extensiones

- `src/engine`: tipos, validación, comandos, pagos, cola de efectos, elecciones, RNG e invariantes.
- `src/content`: cartas, reglas con ID/estado/procedencia y presets.
- `src/bots`: observación filtrada y siete perfiles. Evaluaciones heurísticas, sin porcentajes ficticios ni acceso al orden del mazo.
- `src/ui`: mesa, configuración, editor, visor, reglas y laboratorio.
- `src/persistence`: guardados, importación/exportación, ramas y replay determinista.
- `src/simulation`: worker, lotes de Node, CSV y serie pública.

Para añadir una operación nueva, consulta [docs/extender-motor.md](docs/extender-motor.md). Para dar formato: `npm run format`.

No se desplegó ni conectó la aplicación a servicios externos.
