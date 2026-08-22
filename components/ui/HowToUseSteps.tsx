"use client";

import { HOW_TO_USE_STEPS } from "@/lib/howToUse";

/**
 * The numbered how-to-use step list, shared verbatim by the popup shown on
 * app open (HowToUsePopup) and the settings drawer's HOW TO USE panel --
 * one component so the two can't render the same copy differently.
 *
 * Each step is a filled sage heading bar (number + heading) with its detail
 * sentence underneath. The heading deliberately gets its own line and its
 * own background rather than sitting inline with the detail: run together
 * as one "1. HEADING -- detail" paragraph, five steps read as an
 * undifferentiated block of pixel text with no scannable structure.
 */
export function HowToUseSteps({ compact = false }: { compact?: boolean }) {
  return (
    <ol className="flex flex-col" style={{ gap: compact ? 12 : 14, margin: 0, padding: 0, listStyle: "none" }}>
      {HOW_TO_USE_STEPS.map((step, i) => (
        <li key={step.heading} className="flex flex-col" style={{ gap: 6 }}>
          {/* Heading bar -- sage fill + brown outline, the same accent pair
              the drawer's buttons and the popup's X use. */}
          <div
            className="flex items-center"
            style={{
              gap: 7,
              padding: "5px 8px",
              backgroundColor: "#bfc08e",
              border: "2px solid #8C6551",
              borderRadius: 6,
            }}
          >
            <span
              className="flex items-center justify-center shrink-0"
              style={{
                width: 16,
                height: 16,
                backgroundColor: "#fdf1e5",
                border: "2px solid #8C6551",
                borderRadius: 4,
                fontFamily: "var(--font-pixel)",
                fontSize: 9,
                fontWeight: 700,
                color: "#5a4632",
                lineHeight: 1,
              }}
              aria-hidden
            >
              {i + 1}
            </span>
            <span
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: 10,
                fontWeight: 700,
                color: "#4a3826",
                letterSpacing: "0.06em",
                lineHeight: 1.3,
              }}
            >
              {step.heading}
            </span>
          </div>

          {/* Detail -- indented under the bar, generous leading so five of
              these in a narrow drawer stay readable. */}
          <p
            style={{
              margin: 0,
              paddingLeft: 4,
              paddingRight: 2,
              fontFamily: "var(--font-pixel)",
              fontSize: 10,
              lineHeight: 1.8,
              color: "#6B4731",
            }}
          >
            {step.detail}
          </p>
        </li>
      ))}
    </ol>
  );
}
