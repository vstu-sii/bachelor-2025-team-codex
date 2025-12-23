import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "./_components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Auto-Flashcards — MVP прототип",
  description: "Учебный прототип системы авто-генерации флеш-карточек.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased text-slate-50`}
      >
        {/* Background */}
        <div className="min-h-screen flex flex-col bg-slate-950">
          <div className="pointer-events-none fixed inset-0 -z-10">
            <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_20%_10%,rgba(56,189,248,0.14),transparent_55%),radial-gradient(800px_circle_at_80%_20%,rgba(16,185,129,0.10),transparent_55%),radial-gradient(900px_circle_at_50%_90%,rgba(99,102,241,0.10),transparent_60%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,6,23,0.85),rgba(2,6,23,1))]" />
          </div>

          <Navbar />

          {/* Page content */}
          <main className="flex-1">
            <div className="max-w-6xl mx-auto px-4 py-8">{children}</div>
          </main>

          {/* Footer */}
          <footer className="border-t border-slate-800/80 bg-slate-950/60 backdrop-blur">
            <div className="max-w-6xl mx-auto px-4 py-4 text-[10px] md:text-xs text-slate-400 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <span>Auto-Flashcards — учебный MVP прототип</span>
              <span className="text-slate-500">
                Next.js · FastAPI · Supabase · OpenAI
              </span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
