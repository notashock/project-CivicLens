import net from 'node:net';
import { execSync } from 'node:child_process';
import process from 'node:process';
import { isWindows } from './runtime.mjs';

/**
 * Checks if a TCP port is currently free to bind on.
 * 
 * @param {number} port
 * @param {string} [host='0.0.0.0']
 * @returns {Promise<boolean>}
 */
export function isPortAvailable(port, host = '0.0.0.0') {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => {
      resolve(false);
    });
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

/**
 * Ensures that the specified port is not occupied. If it is occupied, terminates
 * the process occupying it.
 * 
 * @param {number} port
 * @param {string} [serviceName='Service']
 * @param {object} [options]
 * @param {boolean} [options.quiet=false]
 * @param {number} [options.settleDelayMs=800]
 * @returns {Promise<boolean>} true if cleared/free, false if failed
 */
export async function ensurePortFree(port, serviceName = 'Service', options = {}) {
  const { quiet = false, settleDelayMs = 800 } = options;
  const free = await isPortAvailable(port);
  if (free) {
    return true;
  }

  if (!quiet) {
    console.log(`\x1b[33m[ORCHESTRATOR] Port ${port} (${serviceName}) is occupied. Clearing stale process...\x1b[0m`);
  }

  try {
    if (isWindows) {
      execSync(
        `powershell -NoProfile -NonInteractive -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`,
        { stdio: 'ignore' }
      );
    } else {
      execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' });
    }

    if (settleDelayMs > 0) {
      await new Promise((r) => setTimeout(r, settleDelayMs));
    }

    return await isPortAvailable(port);
  } catch (e) {
    if (!quiet) {
      console.warn(`\x1b[33m[ORCHESTRATOR] Warning while freeing port ${port}: ${e.message}\x1b[0m`);
    }
    return false;
  }
}
