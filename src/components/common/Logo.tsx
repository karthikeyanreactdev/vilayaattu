"use client";

import Link from "next/link";
import { APP, ROUTES } from "@/config/constants";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/utils";

/** Brand mark: a kolam-inspired dot grid inside a rounded tile. */
export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  const { locale } = useI18n();
  return (
    <Link href={ROUTES.HOME} className={cn("group flex items-center gap-2.5", className)} aria-label={`${APP.NAME} home`}>
      <span className="relative grid size-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-orange-600 shadow-md shadow-primary/30 transition-transform group-hover:rotate-6">
        <svg viewBox="0 0 24 24" className="size-6 text-primary-foreground" aria-hidden>
          {[6, 12, 18].flatMap((x) => [6, 12, 18].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r={1.4} fill="currentColor" />))}
          <path
            d="M12 3.5 C16 7.5 16 7.5 20.5 12 C16 16.5 16 16.5 12 20.5 C8 16.5 8 16.5 3.5 12 C8 7.5 8 7.5 12 3.5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          />
        </svg>
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-lg font-extrabold tracking-tight">{APP.NAME}</span>
          {locale !== "en" && <span className="tamil text-[11px] text-muted-foreground">{APP.TAMIL_NAME}</span>}
        </span>
      )}
    </Link>
  );
}
