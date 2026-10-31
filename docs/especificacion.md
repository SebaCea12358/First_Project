# Prompt maestro para Codex: laboratorio jugable de Llamas en llamas

> Instrucción de uso: entrega este archivo completo a Codex en la carpeta del proyecto. Es una especificación autosuficiente. No requiere conocer conversaciones anteriores. El usuario desea que se programe la aplicación descrita, no solo un plan o un diseño visual.

---

## 1. Encargo y resultado esperado

Construye una aplicación local jugable para desarrollar y probar un juego de cartas llamado **Llamas en llamas**. Debo poder jugar una partida real contra uno o varios bots, observar partidas entre bots, cambiar parámetros discutibles y cartas desde la interfaz, y volver a jugar para comparar cómo se siente cada variante.

La prioridad es la experiencia de probar el juego: decisiones propias, turnos comprensibles, cartas legibles, efectos que se resuelven correctamente y variantes fáciles de preparar. El motor debe servir también para simulación automática, pero una pantalla de estadísticas no sustituye a la mesa jugable.

**“IA” significa un bot programado, no un modelo de lenguaje.** No uses APIs de LLM, servicios de pago, claves externas ni agentes conversacionales para jugar. Los bots son algoritmos locales con estrategias y acceso limitado a la información que les corresponde.

Entrega software funcional, con código, pruebas y documentación. No termines con un mockup, botones sin lógica o una lista de tareas. Puedes organizar internamente el trabajo por etapas, pero completa el recorrido jugable y editable antes de considerar el encargo terminado.

## 2. Principios de diseño del juego

Buscamos ternura absurda, personalidades de llamas, sabotajes, recuperaciones y combinaciones que puedan generar momentos memorables. El humor surge también de lo que hacen las cartas: una llama glotona, una malvada que roba, una estudiosa que investiga, una explosiva irritable o una santa que comió un hongo y vio la verdad del universo.

No asumas que:

- Todas las cartas deben tener el mismo poder o la misma dificultad de acceso. Coste, condiciones y recompensa pueden ser muy diferentes.
- La partida más corta es la mejor.
- Una cadena larga de acciones es un defecto. Nos interesan especialmente las cadenas y los efectos que se alimentan entre sí.
- Una carta muy poderosa es necesariamente un error: puede funcionar como una ruta alternativa hacia la victoria si es difícil prepararla.
- La diversión se puede deducir de una tasa de victoria o de una cantidad de cambios de líder.

No agregues un sistema de ofrendas. La ruta santa propuesta paga su coste mediante cartas, desarrollo y oportunidades sacrificadas.

## 3. Autoridad de las reglas: separar tres niveles

Mantén explícitamente tres niveles en el modelo y en la documentación:

1. **Reglas base confirmadas:** invariantes del juego. No deben cambiarse silenciosamente ni convertirse en botones genéricos para otro juego.
2. **Decisiones provisionales:** valores necesarios para jugar, todavía configurables y discutibles. Deben estar identificados como tales.
3. **Módulos experimentales:** nuevas cartas, requisitos, recompensas y excepciones que solo se aplican si el preset las habilita.

Cada regla o módulo debe tener identificador estable, descripción, estado (`confirmed`, `provisional`, `experimental`) y procedencia dentro de esta especificación. No hace falta una interfaz académica llena de etiquetas: basta con una vista de “Reglas de esta partida” clara y una sección de edición avanzada.

Los simuladores previos, si se proporcionan como archivos adicionales, son referencias de experimentos y datos, **no autoridad por encima de este documento**. Sus limitaciones de bots no son reglas del juego. No copies su lógica ciegamente.

## 4. Reglas base confirmadas

### 4.1. Llamas, edades y desarrollo

- Las llamas pasan por **bebé → joven → adulta**.
- Las bebés no tienen especialización.
- La primera activación de crecimiento especializa a la bebé y la convierte inmediatamente en joven. No existe una etapa adicional de “bebé especializada” en el flujo base.
- En la regla base hay **UNA sola subida de edad entre todas las llamas del jugador durante su turno**. No una por llama.
- Después de usar esa subida se pueden seguir realizando acciones y alimentando llamas.
- Los recursos entregados se almacenan sobre las llamas. Gastarlos no rejuvenece a la llama ni deshace crecimientos anteriores.
- Tener un recurso acumulado no provoca crecimiento automático en un turno posterior. Hace falta una nueva alimentación o acción habilitante.
- Ejemplo obligatorio: alimentas dos veces una bebé con comida en el mismo turno. La primera alimentación la hace glotona joven; la segunda agrega comida y activa su efecto, pero no la hace adulta. En otro turno necesita otra alimentación para crecer de nuevo.
- No impongas una alimentación máxima por llama. Los bots pueden decidir no seguir alimentando; la persona debe conservar todas las opciones legales.
- Se puede incorporar como máximo una bebé desde la reserva durante un turno. El momento y el carácter opcional se resuelven mediante los valores provisionales de la sección 5.

