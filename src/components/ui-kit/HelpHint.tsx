// Tombol ikon ? dengan popover penjelasan bahasa awam.
import { HelpCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Props {
  title?: string;
  children: React.ReactNode;
  label?: string;
}

export function HelpHint({ title = "Apa ini?", children, label = "Penjelasan" }: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-72 text-sm">
        <div className="mb-1 font-semibold">{title}</div>
        <div className="text-muted-foreground">{children}</div>
      </PopoverContent>
    </Popover>
  );
}