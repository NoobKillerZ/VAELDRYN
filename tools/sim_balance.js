'use strict';
/* ============================================================
   SIMULADOR DE BALANCEO DE VAELDRYN (paralelo, headless)
   Lanza N workers que juegan partidas completas con bots y
   agrega % victorias por mapa/dificultad/estrategia.
   Uso: node tools/sim_balance.js [reps] [--endless]
   ============================================================ */
const os = require('os');
const path = require('path');
const { Worker } = require('worker_threads');

const REPS = Math.max(1, parseInt(process.argv[2], 10) || 4);
const WITH_ENDLESS = process.argv.includes('--endless');
const WITH_CONQUEST = process.argv.includes('--conquest');
const ONLY_CONQUEST = process.argv.includes('--only-conquest');
const WORKER_FILE = path.join(__dirname, 'sim_worker.js');

const MAP_IDS = ['plains', 'desert', 'forest', 'frozen', 'void', 'marsh', 'canyon'];
const DIFFS = [0, 1, 2, 3];
const STRATS = ['cheap', 'heavy'];
const DIFF_NAMES = ['Normal', 'Fácil', 'Difícil', 'Pesadilla'];

const jobs = [];
let id = 0;
if (!ONLY_CONQUEST) {
  for (const mid of MAP_IDS)
    for (const d of DIFFS)
      for (const st of STRATS)
        for (let n = 0; n < REPS; n++)
          jobs.push({ id: id++, mapId: mid, diff: d, strat: st, opts: {} });
}
if (WITH_CONQUEST || ONLY_CONQUEST) {
  for (const mid of MAP_IDS)
    for (const d of DIFFS)
      for (const st of STRATS)
        for (let n = 0; n < REPS; n++)
          jobs.push({ id: id++, mapId: mid, diff: d, strat: st,
            opts: { conquest: true, startRelic: n % 2 ? 'glacier' : 'merchant' } });
}
if (WITH_ENDLESS) {
  for (let n = 0; n < 6; n++)
    jobs.push({ id: id++, mapId: 'plains', diff: 0, strat: 'heavy', opts: { endless: true, maxWave: 70 } });
}

console.log('=== SIMULADOR DE BALANCEO VAELDRYN ===');
console.log((ONLY_CONQUEST ? '[solo conquista] ' : '') +
  `${MAP_IDS.length} mapas x ${DIFFS.length} dificultades x ${STRATS.length} estrategias x ${REPS} partidas` +
  (WITH_CONQUEST ? ' + conquista' : '') + (WITH_ENDLESS ? ' + cola infinita' : '') +
  ` = ${jobs.length} partidas`);
console.log(`Workers: ${Math.max(1, os.cpus().length - 1)}\n`);

const results = [];
let nextJob = 0, done = 0, failed = 0;
let lastDotAt = 0;
const t0 = Date.now();

function onDone() {
  done++;
  if (done - lastDotAt >= Math.floor(jobs.length / 30)) {
    process.stdout.write('.');
    lastDotAt = done;
  }
  if (done >= jobs.length) report();
}

function dispatch(worker) {
  if (nextJob >= jobs.length) {
    if (!worker.__retired) { worker.__retired = true; worker.terminate(); }
    return;
  }
  const job = jobs[nextJob++];
  worker.once('message', msg => {
    if (msg.ready) return dispatch(worker);
    if (msg.ok) results.push(msg.rec);
    else { failed++; console.error('\nFALLO job', msg.id, msg.err); }
    onDone();
    dispatch(worker);
  });
  worker.postMessage(job);
}

const numWorkers = Math.min(Math.max(1, os.cpus().length - 1), jobs.length);
for (let w = 0; w < numWorkers; w++) {
  const worker = new Worker(WORKER_FILE);
  worker.on('error', e => { failed++; console.error('\nWORKER ERROR:', e.message); onDone(); dispatch(worker); });
  worker.once('message', msg => { if (msg.ready) dispatch(worker); });
}

/* ---------- informe ---------- */
const pct = x => (100 * x).toFixed(0) + '%';
const mean = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

