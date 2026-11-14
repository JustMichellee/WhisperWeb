import { createContext, useContext, type HTMLAttributes } from 'react';

type MessageAlign = 'start' | 'end';

const MessageContext = createContext<{ align: MessageAlign }>({ align: 'start' });

function joinClasses(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(' ');
}

export interface MessageProps extends HTMLAttributes<HTMLDivElement> {
  align?: MessageAlign;
}

/** Root row container for a single chat message with start/end alignment context. */
export function Message({
  align = 'start',
  className,
  children,
  ...props
}: MessageProps) {
  return (
    <MessageContext.Provider value={{ align }}>
      <div
        data-align={align}
        className={joinClasses(
          'group flex w-full flex-col',
          align === 'end' ? 'items-end' : 'items-start',
          className
        )}
        {...props}
      >
        {children}
      </div>
    </MessageContext.Provider>
  );
}

/** Vertical stack holding header metadata, bubble row, reactions, and footer metadata. */
export function MessageContent({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const { align } = useContext(MessageContext);

  return (
    <div
      className={joinClasses(
        'flex max-w-[88%] sm:max-w-[75%] md:max-w-[68%] flex-col gap-1',
        align === 'end' ? 'items-end' : 'items-start',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Header metadata slot anchored to content start and aligned with bubble horizontal padding. */
export function MessageHeader({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={joinClasses(
        'flex self-start items-center px-3.5 text-xs text-[var(--text-secondary)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Footer metadata slot following the message row side and aligned with bubble horizontal padding. */
export function MessageFooter({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const { align } = useContext(MessageContext);

  return (
    <div
      className={joinClasses(
        'flex items-center px-3.5 text-[11px] text-[var(--text-secondary)] tabular-nums',
        align === 'end' ? 'self-end' : 'self-start',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