### 4.2. Cinco tipos originales

| Tipo | Activación de crecimiento confirmada | Función general |
|---|---|---|
| Glotona | Alimentación con comida | Robar cartas al comer |
| Estudiosa | Alimentación con estudio | Acceso a investigaciones cuando es adulta |
| Loca | Alimentación con su recurso de caos | Efectos aleatorios |
| Explosiva | Explosión activada por su dueño | Debe existir espacio para que sea más difícil de desarrollar; el acceso exacto a explosiones sigue siendo variable |
| Malvada | Robo exitoso de una bebé o de un recurso | Robos y ventajas que entran en tensión con la ruta santa |

- Una explosión NO hace crecer a las explosivas de los otros jugadores.
- El robo de cartas de la mano rival no activa por sí solo el crecimiento de la malvada.
- Si una acción que podría hacer crecer ocurre cuando ya se gastó la subida, su efecto principal puede resolverse; el crecimiento queda impedido salvo excepción habilitada.

### 4.3. Victoria y excepciones

La referencia es **tener cinco llamas adultas simultáneamente**. El número objetivo aún puede editarse como parámetro provisional. No lo conviertas en victoria acumulada por haber criado adultas que ya no tienes.

Se pueden habilitar excepciones explícitas de crecimiento —por ejemplo, una explosión adicional o una Bendición— mediante módulos. Siempre debe poder verse qué permiso permitió una subida fuera del presupuesto normal.

No habilites esas excepciones en silencio en el preset base. Una variante no puede saltarse restricciones diferentes de las que declara.

## 5. Valores iniciales provisionales para que sea jugable

Implementa estos valores de partida, editables antes de iniciar una nueva sesión. No preguntes al usuario cada detalle de implementación: adopta estos valores y documenta las decisiones adicionales pequeñas.

| Parámetro | Valor inicial |
|---|---|
| Jugadores | 2–4; por defecto una persona y dos bots |
| Mano inicial | 6 cartas |
| Robo al comenzar turno | 2 cartas |
| Llamas desplegadas inicialmente | 0 |
| Reserva de bebés | Suficiente para no agotarse en el preset inicial; configurar una reserva finita como variante si se desea |
| Incorporación de bebé | Ofrecer al comienzo del turno incorporar una, sin coste; se puede omitir. El bot puede aceptar automáticamente |
| Máximo de llamas en el grupo | Sin límite por defecto |
| Máximo de tipos originales | Los cinco tipos disponibles; no confundir tipos con número de llamas |
| Límite de mano | Sin límite por defecto |
| Costes de recursos | Se pagan eligiendo recursos almacenados en cualquier llama propia; la localización sigue importando para robos y pérdidas |
| Victorias | Comprobar después de cada efecto atómico y sus reacciones preventivas, antes del siguiente efecto; no interrumpir una operación atómica a mitad de un intercambio |
| Cartas de evento | Por defecto se juegan desde la mano; la activación automática al robar es una variante, no una regla confirmada |
| Reciclaje del mazo | Barajar descarte disponible cuando se agota |
| Orden del turno | Incorporación opcional → robo inicial y efectos de inicio → acciones libres → finalizar voluntariamente → efectos de cierre |

El pago desde todo el grupo, la ausencia de límite de grupo, el momento exacto de incorporación, el uso de cartas de evento y el momento preciso de victoria son convenciones iniciales, no decisiones históricas definitivas.

Para evitar especializaciones parciales confusas: en el preset inicial solo se puede dar a una bebé una activación que la especialice si hay permiso de crecimiento disponible. Después de gastar la subida, se puede seguir alimentando jóvenes/adultas compatibles, pero no crear una “bebé glotona” sin subir de edad. Esta convención provisional debe ser visible y tener pruebas.

El jugador elige qué llama compatible recibe una activación. El motor no debe escoger siempre por él la más avanzada, como hacían algunos bots de prueba.

## 6. Catálogo inicial de cartas

Los identificadores de lógica deben ser estables, independientes del nombre o traducción. Separar definición de carta, copias físicas e instancias de llamas. No usar nombres visibles como claves de reglas.

Cada carta editable tendrá, como mínimo: ID, nombre, texto de ambientación, texto de efecto, categoría, copias, coste, requisitos, objetivos válidos, efectos, disparadores, duración, ventanas de reacción y módulos necesarios.

### 6.1. Preset «Base de trabajo» — 100 cartas

