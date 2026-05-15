import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_DIR = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = join(TEST_DIR, '..', '..', '..');

describe('package validation scripts', () => {
  it('routes validation scripts through the CLI commands that actually execute validators', async () => {
    const packageJson = JSON.parse(
      await readFile(join(PROJECT_ROOT, 'package.json'), 'utf-8')
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.['skill:validate']).toBe('npx tsx core/engine/cli.ts skill validate');
    expect(packageJson.scripts?.['schema:validate']).toBe('npx tsx core/engine/cli.ts schema validate');
    expect(packageJson.scripts?.['sync:validate']).toBe('npx tsx core/engine/cli.ts sync validate');
  });
});
