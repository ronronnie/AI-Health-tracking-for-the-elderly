export interface ParsedReportSource {
  file: string;
  section: string;
  distance: number;
}

export interface ParsedReportValue {
  name: string;
  value: string;
  unit: string;
  reference_range: string;
  status: 'normal' | 'low' | 'high' | 'critical';
  explanation: string;
  cited_explanation?: string;
  sources?: ParsedReportSource[];
}

export interface PatternExplanation {
  pattern: string;
  explanation: string;
  sources: ParsedReportSource[];
}

export interface ParsedReport {
  patient: {
    name: string | null;
    age: string | null;
    gender: string | null;
    report_date: string | null;
    lab_name: string | null;
  };
  test_panel: string;
  values: ParsedReportValue[];
  summary: {
    traffic_light: 'green' | 'yellow' | 'red';
    headline: string;
    abnormal_count: number;
    patterns_detected: string[];
    pattern_explanations?: PatternExplanation[];
    next_steps: string;
  };
  disclaimer: string;
  meta: {
    rag_calls: number;
    rag_input_tokens: number;
    rag_output_tokens: number;
    rag_estimated_cost_inr: number;
  };
}
