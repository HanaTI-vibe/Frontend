import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "L2Q",
  description: "AI가 만든 문제로 친구들과 함께 공부하세요",
  openGraph: {
    title: "L2Q",
    description: "AI가 만든 문제로 친구들과 함께 공부하세요",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
