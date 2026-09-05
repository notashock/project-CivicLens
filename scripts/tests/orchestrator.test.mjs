import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import http from 'node:http';
import { resolvePython, resolveNpm, isWindows } from '../orchestrator/runtime.mjs';
import { isPortAvailable, ensurePortFree } from '../orchestrator/ports.mjs';
import { waitForHealth } from '../orchestrator/readiness.mjs';
import { ProcessSupervisor, createLinePrefixer } from '../orchestrator/supervisor.mjs';
import { DevOrchestrator } from '../orchestrator/orchestrator.mjs';

test('Runtime Resolver: returns valid Python and NPM binaries', () => {
  const pythonCmd = resolvePython();
  assert.ok(typeof pythonCmd === 'string' && pythonCmd.length > 0, 'Python command should be a non-empty string');

  const npmCmd = resolveNpm();
  assert.equal(npmCmd, isWindows ? 'npm.cmd' : 'npm', 'NPM command should match platform specification');
});

test('Ports Module: detects port availability and occupancy accurately', async () => {
  // 1. Find an ephemeral available port
  const tempServer = net.createServer();
  await new Promise((resolve) => tempServer.listen(0, '127.0.0.1', resolve));
  const assignedPort = tempServer.address().port;

  // 2. Port should be occupied while tempServer is listening
  const availableWhileListening = await isPortAvailable(assignedPort, '127.0.0.1');
  assert.equal(availableWhileListening, false, 'Port should be unavailable while server is listening');

  // 3. Close the server
  await new Promise((resolve) => tempServer.close(resolve));

  // 4. Port should be available after close
  const availableAfterClose = await isPortAvailable(assignedPort, '127.0.0.1');
  assert.equal(availableAfterClose, true, 'Port should be available after server is closed');
});

test('Ports Module: ensurePortFree returns true on available port', async () => {
  const tempServer = net.createServer();
  await new Promise((resolve) => tempServer.listen(0, '127.0.0.1', resolve));
  const assignedPort = tempServer.address().port;
  await new Promise((resolve) => tempServer.close(resolve));

  const result = await ensurePortFree(assignedPort, 'TestService', { quiet: true });
  assert.equal(result, true, 'ensurePortFree should confirm port is free');
});

test('Readiness Prober: resolves true when endpoint becomes healthy', async () => {
  let callCount = 0;
  const mockServer = http.createServer((req, res) => {
    callCount++;
    if (callCount >= 2) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy' }));
    } else {
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      res.end('Unavailable');
    }
  });

  await new Promise((resolve) => mockServer.listen(0, '127.0.0.1', resolve));
  const port = mockServer.address().port;
  const targetUrl = `http://127.0.0.1:${port}/health`;

  const healthy = await waitForHealth(targetUrl, {
    timeoutMs: 3000,
    intervalMs: 50,
    requestTimeoutMs: 500,
  });

  assert.equal(healthy, true, 'waitForHealth should resolve true after service returns 200');
  assert.ok(callCount >= 2, 'Should have polled multiple times until 200 OK was received');

  await new Promise((resolve) => mockServer.close(resolve));
});

test('Readiness Prober: resolves false when endpoint times out', async () => {
  const nonExistentUrl = 'http://127.0.0.1:59999/health';

  const healthy = await waitForHealth(nonExistentUrl, {
    timeoutMs: 300,
    intervalMs: 50,
    requestTimeoutMs: 100,
  });

  assert.equal(healthy, false, 'waitForHealth should resolve false when endpoint is unreachable');
});

test('Process Supervisor: prefixes output streams cleanly', () => {
  const chunks = [];
  const fakeStream = {
    write: (data) => chunks.push(data),
  };

  const prefixer = createLinePrefixer('[TEST]', fakeStream);
  prefixer('line 1\nline 2\n');

  assert.deepEqual(chunks, ['[TEST] line 1\n', '[TEST] line 2\n']);
});

test('Process Supervisor: tracks active processes and handles exits', async () => {
  let exitNotified = false;
  const supervisor = new ProcessSupervisor({
    onProcessExit: (id, code) => {
      if (id === 'short-task') exitNotified = true;
    },
  });

  supervisor.spawnProcess(
    'short-task',
    process.execPath,
    ['-e', 'process.exit(0);'],
    { prefix: '[TASK]' }
  );

  assert.equal(supervisor.getActiveProcesses().length, 1);

  // Wait for short process to exit
  await new Promise((resolve) => setTimeout(resolve, 800));

  assert.equal(supervisor.getActiveProcesses().length, 0);
  assert.equal(exitNotified, true, 'onProcessExit callback should be invoked upon child exit');
});

test('DevOrchestrator: initializes with configuration defaults and overrides', () => {
  const orchestrator = new DevOrchestrator({
    apiPort: 8888,
    webPort: 3333,
    apiOnly: true,
    clearPorts: false,
    registerSignals: false,
  });

  const status = orchestrator.getStatus();
  assert.equal(status.options.apiPort, 8888);
  assert.equal(status.options.webPort, 3333);
  assert.equal(status.options.apiOnly, true);
  assert.equal(status.options.clearPorts, false);
  assert.equal(status.options.registerSignals, false);
  assert.equal(status.isRunning, false);
});
