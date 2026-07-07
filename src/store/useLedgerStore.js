import { create } from 'zustand';
import db from '../db/db';

const useLedgerStore = create((set, get) => ({
  transactions: [],

  addTransaction: async (transaction) => {
    try {
      const record = {
        ...transaction,
        createdAt: Date.now(),
      };
      const id = await db.transactions.add(record);
      console.log('[Ledger] addTransaction success, id:', id, 'record:', record);
      return id;
    } catch (error) {
      console.error('[Ledger] addTransaction failed:', error);
      throw error;
    }
  },

  getTransactions: async () => {
    try {
      const list = await db.transactions.orderBy('date').reverse().toArray();
      console.log('[Ledger] getTransactions success, count:', list.length);
      set({ transactions: list });
      return list;
    } catch (error) {
      console.error('[Ledger] getTransactions failed:', error);
      throw error;
    }
  },

  deleteTransaction: async (id) => {
    try {
      await db.transactions.delete(id);
      console.log('[Ledger] deleteTransaction success, id:', id);
      set((state) => ({
        transactions: state.transactions.filter((t) => t.id !== id),
      }));
    } catch (error) {
      console.error('[Ledger] deleteTransaction failed:', error);
      throw error;
    }
  },

  getMonthlySummary: async (year, month) => {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);

      const records = await db.transactions
        .where('date')
        .between(startDate, endDate)
        .toArray();

      const summary = records.reduce(
        (acc, cur) => {
          if (cur.type === 'income') {
            acc.totalIncome += cur.amount;
          } else if (cur.type === 'expense') {
            acc.totalExpense += cur.amount;
          }
          return acc;
        },
        { totalIncome: 0, totalExpense: 0 }
      );

      summary.balance = summary.totalIncome - summary.totalExpense;

      console.log(
        `[Ledger] getMonthlySummary(${year}-${month}) success:`,
        summary
      );
      return summary;
    } catch (error) {
      console.error('[Ledger] getMonthlySummary failed:', error);
      throw error;
    }
  },
}));

export default useLedgerStore;
