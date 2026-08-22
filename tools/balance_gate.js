'use strict';
/* Puerta de balanceo para CI/verificación manual.
   Ejecuta un conjunto reducido de partidas simuladas y falla (exit 1)
   si algún umbral de dificultad se incumple.
   Uso: node tools/balance_gate.js */
const { Worker } = require('worker_threads');
const path = require('path');

const REPS = 2;
const WORKER_FILE = path.join(__dirname, 'sim_worker.js');
const N_WORKERS = Math.max(1, Math.min(7, require('os').cpus().length - 1));

const jobs = [];
let id = 0;
for (const mid of ['plains', 'frozen', 'canyon'])
  for (const d of [0, 1, 2, 3])
    for (const st of ['cheap', 'heavy'])
      for (let n = 0; n < REPS; n++)
        jobs.push({ id: id++, mapId: mid, diff: d, strat: st, opts: {} });
for (const mid of ['plains', 'canyon'])
  for (const st of ['cheap', 'heavy'])
    jobs.push({ id: id++, mapId: mid, diff: 0, strat: st,
      opts: { conquest: true, startRelic: st === 'cheap' ? 'merchant' : 'glacier' } });
for (let n = 0; n < 2; n++)
  jobs.push({ id: id++, mapId: 'plains', diff: 0, strat: 'heavy', opts: { endless: true, maxWave: 60 } });

console.log(`PUERTA DE BALANCEO: ${jobs.length} partidas · ${N_WORKERS} workers`);
const t0 = Date.now();
const results = [];
let next = 0, done = 0, failed = 0;

function dispatch(worker) {
  if (next >= jobs.length) {
    if (!worker.__retired) { worker.__retired = true; worker.terminate(); }
    return;
  }
  const job = jobs[next++];
  worker.once('message', msg => {
    if (msg.ready) return dispatch(worker);
    if (msg.ok) { results.push(msg.rec); process.stdout.write('.'); }
    else { failed++; console.log(`\nFALLO job ${msg.id}: ${msg.err}`); }
    done++;
    dispatch(worker);
  });
  worker.postMessage(job);
}
for (let i = 0; i < Math.min(N_WORKERS, jobs.length); i++) {
  const w = new Worker(WORKER_FILE);
  w.on('error', e => {
    failed++; done++;
    console.log('\nWORKER ERROR:', e.message);
    dispatch(w);
  });
  w.once('message', msg => { if (msg.ready) dispatch(w); });
}

function waitDone() {
  const iv = setInterval(() => {
    if (done >= jobs.length) {
      clearInterval(iv);
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`\n\nPartidas: ${results.length} ok, ${failed} fallos · ${secs}s de muro`);
      process.exitCode = evaluate(results, failed);
    }
  }, 250);
}

function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }

function evaluate(all, failedJobs) {
  let code = 0;
  const std = all.filter(r => !r.endless && !r.conquest);
  const cq = all.filter(r => r.conquest);
  const end = all.filter(r => r.endless);

  function check(name, value, test, detail) {
    const pass = test(value);
    if (!pass) code = 1;
    console.log(`${pass ? '✓' : '✗ FALLO'}  ${name}: ${value}${detail ? '  (' + detail + ')' : ''}`);
  }

  console.log('\n--- UMBRALES ---');

  const wr = (rows, f) => pct(rows.filter(f || (r => r.won)).length, rows.length);
  const winrateOf = (diff, strat) => wr(std.filter(r => r.diff === diff && (!strat || r.strat === strat)));

  check('Fácil gana ≥50%', winrateOf(1) + '%', v => parseInt(v) >= 50);
  check('Normal (solo cheap) gana ≥40%', winrateOf(0, 'cheap') + '%', v => parseInt(v) >= 40);
  check('Normal global gana ≥20%', winrateOf(0) + '%', v => parseInt(v) >= 20);
  check('Difícil gana ≤40%', winrateOf(2) + '%', v => parseInt(v) <= 40);
  check('Pesadilla gana ≤15%', winrateOf(3) + '%', v => parseInt(v) <= 15);

  const cqN = cq.filter(r => r.diff === 0 && !r.endless);
  const cqw = pct(cqN.filter(r => r.won).length, cqN.length);
  check('Conquista Normal entre 25% y 75%', cqw + '%', v => parseInt(v) >= 25 && parseInt(v) <= 75);

  const stalled = all.filter(r => r.ms > 45000);
  check('Ninguna partida estancada (>45s)', stalled.length, v => v === 0);

  const immortalEnd = end.filter(r => !(r.over && !r.won));
  check('Cola infinita: todas terminan', immortalEnd.length, v => v === 0,
    end.map(r => 'ola ' + r.wave).join(', '));

  if (failedJobs > 0) code = 1;
  console.log(code === 0 ? '\nPUERTA SUPERADA ✓' : '\nPUERTA FALLIDA ✗');
  return code;
}

waitDone();
