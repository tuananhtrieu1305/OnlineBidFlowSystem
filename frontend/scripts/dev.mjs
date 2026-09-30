import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import electron from 'electron';
import './build-electron.mjs';

const server = await createServer();
await server.listen();
server.printUrls();
const env = { ...process.env, ELECTRON_DEV_URL: 'http://localhost:5173' };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ['.'], { stdio: 'inherit', env });
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  child.kill();
  await server.close();
  process.exit(code);
}
child.once('exit', (code) => void stop(code ?? 0));
child.once('error', (error) => { console.error(error); void stop(1); });
process.once('SIGINT', () => void stop());
process.once('SIGTERM', () => void stop());
