"use client";

/**
 * Loading placeholders shaped like the content they stand in for.
 *
 * Every page here fetches on mount and the backend runs on Vercel
 * serverless, so a cold start can leave a screen showing the word
 * "Loading..." for seconds -- which reads as stuck rather than working.
 * These occupy the same footprint as the real cards, so the screen looks
 * like itself immediately and the swap doesn't shift the layout.
 *
 * Styling lives in globals.css (.px-skeleton) so the stepped pulse and its
 * reduced-motion opt-out are defined once.
 */
export function Skeleton({
  width,
  height,
  radius = 6,
  className = "",
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`px-skeleton ${className}`}
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden
    />
  );
}

/** Stand-in for the Friends page's character grid. */
export function FriendGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4" role="status" aria-label="Loading friends">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col items-center gap-2 p-3">
          <Skeleton width={56} height={56} radius={28} />
          <Skeleton width="70%" height={12} />
        </div>
      ))}
    </div>
  );
}

/** Stand-in for a list of user rows (search results, friend requests). */
export function UserRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton width={56} height={56} radius={28} />
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            <Skeleton width="55%" height={14} />
            <Skeleton width="35%" height={10} />
          </div>
          <Skeleton width={64} height={28} radius={8} />
        </div>
      ))}
    </div>
  );
}
