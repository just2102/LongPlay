export type StepId = "approval" | "configure";
export type StepStatus = "idle" | "pending" | "success" | "skipped" | "error";

export interface StepState {
  id: StepId;
  label: string;
  status: StepStatus;
  sublabel?: string;
  txHash?: `0x${string}`;
  error?: string;
}
