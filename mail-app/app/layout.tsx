import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Nexatech Student Mail",
  description: "Student email portal for Nexatech University",
  icons: {
    icon: [
      { url: "/images/logo-text-only-white-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/images/logo-text-only-white-128x128.png", sizes: "128x128", type: "image/png" },
    ],
    apple: [{ url: "/images/logo-text-only-white-512x512.png", sizes: "512x512", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}
