export type Role = 'boss' | 'finance';
export type BillType = 'income' | 'expense';

export interface Category {
  id: number;
  name: string;
  type: BillType;
  sort: number;
}

export interface Bill {
  id: number;
  user_id: number;
  category_id: number;
  amount: number;
  bill_date: string;
  remark: string;
  created_at: string;
  updated_at: string;
  category_name: string;
  category_type: BillType;
  user_name: string;
}

export interface BillInput {
  category_id: number;
  amount: number;
  bill_date: string;
  remark: string;
}

export interface UserItem {
  id: number;
  username: string;
  role: Role;
  name: string;
  created_at: string;
}

export interface MonthStat {
  month: string;
  income: number;
  expense: number;
  balance: number;
  categories: { id: number; name: string; type: BillType; total: number }[];
}

export interface YearStat {
  year: number;
  income: number;
  expense: number;
  balance: number;
  months: { month: string; income: number; expense: number }[];
}
