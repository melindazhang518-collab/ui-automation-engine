import * as fs from 'fs';
import * as path from 'path';
import { Stagehand } from '@browserbasehq/stagehand';
import { z } from 'zod';
import { TestConfig } from './config';
import { ExecutionPlan } from './types';

interface StorageStateItem {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
}

interface StorageState {
  cookies?: StorageStateItem[];
  origins?: Array<{
    origin: string;
    localStorage: Array<{
      name: string;
      value: string;
    }>;
  }>;
}

export class StagehandExecutor {
  private config: TestConfig;

  constructor(config: TestConfig) {
    this.config = config;
  }

  private async applyStorageState(page: any): Promise<void> {
    const storageStatePath = path.resolve(process.cwd(), this.config.storageStatePath);
    if (!fs.existsSync(storageStatePath)) {
      return;
    }

    const rawState = JSON.parse(fs.readFileSync(storageStatePath, 'utf-8')) as StorageState;

    if (rawState.cookies && rawState.cookies.length > 0) {
      await page.context().addCookies(rawState.cookies);
    }

    if (rawState.origins && rawState.origins.length > 0) {
      const baseOrigin = new URL(this.config.baseUrl).origin;
      const matched = rawState.origins.find((item) => item.origin === baseOrigin);
      if (matched && matched.localStorage.length > 0) {
        await page.goto(baseOrigin);
        await page.evaluate((entries: Array<{ name: string; value: string }>) => {
          for (const entry of entries) {
            (globalThis as unknown as { localStorage: { setItem: (key: string, value: string) => void } }).localStorage.setItem(
              entry.name,
              entry.value,
            );
          }
        }, matched.localStorage);
      }
    }
  }

  async execute(plan: ExecutionPlan): Promise<string> {
    const stagehand = new Stagehand({
      env: 'LOCAL',
      modelName: process.env.API_MODEL as any,
      modelClientOptions: {
        apiKey: process.env.API_TOKEN,
        baseURL: process.env.API_BASE_URL,
      },
      headless: this.config.headless,
      verbose: 1,
    });

    const results: string[] = [];
    const assertionSchema = z.object({
      passed: z.boolean(),
      reason: z.string(),
    });

    try {
      await stagehand.init();
      const page = stagehand.page;
      page.setDefaultTimeout(this.config.timeout);

      await this.applyStorageState(page);
      await page.goto(this.config.baseUrl);

      for (const step of plan.steps) {
        console.log(`  → [${step.action}] selector=${step.selector ?? 'N/A'} value=${step.value ?? 'N/A'}`);
        const action = step.action.toLowerCase();

        switch (action) {
          case 'click':
            if (step.selector) {
              await page.act({ action: `点击 ${step.selector}` });
            }
            break;
          case 'fill':
          case 'type':
          case 'input':
            if (step.selector && step.value) {
              await page.act({ action: `在 ${step.selector} 输入 ${step.value}` });
            }
            break;
          case 'navigate':
          case 'goto':
            await page.goto(step.value ?? this.config.baseUrl);
            break;
          case 'wait':
            if (typeof step.waitTime === 'number') {
              await page.waitForTimeout(step.waitTime);
            } else if (step.selector) {
              await page.waitForSelector(step.selector);
            }
            break;
          case 'waitforselector':
            if (step.selector) {
              await page.waitForSelector(step.selector);
            }
            break;
          case 'screenshot': {
            const screenshotDir = path.resolve(process.cwd(), 'screenshots');
            if (!fs.existsSync(screenshotDir)) {
              fs.mkdirSync(screenshotDir, { recursive: true });
            }
            await page.screenshot({ path: path.join(screenshotDir, `${Date.now()}.png`) });
            break;
          }
          default:
            console.log(`  ⚠️  Unknown action: ${step.action}, skipping`);
        }

        results.push(`Executed: ${step.action}`);
      }

      for (const assertion of plan.assertions) {
        const result = await page.extract({
          instruction: `检查页面是否满足: ${assertion.type} 断言，目标="${assertion.target}"，预期值="${assertion.expected}"`,
          schema: assertionSchema,
        });

        if (!result.passed) {
          throw new Error(`断言失败: ${result.reason}`);
        }

        results.push(`Asserted: ${assertion.type} on ${assertion.target}`);
      }
    } finally {
      await stagehand.close();
    }

    return results.join('\n');
  }
}
