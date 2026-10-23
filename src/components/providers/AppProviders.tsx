"use client";

import { useEffect, type ReactNode } from "react";
import { Provider } from "react-redux";
import { ThemeProvider } from "next-themes";
import { Toaster } from "react-hot-toast";
import { MotionConfig } from "motion/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { THEME } from "@/config/theme";
import { soundEngine } from "@/lib/audio/soundEngine";
import { makeStore, useAppDispatch, useAppSelector, type AppStore } from "@/store";
import { hydrateUser } from "@/store/slices/userSlice";
import { hydrateSettings } from "@/store/slices/settingsSlice";

/** Loads saved profile/settings and keeps the sound engine in sync. */
function Bootstrap() {
  const dispatch = useAppDispatch();
  const { sfx, hydrated } = useAppSelector((s) => s.settings);

  useEffect(() => {
    dispatch(hydrateUser());
    dispatch(hydrateSettings());
  }, [dispatch]);

  useEffect(() => {
    if (!hydrated) return;
    soundEngine.setSfx(sfx);
    soundEngine.setMusic(false);
  }, [sfx, hydrated]);

  // Browsers only allow audio after a user gesture.
  useEffect(() => {
    const unlock = () => soundEngine.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  return null;
}

/**
 * One store per browser tab. It's created at module load (not during render) so
 * prerendering stays deterministic; the server only ever renders initial state.
 */
const store: AppStore = makeStore();

export function AppProviders({ children }: { children: ReactNode }) {

  return (
    <Provider store={store}>
      <ThemeProvider
        attribute={THEME.ATTRIBUTE}
        defaultTheme={THEME.DEFAULT_MODE}
        enableSystem
        disableTransitionOnChange
      >
        <MotionConfig reducedMotion="user">
          <TooltipProvider>
            <Bootstrap />
            {children}
            <Toaster
              position="top-center"
              toastOptions={{
                className: "!bg-popover !text-popover-foreground !border !border-border !shadow-lg !rounded-xl !text-sm",
                duration: 2600,
              }}
            />
          </TooltipProvider>
        </MotionConfig>
      </ThemeProvider>
    </Provider>
  );
}