let reported = false;
function report() {
  if (reported) return;
  reported = true;
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n\nPartidas: ${results.length} ok, ${failed} fallos · ${secs}s de muro`);

  const std = results.filter(r => !r.endless && !r.conquest);
  if (!std.length) return printConquest(results) || printEndless(results);

  console.log('\n--- POR DIFICULTAD (todos los mapas) ---');
  console.log('Dificultad  Partidas  Victorias  OlaMedia  OlaMediana  KillsMed  TorresMed  msMedia');
  for (const d of DIFFS) {
    const rows = std.filter(r => r.diff === d);
    console.log(
      DIFF_NAMES[d].padEnd(11) +
      String(rows.length).padStart(7) +
      pct(rows.filter(r => r.won).length / rows.length).padStart(9) +
      mean(rows.map(r => r.wave)).toFixed(1).padStart(10) +
      median(rows.map(r => r.wave)).toFixed(1).padStart(12) +
      String(Math.round(median(rows.map(r => r.kills)))).padStart(9) +
      mean(rows.map(r => r.towers)).toFixed(1).padStart(9) +
      String(Math.round(mean(rows.map(r => r.ms)))).padStart(8));
  }

  console.log('\n--- MATRIZ % VICTORIAS (mapa x dificultad) ---');
  console.log('Mapa'.padEnd(18) + DIFF_NAMES.map(n => n.padStart(10)).join(''));
  for (const mid of MAP_IDS) {
    let line = mid.padEnd(18);
    for (const d of DIFFS) {
      const rows = std.filter(r => r.mapId === mid && r.diff === d);
      line += pct(rows.filter(r => r.won).length / rows.length).padStart(10);
    }
    console.log(line);
  }

  console.log('\n--- POR ESTRATEGIA (Normal) ---');
  for (const st of STRATS) {
    const rows = std.filter(r => r.strat === st && r.diff === 0);
    console.log(st.padEnd(8) + ' victorias ' + pct(rows.filter(r => r.won).length / rows.length)
      + ' · ola media ' + mean(rows.map(r => r.wave)).toFixed(1)
      + ' · torres medias ' + mean(rows.map(r => r.towers)).toFixed(1));
  }

  printConquest(results);
  printEndless(results);

  console.log('\n--- VEREDICTO ---');
  for (const d of DIFFS) {
    const rows = std.filter(r => r.diff === d);
    const w = rows.filter(r => r.won).length / rows.length;
    let verdict = 'OK';
    if (d === 1 && w < 0.7) verdict = 'MUY DURO para ser Fácil';
    if (d === 0 && (w < 0.4 || w > 0.85)) verdict = w < 0.4 ? 'DEMASIADO DURO' : 'TRIVIAL';
    if (d === 2 && w > 0.55) verdict = 'POCO desafiante';
    if (d === 3 && w > 0.25) verdict = 'POCO desafiante';
    console.log(DIFF_NAMES[d].padEnd(11) + pct(w).padStart(5) + '  →  ' + verdict);
  }

  const slow = std.slice().sort((a, b) => b.ms - a.ms)[0];
  if (slow) console.log(`\nPartida más lenta: ${slow.ms}ms (${slow.mapId}/${DIFF_NAMES[slow.diff]}/${slow.strat})`);
}

function printEndless(all) {
  const rows = all.filter(r => r.endless);
  if (!rows.length) return;
  console.log('\n--- MODO INFINITO (plains/Normal/heavy, sin límite de victoria) ---');
  console.log('oleadas alcanzadas: ' + rows.map(r => r.wave).sort((a, b) => a - b).join(', ')
    + ' | mueren todas: ' + rows.every(r => r.over && !r.won));
}

function printConquest(all) {
  const rows = all.filter(r => r.conquest);
  if (!rows.length) return;
  console.log('\n--- CONQUISTA (arranque oleada 10, victoria en la 30) ---');
  console.log('Dificultad  Partidas  Llegan a 30  OlaMediana  ReliquiasMed  msMedia');
  for (const d of DIFFS) {
    const rowsD = rows.filter(r => r.diff === d);
    if (!rowsD.length) continue;
    console.log(
      DIFF_NAMES[d].padEnd(11) +
      String(rowsD.length).padStart(7) +
      pct(rowsD.filter(r => r.won).length / rowsD.length).padStart(12) +
      median(rowsD.map(r => r.wave)).toFixed(1).padStart(12) +
      mean(rowsD.map(r => r.relics)).toFixed(1).padStart(14) +
      String(Math.round(mean(rowsD.map(r => r.ms)))).padStart(9));
  }
  const byMap = MAP_IDS.map(mid => {
    const rowsM = rows.filter(r => r.mapId === mid);
    return mid.padEnd(18) + pct(rowsM.filter(r => r.won).length / rowsM.length).padStart(8)
      + '  ola mediana ' + median(rowsM.map(r => r.wave)).toFixed(1);
  });
  console.log('\nPor mapa (todas las dificultades):');
  console.log(byMap.join('\n'));
}
