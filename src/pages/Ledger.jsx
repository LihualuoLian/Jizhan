import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Utensils,
  Car,
  ShoppingCart,
  Gamepad2,
  Home,
  Wallet,
  Gift,
  TrendingUp,
  Trash2,
  X,
  Inbox,
  Download,
  Upload,
  Loader2,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import toast, { Toaster } from 'react-hot-toast';
import useLedgerStore from '../store/useLedgerStore';
import db from '../db/db';
import './Ledger.css';

// ─── 分类配置 ───────────────────────────────────────────────
const INCOME_CATEGORIES = [
  { value: 'salary', label: '工资', icon: Wallet },
  { value: 'bonus', label: '奖金', icon: Gift },
  { value: 'investment', label: '理财', icon: TrendingUp },
];

const EXPENSE_CATEGORIES = [
  { value: 'food', label: '餐饮', icon: Utensils },
  { value: 'transport', label: '交通', icon: Car },
  { value: 'shopping', label: '购物', icon: ShoppingCart },
  { value: 'entertainment', label: '娱乐', icon: Gamepad2 },
  { value: 'housing', label: '住房', icon: Home },
];

const ALL_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];

const getCategoryMeta = (value) =>
  ALL_CATEGORIES.find((c) => c.value === value) || {
    label: value,
    icon: Wallet,
  };

const FILTER_TAGS = [
  { value: 'all', label: '全部' },
  ...ALL_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
];

// ─── 工具函数 ───────────────────────────────────────────────
const formatNumber = (num) =>
  num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const getDateGroup = (dateStr) => {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(d, today)) return '今天';
  if (isSameDay(d, yesterday)) return '昨天';
  return '更早';
};

