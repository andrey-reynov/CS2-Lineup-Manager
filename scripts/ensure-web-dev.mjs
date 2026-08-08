import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const ngCli = path.join(root, 'node_modules', '@angular', 'cli', 'bin', 'ng.js');
const host = '127.0.0.1';
const port = 4200;

function isPortOpen(hostname, portNumber) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: hostname, port: portNumber });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

if (await isPortOpen(host, port)) {
  console.log(`Angular dev server is already running on http://${host}:${port}`);
  process.exit(0);
}

const child = spawn(process.execPath, [ngCli, 'serve', '--host', host], {
  cwd: root,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
