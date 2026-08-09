"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function TabBar() {
  const pathname = usePathname();
  
  const tabs = [
    { icon: "px-icon-home",    label: "HOME",    id: "home",    href: "/" },
    { icon: "px-icon-me",      label: "ME",      id: "me",      href: "/me" },
    { icon: "px-icon-friends", label: "FRIENDS", id: "friends", href: "/friends" },
    { icon: "px-icon-search",  label: "SEARCH",  id: "search",  href: "/search" },
  ];

  return (
    <nav
      className="absolute bottom-0 left-0 right-0 z-30 flex px-tab-bar"
      style={{ height: 68 }}
    >
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;

        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`px-tab${isActive ? " active" : ""}`}
            style={{ textDecoration: "none" }}
          >
            <span className={`px-icon ${tab.icon}`} aria-hidden />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
