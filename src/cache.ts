import * as fs from 'fs';
import * as path from 'path';
import { CacheResult } from './types';

export class CacheManager {
  private cacheDir: string;
  private store: Map<string, CacheResult>;

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
    this.store = new Map();
    this.load();
  }

  private get cacheFile(): string {
    return path.join(this.cacheDir, 'cache.json');
  }

  private load(): void {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8')) as Record<string, CacheResult>;
        for (const [key, value] of Object.entries(data)) {
          this.store.set(key, value);
        }
      }
    } catch {
      // ignore corrupt cache
    }
  }

  private save(): void {
    fs.mkdirSync(this.cacheDir, { recursive: true });
    const data: Record<string, CacheResult> = {};
    for (const [key, value] of this.store.entries()) {
      data[key] = value;
    }
    fs.writeFileSync(this.cacheFile, JSON.stringify(data, null, 2));
  }

  get(id: string): CacheResult | undefined {
    return this.store.get(id);
  }

  set(id: string, result: CacheResult): void {
    this.store.set(id, result);
    this.save();
  }

  stats(): { total: number } {
    return { total: this.store.size };
  }
}
