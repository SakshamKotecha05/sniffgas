import type { Level, RiskState } from "./ws";

type RiskDisplayInput = {
  level?: Level | null;
  state?: RiskState | null;
  ppm?: number | null;
};

export type RiskDisplayTone = "normal" | "watch" | "alarm" | "unknown";

export type RiskDisplayStatus = {
  label: string;
  detail: string;
  tone: RiskDisplayTone;
};

export function resolvedRiskState({ level, state }: RiskDisplayInput): RiskState | null {
  return state ?? (level === "red" ? "ALARM" : level === "amber" ? "WATCH" : level === "green" ? "NORMAL" : null);
}

export function operationalStatus(input: RiskDisplayInput): RiskDisplayStatus {
  const state = resolvedRiskState(input);
  const atOrAboveStel = input.ppm != null && input.ppm >= 400;

  if (input.level === "red") {
    return {
      label: "ALARM · GAS CONFIRMED",
      detail: "Compound risk is confirmed by the gas gate.",
      tone: "alarm",
    };
  }

  if (input.level === "amber") {
    if (state === "ALARM") {
      return {
        label: "WATCH · GAS CONFIRMED",
        detail: "Gas evidence is confirmed; compound escalation is currently WATCH.",
        tone: "watch",
      };
    }
    if (atOrAboveStel) {
      return {
        label: "WATCH · GAS ELEVATED",
        detail: "CO is at or above STEL 400; compound fusion remains WATCH while it confirms the condition.",
        tone: "watch",
      };
    }
    if (state === "WATCH") {
      return {
        label: "WATCH · EARLY ADVISORY",
        detail: input.ppm == null ? "Context risk is elevated." : "Context risk is elevated while CO remains below STEL 400.",
        tone: "watch",
      };
    }
    return {
      label: "WATCH · LEVEL ELEVATED",
      detail: "Compound risk has reached the WATCH operating band.",
      tone: "watch",
    };
  }

  if (input.level === "green") {
    if (atOrAboveStel) {
      return {
        label: "CO ELEVATED · NO ADVISORY",
        detail: "CO is at or above STEL 400; compound fusion has no active advisory.",
        tone: "watch",
      };
    }
    return {
      label: "NORMAL · LIVE SCORE",
      detail: "No active advisory on the focused zone.",
      tone: "normal",
    };
  }

  return {
    label: "AWAITING LIVE FEED",
    detail: "No zone score has arrived. Unknown is never shown as safe.",
    tone: "unknown",
  };
}
