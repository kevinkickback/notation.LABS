import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function FormSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('dialog-section', className)}>
      <div className="dialog-section-fields">{children}</div>
    </section>
  );
}
