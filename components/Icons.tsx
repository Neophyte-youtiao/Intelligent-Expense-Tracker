import React from 'react';
import { 
  Utensils, Bus, ShoppingBag, Film, Home, Stethoscope, 
  Banknote, MoreHorizontal, CreditCard, Coffee, Smartphone,
  Car, Plane, Gift, Music, Book, Briefcase
} from 'lucide-react';

export const IconMap: Record<string, React.ElementType> = {
  Utensils, Bus, ShoppingBag, Film, Home, Stethoscope, 
  Banknote, MoreHorizontal, CreditCard, Coffee, Smartphone,
  Car, Plane, Gift, Music, Book, Briefcase
};

interface IconProps {
  name: string;
  className?: string;
  size?: number;
}

export const DynamicIcon: React.FC<IconProps> = ({ name, className, size = 24 }) => {
  const IconComponent = IconMap[name] || MoreHorizontal;
  return <IconComponent className={className} size={size} />;
};
