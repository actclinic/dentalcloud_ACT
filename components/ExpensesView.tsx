import React, { useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, Loader2, FileText, FileDown, BarChart3 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { ClinicalRecord, Expense, MedicineSale } from '../types';
import { formatCurrency, Currency } from '../utils/currency';
import { exportExpensesToPDF } from '../utils/pdfExport';
import Pagination from './Pagination';

interface ExpensesViewProps {
  expenses: Expense[];
  treatmentRecords: ClinicalRecord[];
  medicineSales: MedicineSale[];
  loading: boolean;
  currency: Currency;
  onAdd: () => void;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
}

const ExpensesView: React.FC<ExpensesViewProps> = ({
  expenses,
  treatmentRecords,
  medicineSales,
  loading,
  currency,
  onAdd,
  onEdit,
  onDelete
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const itemsPerPage = 10;

  const categories = useMemo(() => {
    const unique = new Set<string>();
    expenses.forEach(expense => {
      if (expense.category) unique.add(expense.category);
    });
    return Array.from(unique).sort();
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return expenses.filter(expense => {
      const matchesTerm = !term
        || expense.description.toLowerCase().includes(term)
        || expense.category.toLowerCase().includes(term)
        || expense.date.toLowerCase().includes(term);
      const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter;
      return matchesTerm && matchesCategory;
    });
  }, [expenses, searchTerm, categoryFilter]);

  const paginatedExpenses = useMemo(() => {
    if (showAll) return filteredExpenses;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredExpenses.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredExpenses, currentPage, showAll]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [expenses]);

  const today = new Date();
  const todayKey = today.toISOString().split('T')[0];
  const monthKey = todayKey.slice(0, 7);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - 6);
  const weekStartKey = weekStart.toISOString().split('T')[0];

  const dailyTotal = expenses
    .filter(exp => exp.date === todayKey)
    .reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const weeklyTotal = expenses
    .filter(exp => exp.date >= weekStartKey)
    .reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const monthlyTotal = expenses
    .filter(exp => exp.date.startsWith(monthKey))
    .reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const totalAll = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

  const dailyTreatmentRevenue = treatmentRecords
    .filter(tr => tr.date === todayKey)
    .reduce((sum, tr) => sum + (tr.cost || 0), 0);
  const weeklyTreatmentRevenue = treatmentRecords
    .filter(tr => tr.date >= weekStartKey)
    .reduce((sum, tr) => sum + (tr.cost || 0), 0);
  const monthlyTreatmentRevenue = treatmentRecords
    .filter(tr => tr.date.startsWith(monthKey))
    .reduce((sum, tr) => sum + (tr.cost || 0), 0);

  const dailyMedicineRevenue = medicineSales
    .filter(sale => sale.date === todayKey)
    .reduce((sum, sale) => sum + (sale.total_price || 0), 0);
  const weeklyMedicineRevenue = medicineSales
    .filter(sale => sale.date >= weekStartKey)
    .reduce((sum, sale) => sum + (sale.total_price || 0), 0);
  const monthlyMedicineRevenue = medicineSales
    .filter(sale => sale.date.startsWith(monthKey))
    .reduce((sum, sale) => sum + (sale.total_price || 0), 0);

  const dailyRevenue = dailyTreatmentRevenue + dailyMedicineRevenue;
  const weeklyRevenue = weeklyTreatmentRevenue + weeklyMedicineRevenue;
  const monthlyRevenue = monthlyTreatmentRevenue + monthlyMedicineRevenue;

  const dailyProfit = dailyRevenue - dailyTotal;
  const weeklyProfit = weeklyRevenue - weeklyTotal;
  const monthlyProfit = monthlyRevenue - monthlyTotal;

  const hasFinancialData = expenses.length > 0 || treatmentRecords.length > 0 || medicineSales.length > 0;

  const monthlyChartData = useMemo(() => {
    const now = new Date();
    const data: { key: string; label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const point = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = point.toISOString().slice(0, 7);
      const label = point.toLocaleString('default', { month: 'short' });
      data.push({
        key,
        label: `${label} ${point.getFullYear()}`,
        total: 0
      });
    }
    expenses.forEach(exp => {
      const entry = data.find(item => exp.date.startsWith(item.key));
      if (entry) entry.total += exp.amount || 0;
    });
    return data;
  }, [expenses]);

  const categoryChartData = useMemo(() => {
    const totals = new Map<string, number>();
    expenses.forEach(exp => {
      const key = exp.category || 'Uncategorized';
      totals.set(key, (totals.get(key) || 0) + (exp.amount || 0));
    });
    return Array.from(totals.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [expenses]);

  const handleDownloadPDF = () => {
    exportExpensesToPDF(expenses, currency);
  };

  const handleDownloadCSV = () => {
    const header = ['Date', 'Description', 'Category', 'Amount'];
    const rows = expenses.map(exp => [
      exp.date,
      exp.description,
      exp.category,
      String(exp.amount ?? 0)
    ]);
    const escapeValue = (value: string) => `"${value.replace(/\"/g, '""')}"`;
    const csv = [header, ...rows].map(row => row.map(escapeValue).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-fade-in">
      <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white sticky top-0 z-10">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Expense Management</h2>
          <p className="text-sm text-gray-500">Track clinic operating expenses and categories</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <input
              type="text"
              placeholder="Search expenses..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-64"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All categories</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <button
            onClick={handleDownloadPDF}
            disabled={expenses.length === 0}
            className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileDown className="w-4 h-4" /> Export PDF
          </button>
          <button
            onClick={handleDownloadCSV}
            disabled={expenses.length === 0}
            className="flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileText className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={onAdd}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Expense
          </button>
        </div>
      </div>

      {!loading && hasFinancialData && (
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest">Today</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(dailyTotal, currency)}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest">This Month</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(monthlyTotal, currency)}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest">All Time</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(totalAll, currency)}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-widest">Monthly Revenue</p>
              <p className="text-lg font-bold text-gray-900 mt-2">{formatCurrency(monthlyRevenue, currency)}</p>
              <p className="text-xs text-gray-500 mt-1">Treatments + medicine sales</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-widest">Monthly Expenses</p>
              <p className="text-lg font-bold text-gray-900 mt-2">{formatCurrency(monthlyTotal, currency)}</p>
              <p className="text-xs text-gray-500 mt-1">Operating costs</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-widest">Monthly Profit</p>
              <p className={`text-lg font-bold mt-2 ${monthlyProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(monthlyProfit, currency)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Revenue - expenses</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-500">
            <div className="bg-white border border-gray-100 rounded-lg px-4 py-3">
              Today: Revenue {formatCurrency(dailyRevenue, currency)} • Expenses {formatCurrency(dailyTotal, currency)} • Profit{' '}
              <span className={dailyProfit >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                {formatCurrency(dailyProfit, currency)}
              </span>
            </div>
            <div className="bg-white border border-gray-100 rounded-lg px-4 py-3">
              This Week: Revenue {formatCurrency(weeklyRevenue, currency)} • Expenses {formatCurrency(weeklyTotal, currency)} • Profit{' '}
              <span className={weeklyProfit >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                {formatCurrency(weeklyProfit, currency)}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800">Monthly Spend</h3>
                  <p className="text-xs text-gray-500">Last 6 months</p>
                </div>
              </div>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyChartData} margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="label" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value: number) => formatCurrency(value, currency)} />
                    <Bar dataKey="total" fill="#6366F1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <BarChart3 className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800">Top Categories</h3>
                  <p className="text-xs text-gray-500">Highest expense categories</p>
                </div>
              </div>
              <div className="h-[220px] w-full">
                {categoryChartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                    No category data available
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryChartData} layout="vertical" margin={{ left: 60, right: 10, top: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E5E7EB" />
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="category" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 11 }} width={90} />
                      <Tooltip formatter={(value: number) => formatCurrency(value, currency)} />
                      <Bar dataKey="total" fill="#F59E0B" radius={[0, 6, 6, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-12 flex justify-center">
          <Loader2 className="animate-spin text-indigo-600" />
        </div>
      ) : (
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Date</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Description</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Category</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">Amount</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-400 italic">
                  No expenses found.
                </td>
              </tr>
            ) : (
              paginatedExpenses.map(expense => (
                <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-500">{expense.date}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">{expense.description}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                      {expense.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-gray-900">{formatCurrency(expense.amount, currency)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onEdit(expense)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Edit expense"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this expense?')) {
                            onDelete(expense.id);
                          }
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete expense"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      {!loading && filteredExpenses.length > 0 && (
        <Pagination
          totalItems={filteredExpenses.length}
          itemsPerPage={itemsPerPage}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          showAll={showAll}
          onToggleShowAll={() => setShowAll(!showAll)}
        />
      )}
    </div>
  );
};

export default ExpensesView;
