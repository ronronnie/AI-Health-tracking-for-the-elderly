import Dexie, { Table } from 'dexie';

export interface Parent {
  id: string;            // UUID
  name: string;
  dateOfBirth?: string;  // ISO date string
  gender?: 'male' | 'female' | 'other';
  bloodType?: string;
  notes?: string;
  createdAt: string;     // ISO datetime
}

export interface Report {
  id: string;
  parentId: string;
  reportDate: string;    // ISO date string
  labName?: string;
  testPanel?: string;
  originalFileName?: string;
  originalFileBlob?: Blob;
  trafficLight: 'green' | 'yellow' | 'red';
  headline: string;
  abnormalCount: number;
  patternsDetected: string[];
  nextSteps: string;
  disclaimer: string;
  parseCostInr?: number;
  parsedJson?: string;   // Full ParsedReport JSON from the Python backend
  createdAt: string;
}

export interface LabValue {
  id: string;
  reportId: string;
  name: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  status: 'normal' | 'low' | 'high' | 'critical';
  explanation?: string;
  citedExplanation?: string;   // RAG-grounded explanation (abnormal values only)
  sources?: string;             // JSON array of ParsedReportSource
  userEdited: boolean;
}

export interface Reminder {
  id: string;
  parentId: string;
  title: string;
  notes?: string;
  scheduledDate: string; // ISO datetime
  isCompleted: boolean;
  createdAt: string;
}

class ParentCareDB extends Dexie {
  parents!: Table<Parent, string>;
  reports!: Table<Report, string>;
  labValues!: Table<LabValue, string>;
  reminders!: Table<Reminder, string>;

  constructor() {
    super('parentcare');
    this.version(1).stores({
      parents: 'id, name, createdAt',
      reports: 'id, parentId, reportDate, createdAt',
      labValues: 'id, reportId, name, status',
      reminders: 'id, parentId, scheduledDate, isCompleted',
    });
  }
}

export const db = new ParentCareDB();