| Carta | Copias | Regla operativa provisional |
|---|---:|---|
| Comida | 18 | Alimenta una glotona o especializa una bebé disponible. Agrega comida 1. Activa su crecimiento si puede y después roba una carta. |
| Estudio | 18 | Alimenta una estudiosa o especializa una bebé. Agrega estudio 1. |
| Hierba de la loca | 18 | Alimenta una loca o especializa una bebé. Agrega caos 1 y resuelve su tabla de efectos. |
| Saqueo | 14 | Roba una bebé rival o un recurso almacenado. Si tiene éxito, añade maldad 1 a una llama propia compatible y habilita su crecimiento. No paga recursos adicionales. |
| Explosión | 10 | Descarta la carta; todos descartan la mano restante y roban la misma cantidad que descartaron. Elige una llama propia compatible, añade bomba 1 y habilita su crecimiento. No afecta al crecimiento de llamas rivales. |
| Escupir | 8 | Carta + caos 1 o bomba 1: una adulta rival vuelve a joven. Conserva recursos en la versión inicial. |
| Conversión | 4 | Carta + maldad 2: roba una joven o adulta rival; pierde sus recursos pero conserva edad. No consume una subida porque su edad no cambió. No hace crecer a la malvada. |
| Alarma de llama | 6 | Reacción opcional: descarta para cancelar un ataque dirigido a tu grupo o mano. Los costes del atacante ya pagados no se devuelven. No cancela explosiones globales. |
| Granja especializada | 2 | Estudiosa adulta + carta + estudio 2. Una carta extra al inicio de tus turnos siguientes. |
| Valla eléctrica | 2 | Estudiosa adulta + carta + estudio 2. Para robarte una llama, el atacante debe gastar dos cartas iguales del ataque. Una alarma puede bloquear todo el intento. |

La glotona roba inicialmente una carta por alimentación, tanto joven como adulta; permitir editar por separado su recompensa adulta. Granja y Valla son únicas por jugador y persisten si se pierde la estudiosa, como convención inicial configurable.

Saqueo debe resolver los casos límite explícitamente: si roba una bebé, puede especializar esa misma bebé o una compatible propia; si roba un recurso, debe existir una llama propia receptora válida. Si se bloquea el robo, no se obtiene el recurso de maldad ni crecimiento. No extraer recursos inexistentes. La elección y el pago se validan de nuevo al resolver si alguna reacción cambió el estado.

La posición protectora de Alarma anotada originalmente no está definida completamente. Empieza con protección del grupo y deja el modelo preparado para una variante por vecindad, sin fingir que ya está implementada.

### 6.2. Módulo «Más interacción» — agrega 16 cartas

| Carta | Copias | Regla inicial |
|---|---:|---|
| Llamitas meditando | 4 | Un turno extra completo después del actual. Solo uno programado por turno normal; no puede programarse desde el turno extra. Variante seleccionable: robar dos cartas en vez de turno extra. |
| Rechazo llamístico | 4 | Devuelve una bebé rival a la reserva; pierde recursos. Sin coste de recursos inicial; variante: caos 1. Alarma puede bloquearlo. |
| Robo de cartas | 6 | Carta + maldad 1: roba al azar una carta rival. Si además pagas estudio 1, mira esa mano y elige. El jugador decide qué versión usa. |
| Sonido de llama | 2 | Propone imitar a una llama, sin efecto material. Bot registra la acción social sin exigir audio, micrófono ni interacción absurda de la persona. |

Total con este módulo: 116 cartas. No agregar la antigua Bendición de ofrendas.

### 6.3. Tabla provisional de loca

Cada alimentación elige equiprobablemente uno de seis resultados:

1. Robar dos cartas.
2. Descartar una carta propia al azar.
3. Robar una carta aleatoria de un rival con mano; si hay varios, el jugador elige el rival. No hace crecer malvada.
4. Ganar estudio 1 en la llama alimentada.
5. Ganar comida 1 en la llama alimentada.
6. Nada mecánico: «Has entendido todo. Se te olvidó inmediatamente».

Regalos de recursos no son alimentación y no activan otra habilidad automáticamente. Esta tabla es experimental, editable con sus probabilidades. En el preset inicial el robo por loca no abre Alarma; la protección de este evento puede probarse como opción. Identificar claramente este comportamiento.

## 7. Módulos experimentales poderosos

No balancearlos automáticamente ni equipararlos por fuerza. Costes, requisitos, duración y efecto deben ser editables. La Tesis necesita una nueva versión: incluye la ensayada como **prototipo para rediseñar**, desactivada en los presets recomendados.

En los módulos individuales hay dos copias de cada poderosa habilitada. Cada jugador puede activar una vez cada poderosa por partida como valor inicial. Después, esa copia sale del circuito de robo. El editor puede cambiar esas restricciones en una variante experimental.

### 7.1. Santa y Bendición

- Agregar seis **Hongos de la verdad inconveniente** y dos **Bendiciones de la Santa Llama**.
- Un hongo permite que una bebé se convierta en santa joven; otro, en otro turno o con permiso explícito, la hace adulta. No genera una moneda de ofrendas.
- La santa no cuenta para la victoria y no puede coexistir con malvadas en el grupo. Esa incompatibilidad debe respetarse también en robos e intercambios.
- Santa adulta permite jugar Bendición, sin coste adicional de recursos.
- Mientras el dueño conserve una santa adulta: alimentar una llama con comida/estudio/caos roba una carta adicional y puede producir crecimiento fuera del límite global.
- Cada llama puede crecer como máximo una vez por turno bajo esta excepción.
- La alimentación sigue necesitando su carta o una fuente de alimentación explícita. Bendición NO transforma cada robo en una alimentación gratuita recursiva.
- Robar o rejuvenecer la santa suspende el efecto; no borra la Bendición adquirida.

