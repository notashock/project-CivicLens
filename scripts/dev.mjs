#!/usr/bin/env node

import process from 'node:process';
import path from 'node:path';
import fs from 'node:fs';
import { startOrchestrator } from './orchestrator/orchestrator.mjs';

// Automatically load root .env if it exists
if (process.loadEnvFile) {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
    } catch (e) {
      console.warn('\x1b[33m[DEV] Notice: could not load .env file:\x1b[0m', e.message);
    }
  }
}

function parseArgs(args) {
  const options = {
    webOnly: false,
    apiOnly: false,
    webPort: parseInt(process.env.WEB_PORT, 10) || 3000,
    apiPort: parseInt(process.env.API_PORT, 10) || 8000,
    clearPorts: true,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--web-only') {
      options.webOnly = true;
    } else if (arg === '--api-only') {
      options.apiOnly = true;
    } else if (arg === '--no-clear') {
      options.clearPorts = false;
    } else if (arg === '--port' || arg === '-p') {
      const val = parseInt(args[++i], 10);
      if (!isNaN(val)) options.webPort = val;
    } else if (arg === '--api-port') {
      const val = parseInt(args[++i], 10);
      if (!isNaN(val)) options.apiPort = val;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
CivicTrace Unified Full-Stack Dev Orchestrator

Usage:
  node scripts/dev.mjs [options]

Options:
  --web-only           Launch only the Next.js frontend
  --api-only           Launch only the FastAPI backend
  --port, -p <number>  Set Next.js port (default: 3000)
  --api-port <number>  Set FastAPI port (default: 8000)
  --no-clear           Do not forcefully clear occupied ports before starting
  --help, -h           Show this help message
`);
      process.exit(0);
    }
  }

  return options;
}

const cliOptions = parseArgs(process.argv.slice(2));

startOrchestrator(cliOptions).catch((err) => {
  console.error('\x1b[31m[ORCHESTRATOR] Fatal startup error:\x1b[0m', err);
  process.exit(1);
});
