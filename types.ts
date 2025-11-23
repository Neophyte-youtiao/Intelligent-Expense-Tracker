export type TransactionType = 'expense' | 'income';

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  date: string; // ISO string
  note: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string; // Icon name from Lucide or emoji
  color: string;
  type: TransactionType;
}

export interface DailyStats {
  date: string;
  total: number;
  transactions: Transaction[];
}

export type ViewState = 'dashboard' | 'add' | 'categories' | 'stats' | 'settings' | 'fortune' | 'daily' | 'compare' | 'trips';

export interface UserProfile {
  birthDate: string; // YYYY-MM-DD
  birthTime: string; // HH:mm
  gender: 'male' | 'female';
  hasProfile: boolean;
}

export interface DailyFortune {
  date: string;
  overallScore: number; // 1-100
  summary: string;
  luckyColor: string;
  luckyDirection: string;
  wealthTip: string;
  careerTip: string;
  loveTip: string;
}

export interface Trip {
  id: string;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  coverImage?: string; // Base64
  photos: string[]; // Base64 array
  notes?: string;
}