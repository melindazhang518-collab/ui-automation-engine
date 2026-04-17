import * as fs from 'fs';
import * as path from 'path';
import { chromium, BrowserContext, BrowserContextOptions } from 'playwright';
import { TestConfig } from './config';
import { ExecutionPlan } from './types';

export class BrowserExecutor {
  private config: TestConfig;

  constructor(config: TestConfig) {
    this.config = config;
  }

  private async createContext(): Promise<{ context: BrowserContext; close: () => Promise<void> }> {
    const storageStatePath = path.resolve(process.cwd(), this.config.storageStatePath);
    const browser = await chromium.launch({ headless: this.config.headless });
    const contextOptions: BrowserContextOptions = { baseURL: this.config.baseUrl };
    if (fs.existsSync(storageStatePath)) {
      contextOptions.storageState = storageStatePath;
    }

    const context = await browser.newContext(contextOptions);
    context.setDefaultTimeout(this.config.timeout);

    return {
      context,
      close: async () => browser.close(),
    };
  }

  async execute(plan: ExecutionPlan): Promise<string> {
    const { context, close } = await this.createContext();
    const results: string[] = [];

    try {
      const page = await context.newPage();
      await page.goto(this.config.baseUrl);

      for (const step of plan.steps) {
        console.log(`  → [${step.action}] selector=${step.selector ?? 'N/A'} value=${step.value ?? 'N/A'}`);
        const action = step.action.toLowerCase();

        switch (action) {
          case 'click':
            if (step.selector) await page.click(step.selector);
            break;
          case 'fill':
          case 'type':
          case 'input':
            if (step.selector && step.value) await page.fill(step.selector, step.value);
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
            if (step.selector) await page.waitForSelector(step.selector);
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
        console.log(`  ✓ Assert [${assertion.type}] ${assertion.target} = ${assertion.expected}`);
        if (assertion.type === 'url') {
          const currentUrl = page.url();
          const expected = assertion.expected.trim();
          let matched = false;

          if (/^https?:\/\//i.test(expected)) {
            const currentParsed = new URL(currentUrl);
            const expectedParsed = new URL(expected);
            matched =
              currentParsed.origin === expectedParsed.origin &&
              currentParsed.pathname.startsWith(expectedParsed.pathname) &&
              (!expectedParsed.search || currentParsed.search === expectedParsed.search);
          } else if (expected.startsWith('/')) {
            const currentParsed = new URL(currentUrl);
            matched = currentParsed.pathname.startsWith(expected);
          } else {
            const currentParsed = new URL(currentUrl);
            matched = currentParsed.pathname.includes(expected);
          }

          if (!matched) {
            throw new Error(`URL assertion failed: expected "${expected}" but got "${currentUrl}"`);
          }
        } else if (assertion.type === 'visible' && assertion.target) {
          try {
            await page.waitForSelector(assertion.target, { state: 'visible' });
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            throw new Error(`Visible assertion failed: selector "${assertion.target}" is not visible. ${reason}`);
          }
        } else if (assertion.type === 'contains' && assertion.target) {
          const text = await page.textContent(assertion.target);
          if (!text?.includes(assertion.expected)) {
            throw new Error(`Text assertion failed: expected "${assertion.expected}" in "${text}"`);
          }
        } else if (assertion.type === 'value' && assertion.target) {
          const value = await page.inputValue(assertion.target);
          if (value !== assertion.expected) {
            throw new Error(`Value assertion failed: expected "${assertion.expected}" got "${value}"`);
          }
        }
        results.push(`Asserted: ${assertion.type} on ${assertion.target}`);
      }
    } finally {
      await close();
    }

    return results.join('\n');
  }
}
