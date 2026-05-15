import { exec } from 'child_process';
import { promisify } from 'util';

export const execAsync = promisify(exec);

type ExecResult = { stdout: string; stderr: string };

const DANGEROUS_PATTERN = /[|;`$&><\n\r{}\[\]]/;

const BLOCKED_COMMANDS = [
  'rm -rf /', 'rm -rf /*', 'mkfs', 'dd if=', ':(){:|:&};:',
  'shutdown', 'reboot', 'halt', 'poweroff',
  'format', 'del /s /q', 'rd /s /q',
];

const ALLOWED_SHELL_COMMANDS = [
  'git status', 'git log', 'git diff', 'git branch', 'git tag',
  'git rev-parse', 'git config', 'git remote',
];

export interface SafeExecOptions {
  cwd?: string;
  timeout?: number;
  allowShellMeta?: boolean;
}

function isBlockedCommand(command: string): boolean {
  const normalized = command.trim().toLowerCase();
  return BLOCKED_COMMANDS.some(blocked => normalized.includes(blocked));
}

function isAllowedShellCommand(command: string): boolean {
  const normalized = command.trim().toLowerCase();
  return ALLOWED_SHELL_COMMANDS.some(allowed => normalized.startsWith(allowed));
}

export async function safeExec(
  command: string,
  options: SafeExecOptions = {}
): Promise<ExecResult> {
  const {
    timeout = 120_000,
    allowShellMeta = false,
  } = options;

  if (!command || command.trim().length === 0) {
    throw new Error('Security: empty command rejected');
  }

  if (isBlockedCommand(command)) {
    throw new Error(`Security: dangerous command blocked: ${command.slice(0, 100)}`);
  }

  if (!allowShellMeta && DANGEROUS_PATTERN.test(command)) {
    throw new Error(`Security: command blocked by safeExec policy (contains disallowed characters): ${command.slice(0, 100)}`);
  }

  if (allowShellMeta && !isAllowedShellCommand(command)) {
    console.warn(
      `⚠️ [safeExec] Shell meta allowed for non-whitelisted command: ${command.slice(0, 80)}`
    );
  }

  const pathTraversalPattern = /\.\.[\/\\]/;
  if (pathTraversalPattern.test(command)) {
    throw new Error(`Security: path traversal detected in command: ${command.slice(0, 100)}`);
  }

  return execAsync(command, {
    cwd: options.cwd,
    timeout,
    maxBuffer: 1024 * 1024,
  });
}
