# ui-automation-engine
AI-powered UI automation framework with Prompt Caching

## 快速开始

### 1. 安装依赖
```bash
npm install
npx playwright install chromium
```

### 2. 配置环境
```bash
cp .env.example .env                    # 填写 AI API 配置
cp test.config.example.json test.config.json  # 填写被测系统地址
```

### 3. 手动登录（只需一次）
```bash
npx ts-node src/index.ts --login
# 浏览器会自动打开，完成登录后按 Enter，Session 将保存供后续复用
```

### 4. 执行测试用例
```bash
npx ts-node src/index.ts ./examples/test-case.md
```

## Stagehand Agent 模式

Stagehand 模式是 AI 驱动的浏览器执行方式，执行阶段通过自然语言理解页面与操作目标，不再依赖固定 CSS selector。

与原有机械执行模式相比，Stagehand 模式可以更好地适应 DOM 结构变化，降低因页面微调导致的用例失败。

该模式已自动集成到当前执行引擎中，默认即可使用，无需额外配置。
