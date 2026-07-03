import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Devanagari } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const noto = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-noto-devanagari",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

// Viewport tuning — device-width covers all mobile browsers; viewport-fit=cover
// pushes background under the notch on iOS so the app feels native when
// installed as a PWA. maximum-scale=5 keeps pinch-zoom for accessibility
// (fully disabling it hurts users who need to zoom).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export const metadata: Metadata = {
  title: "Baari — queue and bookings, one screen",
  description:
    "The paper register your front desk replaces. A live queue and booking dashboard for clinics, salons, and any appointment-based business.",
  manifest: "/manifest.webmanifest",
  // PWA polish for iOS Safari — "Add to Home Screen" installs it as a
  // standalone app that opens without the browser chrome. Android/Chrome
  // reads the manifest for the same behaviour.
  appleWebApp: {
    capable: true,
    title: "Baari",
    statusBarStyle: "default",
  },
  applicationName: "Baari",
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${noto.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
