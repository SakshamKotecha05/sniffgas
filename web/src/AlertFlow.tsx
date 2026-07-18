// D10 (plan.md Task 11): evacuation banner + acknowledge, links the cited report.
import type { Alert } from "./ws";

interface Props {
  alert: Alert | null;
  onAck: () => void;
}

export default function AlertFlow({ alert, onAck }: Props) {
  if (!alert) return null;
  return (
    <div
      data-testid="alert-banner"
      role="alert"
      className="mb-4 flex flex-wrap items-center gap-4 rounded-lg bg-red-600 px-4 py-3 text-white shadow-lg animate-pulse"
    >
      <span className="text-lg font-bold">⚠ EVACUATION — Zone {alert.zone}</span>
      <span className="text-sm opacity-90">
        compound risk {alert.compound.toFixed(2)} ·{" "}
        {new Date(alert.ts).toLocaleTimeString()}
      </span>
      <a
        data-testid="alert-report-link"
        href={`/reports/${alert.report_id}`}
        target="_blank"
        rel="noreferrer"
        className="underline"
      >
        Incident report
      </a>
      <button
        data-testid="alert-ack"
        onClick={onAck}
        className="ml-auto rounded bg-white/20 px-3 py-1 text-sm font-semibold hover:bg-white/30"
      >
        Acknowledge
      </button>
    </div>
  );
}
