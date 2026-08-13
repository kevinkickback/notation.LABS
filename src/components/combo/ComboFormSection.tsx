import type { ReactNode } from 'react';
import { RequiredBadge } from '@/components/shared/RequiredBadge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface ComboFormSectionProps {
  title: string;
  description: string;
  required?: boolean;
  children: ReactNode;
}

export function ComboFormSection({
  title,
  description,
  required = false,
  children,
}: ComboFormSectionProps) {
  return (
    <Card className="gap-3 py-4 shadow-none">
      <CardHeader className="gap-1 px-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <h3>{title}</h3>
          {required && <RequiredBadge />}
        </CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-4">{children}</CardContent>
    </Card>
  );
}