### 7.2. Banquete del Fin del Mundo

Requisito: dos glotonas, al menos una adulta; coste: carta + comida 4. Durante el resto del turno, cada alimentación de glotona **pagada con carta** permite alimentar otra llama propia compatible. Esa segunda alimentación activa habilidades y puede crecer fuera del límite global, una vez por llama. La alimentación gratuita no genera otra gratuita de Banquete. Para iniciar otra vuelta hay que pagar otra carta. La elección de la segunda llama corresponde al jugador; puede omitir un efecto opcional.

Variantes editables: coste, requisito y duración de un turno o permanente.

### 7.3. Gran Estafa Llamística

Requisito: malvada adulta y dos saqueos exitosos previos. Jugar la carta permite intercambiar una llama propia por una rival de mayor edad. Ambas pierden sus recursos. Alarma puede bloquear. No es crecimiento. En esta versión Valla no impide el intercambio; se debe identificar como regla experimental editable.

La ventaja observada de esta carta varió entre tandas: no asumir que ya está equilibrada.

### 7.4. Revelación de dudosa procedencia

Requisito: loca adulta, tres alimentaciones de loca realizadas durante la partida y caos 2; pagar la carta y esos recursos. Durante el resto del turno, cada alimentación de loca revela tres efectos distintos de su tabla; el jugador elige dos y su orden. No concede crecimiento adicional. Variante: duración permanente.

Mostrar la elección de manera real en la interfaz; no sustituirla por la preferencia fija del bot.

### 7.5. Tesis sobre combustión espontánea — prototipo desactivado

Requisito: estudiosa adulta, explosiva al menos joven; coste carta + estudio 2 + bomba 1. Durante el resto del turno, explosiones pueden habilitar crecimiento adicional, una vez por llama. Después de una explosión puedes pagar estudio 1 para recuperar una carta no poderosa del descarte, incluida una explosión. Elegir la carta explícitamente. La recuperación consume estudio; no es gratis.

Editar requisitos, coste de acceso, coste por recuperación, cartas recuperables y duración. No imponer por tu cuenta un nuevo diseño como si estuviera aprobado.

### 7.6. Cartas de conexión, opcionales

- **Hongo compartido**: carta + comida 1, después de un efecto de loca, repite uno de los resultados resueltos en otra llama/objetivo válido. No se dispara a sí misma. La persona elige si la usa y qué efecto repite.
- **Eso estaba en mi tesis**: carta + estudio 1, después de explosión, recupera otra carta no poderosa del descarte. Definir una ventana precisa; valor inicial: desde la nueva mano tras el reemplazo. Mostrar esta restricción. Es una propuesta revisable.
- **Sobras benditas**: después de alimentar con carta, gástala para mover un recurso de esa llama a otra joven propia; no cuenta como alimentación. Prototipo de baja prioridad porque los costes ya se pagan desde todo el grupo.

Cuatro copias de cada conexión si se habilita el módulo, editable.

## 8. Presets listos para jugar

Crear presets inmutables como referencia, clonables para editar:

1. **Base de trabajo**: cinco tipos originales y mazo de 100 cartas; sin poderosas ni excepciones de crecimiento.
2. **Más interacción**: base + módulo de 16 cartas; sin poderosas.
3. **Ruta santa**: Más interacción + hongos/santa/Bendición.
4. **Rutas alternativas**: Más interacción + santa, Gran Estafa, Revelación; permite seleccionar estrategias distintas para los bots. Banquete puede activarse desde el editor. Tesis desactivada.
5. **Recompensas visibles**: variante del preset anterior donde hay una copia común visible de cada poderosa habilitada en lugar de las copias de mano. La primera persona que cumpla requisitos puede reclamarla. Son cartas físicas fuera del mazo, con contabilidad explícita.
6. **Taller libre**: clon de cualquier preset para editar parámetros, mazo, costes y efectos soportados.

No llamar “equilibrado” o “definitivo” a ningún preset.

Implementar como opciones experimentales separadas:

- Obtener poderosas de la mano o como recompensas comunes visibles.
- Anunciar una poderosa con una vuelta normal de anticipación. Revelar la carta, reservarla fuera de la mano y comprobar requisitos al intentar activarla. Un turno extra inmediato no salta la ventana rival. Requisito perdido: la carta se pierde según la convención inicial; diferenciar fallo de preparación pendiente al terminar partida.
- Explosión puede permitir una subida adicional fuera del límite global; máximo una extra en esa variante, no dos subidas de la misma llama.
- Reciclaje inmediato o **recursos consumidos por alimentación apartados hasta el siguiente turno**. En este nuevo motor esta variante afecta únicamente a cartas pagadas como alimentación, no a recursos descartados aleatoriamente: distinguir las causas en los eventos. La recuperación explícita pagando un coste puede recuperar una carta apartada si la carta lo permite. Es una precisión deliberada respecto de simuladores anteriores.

