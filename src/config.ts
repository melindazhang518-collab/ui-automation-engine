import * as fs from 'fs';
import * as path from 'path';

export interface TestConfig {
  baseUrl: string;
  storageStatePath: string;
  headless: boolean;
  timeout: number;
}

export function loadTestConfig(configPath = 'test.config.json'): TestConfig {
  const fullPath = path.resolve(process.cwd(), configPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Config file not found: ${fullPath}\nPlease copy test.config.example.json to test.config.json and fill in the values.`);
  }

  let raw: Partial<TestConfig>;
  try {
    raw = JSON.parse(fs.readFileSync(fullPath, 'utf-8')) as Partial<TestConfig>;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown JSON parse error';
    throw new Error(`Invalid JSON in ${fullPath}: ${message}`);
  }
  if (!raw.baseUrl) {
    throw new Error('test.config.json: missing required field "baseUrl"');
  }

  return {
    baseUrl: raw.baseUrl,
    storageStatePath: raw.storageStatePath ?? '.session/state.json',
    headless: raw.headless ?? false,
    timeout: raw.timeout ?? 30000,
  };
}
