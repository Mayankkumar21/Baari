import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Devanagari } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { PostHogProvider } from "@/components/posthog-provider";
import { getSession } from "@/lib/session";
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
  title: "Baari — know your business, grow your business",
  description:
    "Baari runs your front desk queue, walk-ins, and bookings — then quietly turns every visit into the picture your paper register never could. Silent-churn list, category revenue, cohort retention. For clinics, salons, and any appointment-based business.",
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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Read the session server-side so we can hand a stable identity to
  // PostHog on first paint. Null when not signed in — provider stays
  // anonymous until the next navigation after login.
  const sess = await getSession();
  const identity = sess
    ? {
        userId: sess.user.id,
        clinicId: sess.clinic.id,
        role: sess.user.role,
        name: sess.user.name,
        mobile: sess.user.mobile,
      }
    : null;

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
          <PostHogProvider identity={identity}>{children}</PostHogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
