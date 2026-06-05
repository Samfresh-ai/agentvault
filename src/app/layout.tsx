import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "AgentVault",
  description: "Terminal 3 ADK hackathon demo for hierarchical agent authorization.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} bg-black text-zinc-100 antialiased`}>
        <nav className="border-b border-zinc-800 bg-zinc-950/90">
          <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-8">
            <Link className="font-mono text-lg font-semibold tracking-[0.18em] text-zinc-50" href="/">
              AGENTVAULT
            </Link>
            <div className="flex items-center gap-6 text-sm text-zinc-400">
              <Link className="hover:text-cyan-300" href="/">
                Dashboard
              </Link>
              <Link className="hover:text-cyan-300" href="/demo">
                Demo
              </Link>
              <Link className="hover:text-cyan-300" href="/audit">
                Audit
              </Link>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