## 9. Qué debe poder hacer la persona

### Configurar y empezar

- Elegir preset, número de participantes, asiento humano e inicio aleatorio o determinado.
- Elegir perfil de cada bot y velocidad de visualización.
- Iniciar con semilla aleatoria o repetir una semilla concreta.
- Ver un resumen legible de reglas activas y cambios respecto del preset de referencia.

### Jugar de verdad

- Ver su mano, los grupos rivales, edades, tipos y recursos; manos rivales boca abajo, salvo información revelada legalmente.
- Elegir carta, modo, objetivos y fuentes de pago.
- Ver un resumen del efecto y coste antes de ejecutarlo, sin predecir resultados aleatorios que todavía no conoce.
- Recibir motivos comprensibles cuando una acción no es legal: “Ya usaste la subida de este turno”, “Falta estudio”, etc.
- Alimentar repetidamente, elegir entre crecer y acumular, atacar o conservar recursos y terminar turno voluntariamente.
- Responder a ataques con Alarma o pasar; no gastar defensas automáticamente en su nombre.
- Resolver elecciones de efectos, cartas vistas y orden de efectos cuando corresponda.
- Seguir una cadena con un historial claro de causas y consecuencias; puede acelerar animaciones, no saltarse decisiones pendientes.

### Probar variantes

- Cambiar número de copias de una carta, añadirla o quitarla, modificar costes y parámetros, habilitar módulos y guardar un preset con nombre.
- Crear una carta mediante formulario usando efectos ya soportados, duplicar otra y editarla.
- Importar/exportar presets y cartas en JSON validado.
- Jugar inmediatamente con el preset editado sin modificar archivos de código para los casos comunes.
- Guardar/cargar partida y revisar el historial.
- Pausar bots, avanzar una decisión y ver una explicación breve de la decisión basada en su evaluación, no texto inventado por un LLM.

### Mesa de pruebas

Permitir deshacer/repetir y tomar control de un bot en modo laboratorio. Deshacer puede revelar información; esas sesiones se marcan como exploratorias y no se mezclan con estadísticas competitivas.

Editar reglas durante una partida NO cambia silenciosamente el estado actual. Al editar, ofrecer “usar en una partida nueva” como opción principal. Como opción de laboratorio, permitir crear una rama desde un estado estable: guardar configuración/estado originales, validar compatibilidad y marcar la rama. Si una modificación no puede aplicarse sin ambigüedad, iniciar una nueva partida en lugar de inventar una migración.

## 10. Arquitectura: un único motor para persona y bots

Si el repositorio está vacío, usar **TypeScript, React y Vite** para una aplicación local de navegador, con motor TypeScript puro ejecutable también desde Node. Elegir versiones compatibles disponibles, sin fijar en esta especificación números de versión. Mantener dependencias moderadas. Si existe un proyecto razonable, respetar su estructura y explicar cualquier cambio de stack necesario.

No requiere backend, cuentas, multijugador remoto ni despliegue público. Guardar localmente y permitir exportar archivos. Debe poder arrancarse con comandos documentados y funcionar sin servicios externos una vez instaladas las dependencias.

Separar responsabilidades, adaptando nombres a la estructura existente:

- `engine`: estado, acciones legales, validación, pagos, efectos, disparadores, reacciones, RNG, condición de victoria y eventos.
- `content`: catálogo de cartas, módulos y presets versionados.
- `bots`: observaciones, perfiles, evaluación y selección de acciones.
- `ui`: mesa, editor, elecciones, historial e inspector.
- `simulation`: ejecución sin interfaz, lotes y exportación.
- `persistence`: partidas, configuraciones y replays.

**La UI y los bots deben enviar comandos al mismo motor.** No duplicar las reglas en componentes visuales ni permitir que el bot cambie directamente el estado.

Separar:

1. Enumeración/validación de todas las acciones legales o consultas equivalentes completas.
2. Subconjunto que un bot decide considerar.
3. Elección final del bot.

Una preferencia del bot nunca debe hacer desaparecer una opción legal de la persona. Una representación perezosa de objetivos es aceptable; omitir jugadas válidas por una heurística no lo es.

## 11. Estado, efectos y aleatoriedad

El estado debe incluir, como mínimo:

- Partida, versión de reglas y huella de configuración.
- Jugadores, controlador humano/bot, manos y grupos ordenados.
- Instancias de llamas con ID, edad, tipo, recursos y propietario.
- Mazo, descarte, recursos apartados, reserva, recompensas comunes y cartas fuera del circuito.
- Turno actual, vuelta normal, turnos extras pendientes, fases y jugador que debe decidir ahora.
- Presupuesto global de crecimiento y permisos excepcionales; llamas que ya crecieron bajo límites por identidad.
- Efectos activos, duraciones, contadores de requisitos e investigaciones.
- Elecciones y reacciones pendientes; orden de resolución.
- Estado del generador aleatorio, historial de comandos/eventos y resultado.

