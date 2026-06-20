import {
  Stethoscope,
  Scissors,
  Flower,
  PawPrint,
  Store,
} from "lucide-react";
import { Tooth } from "@/components/icons/tooth";

export function VerticalIcon({
  tenantType,
  className,
}: {
  tenantType: string;
  className?: string;
}) {
  switch (tenantType) {
    case "dental":
      return <Tooth className={className} />;
    case "salon":
      return <Scissors className={className} />;
    case "spa":
      return <Flower className={className} />;
    case "vet":
      return <PawPrint className={className} />;
    case "other":
      return <Store className={className} />;
    case "clinic":
    default:
      return <Stethoscope className={className} />;
  }
}
