import { TestCase, ExecutionPlan } from './types';

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
}

export class ClaudeExecutor {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly token: string;

  constructor() {
    this.baseUrl = process.env.API_BASE_URL || '';
    this.model = process.env.API_MODEL || 'gemini-3_1-pro-preview';
    this.token = process.env.API_TOKEN || '';

    const missingVars = ['API_BASE_URL', 'API_TOKEN'].filter((key) => !process.env[key]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
  }

  private getEndpoint(): string {
    return `${this.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  }

  private async callChatCompletion(systemPrompt: string, userMessage: string, maxTokens: number): Promise<string> {
    const response = await fetch(this.getEndpoint(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ]
      })
    });

    const rawBody = await response.text();
    if (!response.ok) {
      throw new Error(`API request failed (${response.status}): ${rawBody}`);
    }

    let data: ChatCompletionResponse;
    try {
      data = JSON.parse(rawBody) as ChatCompletionResponse;
    } catch {
      throw new Error('API response is not valid JSON');
    }

    const content = data.choices?.[0]?.message?.content;
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      const merged = content
        .filter((part) => part.type === 'text' && typeof part.text === 'string')
        .map((part) => part.text)
        .join('\n')
        .trim();

      if (merged) {
        return merged;
      }
    }

    throw new Error('API response missing message content');
  }

  async generateExecutionPlan(testCase: TestCase): Promise<ExecutionPlan> {
    const systemPrompt = `你是一个UI自动化专家。你的任务是根据测试用例生成可执行的自动化步骤。\n\n你需要将自然语言的步骤转换为结构化的执行计划，包括：\n1. 具体的DOM选择器（使用CSS选择器）\n2. 操作类型（click, input, select等）\n3. 预期结果验证\n\n输出格式为JSON，包含以下结构：\n{\n  "steps": [\n    {\n      "id": "step_1",\n      "action": "click|input|select|navigate|wait",\n      "selector": "CSS选择器",\n      "value": "输入的值（如果有）",\n      "waitTime": 等待时间毫秒（可选）\n    }\n  ],\n  "assertions": [\n    {\n      "type": "visible|contains|value|url",\n      "target": "CSS选择器或URL",\n      "expected": "期望值"\n    }\n  ]\n}`;

    const userMessage = `\n请根据以下测试用例生成执行计划：\n\n标题: ${testCase.title}\n\n前置条件:\n${testCase.preconditions.join('\n')}\n\n设置步骤:\n${testCase.setup.join('\n')}\n\n执行步骤:\n${testCase.steps.map(s => `${s.number}. ${s.action}\n${s.details.map(d => `   - ${d}`).join('\n')}`).join('\n')}\n\n请生成对应的自动化执行计划。`;

    try {
      const content = await this.callChatCompletion(systemPrompt, userMessage, 2048);
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as ExecutionPlan;
      }

      throw new Error('Failed to parse execution plan');
    } catch (error) {
      console.error('Model API error:', error);
      throw error;
    }
  }

  async analyzeResult(testCase: TestCase, executionResult: string): Promise<{ success: boolean; message: string }> {
    const systemPrompt = '你是一个测试结果分析专家。分析执行结果是否符合预期。';
    const userMessage = `\n测试用例: ${testCase.title}\n预期结果: ${testCase.steps.map(s => s.expectedResult).filter(Boolean).join('\n')}\n实际结果: ${executionResult}\n\n请分析结果是否符合预期，用JSON格式返回: {"success": boolean, "message": string}`;

    const content = await this.callChatCompletion(systemPrompt, userMessage, 512);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as { success: boolean; message: string };
    }

    return { success: false, message: 'Analysis failed' };
  }
}
