# VAELDRYN — Notas de balanceo y verificación

Herramientas sin dependencias (solo Node.js). Nada de esto corre en el navegador.

## Herramientas

| Comando | Qué hace |
|---|---|
| `node tools/smoke.js` | 31 verificaciones unitarias/de integración sobre el JS real (VM sandbox headless) |
| `node tools/sim_balance.js [reps] [--conquest] [--endless] [--only-conquest]` | Simula cientos de partidas completas en paralelo (worker_threads) con 2 bots (cheap/heavy) |
| `node tools/balance_gate.js` | Puerta de CI: conjunto reducido + umbrales; exit 1 si se incumple alguno |
| `npm run smoke` / `run gate` / `run balance` | Atajos (en PowerShell usar `npm.cmd`) |

Los bots juegan "mal a propósito" (estrategias fijas, habilidades simples): sirven
como suelo comparativo entre versiones, no como techo de habilidad humana.

## Estado medido (última sesión)

### Clásico (230 partidas estándar)
- Fácil **79%** · Normal **34%** global / **64%** solo-estrategia-cheap
- Difícil **9%** · Pesadilla **0%** (sobreviven a la oleada 3+, mueren en la 4ª-6ª)
- Infinito: ya no hay muro artificial en la oleada 10 (muertes dispersas 10-15 antes del acelerador)

### Conquista (112 partidas, arranque en oleada 10, victoria en la 30)
- Fácil **89%** · Normal **50%** (mediana: llega a la 30) · Difícil **7%** · Pesadilla **0%**
- La distribución es bimodal por diseño: el Rey Orco abre el modo; quien lo supera suele encadenar hasta el final.
- Difícil/Pesadilla en conquista son "solo expertos", coherente con su filosofía en clásico (9%/0%).

## Bugs encontrados y corregidos durante el balanceo

1. **hpScale ignoraba `hpMult` de dificultad** (`startWave`, game.js): Difícil/Pesadilla perdían su multiplicador tras arrancar la oleada 1. Ahora: `(1+(wave-1)*0.05) * map.mult * hpMult * rampa`.
2. **Élites planas en todas las dificultades**: la fórmula ignoraba la tabla DIFFICULTY y había doble tirada. Ahora solo tiran dificultades con `eliteChance > 0` (una sola vez).
3. **Soflock de conquista** (relic_choice para siempre si se salía del modal): curación defensiva en `update()` + restauración explícita en los handlers de `main.js`.
4. **Victoria tras muerte en el mismo tick**: `update()` ejecutaba `waveCleared()` aunque `over` fuera true. Guardia añadida.
5. **Bucle infinito en `applyStarting`** (conquista colgaba el navegador al iniciar): iteraba `this.relics` mientras `grantRelic` hacía push. Nunca se había ejecutado antes.
6. **Reliquia inicial aplicada dos veces**: `start()` ya registraba la reliquia; separé `_applyEffects` (aplicar) de `grantRelic` (registrar+aplicar).
7. **Elección inicial falsa**: Berserker no afectaba a cero torres → sustituido por Glacial en `SELECTED`. Lucky ahora tiene crítico real (x1.5 cableado en `Enemy.takeDamage`).
8. **Conquista injugable**: abría en la oleada jefe sin economía. Presupuesto inicial +500 oro (medido: Normal pasó de 39%→50% y su mediana de muerte dejó de ser la propia oleada 10).

## Desviaciones conocidas respecto a main.py (documentadas, intencionales)

- Escalado de vida **lineal** (+5%/oleada) frente al superlineal de Python (`(w-1)^1.3*0.04`): Python sería más duro; se mantiene el lineal como decisión de diseño web.
- Temporizador de conquista decorativo (no hay condición de derrota asociada).
- Mapas mult: marsh 1.8 / canyon 1.9 (rebajados desde 1.9/2.0 tras medir).

## Umbrales de la puerta de CI (`tools/balance_gate.js`, 54 partidas ≈ 35 s)

Fácil ≥50% · Normal-cheap ≥40% · Normal ≥20% · Difícil ≤40% · Pesadilla ≤15%
· Conquista-Normal ∈ [25%,75%] · ninguna partida >45 s · el infinito siempre termina.
