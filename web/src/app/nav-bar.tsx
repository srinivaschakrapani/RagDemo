"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/about-data", label: "About Data" },
  { href: "/", label: "Intuition" },
  { href: "/data-preparation", label: "Data Preparation" },
  { href: "/chunking", label: "Chunking" },
  { href: "/vector", label: "Vector RAG" },
  { href: "/pageindex", label: "Vectorless RAG" },
  { href: "/compare", label: "Compare" },
] as const;

export default function NavBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-surface-border bg-surface/80 backdrop-blur-sm">
      <nav className="mx-auto flex max-w-4xl items-center gap-1 px-6 py-3">
        <span className="mr-3 bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-sm font-bold text-transparent">
          Vector RAG · Vectorless RAG
        </span>
        <div className="flex flex-1 gap-1">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-gradient-to-r from-accent to-accent-2 text-white shadow-sm"
                    : "text-foreground/60 hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
