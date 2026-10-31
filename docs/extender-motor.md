# Añadir una operación de efecto

1. Añade su identificador a `Operation` en `src/engine/types.ts` y define campos tipados si necesita más datos. Nunca uses código evaluable, `eval` ni nombres visibles para despachar lógica.
2. Valida los parámetros y dependencias en `validateConfig`. Los JSON importados pasan por esta función antes de crear partidas. Añade su descripción a `effectText`.
3. Añade validación de objetivos a `targetError` y la enumeración completa a `templates` cuando corresponda. Para costes comunes se reutilizan `costFor`, `defaultPayment` y `validatePayment`. No pongas filtros de preferencia del bot en el motor.
4. Implementa un caso de `perform`. Una transferencia de propiedad debe completarse atómicamente antes de volver. Para elecciones llama `prompt` con alternativas de tareas. Para efectos posteriores usa `enqueue`. No continúes resolviendo por fuera de la cola ni mediante recursión sin control.
5. Registra eventos públicos sin nombres de cartas ocultas. `resolve` liga las consecuencias a su efecto padre y comprueba victoria después del efecto completo.
6. Añade la operación al constructor de `Editor.tsx`, con campos compatibles. Si solo es una nueva carta con operaciones existentes, basta con crear/importar su definición.
7. Añade pruebas de legalidad, fallo, pagos, defensa si aplica, revalidación, conservación y replay. Prueba en navegador si introduce una decisión nueva. Inclúyela en una tanda con semilla fija.

Ejemplo de carta JSON (importa un objeto `{"format":"llamas-card","version":1,"card":...}`):

```json
{
  "id": "dosIdeas",
  "name": "Dos ideas brillantes",
  "flavor": "Una era comer el libro.",
  "text": "Roba dos cartas.",
  "category": "event",
  "copies": 2,
  "cost": {},
  "requirements": {},
  "targets": "none",
  "effects": [{ "op": "draw", "amount": 2 }],
  "triggers": [],
  "duration": "turn",
  "reactionWindows": [],
  "modules": [],
  "limit": 0
}
```

Operaciones disponibles: `draw`, `discard`, `feed`, `resource`, `spend`, `transfer`, `age`, `steal`, `swap`, `return`, `install`, `recover`, `extra`, `choice`, `random`, `explosion`, `social`, `connection`. Los modos especiales de robo (`raid`, `conversion`, `hand`), instalaciones y conexiones se seleccionan por `key`. `feed` requiere `kind` y puede generar `resource`; `choice` y `random` contienen `options: Effect[][]`. El crecimiento positivo siempre respeta un permiso del motor.
