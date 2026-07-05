"use client";

// First-signup coach-mark tour for /queue. Renders a full-screen
// spotlight overlay + a step tooltip anchored to the highlighted
// element. Persists dismissal server-side (users.onboardedAt) so it
// doesn't come back on the next login.
//
// Steps target elements by data-tour-id attribute on the queue page
// so the tour doesn't need to know CSS structure — the queue owns
// which node each step points at.

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dismissOnboardingTour } from "./onboarding-actions";

type Step = {
  targetId: string;              // matches [data-tour-id="..."]
  title: string;
  body: string;
  placement?: "top" | "bottom";  // where tooltip sits relative to target
};

const STEPS: Step[] = [
  {
    targetId: "counters",
    title: "This is your queue",
    body:
      "Today's bookings live here. Counters at the top show waiting, in-session, done, and running-late in real time.",
    placement: "bottom",
  },
  {
    targetId: "new-booking",
    title: "Add a walk-in or new booking",
    body:
      "For someone who just showed up at the counter, use Walk in. For a phone booking, use New booking.",
    placement: "bottom",
  },
  {
    targetId: "settings-link",
    title: "Finish setting up",
    body:
      "Head to Settings to set your opening hours, add a recovery email you can verify, and turn on public app bookings so customers can find you.",
    placement: "bottom",
  },
  {
    targetId: "close-day",
    title: "Wrap up at end of day",
    body:
      "Close day converts today's remaining pending bookings to no-shows and stamps the summary. Come back tomorrow to a fresh queue.",
    placement: "top",
  },
];

export function OnboardingTour({ initialShow }: { initialShow: boolean }) {
  const [show, setShow] = useState(initialShow);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [pending, startDismiss] = useTransition();
  const [portalHost, setPortalHost] = useState<Element | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setPortalHost(document.body);
  }, []);

  const step = STEPS[stepIdx];

  // Locate the target element and track its position through scrolls
  // and viewport resizes. Uses rAF-loop so a scroll while the tour is
  // open keeps the spotlight glued to its target.
  useEffect(() => {
    if (!show || !step) return;
    let cancelled = false;
    const measure = () => {
      const el = document.querySelector(`[data-tour-id="${step.targetId}"]`);
      if (el) {
        const r = (el as HTMLElement).getBoundingClientRect();
        setRect(r);
      } else {
        setRect(null);
      }
      if (!cancelled) rafRef.current = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", measure);
    };
  }, [show, step]);

  const finish = () => {
    setShow(false);
    startDismiss(async () => {
      await dismissOnboardingTour();
    });
  };

  if (!show || !step || !portalHost) return null;

  // Padding around the target so the spotlight has breathing room.
  const PAD = 8;
  const spotlight = rect
    ? {
        top: Math.max(0, rect.top - PAD),
        left: Math.max(0, rect.left - PAD),
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  // Position the tooltip below the target by default, above if
  // requested or if there's no room below.
  const TOOLTIP_H = 190;
  const TOOLTIP_W = 340;
  let tooltipStyle: React.CSSProperties = {
    // Fallback: centered mid-screen when the target isn't measurable
    // (e.g. behind a scroll container we can't reach).
    left: `calc(50% - ${TOOLTIP_W / 2}px)`,
    top: `calc(50% - ${TOOLTIP_H / 2}px)`,
    width: TOOLTIP_W,
  };
  if (spotlight) {
    const preferTop =
      step.placement === "top" ||
      spotlight.top + spotlight.height + TOOLTIP_H + 24 > window.innerHeight;
    if (preferTop) {
      tooltipStyle = {
        top: Math.max(16, spotlight.top - TOOLTIP_H - 16),
        left: Math.max(
          16,
          Math.min(
            window.innerWidth - TOOLTIP_W - 16,
            spotlight.left + spotlight.width / 2 - TOOLTIP_W / 2,
          ),
        ),
        width: TOOLTIP_W,
      };
    } else {
      tooltipStyle = {
        top: spotlight.top + spotlight.height + 16,
        left: Math.max(
          16,
          Math.min(
            window.innerWidth - TOOLTIP_W - 16,
            spotlight.left + spotlight.width / 2 - TOOLTIP_W / 2,
          ),
        ),
        width: TOOLTIP_W,
      };
    }
  }

  const isLast = stepIdx === STEPS.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-[200] pointer-events-none">
      {/* Dark backdrop with a cut-out around the target. Achieved via
          two overlays: a full-screen dim + a positioned "hole" that
          uses box-shadow to darken everything around it. */}
      {spotlight ? (
        <div
          className="pointer-events-auto absolute rounded-lg ring-4 ring-primary/60 transition-all duration-200"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
          }}
        />
      ) : (
        <div className="pointer-events-auto absolute inset-0 bg-black/60" />
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="pointer-events-auto absolute rounded-xl border border-border bg-card p-5 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200"
        style={tooltipStyle}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Step {stepIdx + 1} of {STEPS.length}
            </div>
            <h3
              id="onboarding-title"
              className="pt-1 text-base font-semibold text-foreground"
            >
              {step.title}
            </h3>
          </div>
          <button
            type="button"
            aria-label="Skip tour"
            onClick={finish}
            disabled={pending}
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={finish}
            disabled={pending}
            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            Skip
          </button>
          <div className="flex items-center gap-2">
            {stepIdx > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStepIdx((i) => i - 1)}
                disabled={pending}
              >
                Back
              </Button>
            ) : null}
            {isLast ? (
              <Button
                type="button"
                variant="glow"
                size="sm"
                onClick={finish}
                disabled={pending}
              >
                Got it
              </Button>
            ) : (
              <Button
                type="button"
                variant="glow"
                size="sm"
                onClick={() => setStepIdx((i) => i + 1)}
                disabled={pending}
              >
                Next <ArrowRight className="size-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    portalHost,
  );
}
