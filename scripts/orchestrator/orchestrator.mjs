import path from 'node:path';
import fs from 'node:fs';
import process from 'node:process';
import { resolvePython, resolveNpm } from './runtime.mjs';
import { ensurePortFree } from './ports.mjs';
import { waitForHealth } from './readiness.mjs';
import { ProcessSupervisor } from './supervisor.mjs';

/**
 * @typedef {Object} OrchestratorOptions
 * @property {number} [apiPort=8000] FastAPI listening port
 * @property {number} [webPort=3000] Next.js listening port
 * @property {string} [host='127.0.0.1'] Host address for API
 * @property {boolean} [apiOnly=false] Launch only the FastAPI backend
 * @property {boolean} [webOnly=false] Launch only the Next.js frontend
 * @property {boolean} [clearPorts=true] Clear occupied ports before launching
 * @property {boolean} [registerSignals=true] Register process signal handlers
 * @property {string} [rootDir=process.cwd()] Root repository directory
 */

/**
 * Unified Dev Orchestrator Session
 */
export class DevOrchestrator {
  /**
   * @param {OrchestratorOptions} [options={}]
   */
  constructor(options = {}) {
    const rootDir = options.rootDir || process.cwd();
    if (process.loadEnvFile) {
      const envPath = path.resolve(rootDir, '.env');
      if (fs.existsSync(envPath)) {
        try {
          process.loadEnvFile(envPath);
        } catch (e) {}
      }
    }

    this.options = {
      apiPort: options.apiPort || parseInt(process.env.API_PORT, 10) || 8000,
      webPort: options.webPort || parseInt(process.env.WEB_PORT, 10) || 3000,
      host: options.host || process.env.API_HOST || '127.0.0.1',
      apiOnly: Boolean(options.apiOnly),
      webOnly: Boolean(options.webOnly),
      clearPorts: options.clearPorts !== false,
      registerSignals: options.registerSignals !== false,
      rootDir,
    };

    this.supervisor = new ProcessSupervisor({
      onProcessExit: (id, code, signal) => this.handleProcessExit(id, code, signal),
    });

    this.isRunning = false;
    this.signalCleanupRegistered = false;
  }

  handleProcessExit(id, code, signal) {
    if (!this.isRunning) return;

    if (code !== 0 && code !== null) {
      console.error(`\x1b[31m[ORCHESTRATOR] Subprocess '${id}' exited unexpectedly with code ${code} (${signal || 'NO_SIGNAL'})\x1b[0m`);
    } else {
      console.log(`\x1b[33m[ORCHESTRATOR] Subprocess '${id}' stopped.\x1b[0m`);
    }
  }

  /**
   * Boots the full-stack development orchestration pipeline.
   */
  async start() {
    this.isRunning = true;
    const { apiPort, webPort, host, apiOnly, webOnly, clearPorts, rootDir } = this.options;

    console.log('\x1b[36m%s\x1b[0m', '=====================================================');
    console.log('\x1b[36m%s\x1b[0m', '   CivicTrace — Unified Full-Stack Dev Orchestrator');
    console.log('\x1b[36m%s\x1b[0m', '=====================================================');

    if (this.options.registerSignals && !this.signalCleanupRegistered) {
      const shutdownHandler = () => {
        this.stop();
        process.exit(0);
      };
      process.on('SIGINT', shutdownHandler);
      process.on('SIGTERM', shutdownHandler);
      this.signalCleanupRegistered = true;
    }

    // 1. Port Clearance
    if (clearPorts) {
      if (!webOnly) {
        await ensurePortFree(apiPort, 'FastAPI');
      }
      if (!apiOnly) {
        await ensurePortFree(webPort, 'Next.js');
      }
    }

    // 2. Start API if requested
    if (!webOnly) {
      const pythonCmd = resolvePython(rootDir);
      console.log(`\x1b[32m[ORCHESTRATOR] Launching FastAPI backend on http://${host}:${apiPort} using ${path.basename(pythonCmd)} ...\x1b[0m`);

      this.supervisor.spawnProcess(
        'api',
        pythonCmd,
        ['-m', 'uvicorn', 'apps.api.app.main:app', '--host', host, '--port', String(apiPort), '--reload'],
        {
          cwd: rootDir,
          prefix: '[API]',
          color: '\x1b[32m',
        }
      );

      // 3. Healthcheck Readiness Probe
      const healthUrl = `http://${host}:${apiPort}/health`;
      console.log(`\x1b[32m[ORCHESTRATOR] Probing API readiness at ${healthUrl} ...\x1b[0m`);
      const isHealthy = await waitForHealth(healthUrl, { timeoutMs: 15000 });

      if (isHealthy) {
        console.log(`\x1b[32m[ORCHESTRATOR] FastAPI backend is READY and accepting traffic!\x1b[0m`);
      } else {
        console.warn(`\x1b[33m[ORCHESTRATOR] Notice: API health probe timed out after 15s. Proceeding with frontend launch...\x1b[0m`);
      }
    }

    // 4. Start Web if requested
    if (!apiOnly) {
      const npmCmd = resolveNpm();
      console.log(`\x1b[34m[ORCHESTRATOR] Launching Next.js frontend on http://localhost:${webPort} (proxied to API on port ${apiPort}) ...\x1b[0m`);

      // Clear any conflicting Webpack cache to avoid build vs dev collisions
      try {
        const cacheDir = path.resolve(rootDir, 'apps', 'web', '.next', 'cache');
        if (fs.existsSync(cacheDir)) {
          fs.rmSync(cacheDir, { recursive: true, force: true });
        }
      } catch (_) {}

      this.supervisor.spawnProcess(
        'web',
        npmCmd,
        ['run', 'dev', '--workspace=apps/web', '--', '-p', String(webPort)],
        {
          cwd: rootDir,
          env: {
            API_PORT: String(apiPort),
            INTERNAL_API_URL: `http://${host}:${apiPort}`,
          },
          prefix: '[WEB]',
          color: '\x1b[34m',
        }
      );
    }

    return this;
  }

  /**
   * Shuts down all supervised child processes.
   */
  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    console.log('\n\x1b[33m[ORCHESTRATOR] Shutting down full-stack development processes...\x1b[0m');
    this.supervisor.terminateAll();
  }

  /**
   * Returns current active status.
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeProcesses: this.supervisor.getActiveProcesses(),
      options: this.options,
    };
  }
}

/**
 * Functional entrypoint to boot the orchestrator.
 * 
 * @param {OrchestratorOptions} [options]
 * @returns {Promise<DevOrchestrator>}
 */
export async function startOrchestrator(options = {}) {
  const orchestrator = new DevOrchestrator(options);
  await orchestrator.start();
  return orchestrator;
}
