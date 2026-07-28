import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  /** Ícone opcional exibido à esquerda do título. */
  icon?: LucideIcon;
  /** Badge/indicador exibido ao lado do título. */
  badge?: React.ReactNode;
  /** Ações alinhadas à direita (botões, filtros). */
  actions?: React.ReactNode;
  /** Conteúdo extra abaixo do título (chips, contadores). */
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  badge,
  actions,
  children,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {Icon && <Icon className="h-5 w-5 text-primary shrink-0" />}
          <h1 className="text-2xl font-heading font-bold text-foreground">{title}</h1>
          {badge}
        </div>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        {children}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap sm:justify-end shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}
