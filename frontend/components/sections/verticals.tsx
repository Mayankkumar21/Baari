"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  Stethoscope,
  Scissors,
  Flower,
  PawPrint,
  Store,
} from "lucide-react";

import { Tooth } from "@/components/icons/tooth";


type Vertical = {
  key: string;
  label: string;
  scenario: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

const VERTICALS: Vertical[] = [
  {
    key: "clinic",
    label: "Clinic",
    scenario: "Homeopathy, GP, paediatrics. Walk-ins and bookings on the same queue.",
    icon: Stethoscope,
  },
  {
    key: "dental",
    label: "Dental",
    scenario: "Sequential chairs, follow-up patients, no double-bookings.",
    icon: Tooth,
  },
  {
    key: "salon",
    label: "Salon",
    scenario: "Track who's in the chair, who's next, who's still waiting.",
    icon: Scissors,
  },
  {
    key: "spa",
    label: "Spa",
    scenario: "Long sessions, multi-room, family appointments.",
    icon: Flower,
  },
  {
    key: "vet",
    label: "Vet",
    scenario: "Sick pets first, the queue knows.",
    icon: PawPrint,
  },
  {
    key: "other",
    label: "Other",
    scenario: "Any service where customers wait their turn.",
    icon: Store,
  },
];

export function Verticals() {
  return (
    <section className="container pb-20 pt-4 sm:pb-24">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mb-6 text-center"
      >
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Who Baari is for
        </div>
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.04 } },
        }}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
      >
        {VERTICALS.map(({ key, label, scenario, icon: Icon }) => (
          <motion.div
            key={key}
            variants={{
              hidden: { opacity: 0, y: 12 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
            }}
          >
            <Link
              href={`/signup?type=${key}`}
              title={scenario}
              className="group block h-full rounded-xl border border-border bg-card/70 p-4 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:bg-card hover:shadow-lg hover:shadow-primary/10"
            >
              <Icon className="size-5 text-primary transition-transform group-hover:scale-110" />
              <div className="mt-2.5 text-sm font-semibold">{label}</div>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{scenario}</p>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
