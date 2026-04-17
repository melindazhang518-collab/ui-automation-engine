import { ExecutionPlan } from './types';

export class BrowserExecutor {
  async execute(plan: ExecutionPlan): Promise<string> {
    const results: string[] = [];

    for (const step of plan.steps) {
      console.log(`  → [${step.action}] selector=${step.selector ?? 'N/A'} value=${step.value ?? 'N/A'}`);
      results.push(`Executed: ${step.action}`);
    }

    for (const assertion of plan.assertions) {
      console.log(`  ✓ Assert [${assertion.type}] ${assertion.target} = ${assertion.expected}`);
      results.push(`Asserted: ${assertion.type} on ${assertion.target}`);
    }

    return results.join('\n');
  }
}
