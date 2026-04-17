import Anthropic from '@anthropic-ai/sdk';
import { TestCase, ExecutionPlan } from './types';

export class ClaudeExecutor {
  private client: Anthropic;
  private model = 'claude-3-5-sonnet-20241022';

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }

  async generateExecutionPlan(testCase: TestCase): Promise<ExecutionPlan> {
    const systemPrompt = `你是一个UI自动化专家。你的任务是根据测试用例生成可执行的自动化步骤。\n\n你需要将自然语言的步骤转换为结构化的执行计划，包括：\n1. 具体的DOM选择器（使用CSS选择器）\n2. 操作类型（click, input, select等）\n3. 预期结果验证\n\n输出格式为JSON，包含以下结构：\n{\n  "steps": [\n    {\n      "id": "step_1",\n      "action": "click|input|select|navigate|wait",\n      "selector": "CSS选择器",\n      "value": "输入的值（如果有）",\n      "waitTime": 等待时间毫秒（可选）\n    }\n  ],\n  "assertions": [\n    {\n      "type": "visible|contains|value|url",\n      "target": "CSS选择器或URL",\n      "expected": "期望值"\n    }\n  ]\n}`;

    const userMessage = `\n请根据以下测试用例生成执行计划：\n\n标题: ${testCase.title}\n\n前置条件:\n${testCase.preconditions.join('\n')}\n\n设置步骤:\n${testCase.setup.join('\n')}\n\n执行步骤:\n${testCase.steps.map(s => `${s.number}. ${s.action}\n${s.details.map(d => `   - ${d}`).join('\n')}`).join('\n')}\n\n请生成对应的自动化执行计划。`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2048,
        system: [
          {
            type: 'text',
            text: systemPrompt,
            cache_control: { type: 'ephemeral' }
          }
        ],
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: userMessage,
                cache_control: { type: 'ephemeral' }
              }
            ]
          }
        ]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }

      throw new Error('Failed to parse execution plan');
    } catch (error) {
      console.error('Claude error:', error);
      throw error;
    }
  }

  async analyzeResult(testCase: TestCase, executionResult: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 512,
      system: [
        {
          type: 'text',
          text: '你是一个测试结果分析专家。分析执行结果是否符合预期。'
        }
      ],
      messages: [
        {
          role: 'user',
          content: `\n测试用例: ${testCase.title}\n预期结果: ${testCase.steps.map(s => s.expectedResult).filter(Boolean).join('\n')}\n实际结果: ${executionResult}\n\n请分析结果是否符合预期，用JSON格式返回: {"success": boolean, "message": string}`
        }
      ]
    });

    const content = response.content[0];
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }

    return { success: false, message: 'Analysis failed' };\n  }
}