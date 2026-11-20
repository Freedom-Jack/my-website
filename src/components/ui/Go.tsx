import type { ReactNode } from 'react';
import { InlineLink } from '@/lib/inline';
import { Arrow } from './Arrow';

/** A way on: words on a ruled line and an arrow after them (prose.css .go). */
export function Go({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <InlineLink href={href} className={className ? `go ${className}` : 'go'}>
      <span className="go__words">{children}</span>
      <Arrow />
    </InlineLink>
  );
}
