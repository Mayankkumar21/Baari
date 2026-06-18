import * as React from "react";

/* A clean two-root tooth, drawn at Lucide's 24×24 viewBox + stroke
   conventions so it composes correctly inside the existing chips. */
export function Tooth({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M9.5 3a4 4 0 0 1 3.55 0 4 4 0 0 1 3.45 0c2 0 4 1.5 4 4 0 4-2 12-4.5 12s-2-5-3-5-.5 5-3 5-4.5-8-4.5-12c0-2.5 2-4 4-4z" />
    </svg>
  );
}
