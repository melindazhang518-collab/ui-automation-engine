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
