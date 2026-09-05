import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

export const isWindows = process.platform === 'win32';

/**
 * Resolves the path to the best available Python executable.
 * Prioritizes local virtual environments (.venv, venv) before system python.
 * 
 * @param {string} rootDir Base directory of the repository
 * @returns {string} Executable command or path
 */
export function resolvePython(rootDir = process.cwd()) {
  const venvCandidates = [
    path.join(rootDir, '.venv', isWindows ? 'Scripts/python.exe' : 'bin/python'),
    path.join(rootDir, 'venv', isWindows ? 'Scripts/python.exe' : 'bin/python'),
    path.join(rootDir, 'apps/api/.venv', isWindows ? 'Scripts/python.exe' : 'bin/python'),
    path.join(rootDir, 'apps/api/venv', isWindows ? 'Scripts/python.exe' : 'bin/python'),
  ];

  for (const candidate of venvCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return isWindows ? 'python' : 'python3';
}

/**
 * Resolves the appropriate npm command for the current platform.
 * 
 * @returns {string} 'npm.cmd' on Windows, 'npm' on POSIX
 */
export function resolveNpm() {
  return isWindows ? 'npm.cmd' : 'npm';
}
