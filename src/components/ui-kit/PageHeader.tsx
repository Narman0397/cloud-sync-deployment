// Header halaman konsisten: H1 display + 1 kalimat ringkas + slot aksi kanan.
import type { ReactNode } from "react";

interface Props {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
}

export function PageHeader({ title, description, actions, eyebrow }: Props) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-2xl">
        {eyebrow ? (
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-foreground md:text-[28px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}