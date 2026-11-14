import type { HTMLAttributes } from 'react';

type BubbleVariant = 'default' | 'muted';

function joinClasses(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(' ');
}

export interface BubbleProps extends HTMLAttributes<HTMLDivElement> {
  variant?: BubbleVariant;
}

/** Styled speech bubble surface supporting outgoing (default) and incoming (muted) variants. */
export function Bubble({
  variant = 'default',
  className,
  children,
  ...props
}: BubbleProps) {
  return (
    <div
      data-variant={variant}
      className={joinClasses(
        'relative min-w-0 max-w-full rounded-2xl shadow-sm transition-colors',
        variant === 'default'
          ? 'bg-[var(--bubble-out)] text-[var(--text-primary)]'
          : 'bg-[var(--bubble-in)] text-[var(--text-primary)] border border-[var(--border-subtle)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Inner padding and typography container for bubble payload. */
export function BubbleContent({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={joinClasses('px-4 py-2.5 text-[14.5px] leading-[1.45]', className)}
      {...props}
    >
      {children}
    </div>
  );
}
