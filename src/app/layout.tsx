import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Tamil } from "next/font/google";
import { AppProviders } from "@/components/providers/AppProviders";
import { APP } from "@/config/constants";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const notoTamil = Noto_Sans_Tamil({ variable: "--font-noto-tamil", subsets: ["tamil"], weight: ["400", "600", "700"] });

export const metadata: Metadata = {
  title: `${APP.NAME} · Play together`,
  description: "Play Pallanguzhi, Aadu Puli, Hand Cricket, Chess, Rummy and more with friends. No sign-up, just share a code.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf7f0" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1712" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${notoTamil.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col no-tap-highlight">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
