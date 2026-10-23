"use client";

import { LOCALES } from "@/i18n/locales";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/utils";

/** Landing language switch: English, Tamil, Hindi, Malayalam, Kannada, Telugu. */
export function LanguagePicker() {
  const { locale, setLocale } = useI18n();
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Language" data-language={locale}>
      {LOCALES.map((item) => (
        <button
          key={item.id}
          type="button"
          role="radio"
          aria-checked={locale === item.id}
          onClick={() => setLocale(item.id)}
          className={cn(
            "indic rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors",
            locale === item.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card/80 text-muted-foreground hover:text-foreground",
          )}
        >
          {item.native}
        </button>
      ))}
    </div>
  );
}
