import { spawn, execSync } from 'node:child_process';
import process from 'node:process';
import { isWindows } from './runtime.mjs';

/**
 * Creates line-buffered stream handler that prepends a colorized prefix to each line.
 * 
 * @param {string} prefix Colorized prefix string (e.g. '\x1b[32m[API]\x1b[0m ')
 * @param {NodeJS.WriteStream} targetStream process.stdout or process.stderr
 * @returns {(chunk: Buffer | string) => void}
 */
export function createLinePrefixer(prefix, targetStream = process.stdout) {
  let remainder = '';

  return (chunk) => {
    const text = remainder + chunk.toString();
    const lines = text.split('\n');
    remainder = lines.pop() || '';

    for (const line of lines) {
      targetStream.write(`${prefix} ${line}\n`);
    }
  };
}

export class ProcessSupervisor {
  constructor(options = {}) {
    this.managedProcesses = new Map();
    this.isTearingDown = false;
    this.onExitCallback = options.onProcessExit || null;
  }

  /**
   * Spawns and supervises a child process.
   * 
   * @param {string} id Unique identifier for the process (e.g. 'api', 'web')
   * @param {string} command Executable path or command name
   * @param {string[]} args Command arguments
   * @param {object} [options]
   * @param {string} [options.cwd] Working directory
   * @param {Record<string, string>} [options.env] Environment variables
   * @param {string} [options.prefix] Log prefix
   * @param {string} [options.color] ANSI color code for prefix
   * @returns {import('node:child_process').ChildProcess}
   */
  spawnProcess(id, command, args, options = {}) {
    const {
      cwd = process.cwd(),
      env = process.env,
      prefix = `[${id.toUpperCase()}]`,
      color = '\x1b[36m',
    } = options;

    const fullPrefix = `${color}${prefix}\x1b[0m`;
    const executable = isWindows && command.includes(' ') && !command.startsWith('"')
      ? `"${command}"`
      : command;

    const child = spawn(executable, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: isWindows,
    });

    const stdoutHandler = createLinePrefixer(fullPrefix, process.stdout);
    const stderrHandler = createLinePrefixer(fullPrefix, process.stderr);

    child.stdout?.on('data', stdoutHandler);
    child.stderr?.on('data', stderrHandler);

    this.managedProcesses.set(id, {
      id,
      command,
      args,
      child,
      pid: child.pid,
      startTime: Date.now(),
    });

    child.on('exit', (code, signal) => {
      this.managedProcesses.delete(id);
      if (!this.isTearingDown && typeof this.onExitCallback === 'function') {
        this.onExitCallback(id, code, signal);
      }
    });

    return child;
  }

  /**
   * Gracefully or forcefully terminates a single child process and its process tree.
   * 
   * @param {string} id Identifier of the managed process
   */
  terminateProcess(id) {
    const record = this.managedProcesses.get(id);
    if (!record || !record.child) return;

    const { child, pid } = record;
    try {
      if (isWindows && pid) {
        execSync(`taskkill /pid ${pid} /f /t`, { stdio: 'ignore' });
      } else if (pid) {
        try {
          process.kill(-pid, 'SIGTERM');
        } catch {
          child.kill('SIGTERM');
        }
      }
    } catch {
      // Process might have already terminated
    } finally {
      this.managedProcesses.delete(id);
    }
  }

  /**
   * Terminates all managed processes across platforms.
   */
  terminateAll() {
    this.isTearingDown = true;
    for (const id of Array.from(this.managedProcesses.keys())) {
      this.terminateProcess(id);
    }
  }

  /**
   * Returns list of currently active process records.
   */
  getActiveProcesses() {
    return Array.from(this.managedProcesses.values()).map((p) => ({
      id: p.id,
      pid: p.pid,
      uptimeMs: Date.now() - p.startTime,
    }));
  }
}
