export type FlowTemplate = "restaurant_order" | "reservation" | "combined" | "custom";

export type FlowStepType = "greeting" | "question" | "branch" | "action" | "closing";

export interface FlowStep {
  id: string;
  type: FlowStepType;
  title: string;
  message: string;
  /** For question/branch: option label → next step id */
  branches?: Record<string, string>;
  /** For action steps: e.g. take_order, upsell, send_payment_link, book_table */
  action?: string;
}

export interface AgentFlow {
  id: number;
  restaurantId: number;
  name: string;
  template: FlowTemplate;
  steps: FlowStep[];
  generatedPrompt: string | null;
  isActive: boolean;
  appliedAgentId: string | null;
  createdAt: string;
  updatedAt: string;
}
