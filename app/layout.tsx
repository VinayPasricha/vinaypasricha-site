import type { Metadata } from "next";
import { Fraunces, Newsreader, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Masthead from "@/components/Masthead";
import Colophon from "@/components/Colophon";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz", "SOFT", "WONK"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vinay Pasricha — A Quarterly of Thought",
  description:
    "A personal record of writings, projects, books and philosophy by Vinay Pasricha.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${newsreader.variable} ${jetbrains.variable} h-full antialiased`}
      style={{
        // map next/font vars to our theme tokens
        // @ts-expect-error – CSS variables aren't typed in React style
        "--font-display": "var(--font-fraunces)",
        "--font-body": "var(--font-newsreader)",
        "--font-mono": "var(--font-jetbrains)",
      }}
    >
      <body className="min-h-full flex flex-col">
        <Masthead />
        <main className="flex-1">{children}</main>
        <Colophon />
      </body>
    </html>
  );
}
