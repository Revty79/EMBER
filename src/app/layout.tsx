import type { Metadata } from "next";
import { Bree_Serif, Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const breeSerif = Bree_Serif({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "EMBER",
  description: "Enhanced Memory Backbone for Everyday Reasoning",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${nunito.variable} ${breeSerif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
