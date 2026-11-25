import {
  Award,
  Baby,
  Banknote,
  Briefcase,
  Building2,
  Bus,
  Car,
  CircleDashed,
  CirclePlus,
  Coffee,
  Coins,
  Droplets,
  Dumbbell,
  Fuel,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Laptop,
  PartyPopper,
  PawPrint,
  Percent,
  PiggyBank,
  Pill,
  Plane,
  Receipt,
  Repeat,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Sun,
  Tag,
  Timer,
  TrendingUp,
  Trophy,
  Tv,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  briefcase: Briefcase,
  timer: Timer,
  receipt: Receipt,
  trophy: Trophy,
  award: Award,
  gift: Gift,
  sun: Sun,
  coins: Coins,
  "trending-up": TrendingUp,
  laptop: Laptop,
  tag: Tag,
  "circle-plus": CirclePlus,
  home: Home,
  zap: Zap,
  "shopping-cart": ShoppingCart,
  utensils: Utensils,
  car: Car,
  "heart-pulse": HeartPulse,
  "graduation-cap": GraduationCap,
  repeat: Repeat,
  "party-popper": PartyPopper,
  "shopping-bag": ShoppingBag,
  sparkles: Sparkles,
  "paw-print": PawPrint,
  plane: Plane,
  landmark: Landmark,
  shield: Shield,
  banknote: Banknote,
  percent: Percent,
  "circle-dashed": CircleDashed,
  "piggy-bank": PiggyBank,
  wallet: Wallet,
  fuel: Fuel,
  bus: Bus,
  pill: Pill,
  tv: Tv,
  dumbbell: Dumbbell,
  coffee: Coffee,
  smartphone: Smartphone,
  wifi: Wifi,
  droplets: Droplets,
  baby: Baby,
  wrench: Wrench,
  building: Building2,
};

/** Ícones que dá para escolher numa categoria. */
export const ICON_CHOICES = Object.keys(ICONS);

export function FinIcon({ name, className = "h-4 w-4" }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Tag;
  return <Icon className={className} />;
}

/** Ícone redondo com a cor da categoria/conta. */
export function IconBubble({ icon, color, size = "md" }: { icon: string; color: string; size?: "sm" | "md" | "lg" }) {
  const box = size === "sm" ? "h-7 w-7" : size === "lg" ? "h-11 w-11" : "h-9 w-9";
  const glyph = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4";
  return (
    <span className={`flex ${box} shrink-0 items-center justify-center rounded-xl`} style={{ backgroundColor: `${color}1f`, color }}>
      <FinIcon name={icon} className={glyph} />
    </span>
  );
}