Usar aleatoriedad con semilla y streams separados para azar del juego y desempates/decisiones aleatorias de bots. Animaciones, velocidad, cantidad de renders y pausas no deben consumir azar del juego. No usar `Math.random()` disperso en lógica o UI de partida.

Definir una cola/pila de efectos con orden documentado y eventos de causa: quién inició, qué carta, cuál fue el efecto padre, qué recursos se gastaron y qué se obtuvo. Los efectos con elecciones o defensas deben pausar la resolución hasta recibir un comando válido. No procesarlos mediante recursión sin control ni bloquear la interfaz.

Los ataques tienen ventana de defensa antes de aplicar el daño o robo. Validar pago y objetivos; aplicar operaciones atómicas completas; resolver sus consecuencias. No comprobar victoria a mitad de una transferencia. Si durante una elección se vuelve inválido un objetivo, seguir una política definida (por defecto, revalidar y omitir solo la parte imposible sin devolver costes ya pagados), mostrarla y probarla.

## 12. Cadenas y rendimiento

No imponer un límite arbitrario de acciones como regla de juego. Debe ser legal realizar una cadena larga que tenga sustento en cartas y recursos.

Sí debe existir protección técnica:

- Resolver por bloques y devolver control al navegador, preferentemente mediante Web Worker para bots/simulaciones.
- Poder pausar, inspeccionar el estado y terminar voluntariamente cuando la fase lo permita.
- Si una simulación excede un presupuesto de tiempo/eventos, registrar `interrupted` o `censored`, sin inventar ganador ni contar la partida como derrota.
- En juego interactivo, advertir/pausar una resolución muy extensa en vez de truncarla silenciosamente o cambiar reglas.
- Detectar repeticiones sospechosas como diagnóstico; no afirmar que cualquier repetición es un ciclo infinito, especialmente con azar o recursos cambiantes.

Un bot debe poder decidir pasar cuando continuar ya no aporta valor. Alimentar indefinidamente por una puntuación positiva constante es un fallo de política, no una regla que deba copiarse al juego humano.

## 13. Bots locales con estrategias

Implementar al menos estos perfiles seleccionables:

- **Equilibrado:** crecimiento, recursos, defensa y ataques según posición.
- **Criador:** prioriza desarrollar su grupo y preparar futuras alimentaciones.
- **Agresivo:** busca robos y frenar a rivales avanzados, considerando costes y posibilidad de bloqueo.
- **Investigador:** valora estudios, investigaciones y motores habilitados.
- **Glotón:** busca alimentación, robo y Banquete si existe.
- **Caótico:** busca loca y Revelación si están habilitadas.
- **Devoto:** busca santa/Bendición, reserva cartas pertinentes y respeta incompatibilidad con malvada.

Los perfiles deben adaptarse al preset. Si la ruta no está habilitada, avisar al configurar y ofrecer un perfil válido o un fallback explícito; no permitir una política esperando eternamente cartas ausentes.

La primera implementación puede usar evaluación heurística y simulación superficial de acciones. No se exige aprendizaje automático. Un bot razonable y depurable tiene más valor que una complejidad opaca.

Requisitos obligatorios:

- Obtiene una observación filtrada: su mano, estado público e información revelada legítimamente. No recibe mano rival ni orden real del mazo.
- No usar información oculta para valorar una jugada o hacer lookahead. Puede muestrear hipótesis compatibles con lo conocido.
- Puede reservar recursos para una carta, escoger cómo pagar, elegir blancos, reaccionar o pasar.
- El valor marginal de acumular disminuye. Considerar cartas necesarias para completar desarrollo, futuras oportunidades y terminar el turno; no convertir esto en límites del reglamento.
- Registrar una explicación breve de la elección y las principales alternativas consideradas.
- Distinguir evaluaciones heurísticas de probabilidades reales de victoria. No mostrar porcentajes inventados.
- No garantizar victoria humana ni hacer trampas para que “se sienta equilibrado”.

## 14. Editor de reglas y cartas

Debe haber un editor práctico, no solamente un textarea JSON.

### Edición común sin programar

Permitir editar: copias, costes, requisitos numéricos, objetivos, cantidades de robo, cambios de edad permitidos por módulos, recursos generados, probabilidades de la tabla de loca, duración de efectos, límites de activación de cartas, parámetros de inicio, meta numérica de victoria y reglas provisionales enumeradas.

Ofrecer un constructor de efectos con operaciones reutilizables: robar/descartar, alimentar, transferir/gastar recursos, subir/bajar edad bajo un permiso, robar/intercambiar/devolver llamas, instalar efecto duradero, recuperar carta, turno extra, elección del jugador y selección aleatoria. Las opciones deben validar tipos y dependencias.

