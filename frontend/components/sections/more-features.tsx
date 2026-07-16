"use client";

import { motion } from "motion/react";
import { BarChart3, Coins, Globe, Search, Users } from "lucide-react";

type MiniFeature = {
  title: string;
  body: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

const ITEMS: MiniFeature[] = [
  {
    title: "Revenue that owns itself",
    body: "Type the amount at Mark Done. Baari sums it into daily / weekly / monthly totals so you finally know what you actually earned.",
    icon: Coins,
  },
  {
    title: "First-timers vs repeat",
    body: "Every visit tagged automatically. See what share of today's traffic is loyalty vs new business.",
    icon: BarChart3,
  },
  {
    title: "Customer memory",
    body: "Every past visit, no-show, and reason logged. Search by name or mobile — the whole history is one line away.",
    icon: Search,
  },
  {
    title: "Family bookings",
    body: "Grandma books for the grandson in two taps. Baari links the accounts so nothing falls off.",
    icon: Users,
  },
  {
    title: "Works on any phone",
    body: "Web + mobile. No install for the receptionist. Customers book from any browser.",
    icon: Globe,
  },
];

export function MoreFeatures() {
  return (
    <section className="container pb-20 sm:pb-24">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.06 } },
        }}
        className="grid gap-8 border-t border-border/60 pt-10 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3"
      >
        {ITEMS.map(({ title, body, icon: Icon }) => (
          <motion.div
            key={title}
            variants={{
              hidden: { opacity: 0, y: 10 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
            }}
            className="flex items-start gap-3"
          >
            <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <div className="text-sm font-semibold">{title}</div>
              <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
