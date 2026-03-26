import type { Metadata } from "next";
import { EB_Garamond, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/app/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cvSerif = EB_Garamond({
  variable: "--font-cv-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CV Processor",
  description: "Enhance a hardcoded CV for a target job description.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${cvSerif.variable} antialiased`}
      >
        {children}
        <Providers />
      </body>
    </html>
  );
}