// ─── 月份切换组件 ─────────────────────────────────────────────
function MonthNavigator({ year, month, onPrev, onNext }) {
  return (
    <div className="ledger-month-nav">
      <button className="ledger-nav-btn" onClick={onPrev} aria-label="上一月">
        <ChevronLeft size={20} />
      </button>
      <span className="ledger-month-label">
        {year}年{String(month).padStart(2, '0')}月
      </span>
      <button className="ledger-nav-btn" onClick={onNext} aria-label="下一月">
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

// ─── 概览卡片组件 ─────────────────────────────────────────────
function SummaryCards({ summary }) {
  return (
    <div className="ledger-summary-row">
      <div className="ledger-summary-card">
        <span className="ledger-summary-label">总收入</span>
        <span className="ledger-summary-value income">
          +{formatNumber(summary.totalIncome)}
        </span>
      </div>
      <div className="ledger-summary-card">
        <span className="ledger-summary-label">总支出</span>
        <span className="ledger-summary-value expense">
          -{formatNumber(summary.totalExpense)}
        </span>
      </div>
      <div className="ledger-summary-card">
        <span className="ledger-summary-label">结余</span>
        <span
          className={`ledger-summary-value ${
            summary.balance < 0 ? 'negative' : 'positive'
          }`}
        >
          {summary.balance < 0 ? '-' : '+'}
          {formatNumber(Math.abs(summary.balance))}
        </span>
      </div>
    </div>
  );
}

// ─── 饼图颜色（柔和渐变色系）─────────────────────────────────────
const PIE_COLORS = [
  '#60a5fa', // 蓝
  '#34d399', // 绿
  '#fbbf24', // 黄
  '#f472b6', // 粉
  '#a78bfa', // 紫
  '#fb923c', // 橙
  '#38bdf8', // 天蓝
  '#4ade80', // 浅绿
];

// ─── 数据洞察组件 ─────────────────────────────────────────────
function DataInsights({ transactions, year, month, timeRange, onTimeRangeChange }) {
  const [expanded, setExpanded] = useState(true);

  // 计算当前筛选的时间范围
  const dateRange = useMemo(() => {
    const now = new Date();
    let startDate, endDate;

    if (timeRange === 'thisMonth') {
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0); // 本月最后一天
    } else if (timeRange === 'lastMonth') {
      startDate = new Date(year, month - 2, 1);
      endDate = new Date(year, month - 1, 0); // 上月最后一天
    } else {
      // last3Months: 从本月1号往前推2个月
      startDate = new Date(year, month - 3, 1);
      endDate = new Date(year, month, 0);
    }

    // 确保 endDate 不超过今天
    if (endDate > now) endDate = now;

    return { startDate, endDate };
  }, [timeRange, year, month]);

  // 筛选时间范围内的交易
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const d = new Date(tx.date);
      return d >= dateRange.startDate && d <= dateRange.endDate;
    });
  }, [transactions, dateRange]);

  // 计算汇总数据
  const rangeSummary = useMemo(() => {
    const s = filteredTransactions.reduce(
      (acc, cur) => {
        if (cur.type === 'income') acc.totalIncome += cur.amount;
        else if (cur.type === 'expense') acc.totalExpense += cur.amount;
        return acc;
      },
      { totalIncome: 0, totalExpense: 0 }
    );
    s.balance = s.totalIncome - s.totalExpense;
    return s;
  }, [filteredTransactions]);

  // 饼图数据：按分类聚合支出
  const pieData = useMemo(() => {
    const expenseByCategory = {};
    filteredTransactions
      .filter((tx) => tx.type === 'expense')
      .forEach((tx) => {
        const category = tx.category || 'other';
        if (!expenseByCategory[category]) {
          expenseByCategory[category] = 0;
        }
        expenseByCategory[category] += tx.amount;
      });

    return Object.entries(expenseByCategory).map(([category, amount]) => ({
      name: getCategoryMeta(category).label,
      value: amount,
      category,
    }));
  }, [filteredTransactions]);

  // 折线图数据：按日期聚合收支
  const lineData = useMemo(() => {
    const dailyData = {};

    filteredTransactions.forEach((tx) => {
      const d = new Date(tx.date);
      let dateKey;

      // 近3个月按月聚合，否则按日聚合
      if (timeRange === 'last3Months') {
        dateKey = `${d.getMonth() + 1}月`;
      } else {
        dateKey = `${d.getMonth() + 1}/${d.getDate()}`;
      }

      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { date: dateKey, income: 0, expense: 0 };
      }

      if (tx.type === 'income') {
        dailyData[dateKey].income += tx.amount;
      } else {
        dailyData[dateKey].expense += tx.amount;
      }
    });

    // 按日期排序
    return Object.values(dailyData).sort((a, b) => {
      if (timeRange === 'last3Months') {
        return parseInt(a.date) - parseInt(b.date);
      }
      const [aMonth, aDay] = a.date.split('/').map(Number);
      const [bMonth, bDay] = b.date.split('/').map(Number);
      return aMonth !== bMonth ? aMonth - bMonth : aDay - bDay;
    });
  }, [filteredTransactions, timeRange]);

  // 判断是否为空数据
  const hasPieData = pieData.length > 0;
  const hasLineData = lineData.length > 0;

  // 时间筛选按钮标签
  const timeRangeOptions = [
    { value: 'thisMonth', label: '本月' },
    { value: 'lastMonth', label: '上月' },
    { value: 'last3Months', label: '近3个月' },
  ];

  return (
    <div className="data-insights glass">
      <button
        className="data-insights-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="data-insights-title">📊 数据洞察</span>
        <ChevronRight
          size={16}
          className={`data-insights-arrow ${expanded ? 'open' : ''}`}
        />
      </button>

      {expanded && (
        <div className="data-insights-body">
          {/* 时间筛选按钮 */}
          <div className="data-insights-filter">
            {timeRangeOptions.map((opt) => (
              <button
                key={opt.value}
                className={`data-insights-filter-btn ${
                  timeRange === opt.value ? 'active' : ''
                }`}
                onClick={() => onTimeRangeChange(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* 汇总数据 */}
          <div className="data-insights-summary">
            <div className="data-insights-summary-item">
              <span className="data-insights-summary-label">收入</span>
              <span className="data-insights-summary-value income">
                +{formatNumber(rangeSummary.totalIncome)}
              </span>
            </div>
            <div className="data-insights-summary-item">
              <span className="data-insights-summary-label">支出</span>
              <span className="data-insights-summary-value expense">
                -{formatNumber(rangeSummary.totalExpense)}
              </span>
            </div>
            <div className="data-insights-summary-item">
              <span className="data-insights-summary-label">结余</span>
              <span
                className={`data-insights-summary-value ${
                  rangeSummary.balance < 0 ? 'negative' : 'positive'
                }`}
              >
                {rangeSummary.balance < 0 ? '-' : '+'}
                {formatNumber(Math.abs(rangeSummary.balance))}
              </span>
            </div>
          </div>

          {/* 图表区域 */}
          <div className="data-insights-charts">
            {/* 饼图：支出分类 */}
            <div className="data-insights-chart-card">
              <h4 className="data-insights-chart-title">支出分类</h4>
              {hasPieData ? (
                <div className="data-insights-pie-container">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                      >
                        {pieData.map((entry, index) => (
                          <Cell
                            key={entry.category}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => formatNumber(value)}
                        contentStyle={{
                          background: 'rgba(30, 41, 59, 0.95)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px',
                          color: '#e2e8f0',
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value) => (
                          <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                            {value}
                          </span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="data-insights-pie-center">
                    <span className="data-insights-pie-total-label">总支出</span>
                    <span className="data-insights-pie-total-value">
                      {formatNumber(rangeSummary.totalExpense)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="data-insights-empty">
                  <p>暂无支出数据，继续加油 💪</p>
                </div>
              )}
            </div>

            {/* 折线图：收支趋势 */}
            <div className="data-insights-chart-card">
              <h4 className="data-insights-chart-title">收支趋势</h4>
              {hasLineData ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={lineData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.06)"
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                      interval={lineData.length > 10 ? 2 : 0}
                    />
                    <YAxis
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                      tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(30, 41, 59, 0.95)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        color: '#e2e8f0',
                      }}
                      formatter={(value, name) => [
                        formatNumber(value),
                        name === 'income' ? '收入' : '支出',
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="income"
                      stroke="#34d399"
                      strokeWidth={2}
                      dot={false}
                      name="income"
                    />
                    <Line
                      type="monotone"
                      dataKey="expense"
                      stroke="#f87171"
                      strokeWidth={2}
                      dot={false}
                      name="expense"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="data-insights-empty">
                  <p>暂无收支数据</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 分类筛选栏 ─────────────────────────────────────────────
function FilterBar({ active, onChange }) {
  return (
    <div className="ledger-filter-bar">
      {FILTER_TAGS.map((tag) => (
        <button
          key={tag.value}
          className={`ledger-filter-tag ${
            active === tag.value ? 'active' : ''
          }`}
          onClick={() => onChange(tag.value)}
        >
          {tag.label}
        </button>
      ))}
    </div>
  );
}

// ─── 空状态 ─────────────────────────────────────────────────
function EmptyState({ isFiltered }) {
  return (
    <div className="ledger-empty-state">
      <div className="ledger-empty-icon">
        <Inbox size={56} strokeWidth={1.2} />
      </div>
      <p className="ledger-empty-title">
        {isFiltered ? '该分类下没有流水' : '本月还没有流水'}
      </p>
      <p className="ledger-empty-sub">
        {isFiltered ? '试试切换其他分类看看' : '记一笔吧'}
      </p>
    </div>
  );
}

// ─── 添加记录弹窗 ─────────────────────────────────────────────
function AddModal({ open, onClose, onConfirm }) {
  const [type, setType] = useState('expense');
  const [category, setCategory] = useState('food');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  // 切换类型时重置分类为该类型的第一个
  useEffect(() => {
    const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    setCategory(list[0].value);
  }, [type]);

  const handleSubmit = () => {
    const num = parseFloat(amount);
    if (!num || num <= 0) return;
    onConfirm({
      type,
      category,
      amount: num,
      date: new Date(date),
      note: note.trim(),
    });
    // 重置表单
    setAmount('');
    setNote('');
    setDate(new Date().toISOString().slice(0, 10));
    onClose();
  };

  if (!open) return null;

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div className="ledger-modal-overlay" onClick={onClose}>
      <div
        className="ledger-modal glass"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ledger-modal-header">
          <h3>添加记录</h3>
          <button className="ledger-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* 类型切换 */}
        <div className="ledger-form-group">
          <label className="ledger-form-label">类型</label>
          <div className="ledger-type-toggle">
            <button
              className={`ledger-type-btn ${
                type === 'income' ? 'active income' : ''
              }`}
              onClick={() => setType('income')}
            >
              收入
            </button>
            <button
              className={`ledger-type-btn ${
                type === 'expense' ? 'active expense' : ''
              }`}
              onClick={() => setType('expense')}
            >
              支出
            </button>
          </div>
        </div>

        {/* 分类 */}
        <div className="ledger-form-group">
          <label className="ledger-form-label">分类</label>
          <select
            className="ledger-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* 金额 */}
        <div className="ledger-form-group">
          <label className="ledger-form-label">金额</label>
          <input
            className="ledger-input"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        {/* 日期 */}
        <div className="ledger-form-group">
          <label className="ledger-form-label">日期</label>
          <input
            className="ledger-input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {/* 备注 */}
        <div className="ledger-form-group">
          <label className="ledger-form-label">备注</label>
          <textarea
            className="ledger-textarea"
            rows={3}
            placeholder="可选备注…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <button className="ledger-submit-btn" onClick={handleSubmit}>
          确认添加
        </button>
      </div>
    </div>
  );
}

// ─── 单条记录 ─────────────────────────────────────────────────
function TransactionItem({ tx, onDelete }) {
  const meta = getCategoryMeta(tx.category);
  const Icon = meta.icon;
  const isIncome = tx.type === 'income';

  const handleDelete = () => {
    if (window.confirm('确定要删除这条记录吗？')) {
      onDelete(tx.id);
    }
  };

  return (
    <div className="ledger-tx-item">
      <div className="ledger-tx-icon-wrap">
        <Icon size={18} />
      </div>
      <div className="ledger-tx-info">
        <span className="ledger-tx-category">{meta.label}</span>
        {tx.note && <span className="ledger-tx-note">{tx.note}</span>}
      </div>
      <span className={`ledger-tx-amount ${isIncome ? 'income' : 'expense'}`}>
        {isIncome ? '+' : '-'}
        {formatNumber(tx.amount)}
      </span>
      <button className="ledger-tx-delete" onClick={handleDelete} aria-label="删除">
        <Trash2 size={16} />
      </button>
    </div>
  );
}

// ─── 分组折叠列表 ─────────────────────────────────────────────
function GroupedTransactions({ transactions, onDelete }) {
  const [collapsed, setCollapsed] = useState({});

  const toggle = (group) =>
    setCollapsed((prev) => ({ ...prev, [group]: !prev[group] }));

  const groups = useMemo(() => {
    const map = {};
    transactions.forEach((tx) => {
      const g = getDateGroup(tx.date);
      if (!map[g]) map[g] = [];
      map[g].push(tx);
    });
    // 保持固定顺序
    const ordered = {};
    ['今天', '昨天', '更早'].forEach((g) => {
      if (map[g]) ordered[g] = map[g];
    });
    return ordered;
  }, [transactions]);

  const groupKeys = Object.keys(groups);

  if (groupKeys.length === 0) {
    return <div className="ledger-empty">本月暂无记录</div>;
  }

  return (
    <div className="ledger-tx-list">
      {groupKeys.map((group) => (
        <div key={group} className="ledger-tx-group">
          <button
            className="ledger-group-header"
            onClick={() => toggle(group)}
          >
            <span>{group}</span>
            <span className="ledger-group-count">
              {groups[group].length}笔
            </span>
            <ChevronRight
              size={16}
              className={`ledger-group-arrow ${
                collapsed[group] ? '' : 'open'
              }`}
            />
          </button>
          {!collapsed[group] && (
            <div className="ledger-group-body">
              {groups[group].map((tx) => (
                <TransactionItem key={tx.id} tx={tx} onDelete={onDelete} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── 主页面 ───────────────────────────────────────────────────
export default function Ledger() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [importing, setImporting] = useState(false);
  const [timeRange, setTimeRange] = useState('thisMonth'); // thisMonth | lastMonth | last3Months
  const fileInputRef = useRef(null);
  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
  });

  const {
    transactions,
    getTransactions,
    addTransaction,
    deleteTransaction,
    getMonthlySummary,
  } = useLedgerStore();

  // 加载数据
  const refresh = useCallback(async () => {
    await getTransactions();
    const s = await getMonthlySummary(year, month);
    setSummary(s);
  }, [year, month, getTransactions, getMonthlySummary]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // 按月筛选流水
  const monthlyTx = useMemo(() => {
    return transactions.filter((tx) => {
      const d = new Date(tx.date);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });
  }, [transactions, year, month]);

  // 按分类筛选（前端过滤）
  const filteredTx = useMemo(() => {
    if (activeFilter === 'all') return monthlyTx;
    return monthlyTx.filter((tx) => tx.category === activeFilter);
  }, [monthlyTx, activeFilter]);

  // 筛选后的动态汇总
  const filteredSummary = useMemo(() => {
    const s = filteredTx.reduce(
      (acc, cur) => {
        if (cur.type === 'income') acc.totalIncome += cur.amount;
        else if (cur.type === 'expense') acc.totalExpense += cur.amount;
        return acc;
      },
      { totalIncome: 0, totalExpense: 0 }
    );
    s.balance = s.totalIncome - s.totalExpense;
    return s;
  }, [filteredTx]);

  // 基于时间范围的汇总（与数据洞察同步）
  const timeRangeSummary = useMemo(() => {
    const now = new Date();
    let startDate, endDate;

    if (timeRange === 'thisMonth') {
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0);
    } else if (timeRange === 'lastMonth') {
      startDate = new Date(year, month - 2, 1);
      endDate = new Date(year, month - 1, 0);
    } else {
      startDate = new Date(year, month - 3, 1);
      endDate = new Date(year, month, 0);
    }

    if (endDate > now) endDate = now;

    const rangeTx = transactions.filter((tx) => {
      const d = new Date(tx.date);
      return d >= startDate && d <= endDate;
    });

    const s = rangeTx.reduce(
      (acc, cur) => {
        if (cur.type === 'income') acc.totalIncome += cur.amount;
        else if (cur.type === 'expense') acc.totalExpense += cur.amount;
        return acc;
      },
      { totalIncome: 0, totalExpense: 0 }
    );
    s.balance = s.totalIncome - s.totalExpense;
    return s;
  }, [transactions, year, month, timeRange]);

  // 月份切换
  const handlePrevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  // 添加记录
  const handleAdd = async (data) => {
    await addTransaction(data);
    await refresh();
  };

  // 删除记录
  const handleDelete = async (id) => {
    await deleteTransaction(id);
    await refresh();
  };

  // 导出备份
  const handleExport = async () => {
    try {
      const allData = await db.transactions.toArray();
      const json = JSON.stringify(allData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const a = document.createElement('a');
      a.href = url;
      a.download = `账本备份_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`备份导出成功！共导出 ${allData.length} 条记录。`);
    } catch (err) {
      console.error('[Ledger] export failed:', err);
      toast.error('导出失败，请重试。');
    }
  };

  // 导入备份
  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 重置 input 以支持重复选择同一文件
    e.target.value = '';

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // 校验
      if (!Array.isArray(data) || data.length === 0) {
        toast.error('文件格式错误，请选择正确的备份文件。');
        return;
      }
      const first = data[0];
      if (!first.type || first.amount === undefined || !first.date || !first.category) {
        toast.error('文件格式错误，请选择正确的备份文件。');
        return;
      }

      // 二次确认
      const confirmed = window.confirm(
        `即将导入 ${data.length} 条记录，此操作将覆盖当前所有数据，确定继续吗？`
      );
      if (!confirmed) return;

      // 显示加载遮罩
      setImporting(true);

      // 格式化日期为 Date 对象
      const records = data.map((item) => ({
        ...item,
        date: new Date(item.date),
        createdAt: item.createdAt || Date.now(),
      }));

      // 清空旧数据 → 批量写入
      await db.transactions.clear();
      await db.transactions.bulkAdd(records);

      // 刷新
      await refresh();

      toast.success(`数据恢复成功！已导入 ${records.length} 条记录。`);
    } catch (err) {
      console.error('[Ledger] import failed:', err);
      if (err instanceof SyntaxError) {
        toast.error('文件格式错误，请选择正确的备份文件。');
      } else {
        toast.error('导入失败，请重试。');
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="ledger-page">
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#e2e8f0',
            fontSize: '14px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.1)',
          },
          success: { iconTheme: { primary: '#34d399', secondary: '#1e293b' } },
          error: { iconTheme: { primary: '#f87171', secondary: '#1e293b' } },
        }}
      />

      {/* 加载遮罩 */}
      {importing && (
        <div className="ledger-loading-overlay">
          <div className="ledger-loading-spinner">
            <Loader2 size={36} className="ledger-spin" />
            <span>正在导入数据…</span>
          </div>
        </div>
      )}

      {/* 顶部：操作栏 + 月份切换 + 概览 */}
      <div className="ledger-top glass">
        <div className="ledger-top-bar">
          <MonthNavigator
            year={year}
            month={month}
            onPrev={handlePrevMonth}
            onNext={handleNextMonth}
          />
          <div className="ledger-top-actions">
            <button
              className="ledger-action-btn"
              onClick={handleExport}
              title="导出备份"
            >
              <Download size={16} />
            </button>
            <button
              className="ledger-action-btn"
              onClick={() => fileInputRef.current?.click()}
              title="导入备份"
            >
              <Upload size={16} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
          </div>
        </div>
        <SummaryCards summary={timeRangeSummary} />
      </div>

      {/* 数据洞察 */}
      <DataInsights
        transactions={transactions}
        year={year}
        month={month}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
      />

      {/* 筛选栏 */}
      <FilterBar active={activeFilter} onChange={setActiveFilter} />

      {/* 底部：流水列表 */}
      <div className="ledger-body">
        {filteredTx.length > 0 ? (
          <>
            <div className="ledger-tx-count">共 {filteredTx.length} 笔流水</div>
            <GroupedTransactions transactions={filteredTx} onDelete={handleDelete} />
          </>
        ) : (
          <EmptyState isFiltered={activeFilter !== 'all'} />
        )}
      </div>

      {/* 悬浮添加按钮 */}
      <button
        className="ledger-fab glass"
        onClick={() => setModalOpen(true)}
        aria-label="添加记录"
      >
        <Plus size={28} />
      </button>

      {/* 添加弹窗 */}
      <AddModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleAdd}
      />
    </div>
  );
}
