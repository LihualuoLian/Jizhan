import Dexie from 'dexie';

const db = new Dexie('LifeDashboardDB');

db.version(1).stores({
  transactions: '++id, date, category',
});

export default db;
