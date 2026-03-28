import { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

const VARIANTS = {
  primary: 'bg-[#f7941d] text-[#060d1a] hover:opacity-90 font-bold',
  secondary: 'bg-[#0c2d5e] text-white border border-[#f7941d]/30 hover:border-[#f7941d]/60',
  danger: 'bg-[#ff4444] text-white hover:opacity-90',
  ghost: 'bg-transparent text-white border border-white/20 hover:bg-white/10',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
