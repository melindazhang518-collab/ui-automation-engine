import { UIAutomationEngine } from './engine';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
🤖 UI Automation Engine

使用方法:
  npx ts-node src/index.ts <markdown-file-path>
  npx ts-node src/index.ts --batch <markdown-directory>

例子:
  npx ts-node src/index.ts ./examples/test-case.md
  npx ts-node src/index.ts --batch ./examples/
    `);
    return;
  }

  const engine = new UIAutomationEngine('./cache');

  if (args[0] === '--batch' && args[1]) {
    const results = await engine.runBatch(args[1]);
    
    console.log('\n\n📊 ========== 测试总结 ==========');
    const passed = results.filter(r => r.success).length;
    const total = results.length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const cacheHits = results.filter(r => r.cachedHit).length;

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