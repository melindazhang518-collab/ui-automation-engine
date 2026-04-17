export interface TestCase {
  id: string;
  title: string;
  description: string;
  preconditions: string[];
  setup: string[];
  steps: Step[];
  teardown: string[];
  rawMarkdown: string;
}

export interface Step {
  number: number;
  action: string;
  details: string[];
  expectedResult?: string;
}

export interface CacheResult {
  testCaseId: string;
  success: boolean;
  result: string;
  timestamp: number;
  executionTime: number;
}

export interface ExecutionPlan {
  steps: ExecutionStep[];
  assertions: Assertion[];
}

export interface ExecutionStep {
  id: string;
  action: string;
  selector?: string;
  value?: string;
  waitTime?: number;
}

export interface Assertion {
  type: 'visible' | 'contains' | 'value' | 'url';
  target: string;
  expected: string;
}

export interface ExecutionResult {
  testCaseId: string;
  success: boolean;
  message: string;
  duration: number;
  cachedHit: boolean;
  screenshotPath?: string;
}