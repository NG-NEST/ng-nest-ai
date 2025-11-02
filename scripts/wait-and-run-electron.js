// scripts/wait-and-run-electron.js
import { spawn } from 'child_process';
import net from 'net';

const host = '127.0.0.1';
const port = 5200;

function checkPort() {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host, () => {
      socket.end();
      resolve(true);
    });
  });
}

async function waitForPort() {
  console.log(`⏳ Waiting for ${host}:${port} to be ready...`);
  while (!(await checkPort())) {
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log('✅ Port is ready, launching Electron...');
}

await waitForPort();

const electron = spawn('npx', ['electron', './dist/electron/main.js', '--enable-logging'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, NODE_ENV: 'development' }
});

electron.on('exit', (code) => {
  console.log(`Electron exited with code ${code}`);
});
