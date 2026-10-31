# Evidencia de validación

Ejecutada en este entorno con Node 24.19.0, npm 11.9.0 y Chromium del sistema. No se realizó despliegue.

## Motor

`npm test`: 38 pruebas. Incluyen:

- Crecimiento global, nueva activación en otro turno, alimentación repetida y acumulación voluntaria.
- Pagos distribuidos, no rejuvenecimiento, explosión solo del dueño.
- Saqueos, Valla, defensas pendientes, bloqueo y paso, robo selectivo y victoria por transferencia.
- Santa, suspensión de Bendición, permisos por identidad, Banquete sin recursión, Revelación con elecciones en orden y Estafa atómica.
- Tesis con recuperación pagada, conexiones, apartadas por causa y recuperación explícita.
- Constructor de cartas, transferencia, dependencias, planes fallidos y anuncio que no avanza por turnos extra.
- Observación filtrada y decisión idéntica ante cambios exclusivamente ocultos; siete perfiles, pasar con valor marginal agotado.
- Replay exacto, ramas, conservación, IDs únicos y recursos no negativos.
- Cola de 450 efectos resuelta en tres bloques, sin truncamiento.
- Diez ejecuciones cortas con cinco presets y semillas `puna`/`volcan`, más recorridos de los siete perfiles, validando invariantes en cada comando.

## Navegador real

`npm run test:e2e`: 10 recorridos con Playwright y Chromium:

1. Configurar persona + dos bots y completar partida desde la mesa, con meta de una adulta para acortar la prueba. No usa un ganador forzado.
2. Pagar desde una llama distinta y verificar la distribución resultante.
3. Responder a Alarma cancelando y pasando en estados de ataque pendientes.
4. Elegir resultados de Revelación en orden y una carta de la mano revelada.
5. Clonar preset, cambiar coste/copias, quitar una carta, crear una carta de robar dos y jugarla.
6. Deshacer/repetir, recargar guardado, verificar replay, retroceder/avanzar y tomar control.
7. Usar Bendición para dos crecimientos distintos y verificar suspensión tras rejuvenecer la santa.
8. Espectador con pausa/paso; comparación en Worker y descarga CSV.
9. Capturas de mesa en escritorio y viewport de 390 px.
10. Treinta alimentaciones consecutivas desde la interfaz, conservando la posibilidad de terminar turno.

Los estados preparados para decisiones raras mantienen la contabilidad de cartas y pasan `assertInvariants`. Los recorridos seleccionan cartas/objetivos y confirman jugadas mediante controles reales. Capturas generadas: `test-results/mesa-desktop.png` y `test-results/mesa-mobile.png`; la captura de escritorio se inspeccionó visualmente. Los artefactos son locales e ignorados por Git.

## Simulación de aceptación

Comando: `npm run simulate -- --seeds 2 --budget 700`.

- Presets: los cinco de referencia, con su meta original de cinco adultas.
- Semillas: `lote-0`, `lote-1`.
- Perfiles: Criador, Agresivo e Investigador.
- Tres rotaciones de los perfiles en los asientos por combinación: 30 partidas.
- Presupuesto: 700 decisiones y 15 segundos por partida; invariantes después de cada comando.
- Resultado de la tanda guardada: 30 completadas; ninguna censurada ni fallo de invariantes. Los ganadores y métricas se conservan en `docs/resultados-aceptacion.csv`.

Esto demuestra ejecución e integridad para esas semillas; no demuestra equilibrio ni diversión. El estado `censored` se comprueba además con un presupuesto de una decisión: conserva ganador nulo. Las interrupciones manuales conservan un último snapshot y se separan de resultados terminados.

## Build y entorno

`npm run build` ejecuta TypeScript y genera la aplicación estática con Vite. El juego no necesita red después de instalar dependencias.

La descarga opcional del navegador de Playwright fue rechazada por la política de dominios. Se utilizó Chromium ya instalado, sin cambiar la política ni desactivar TLS. La instalación npm y las pruebas de servidor/navegador requirieron ejecución fuera del sandbox de procesos del comando; no requieren credenciales de la aplicación.
