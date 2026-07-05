"use client";

import { motion } from "motion/react";
import { BarChart3, Globe, Users } from "lucide-react";

type MiniFeature = {
  title: string;
  body: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

const ITEMS: MiniFeature[] = [
  {
    title: "Family sub-tokens",
    body: "When grandma brings the kids, attach them to one token.",
    icon: Users,
  },
  {
    title: "End-of-day report",
    body: "Bookings, no-shows, wait times, source breakdown — one page.",
    icon: BarChart3,
  },
  {
    title: "English + हिन्दी",
    body: "Customer-facing screens work in both scripts. Customer picks once.",
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
        className="grid gap-8 border-t border-border/60 pt-10 sm:grid-cols-3 sm:gap-6"
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
