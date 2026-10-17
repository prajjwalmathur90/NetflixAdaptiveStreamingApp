import { ProcessingStatus } from "../api/client";

interface StatusBadgeProps {
  status: ProcessingStatus;
  size?: "sm" | "md";
}

const labels: Record<ProcessingStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
};

export default function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-badge--${status} status-badge--${size}`}>
      {labels[status]}
    </span>
  );
}
