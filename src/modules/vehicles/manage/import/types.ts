export type FleetImportOperation = 'ADD' | 'UPDATE' | 'UNCHANGED' | 'ERROR' | 'OPTIONAL_ARCHIVE';

export interface FleetImportSourceRow {
  make: string;
  model: string;
  registrationNumber: string;
  year: string | number;
  vin?: string | null;
}

export interface FleetImportRow {
  rowNumber: number;
  make: string;
  model: string;
  registrationNumberNormalized: string;
  vinNormalized: string | null;
  year: number;
}

export interface FleetImportRowError {
  rowNumber: number;
  code: string;
  message: string;
}

export interface FleetImportParseResult {
  rows: FleetImportRow[];
  errors: FleetImportRowError[];
}
