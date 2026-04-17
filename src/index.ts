import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { chromium } from 'playwright';
import { UIAutomationEngine } from './engine';
import { loadTestConfig } from './config';
import { ExecutionResult } from './types';

async function login(): Promise<void> {
  const config = loadTestConfig();
  const storageStateFullPath = path.resolve(process.cwd(), config.storageStatePath);

  console.log(`\n🌐 正在打开浏览器，导航到: ${config.baseUrl}`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(config.baseUrl);

  console.log('\n请在浏览器中完成登录，登录成功后按 Enter 键保存 Session...');

  await new Promise<void>((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('', () => {
      rl.close();
      resolve();
    });
  });

  const dir = path.dirname(storageStateFullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  await context.storageState({ path: storageStateFullPath });
  await browser.close();

  console.log(`\n✅ Session 已保存到 ${config.storageStatePath}，后续执行用例时将自动复用\n`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === '--login') {
    await login();
    return;
  }

  if (args.length === 0) {
    console.log(`
🤖 UI Automation Engine

使用方法:
  npx ts-node src/index.ts --login                  # 手动登录，保存 Session
  npx ts-node src/index.ts <markdown-file-path>     # 执行单条用例
  npx ts-node src/index.ts --batch <markdown-directory>   # 批量执行用例

例子:
  npx ts-node src/index.ts --login
  npx ts-node src/index.ts ./examples/test-case.md
  npx ts-node src/index.ts --batch ./examples/
    `);
    return;
  }

  const config = loadTestConfig();
  const engine = new UIAutomationEngine('./cache', config);

  if (args[0] === '--batch' && args[1]) {
    const results = await engine.runBatch(args[1]);
    
    console.log('\n\n📊 ========== 测试总结 ==========');
    const passed = results.filter((r: ExecutionResult) => r.success).length;
    const total = results.length;
    const totalDuration = results.reduce((sum: number, r: ExecutionResult) => sum + r.duration, 0);
    const cacheHits = results.filter((r: ExecutionResult) => r.cachedHit).length;

    console.log(`✅ 通过: ${passed}/${total}`);
    console.log(`💾 缓存命中: ${cacheHits}/${total}`);
    console.log(`⏱️ 总耗时: ${totalDuration}ms`);
    console.log(`💰 Token节省: 约${Math.round(cacheHits * 90)}%`);
    return;
  }

  const filePath = args[0];
  console.log(`\n🚀 Running test case: ${filePath}\n`);

  const result = await engine.run(filePath);

  console.log('\n\n📊 ========== 执行结果 ==========');
  console.log(`用例ID: ${result.testCaseId}`);
  console.log(`状态: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`消息: ${result.message}`);
  console.log(`耗时: ${result.duration}ms`);
  console.log(`缓存命中: ${result.cachedHit ? '✓' : '✗'}`);

  const stats = engine.getCacheStats();
  console.log(`\n💾 缓存状态: ${stats.total} 条记录`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
