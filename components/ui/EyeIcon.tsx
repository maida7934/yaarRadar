"use client";

/** Standard stroke-based eye / eye-off toggle icon (not the pixel-art style
 * used elsewhere in this UI) -- open eye when the password is visible, eye
 * with a slash through it when hidden. */
export function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      {open ? (
        <>
          <path
            d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"
            stroke="#6b403b"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={12} cy={12} r={3} stroke="#6b403b" strokeWidth={2} />
        </>
      ) : (
        <>
          <path
            d="M3 3l18 18"
            stroke="#6b403b"
            strokeWidth={2}
            strokeLinecap="round"
          />
          <path
            d="M10.58 5.14A10.6 10.6 0 0 1 12 5c7 0 11 7 11 7a17.6 17.6 0 0 1-3.22 4.19M6.5 6.61C3.55 8.36 1 12 1 12s4 7 11 7a10.3 10.3 0 0 0 4.24-.9"
            stroke="#6b403b"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9.9 9.9A3 3 0 0 0 12 15a3 3 0 0 0 2.1-.9"
            stroke="#6b403b"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}