No evaluar JavaScript arbitrario proveniente de JSON importado. Para una mecánica completamente inédita, admitir extensión del motor en TypeScript documentada y con pruebas. Explicar honestamente esa frontera; no prometer que cualquier reglamento imaginable puede construirse con el formulario.

### Coherencia y versiones

- Duplicar preset antes de editar; referencias originales protegidas.
- Cada partida guarda una copia completa de su configuración y catálogo. Editar después un preset no modifica partidas ni replays existentes.
- Validación de dependencias: si hay Bendición pero no forma de obtener santa, o una carta exige un recurso que el preset no puede producir, mostrar un diagnóstico claro.
- Distinguir errores que impiden jugar de advertencias experimentales. Permitir conscientemente un mazo difícil o desequilibrado si es válido.
- No permitir valores inválidos, objetivos imposibles por tipos inexistentes, probabilidades sin normalización explícita o costes negativos.
- No autoajustar costes según las simulaciones ni modificar un mazo “para equilibrarlo” sin decisión del usuario.

## 15. Interfaz y tono

Toda la experiencia debe estar en español claro. Diseñar para escritorio y adaptar a pantallas menores sin que sea necesario empezar con soporte móvil perfecto.

Mesa central con grupos rivales, grupo propio y mano. Distinguir tipo y edad por iconos/texto además del color. Mostrar recursos sobre cada llama, cartas restantes y permiso de crecimiento. Evitar una pantalla que parezca una consola de depuración.

Flujo principal: **Nueva partida → elegir variante y bots → jugar → revisar experiencia → clonar/editar variante → volver a jugar**.

Usar estética lúdica legible, llamas sencillas, nombres humorísticos y animaciones breves regulables. No depender de ilustraciones externas ni retrasar el motor por producir arte. Usar assets propios simples o placeholders coherentes. El detalle técnico vive en el inspector, no encima de cada carta.

Soportar selección mediante clic; arrastrar es opcional y no debe ser el único modo de jugar. Mostrar claramente cuándo decide un rival o cuándo se espera una reacción humana. Los bots nunca deben saltarse una ventana de respuesta de la persona por velocidad de animación.

## 16. Registro de experiencia y simulación

Guardar eventos suficientes para reconstruir acciones, decisiones, activaciones y estado. Exportar partida y reglas a JSON; métricas tabulares a CSV.

Registrar, al menos:

- Rondas, turnos normales/extras, acciones y efectos automáticos por turno.
- Opciones legales agrupadas y opciones consideradas por el bot, como cantidades distintas.
- Desarrollo de cada tipo, recursos y manos a lo largo de la partida.
- Ataques intentados, bloqueados y exitosos; pérdidas y recuperaciones.
- Cambios de líder por adultas, señalando que no es una probabilidad de victoria.
- Acceso, coste pagado, momento y beneficios de cartas poderosas.
- Ganador, interrupciones y estado de partidas sin completar.
- Tiempo humano de decisión, tiempo de ejecución bot y animaciones, separados; no mezclar estos tiempos con duración de una simulación acelerada.
- Notas manuales vinculadas a un momento de partida: “divertido”, “confuso”, “espera larga”, “quiero cambiar este coste”, con texto libre y exportación.

Incluir un modo de espectador entre bots, pausa/paso a paso y un ejecutor de lotes sin UI. Los lotes deben usar exactamente el mismo motor y configuración que una partida humana. Un panel sencillo que compara dos presets mediante semillas y rotación de asientos es suficiente inicialmente; no convertirlo en un proyecto de analítica que impida terminar el juego jugable.

No guardar ni mostrar manos ocultas en el historial público de una partida en curso. El inspector de laboratorio puede revelarlas mediante una acción explícita; esa sesión queda marcada y la observación del bot continúa filtrada. Un archivo de replay completo puede contener secretos, pero su reproducción desde un asiento no debe revelarlos antes de tiempo.

## 17. Persistencia y reproducción

Guardar partidas y presets localmente, preferentemente IndexedDB o almacenamiento equivalente adecuado. Exportar/importar archivos para respaldar y compartir variantes sin cuentas.

Un replay necesita estado inicial, configuración versionada, semilla/estado RNG, decisiones y resultados aleatorios pertinentes, además de versión del motor. Con la misma versión debe reproducir exactamente el estado final. Ante versiones incompatibles, informar el problema y no reproducir silenciosamente con reglas distintas.

Deshacer/restaurar debe devolver también RNG, elecciones pendientes, turnos extras, presupuestos y efectos, no solo las cartas visibles.

## 18. Pruebas y criterios de aceptación

Usar pruebas de motor, integración y recorridos reales de interfaz. Herramientas sugeridas: Vitest o equivalente; Playwright o equivalente para navegador. No inventar resultados ni afirmar una verificación visual que no se ejecutó.

### Reglas e invariantes

