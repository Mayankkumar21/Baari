// Compact India tricolour for the mobile-number prefix. Three horizontal bands
// in the correct order (saffron / white / India green) with a stylised Ashoka
// Chakra hint in the middle — small enough that the chakra reads as a dot
// but conveys the flag at a glance.
import * as React from "react";

export function IndiaFlag({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 18 12"
      width="18"
      height="12"
      role="img"
      aria-label="India"
      className={className}
      {...props}
    >
      <rect width="18" height="4" fill="#FF9933" />
      <rect y="4" width="18" height="4" fill="#FFFFFF" />
      <rect y="8" width="18" height="4" fill="#138808" />
      <circle cx="9" cy="6" r="1.4" fill="none" stroke="#000080" strokeWidth="0.4" />
    </svg>
  );
}
