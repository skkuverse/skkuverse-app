#!/usr/bin/env node
// Dump the app's console output (log, warn, error) through Metro's debugger socket.
// Runtime.enable replays what the session has buffered, so a fresh connect after a drive returns
// the whole run. One debugger per target: this starves an open React Native DevTools window, and
// an open DevTools window starves this.
// Usage: node .claude/skills/verify-mobile/scripts/console.mjs [seconds=3] [out-file]
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const repo = execFileSync('git', ['-C', import.meta.dirname, 'rev-parse', '--show-toplevel']).toString().trim();
const WebSocket = createRequire(`${repo}/package.json`)('ws');
const seconds = Number(process.argv[2] ?? 3);
const out = process.argv[3];

const targets = await (await fetch('http://127.0.0.1:8081/json/list')).json();
const target = targets.find((t) => String(t.description).includes('Bridgeless'));
if (!target) {
  console.error('no app connected to Metro on 127.0.0.1:8081');
  process.exit(1);
}
// Metro refuses a debugger without a local Origin.
const url = target.webSocketDebuggerUrl.replace('//localhost:', '//127.0.0.1:');
const ws = new WebSocket(url, { headers: { Origin: 'http://127.0.0.1:8081' } });
const lines = [];
const show = (a) => a.value ?? a.preview?.properties?.map((p) => `${p.name}=${p.value}`).join(' ') ?? a.description;
ws.on('open', () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' })));
ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.method !== 'Runtime.consoleAPICalled') return;
  lines.push(`${msg.params.type}: ${msg.params.args.map(show).join(' ')}`);
});
ws.on('error', (e) => {
  console.error(`debugger socket: ${e.message}`);
  process.exit(1);
});
setTimeout(() => {
  ws.close();
  const text = lines.join('\n');
  if (out) writeFileSync(out, `${text}\n`);
  console.log(out ? `${lines.length} console lines -> ${out}` : text);
}, seconds * 1000);
