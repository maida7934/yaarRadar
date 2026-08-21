"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotchedFrame } from "@/components/ui/NotchedFrame";

export function TabBar() {
  const pathname = usePathname();

  // `size` is the icon's rendered height; `width` defaults to the same
  // value (square box) except where noted. nav-me-new.png's actual artwork
  // (a standing figure + heart) only fills a small, non-square slice of its
  // source canvas -- unlike the other three nav images, which are cropped
  // close to their content already -- so squaring it off at the same box
  // size as its siblings rendered it visibly smaller than them. Using the
  // pre-cropped nav-me-cropped.png (trimmed to its real content bounds,
  // aspect ratio ~0.51) with an explicit width lets it render at its
  // natural proportions instead of being squashed into a square.
  const tabs = [
    { icon: "px-icon-home",    image: "/pixelated-icons/buttons/nav-home-clean.png", label: "HOME",    id: "home",    href: "/",        size: 28, width: 28, labelOffset: 0, iconOffset: 0 },
    { icon: "px-icon-me",      image: "/pixelated-icons/buttons/nav-me-cropped.png", label: "ME",      id: "me",      href: "/me",      size: 34, width: 18, labelOffset: 0, iconOffset: 0 },
    { icon: "px-icon-friends", image: "/pixelated-icons/buttons/nav-friends-new.png",label: "FRIENDS", id: "friends", href: "/friends", size: 28, width: 28, labelOffset: 0, iconOffset: 0 },
    { icon: "px-icon-search",  image: "/pixelated-icons/buttons/nav-search-new.png", label: "SEARCH",  id: "search",  href: "/search",  size: 28, width: 28, labelOffset: 0, iconOffset: 0 },
  ];

  return (
    <nav
      className="absolute bottom-0 left-0 right-0 z-30 flex"
      style={{ height: 76 }}
    >
      {/* Same staircase-notched frame technique as the rest of the app's
          boxes (code-drawn SVG, not an image), instead of the plain flat
          .px-tab-bar background/border. */}
      <NotchedFrame colors={["#8C6551", "#F3E8DB", "#fdf1e5"]} step={5} ringWidth={4} />
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;

        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`px-tab${isActive ? " active" : ""}`}
            style={{ textDecoration: "none" }}
          >
            {tab.image ? (
              <img src={tab.image} alt="" style={{ width: tab.width, height: tab.size, position: "relative", top: tab.iconOffset ?? 0, imageRendering: "pixelated" }} />
            ) : (
              <span className={`px-icon ${tab.icon}`} aria-hidden />
            )}
            <span style={{ position: "relative", top: tab.labelOffset ?? 0 }}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
