import { StepState } from "~~/types/tx-types";

const dot = (status: StepState["status"]) => {
  const base = "inline-block w-2.5 h-2.5 rounded-full";
  switch (status) {
    case "success":
      return `${base} bg-green-500`;
    case "pending":
      return `${base} bg-yellow-500 animate-pulse`;
    case "error":
      return `${base} bg-red-500`;
    case "skipped":
      return `${base} bg-gray-400`;
    default:
      return `${base} bg-gray-300`;
  }
};

export const TxStepper = ({ steps }: { steps: StepState[] }) => (
  <ol className="space-y-3 ">
    {steps.map(s => (
      <li key={s.id} className="flex items-center gap-3">
        <span className={dot(s.status)} />
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-900">
            {s.label}
            {s.status === "pending" && (
              <span className="ml-2 text-xs font-normal text-gray-500">Check your wallet…</span>
            )}
            {s.status === "skipped" && <span className="ml-2 text-xs font-normal text-gray-500">Already approved</span>}
          </div>
          {s.sublabel && <div className="text-xs text-gray-500">{s.sublabel}</div>}
          {s.error && <div className="text-xs text-red-600 mt-0.5">{s.error}</div>}
        </div>
      </li>
    ))}
  </ol>
);
