export type FieldStatus = "unknown" | "valid" | "invalid" | "missing";

export type FieldType =
  | "text"
  | "number"
  | "email"
  | "tel"
  | "date"
  | "time"
  | "datetime-local"
  | "month"
  | "week"
  | "color"
  | "range"
  | "url"
  | "search"
  | "select"
  | "checkbox"
  | "radio"
  | "textarea"
  | "password"
  | "hidden"
  | "other";

export interface ScannedField {
  uid: string;
  formIndex: number;
  name: string;
  id: string;
  type: FieldType;
  label: string;
  placeholder: string;
  required: boolean;
  options?: string[];
  value?: string;
  checked?: boolean;
}

export interface ScannedForm {
  index: number;
  id: string;
  name: string;
  action: string;
  method: string;
  fieldCount: number;
}

export interface PageInfo {
  title: string;
  url: string;
  headings: string[];
  descriptions: string[];
}

export interface ScanResult {
  pageInfo: PageInfo;
  forms: ScannedForm[];
  fields: ScannedField[];
  scannedAt: string;
}

export interface ImportantField {
  uid?: string;
  label: string;
  nameOrId: string;
  type?: FieldType;
  reason: string;
  status: FieldStatus;
  message?: string;
  value?: string;
}

export interface ValidationRule {
  field: string;
  rule: string;
  description: string;
}

export interface AiAnalysis {
  page_summary: string;
  detected_purpose: string;
  important_fields: ImportantField[];
  validation_rules?: ValidationRule[];
  warnings?: string[];
  simulation_values?: Record<string, string | boolean>;
}

export interface ValidationResult {
  overall: "pass" | "fail";
  summary: string;
  fields: Array<{
    nameOrId: string;
    status: FieldStatus;
    message?: string;
    value?: string;
  }>;
}

export interface AiModel {
  id: string;
  name: string;
  description?: string;
  ownedBy?: string;
}

export interface AiSettings {
  apiUrl: string;
  apiKey: string;
  apiSecret: string;
  model: string;
  enabled: boolean;
}

export interface AppSettings {
  targetUrl: string;
  ai: AiSettings;
  skipConfirmDomains: string[];
  simulateFillEnabled: boolean;
}

export interface ConfirmAction {
  title: string;
  description: string;
  details?: string[];
  confirmLabel?: string;
  onConfirm: () => void;
}

export type PanelTab = "controls" | "scratchpad" | "settings";

export const DEFAULT_SETTINGS: AppSettings = {
  targetUrl: "sandbox://coretax-spt-masa",
  ai: {
    apiUrl: "http://localhost:20128/v1/chat/completions",
    apiKey: "",
    apiSecret: "",
    model: "",
    enabled: true,
  },
  skipConfirmDomains: [],
  simulateFillEnabled: true,
};

export const SANDBOX_URL = "sandbox://coretax-spt-masa";
export const SANDBOX_TITLE = "Coretax DJP — SPT Masa PPh Pasal 21 (Sandbox)";
