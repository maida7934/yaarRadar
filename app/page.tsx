"use client";

import dynamic from "next/dynamic";

// FindScene renders Framer Motion transforms (e.g. sprite rotation) that
// have a real value from the very first render, since they depend on
// position, not on whether the walk simulation is running. Framer's own
// runtime-applied value and the SSR-rendered string differ in floating-
// point precision, which React's hydration check flags even though the
// angle is visually identical -- skipping SSR for this fully client-side,
// mock-data-driven scene avoids that class of mismatch entirely.
const FindScene = dynamic(() => import("@/components/scene/FindScene").then((m) => m.FindScene), {
  ssr: false,
});

export default function Home() {
  return (
    <div className="flex flex-1 w-full h-full bg-zinc-50 dark:bg-black">
      <FindScene />
    </div>
  );
}
