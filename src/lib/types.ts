/** Shape of each lab value returned by the AI parser. */
export interface ParsedLabValue {
  name: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  status: 'normal' | 'low' | 'high' | 'critical';
  explanation?: string;
}

/** Full parsed report object returned by the AI parser. */
export interface ParsedReport {
  reportDate: string;        // ISO date (YYYY-MM-DD)
  labName?: string;
  testPanel?: string;
  trafficLight: 'green' | 'yellow' | 'red';
  headline: string;
  abnormalCount: number;
  patternsDetected: string[];
  nextSteps: string;
  disclaimer: string;
  labValues: ParsedLabValue[];
}

/** Token usage + cost returned alongside the parsed report. */
export interface ParseUsage {
  input_tokens: number;
  output_tokens: number;
  est_cost_inr: number;
}

/** Full response shape from POST /api/parse */
export interface ParseApiResponse {
  parsed: ParsedReport;
  usage: ParseUsage;
}
