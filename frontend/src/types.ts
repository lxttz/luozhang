export type Role = 'boss' | 'finance';
export type BillType = 'income' | 'expense';
export type BillStatus = 'pending' | 'approved' | 'rejected';

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
  status: BillStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
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

export interface LogItem {
  id: number;
  bill_id: number | null;
  user_id: number;
  action: string;
  content: string;
  created_at: string;
  user_name: string;
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

export interface RangeStat {
  startDate: string;
  endDate: string;
  income: number;
  expense: number;
  balance: number;
  previous: { income: number; expense: number; balance: number };
  incomeChange: number | null;
  expenseChange: number | null;
  categories: { id: number; name: string; type: BillType; total: number }[];
}

export interface DashboardStat {
  date: string;
  month: string;
  today: { income: number; expense: number; balance: number };
  monthTotals: { income: number; expense: number; balance: number };
  recent: Pick<Bill, 'id' | 'amount' | 'bill_date' | 'remark' | 'status' | 'category_name' | 'category_type' | 'user_name'>[];
  ranking: { id: number; name: string; type: BillType; total: number }[];
}
