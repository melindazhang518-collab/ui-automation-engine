import * as crypto from 'crypto';
import { TestCase, Step } from './types';

export class MarkdownParser {
  parse(markdown: string): TestCase {
    const id = crypto.createHash('md5').update(markdown).digest('hex').slice(0, 8);
    const titleMatch = markdown.match(/^#\s+(.+)/m);
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled';

    const preconditions = this.extractSection(markdown, '前置条件');
    const setup = this.extractSection(markdown, '设置步骤');
    const teardown = this.extractSection(markdown, '清理步骤');
    const steps = this.extractSteps(markdown);

    return {
      id,
      title,
      description: '',
      preconditions,
      setup,
      steps,
      teardown,
      rawMarkdown: markdown,
    };
  }

  private extractSection(markdown: string, sectionName: string): string[] {
    const regex = new RegExp(`##\\s+${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n##|$)`, 'i');
    const match = markdown.match(regex);
    if (!match) return [];
    return match[1]
      .split('\n')
      .map((line: string) => line.replace(/^[-*]\s+/, '').trim())
      .filter(Boolean);
  }

  private extractSteps(markdown: string): Step[] {
    const stepsMatch = markdown.match(/##\s+测试步骤\s*\n([\s\S]*?)(?=\n##|$)/i);
    if (!stepsMatch) return [];
    const lines = stepsMatch[1].split('\n').filter(Boolean);
    const steps: Step[] = [];
    let currentStep: Step | null = null;

    for (const line of lines) {
      const stepMatch = line.match(/^\d+\.\s+(.+)/);
      if (stepMatch) {
        if (currentStep) steps.push(currentStep);
        currentStep = {
          number: steps.length + 1,
          action: stepMatch[1].trim(),
          details: [],
        };
      } else if (currentStep && line.includes('预期')) {
        currentStep.expectedResult = line.replace(/预期[结果：:]+/, '').trim();
      } else if (currentStep && line.trim().startsWith('-')) {
        currentStep.details.push(line.replace(/^-\s+/, '').trim());
      }
    }
    if (currentStep) steps.push(currentStep);
    return steps;
  }
}
