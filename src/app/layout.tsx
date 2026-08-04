import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { BottomNav } from "@/components/BottomNav";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ParentCare",
  description: "Track your parents' health — lab reports, reminders, caregiving.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ParentCare",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2d7a6e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="bg-app-gradient min-h-screen text-foreground antialiased">
        <Providers>
          <div className="mx-auto max-w-2xl lg:max-w-5xl min-h-screen flex flex-col">
            {children}
          </div>
          <BottomNav />
          <Toaster richColors position="top-center" />
        </Providers>
      </body>
    </html>
  );
}
