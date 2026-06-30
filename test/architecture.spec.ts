import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function collectFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolutePath = join(directory, entry);
    const stat = statSync(absolutePath);

    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git') return [];
      return collectFiles(absolutePath);
    }

    return [absolutePath];
  });
}

function isRuntimeGuardrailFile(file: string): boolean {
  return (
    file.includes(`${join('src')}${join('').slice(0, 0)}`) ||
    file.endsWith('package.json') ||
    file.endsWith('.env.example')
  );
}

describe('architecture guardrails', () => {
  it('does not introduce legacy runtime dependencies', () => {
    const root = join(__dirname, '..');
    const source = collectFiles(root)
      .filter((file) => !file.endsWith('architecture.spec.ts'))
      .filter(isRuntimeGuardrailFile)
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');

    expect(source).not.toMatch(/script\.google\.com/i);
    expect(source).not.toMatch(/SpreadsheetApp/i);
    expect(source).not.toMatch(/appsscript/i);
  });
});