- Dos alimentaciones a una bebé en un turno producen una sola subida; una nueva alimentación en otro turno puede producir la siguiente.
- Después de crecer una llama, otra no crece bajo la regla base, aunque reciba recursos.
- Gastar recursos no modifica edad.
- Explosión no hace crecer a llamas de los rivales.
- Saqueo exitoso habilita malvada; un saqueo bloqueado y un robo de cartas no lo hacen.
- Robar una adulta puede completar victoria sin contabilizar una subida.
- Alarma ofrece reacción real a humano y bots; las acciones no se resuelven antes de su respuesta.
- Repetición de alimentación legal para humano, aunque un bot prefiera pasar.
- Cada excepción de crecimiento se aplica solo a sus fuentes y límites declarados.
- Santa no cuenta para ganar, no coexiste con malvada y su rejuvenecimiento suspende Bendición.
- Conservación de cartas, identidades únicas, recursos no negativos y transferencias atómicas, incluyendo reservas, mercado, planes y cartas apartadas.
- Seleccionar pagos diferentes produce consecuencias diferentes cuando luego se roba una llama.
- Reciclaje diferido distingue alimentación de descarte por explosión u otras causas.
- Meditación no elude la vuelta de espera de una carta anunciada.
- Las cartas nuevas construidas con el editor se ejecutan por el motor; texto y efecto no pueden divergir silenciosamente.

### Bots e información

- Un bot no puede consultar manos ocultas ni orden del mazo mediante su API.
- Con la misma observación y RNG del bot, modificar solamente información oculta no cambia su decisión.
- Bot puede pasar cuando acumular dejó de ser útil.
- No pierde acciones humanas legales por filtros del bot.
- Presets sin su ruta reciben fallback explícito.
- Simulaciones interrumpidas no generan ganadores artificiales.

### Recorridos de usuario que deben funcionar

1. Arrancar, elegir un humano y dos bots, y completar una partida legal desde la interfaz.
2. Jugar una carta, elegir llama y fuentes de pago; responder a un ataque con Alarma y en otro caso pasar.
3. Resolver elecciones de Revelación y robo selectivo mediante interfaz real.
4. Clonar preset, cambiar copias/coste de una carta, quitar otra y volver a jugar verificando que el mazo cambió.
5. Crear una carta simple de “robar dos” en el editor, incorporarla y jugarla sin tocar código.
6. Guardar, recargar y continuar una partida; reproducir su replay con el mismo resultado.
7. Ver bots jugar, pausar y avanzar una decisión; comprobar que no saltan una reacción humana al tomar control.
8. Activar ruta santa y comprobar la excepción de crecimiento y su suspensión.
9. Ejecutar una cadena larga sin congelar el navegador ni recortarla como regla de juego.
10. Comparar dos presets y exportar resultados, conservando la identificación de reglas y las partidas interrumpidas.

Implementar una prueba de lote con varios perfiles/presets y semillas fijas, con un presupuesto razonable y publicado. Validar invariantes en cada paso. Si aparecen casos extremos, conservar semillas y reproducirlos antes de atribuirlos a balance.

## 19. Plan de ejecución y entregables

Trabaja en este orden para que el proyecto no se quede en una maqueta:

1. Inspecciona el repositorio y sus instrucciones; registra esta especificación y decisiones necesarias.
2. Construye el motor base y pruebas de reglas críticas.
3. Completa una partida vertical real: persona, bot, pagos, defensa, turnos y victoria.
4. Añade editor, presets y persistencia, usando el mismo motor.
5. Añade módulos experimentales, perfiles y observación paso a paso.
6. Completa registro, replays y ejecutor de lotes; prueba recorridos en navegador.
7. Corrige fallos, mejora legibilidad y entrega instrucciones de ejecución.

Este orden es interno: no detengas el encargo después del paso 3 dejando todo lo demás como una promesa. Evita diseñar un lenguaje universal innecesariamente complejo; cubre los efectos descritos con una estructura extensible y probada.

Entregar:

- Código ejecutable y archivos de dependencias bloqueadas.
- README con instalación, arranque, pruebas, simulación y exportación/importación.
- Reglas confirmadas, valores provisionales y módulos claramente separados.
- Presets completos y ejemplos de cartas editables.
- Documentación para añadir una nueva operación de efecto en el motor.
- Pruebas y evidencia real de los recorridos ejecutados.
- Registro de decisiones y limitaciones concretas; distinguir lo no implementado de lo no equilibrado.

Los scripts equivalentes a `dev`, `build`, `test`, `test:e2e` y `simulate` deben estar disponibles y documentados.

No desplegar públicamente, conectar servicios ni enviar datos a terceros como parte de este encargo. Todo debe poder probarse localmente.

**Comienza a implementar. Usa esta especificación como referencia de alcance y conserva las reglas base. El resultado final debe permitir sentarme a jugar, descubrir que una carta se siente demasiado cara o una cadena resulta entretenida, cambiar la variante desde la interfaz y volver a probarla.**
