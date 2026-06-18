"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";


export function CtaClosing() {
  return (
    <section className="container pb-28">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative isolate overflow-hidden rounded-3xl border border-border bg-card/60 px-6 py-16 text-center backdrop-blur-xl sm:px-12"
      >
        <div className="orb left-[20%] top-[-30%] h-[260px] w-[260px] bg-primary/30" />
        <div className="orb right-[15%] bottom-[-40%] h-[280px] w-[280px] bg-primary/25" />

        <h2 className="relative text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          Set up in under a minute.
        </h2>
        <p className="relative mx-auto mt-3 max-w-md text-balance text-muted-foreground">
          Name your business, pick your shift hours, start booking. No installs, no training.
        </p>
        <div className="relative mt-8">
          <Button variant="glow" size="xl" asChild>
            <Link href={`/signup`}>
              Start for free <ArrowRight className="size-5" />
            </Link>
          </Button>
        </div>
      </motion.div>
    </section>
  );
}
