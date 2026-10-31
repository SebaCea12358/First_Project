# Decisiones de implementación y límites

La autoridad es `especificacion.md`. El catálogo identifica reglas como `confirmed`, `provisional` o `experimental`, con identificador estable y sección de procedencia. Ninguna simulación modifica costes ni reglas.

## Reglas conservadas

- Bebé sin tipo → joven especializada → adulta. Una subida global entre todas las llamas por turno, reiniciada también en un turno extra completo.
- Una bebé requiere permiso de crecimiento; una joven/adulta compatible puede alimentarse repetidamente. Se ofrece acumular sin crecer en una joven.
- Los recursos pertenecen a llamas, el coste puede pagarse desde cualquier combinación propia, y gastarlos nunca cambia edad.
- Victoria por adultas simultáneas tras cada efecto atómico. Santa excluida. Transferencias e intercambios se completan antes de comprobar victoria.
- Explosión afecta manos globalmente y solo activa una explosiva del dueño. No abre Alarma.
- Saqueo activa malvada solo al robar con éxito una bebé o un recurso. La bebé robada puede ser la receptora. Robar cartas no activa malvada.
- Las defensas son elecciones pendientes del jugador atacado. Se pagan costes antes de defender y no se devuelven al cancelar. Revalidación: se omite la parte imposible sin fabricar recursos.

## Convenciones y experimentos

- Incorporación gratuita opcional antes del robo; reserva infinita, sin límite de grupo/mano, investigaciones persistentes, eventos desde mano por defecto. Todos estos parámetros tienen controles de taller.
- Granja y Valla son únicas por jugador. Valla exige dos copias físicas iguales para robar una llama, no un recurso. Una Alarma cancela el intento completo.
- Meditación no programa otro extra desde un extra ni más de uno por turno normal. La variante permite robar dos en su lugar.
- Anuncio: una poderosa se aparta; espera tantos **turnos normales** como participantes desde el anuncio. Los extras no avanzan el reloj. Se revalidan requisitos y objetivos al activarla. La pérdida de requisitos habilita un comando explícito de descarte; un plan sin madurar permanece pendiente si termina la partida.
- Mercado: una copia de cada poderosa habilitada fuera del mazo. La contabilidad de cartas incluye mercado, planes, apartadas y fuera del circuito.
- Santa/Bendición, Banquete, Revelación, Gran Estafa y Tesis usan sus permisos y requisitos propios. Cada crecimiento registra qué permiso lo autorizó. Las alimentaciones gratuitas de Banquete no crean otras gratuitas.
- Tesis es el prototipo pedido, deshabilitado en referencias. Recuperación tras explosión exige estudio por cada carta. Se permite recuperar la propia Explosión; ninguna poderosa es recuperable.
- Hongo compartido repite un resultado en otra llama, y después cierra la ventana de conexión. Sobras mueve un recurso a otra joven sin alimentar. Eso estaba en mi tesis solo se ofrece desde la nueva mano tras explosión.
- Las conexiones se juegan inmediatamente después del efecto correspondiente; otra acción o fin de turno cierra esa oportunidad. Resultados de loca que roban cartas requieren elegir rival si hay varios. Revelación exige al menos tres resultados con peso positivo; su sorteo es ponderado sin reemplazo.
- El evento automático Explosión solicita objetivo propio cuando existe uno compatible. Sin objetivo compatible reemplaza manos, sin crecimiento. Un evento automático de alguien que no es el jugador activo no toma prestado el permiso de crecimiento ajeno. Los efectos automáticos no reciben alimentación implícita por robar cartas.

## Arquitectura y protección de información

`dispatch` clona el estado y valida el comando antes de ejecutar. La cola se resuelve hasta una elección o hasta 200 efectos atómicos. Una resolución mayor queda en pausa técnica y se continúa por bloques, sin eliminar efectos ni convertir el presupuesto en regla del juego. Los lotes se ejecutan en Worker.

RNG del juego y RNG de desempates de bots son independientes. Renderizar, pausar y cambiar velocidad no consumen azar del juego. La semilla nueva se genera fuera de una partida con `crypto.getRandomValues`.

`legalActions` enumera cartas y objetivos válidos; `validatePayment` es la consulta completa de distribuciones de pago. La UI permite cualquier distribución válida, no solo el pago sugerido. La política del bot reduce candidatos equivalentes, usa valor marginal decreciente y elige fuentes de recursos. Sus preferencias no eliminan acciones de la persona.

El bot recibe `observe`, con su mano y el estado público, mazo enmascarado, manos rivales enmascaradas, sin seed/RNG del juego ni comandos históricos. Solo ve cartas ajenas si una elección legal se las revela. La interfaz pública oculta alternativas privadas del bot; su exportación completa puede contenerlas.

## Límites concretos

- El constructor cubre las operaciones implementadas y las rutas descritas. No es un lenguaje universal. Las alternativas de elección/azar tienen un formulario sencillo de robo de cartas; composiciones más complejas soportadas pueden importarse como JSON validado. Un efecto completamente nuevo requiere TypeScript y pruebas.
- El texto de ambientación y la descripción editorial se editan independientemente de la lógica. Para evitar confusión, la mesa y el editor muestran además el efecto ejecutable generado. Los identificadores, no los nombres, conectan lógica y cartas físicas.
- Alarma protege el grupo completo; la variante de vecindad no está implementada, como permite la especificación inicial.
- Las ramas solo migran la meta de victoria. Otros cambios rechazan la migración y requieren partida nueva. No se intenta adivinar el destino de cartas al cambiar catálogo.
- Persistencia en `localStorage`: adecuada para este laboratorio, pero limitada por la cuota del navegador. No hay sincronización entre dispositivos. Exporta las partidas grandes. Deshacer es un historial de la sesión abierta; tras recargar se continúa desde el guardado y se usa replay para revisar decisiones previas.
- Los bots son una primera política heurística, sin búsqueda profunda. No se afirma equilibrio ni superioridad de ninguna ruta. El lote de aceptación no mide diversión.
- Los formularios tienen límites técnicos de tamaño (1500 cartas físicas, cantidades hasta 100 y profundidad de efectos hasta 5). No hay límite de acciones por turno. No se usa micrófono, cuentas ni servicios de IA.
- La primera ruta E2E completa usa meta de una adulta para acortar el recorrido de interfaz; las simulaciones de aceptación usan la meta original de cinco. Los otros recorridos preparan estados válidos para ejercitar decisiones raras sin depender de encontrar esas cartas al azar.
