import type { Metadata, Viewport } from "next";
import { Geist, Trocchi } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ServiceWorkerRegister } from "@/components/sw-register";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const trocchi = Trocchi({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  variable: "--font-trocchi",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Bible Track",
    template: "%s · Bible Track",
  },
  description:
    "Create a personalized plan to read through the entire Bible. Track progress, read Scripture in-app, and get gentle reminders.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bible Track",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff8f5" },
    { media: "(prefers-color-scheme: dark)", color: "#17120e" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`min-h-dvh antialiased ${geist.variable} ${trocchi.variable}`}
      >
        <ThemeProvider>{children}</ThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
