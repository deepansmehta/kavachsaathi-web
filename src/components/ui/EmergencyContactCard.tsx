import { Phone, User } from "lucide-react";
import { telHref, formatPhone } from "@/lib/utils";
import type { EmergencyContact } from "@/lib/types";
import { cn } from "@/lib/utils";

interface EmergencyContactCardProps {
  contact: EmergencyContact;
  index?: number;
  className?: string;
}

export function EmergencyContactCard({
  contact,
  index,
  className,
}: EmergencyContactCardProps) {
  if (!contact?.name || !contact?.phone) return null;

  return (
    <a
      href={telHref(contact.phone)}
      className={cn(
        "flex items-center gap-4 rounded-card border border-gold-border bg-kavach-s1 p-4 transition-all active:scale-[0.98] hover:border-gold hover:bg-gold-faint",
        className
      )}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold-faint text-gold">
        <User className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-rajdhani text-lg font-semibold text-cream">
          {contact.name}
          {index !== undefined && (
            <span className="ml-2 font-mono text-xs text-cream-soft">
              #{index}
            </span>
          )}
        </p>
        <p className="font-dm text-sm text-cream-soft">{contact.relation}</p>
        <p className="mt-0.5 font-mono text-sm text-gold">
          {formatPhone(contact.phone)}
        </p>
      </div>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success text-white">
        <Phone className="h-5 w-5" />
      </div>
    </a>
  );
}
