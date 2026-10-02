import type { ReactNode } from 'react';

export function FormSection({ children }: { children: ReactNode }) {
  return (
    <section className="dialog-section">
      <div className="dialog-section-fields">{children}</div>
    </section>
  );
}
