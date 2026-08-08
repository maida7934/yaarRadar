import { FindScene } from "@/components/scene/FindScene";

export default function Home() {
  return (
    <div className="flex flex-1 justify-center bg-zinc-100 dark:bg-zinc-950">
      <div className="w-full max-w-md bg-zinc-50 dark:bg-black">
        <FindScene />
      </div>
    </div>
  );
}
