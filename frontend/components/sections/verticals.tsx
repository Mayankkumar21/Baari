"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  Stethoscope,
  Bone,
  Scissors,
  Flower,
  PawPrint,
  Store,
  type LucideIcon,
} from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://baariprod.vercel.app";

type Vertical = {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

// `Bone` is the closest Lucide glyph to a tooth — readable at small size.
// Swap to a custom SVG later if we want a true tooth icon.
const VERTICALS: Vertical[] = [
  { key: "clinic", label: "Clinic", description: "Homeopathy, GP, paediatrics, physio.", icon: Stethoscope },
  { key: "dental", label: "Dental", description: "Dentist, orthodontist.", icon: Bone },
  { key: "salon",  label: "Salon",  description: "Hair, beauty, nails, barbershop.", icon: Scissors },
  { key: "spa",    label: "Spa",    description: "Massage, wellness, day spa.", icon: Flower },
  { key: "vet",    label: "Vet",    description: "Veterinary clinic.", icon: PawPrint },
  { key: "other",  label: "Other",  description: "Any appointment-based business.", icon: Store },
];

export function Verticals() {
  return (
    <section className="container -mt-2 pb-24">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.04 } },
        }}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6"
      >
        {VERTICALS.map(({ key, label, description, icon: Icon }) => (
          <motion.div
            key={key}
            variants={{
              hidden: { opacity: 0, y: 12 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
            }}
          >
            <Link
              href={`${BACKEND_URL}/signup?type=${key}`}
              title={description}
              className="group block h-full rounded-xl border border-border bg-card/70 p-4 text-center backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:bg-card hover:shadow-lg hover:shadow-primary/10"
            >
              <Icon className="mx-auto size-6 text-primary transition-transform group-hover:scale-110" />
              <div className="mt-2 text-sm font-semibold">{label}</div>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
