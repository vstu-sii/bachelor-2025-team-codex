"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function NavItem({ href, children, active }) {
  return (
    <Link
      href={href}
      className={[
        "relative rounded-full px-3 py-1.5 text-xs md:text-sm transition-colors",
        "text-slate-300 hover:text-sky-300 hover:bg-slate-800/60",
        active ? "text-sky-200 bg-slate-800/70 ring-1 ring-slate-700" : "",
      ].join(" ")}
    >
      {children}
      {active && (
        <span className="absolute -bottom-1 left-1/2 h-[3px] w-8 -translate-x-1/2 rounded-full bg-sky-500/70" />
      )}
    </Link>
  );
}

function AuthButton({ href, children }) {
  return (
    <Link
      href={href}
      className="rounded-full px-3 py-1.5 text-xs md:text-sm font-semibold bg-emerald-600/90 hover:bg-emerald-500 text-white ring-1 ring-emerald-500/40 transition-colors"
    >
      {children}
    </Link>
  );
}

export default function Navbar() {
  const pathname = usePathname();

  const isActive = (href) => {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/75 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 ring-1 ring-sky-500/20">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-400/80" />
          </span>
          <div className="leading-tight">
            <div className="text-sm md:text-base font-semibold text-slate-100 group-hover:text-sky-200 transition-colors">
              Auto-Flashcards
            </div>
            <div className="text-[10px] md:text-xs text-slate-400">
              MVP · Next.js + FastAPI
            </div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-2">
          <NavItem href="/" active={isActive("/")}>Главная</NavItem>
          <NavItem href="/review" active={isActive("/review")}>Повторение</NavItem>
          <NavItem href="/stats" active={isActive("/stats")}>Статистика</NavItem>
          <NavItem href="/profile" active={isActive("/profile")}>Профиль</NavItem>
        </nav>

        <div className="flex items-center gap-2">
          <div className="md:hidden flex items-center gap-1">
            <NavItem href="/" active={isActive("/")}>Home</NavItem>
            <NavItem href="/review" active={isActive("/review")}>Review</NavItem>
          </div>

          <span className="hidden sm:inline-block h-6 w-px bg-slate-800 mx-1" />

          <Link
            href="/login"
            className="rounded-full px-3 py-1.5 text-xs md:text-sm text-slate-200 hover:text-emerald-200 hover:bg-slate-800/60 ring-1 ring-slate-800 transition-colors"
          >
            Вход
          </Link>

          <AuthButton href="/register">Регистрация</AuthButton>
        </div>
      </div>
    </header>
  );
}
