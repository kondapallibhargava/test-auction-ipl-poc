import { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  bordered?: boolean;
}

export default function Card({ bordered = false, className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`rounded-xl p-4 ${bordered ? 'border border-[#f7941d]/20' : ''} ${className}`}
      style={{ backgroundColor: '#252525' }}
      {...props}
    >
      {children}
    </div>
  );
}
