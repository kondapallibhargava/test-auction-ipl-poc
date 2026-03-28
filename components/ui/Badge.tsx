interface BadgeProps {
  children: React.ReactNode;
  variant?: 'gold' | 'blue' | 'green' | 'red' | 'orange' | 'gray';
}

const COLORS = {
  gold: 'bg-[#f7941d]/20 text-[#f7941d] border border-[#f7941d]/30',
  blue: 'bg-[#0c2d5e]/50 text-blue-200 border border-blue-500/30',
  green: 'bg-green-900/40 text-green-300 border border-green-500/30',
  red: 'bg-red-900/40 text-red-300 border border-red-500/30',
  orange: 'bg-[#f7941d]/20 text-[#f7941d] border border-[#f7941d]/40',
  gray: 'bg-white/10 text-gray-300 border border-white/20',
};

export default function Badge({ children, variant = 'gray' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${COLORS[variant]}`}>
      {children}
    </span>
  );
}
