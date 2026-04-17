import * as fs from 'fs';
import * as path from 'path';
import { TestCase, ExecutionResult } from './types';
import { ClaudeExecutor } from './claude-executor';
import { MarkdownParser } from './parser';
import { CacheManager } from './cache';
import { BrowserExecutor } from './browser-executor';

export class UIAutomationEngine {
  private executor: ClaudeExecutor;
  private parser: MarkdownParser;
  private cache: CacheManager;
  private browser: BrowserExecutor;

  constructor(cacheDir: string) {
    this.executor = new ClaudeExecutor();
    this.parser = new MarkdownParser();
    this.cache = new CacheManager(cacheDir);
    this.browser = new BrowserExecutor();
  }

  async run(filePath: string): Promise<ExecutionResult> {
    const startTime = Date.now();
    const markdown = fs.readFileSync(filePath, 'utf-8');
    const testCase: TestCase = this.parser.parse(markdown);

    const cached = this.cache.get(testCase.id);
    if (cached) {
      return {
        testCaseId: testCase.id,
        success: cached.success,
        message: cached.result,
        duration: Date.now() - startTime,
        cachedHit: true
      };
    }

    try {
      const plan = await this.executor.generateExecutionPlan(testCase);
      const executionResult = await this.browser.execute(plan);
      const analysis = await this.executor.analyzeResult(testCase, executionResult);

      this.cache.set(testCase.id, {
        testCaseId: testCase.id,
        success: analysis.success,
        result: analysis.message,
        timestamp: Date.now(),
        executionTime: Date.now() - startTime
      });

      return {
        testCaseId: testCase.id,
        success: analysis.success,
        message: analysis.message,
        duration: Date.now() - startTime,
        cachedHit: false
      };
    } catch (error) {
      return {
        testCaseId: testCase.id,
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
        cachedHit: false
      };
    }
  }

  async runBatch(dirPath: string): Promise<ExecutionResult[]> {
    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.md'));
    const results: ExecutionResult[] = [];
    for (const file of files) {
      const result = await this.run(path.join(dirPath, file));
      results.push(result);
    }
    return results;
  }

  getCacheStats(): { total: number } {
    return this.cache.stats();
  }
}
