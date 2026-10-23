"use client";

import { motion } from "motion/react";
import { BookOpen, Clock, Gamepad2, Lightbulb, Target, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { GameIcon } from "@/components/game/GameIcon";
import { GUIDES } from "@/games/guides";
import { useI18n } from "@/hooks/useI18n";
import { playerRange } from "@/games/registry";
import type { GameMeta } from "@/games/types";

function Section({ icon, title, children, delay }: { icon: ReactNode; title: string; children: ReactNode; delay: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="grid gap-2"
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</span>
        {title}
      </h3>
      {children}
    </motion.section>
  );
}

/** Guide content for one game. Reusable in a sheet, dialog or page. */
export function GameGuideContent({ meta }: { meta: GameMeta }) {
  const guide = GUIDES[meta.id];
  return (
    <div className="grid gap-6 pb-6">
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${meta.accent} p-5 text-white`}>
        <GameIcon id={meta.id} className="absolute -top-2 -right-1 size-28 text-white opacity-30" />
        <p className="text-sm/relaxed opacity-95">{meta.tagline}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="secondary" className="bg-white/20 text-white">
            <Users /> {playerRange(meta)}
          </Badge>
          <Badge variant="secondary" className="bg-white/20 text-white">
            <Clock /> {meta.duration} min
          </Badge>
          <Badge variant="secondary" className="bg-white/20 text-white">
            {meta.difficulty}
          </Badge>
        </div>
      </div>

      {guide && (
        <Section icon={<Target className="size-4" />} title="Goal" delay={0.05}>
          <p className="text-sm text-muted-foreground">{guide.goal}</p>
        </Section>
      )}

      <Section icon={<BookOpen className="size-4" />} title="Rules" delay={0.1}>
        <ol className="grid gap-2">
          {meta.rules.map((rule, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold">{i + 1}</span>
              <span className="pt-0.5 text-muted-foreground">{rule}</span>
            </li>
          ))}
        </ol>
      </Section>

      {guide && (
        <>
          <Section icon={<Gamepad2 className="size-4" />} title="How to play here" delay={0.15}>
            <ul className="grid gap-1.5 text-sm text-muted-foreground">
              {guide.controls.map((c, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-primary">•</span>
                  {c}
                </li>
              ))}
            </ul>
          </Section>
          <Section icon={<Lightbulb className="size-4" />} title="Tips" delay={0.2}>
            <ul className="grid gap-2">
              {guide.tips.map((t, i) => (
                <li key={i} className="rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                  💡 {t}
                </li>
              ))}
            </ul>
          </Section>
          {guide.terms && (
            <Section icon={<span className="tamil text-xs font-bold">அ</span>} title="Words to know" delay={0.25}>
              <dl className="grid gap-2 text-sm">
                {guide.terms.map((t) => (
                  <div key={t.term} className="flex gap-2">
                    <dt className="shrink-0 font-semibold">{t.term}</dt>
                    <dd className="text-muted-foreground">: {t.meaning}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

type Props = { meta: GameMeta; trigger?: React.ReactElement; label?: string; iconOnly?: boolean };

/** "How to play" side sheet; bottom sheet on phones. */
export function HowToPlay({ meta, trigger, label = "How to play", iconOnly }: Props) {
  const text = useI18n().game(meta);
  return (
    <Sheet>
      <SheetTrigger
        nativeButton={!trigger}
        render={
          trigger ?? (
            <Button variant="outline" size="sm" data-tour="guide" aria-label={iconOnly ? `How to play ${meta.name}` : undefined} />
          )
        }
      >
        {!trigger && (
          <>
            <BookOpen /> {!iconOnly && label}
          </>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <GameIcon id={meta.id} className="size-7" /> {text.title}
            {text.subtitle && <span className="indic text-sm font-normal text-muted-foreground">{text.subtitle}</span>}
          </SheetTitle>
          <SheetDescription>How to play</SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-4">
            <GameGuideContent meta={meta} />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
