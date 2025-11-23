import { Category } from './types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Dining', icon: 'Utensils', color: '#ef4444', type: 'expense' }, // Red
  { id: '2', name: 'Transport', icon: 'Bus', color: '#3b82f6', type: 'expense' }, // Blue
  { id: '3', name: 'Shopping', icon: 'ShoppingBag', color: '#f59e0b', type: 'expense' }, // Amber
  { id: '4', name: 'Entertainment', icon: 'Film', color: '#8b5cf6', type: 'expense' }, // Violet
  { id: '5', name: 'Housing', icon: 'Home', color: '#10b981', type: 'expense' }, // Emerald
  { id: '6', name: 'Medical', icon: 'Stethoscope', color: '#ec4899', type: 'expense' }, // Pink
  { id: '7', name: 'Salary', icon: 'Banknote', color: '#22c55e', type: 'income' }, // Green
  { id: '8', name: 'Other', icon: 'MoreHorizontal', color: '#9ca3af', type: 'expense' }, // Gray
];
