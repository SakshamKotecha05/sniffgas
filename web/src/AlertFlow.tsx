// D10 (plan.md Task 11): evacuation banner + an in-console view of the cited report.
import { useEffect, useState } from "react";
import type { Alert } from "./ws";

interface Props {
  alert: Alert | null;
  isCurrentEvacuation?: boolean;
  onAck: () => void;
}

interface IncidentReport {
  narrative?: string;
  structured?: {
    zone?: string;
    actions?: string[];
    clause_ids?: string[];
    timeline?: string[];
  };
}

const REPORT_REFRESH_MS = 1_500;
const REPORT_REFRESH_LIMIT = 21;

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0 fill-current">
      <path d="M12 2.5 1.8 20.2a1.5 1.5 0 0 0 1.3 2.3h17.8a1.5 1.5 0 0 0 1.3-2.3L12 2.5Zm0 5.3c.5 0 .9.4.9.9v5.4a.9.9 0 1 1-1.8 0V8.7c0-.5.4-.9.9-.9Zm0 10.2a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2Z" />
    </svg>
  );
}

function alertTime(ts: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(ts));
}

export default function AlertFlow({ alert, isCurrentEvacuation = true, onAck }: Props) {
  const [report, setReport] = useState<IncidentReport | null>(null);
  const [reportError, setReportError] = useState(false);
  const reportId = alert?.report_id;

  useEffect(() => {
    if (!reportId) {
      setReport(null);
      setReportError(false);
      return;
    }

    let mounted = true;
    setReport(null);
    setReportError(false);
    let refresh: number | null = null;
    const stopRefresh = () => {
      if (refresh != null) {
        window.clearInterval(refresh);
        refresh = null;
      }
    };
    const loadReport = async () => {
      try {
        const response = await fetch(`/reports/${reportId}`);
        if (!response.ok) throw new Error("report unavailable");
        const next = (await response.json()) as IncidentReport;
        if (mounted) {
          setReport(next);
          setReportError(false);
          // Z1's recorded demo uses an immutable, already-cited rehearsal
          // report. Stop here; only an uncited fallback needs an upgrade poll.
          if ((next.structured?.clause_ids?.length ?? 0) > 0) stopRefresh();
        }
      } catch {
        if (mounted) setReportError(true);
      }
    };

    void loadReport();
    let refreshes = 0;
    refresh = window.setInterval(() => {
      refreshes += 1;
      void loadReport();
      if (refreshes >= REPORT_REFRESH_LIMIT) stopRefresh();
    }, REPORT_REFRESH_MS);
    return () => {
      mounted = false;
      stopRefresh();
    };
  }, [reportId]);

  if (!alert) return null;

  const citationIds = report?.structured?.clause_ids ?? [];
  const actions = report?.structured?.actions ?? [];
  const reportStatus = citationIds.length
    ? `CITED REPORT · ${citationIds.length} SPAN${citationIds.length === 1 ? "" : "S"}`
    : "PREPARED FALLBACK";
  const briefingLabel = isCurrentEvacuation ? "Active evacuation response briefing" : "Prior evacuation briefing";
  const bannerLabel = isCurrentEvacuation ? "EVACUATION RESPONSE" : "PRIOR ALARM";
  const reportTitle = isCurrentEvacuation ? "Response recommendation" : "Prior response brief";

  return (
    <section className="incident-flow" aria-label={briefingLabel}>
      <div
        data-testid="alert-banner"
        role="alert"
        className="incident-banner motion-reduce:animate-none"
      >
        <div className="incident-icon"><WarningIcon /></div>
        <div className="incident-message">
          <span>{bannerLabel} · Zone {alert.zone}</span>
          <small>Compound risk {alert.compound.toFixed(2)} · {alertTime(alert.ts)}</small>
        </div>
        <button
          data-testid="alert-ack"
          onClick={onAck}
          aria-label="Dismiss briefing from this display"
          title="Dismiss this briefing from the current display"
          className="ack-button"
        >
          Dismiss briefing
        </button>
      </div>

      <section
        data-testid="incident-report"
        aria-live="polite"
        className="incident-report-panel"
      >
        {report ? (
          <>
            <div className="incident-report-heading">
              <div>
                <p className="eyebrow">Response brief</p>
                <h2>{reportTitle}</h2>
              </div>
              <span data-testid="report-status" className={`report-status ${citationIds.length ? "report-status-cited" : "report-status-fallback"}`}>
                {reportStatus}
              </span>
            </div>
            <p className="incident-narrative">{report.narrative ?? "Report details are being prepared."}</p>
            {actions.length > 0 && (
              <ul className="incident-actions" aria-label="Recommended actions">
                {actions.map((action) => (
                  <li key={action}>
                    {action}
                  </li>
                ))}
              </ul>
            )}
            {citationIds.length > 0 && (
              <p className="incident-citations">
                Citation spans · {citationIds.map((id) => `[${id}]`).join(" ")}
              </p>
            )}
          </>
        ) : (
          <p className="incident-loading">
            {reportError ? "Report sync is unavailable; the response briefing remains active." : "Loading response brief…"}
          </p>
        )}
      </section>
    </section>
  );
}
