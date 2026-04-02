import React, { useMemo } from 'react';
import { DollarSign, Activity, Users, Calendar as CalendarIcon, PieChart as PieIcon, MapPin, TrendingDown } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { StatsCard } from './Shared';
import { Patient, Appointment, ClinicalRecord, Location, Expense } from '../types';
import { formatCurrency, Currency } from '../utils/currency';

interface DashboardViewProps {
  patients: Patient[];
  appointments: Appointment[];
  treatmentRecords: ClinicalRecord[];
  expenses: Expense[];
  currency: Currency;
  locations: Location[];
  selectedLocationId: string;
  allBranchesValue: string;
  canViewAllBranches: boolean;
  onLocationChange: (locationId: string) => void;
  loading?: boolean;
}

const DashboardView: React.FC<DashboardViewProps> = ({
  patients,
  appointments,
  treatmentRecords,
  expenses,
  currency,
  locations,
  selectedLocationId,
  allBranchesValue,
  canViewAllBranches,
  onLocationChange,
  loading = false
}) => {
  const selectedLocationName = useMemo(() => {
    if (selectedLocationId === allBranchesValue) return 'All Branches';
    return locations.find(location => location.id === selectedLocationId)?.name || 'Current Branch';
  }, [allBranchesValue, locations, selectedLocationId]);

  // Calculate Daily Revenue (today's treatments)
  const dailyRevenue = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return treatmentRecords
      .filter(record => record.date === today)
      .reduce((sum, record) => sum + (record.cost || 0), 0);
  }, [treatmentRecords]);

  const dailyExpenses = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return expenses
      .filter(expense => expense.date === today)
      .reduce((sum, expense) => sum + (expense.amount || 0), 0);
  }, [expenses]);

  // Calculate Monthly Revenue (this month's treatments)
  const monthlyRevenue = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    return treatmentRecords
      .filter(record => record.date >= startOfMonth && record.date <= endOfMonth)
      .reduce((sum, record) => sum + (record.cost || 0), 0);
  }, [treatmentRecords]);

  const monthlyExpenses = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    return expenses
      .filter(expense => expense.date >= startOfMonth && expense.date <= endOfMonth)
      .reduce((sum, expense) => sum + (expense.amount || 0), 0);
  }, [expenses]);

  const monthlyProfit = useMemo(() => monthlyRevenue - monthlyExpenses, [monthlyRevenue, monthlyExpenses]);

  // Weekly Revenue Data (last 7 days)
  const weeklyRevenueData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const weekData = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayName = days[date.getDay()];
      
      const revenue = treatmentRecords
        .filter(record => record.date === dateStr)
        .reduce((sum, record) => sum + (record.cost || 0), 0);
      
      weekData.push({ name: dayName, value: revenue, date: dateStr });
    }
    
    return weekData;
  }, [treatmentRecords]);

  const weeklyFinancialData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const weekData = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayName = days[date.getDay()];

      const revenue = treatmentRecords
        .filter(record => record.date === dateStr)
        .reduce((sum, record) => sum + (record.cost || 0), 0);

      const totalExpense = expenses
        .filter(expense => expense.date === dateStr)
        .reduce((sum, expense) => sum + (expense.amount || 0), 0);

      weekData.push({ name: dayName, revenue, expenses: totalExpense, profit: revenue - totalExpense, date: dateStr });
    }

    return weekData;
  }, [treatmentRecords, expenses]);

  // Appointment Revenue Performance (revenue by day over last 14 days)
  const appointmentRevenueData = useMemo(() => {
    const data = [];
    const today = new Date();
    
    for (let i = 13; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfMonth = date.getDate();
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      
      const revenue = treatmentRecords
        .filter(record => record.date === dateStr)
        .reduce((sum, record) => sum + (record.cost || 0), 0);
      
      const appointmentsCount = appointments.filter(apt => apt.date === dateStr).length;
      
      data.push({ 
        name: `${month} ${dayOfMonth}`, 
        revenue: revenue,
        appointments: appointmentsCount 
      });
    }
    
    return data;
  }, [treatmentRecords, appointments]);

  // Patient Revenue Performance (top 10 patients by total revenue)
  const patientRevenueData = useMemo(() => {
    const patientMap = new Map<string, { name: string; revenue: number }>();
    
    treatmentRecords.forEach(record => {
      const patientId = record.patient_id;
      const patientName = record.patient_name || 'Unknown';
      
      if (!patientMap.has(patientId)) {
        patientMap.set(patientId, { name: patientName, revenue: 0 });
      }
      
      const patient = patientMap.get(patientId)!;
      patient.revenue += record.cost || 0;
    });
    
    return Array.from(patientMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map((patient, index) => ({
        name: patient.name.length > 15 ? patient.name.substring(0, 15) + '...' : patient.name,
        revenue: patient.revenue
      }));
  }, [treatmentRecords]);

  // Calculate trend for daily revenue (compare to yesterday)
  const dailyTrend = useMemo(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    const yesterdayRevenue = treatmentRecords
      .filter(record => record.date === yesterdayStr)
      .reduce((sum, record) => sum + (record.cost || 0), 0);
    
    if (yesterdayRevenue === 0) return 'N/A';
    const change = ((dailyRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;
    return change >= 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
  }, [dailyRevenue, treatmentRecords]);

  // Calculate trend for monthly revenue (compare to last month)
  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    
    const lastMonthRevenue = treatmentRecords
      .filter(record => record.date >= lastMonthStart && record.date <= lastMonthEnd)
      .reduce((sum, record) => sum + (record.cost || 0), 0);
    
    if (lastMonthRevenue === 0) return 'N/A';
    const change = ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
    return change >= 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
  }, [monthlyRevenue, treatmentRecords]);

  const monthlyExpenseTrend = useMemo(() => {
    const now = new Date();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

    const lastMonthExpenses = expenses
      .filter(expense => expense.date >= lastMonthStart && expense.date <= lastMonthEnd)
      .reduce((sum, expense) => sum + (expense.amount || 0), 0);

    if (lastMonthExpenses === 0) return 'N/A';
    const change = ((monthlyExpenses - lastMonthExpenses) / lastMonthExpenses) * 100;
    return change >= 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
  }, [monthlyExpenses, expenses]);

  const monthlyProfitTrend = useMemo(() => {
    const now = new Date();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

    const lastMonthRevenue = treatmentRecords
      .filter(record => record.date >= lastMonthStart && record.date <= lastMonthEnd)
      .reduce((sum, record) => sum + (record.cost || 0), 0);
    const lastMonthExpenses = expenses
      .filter(expense => expense.date >= lastMonthStart && expense.date <= lastMonthEnd)
      .reduce((sum, expense) => sum + (expense.amount || 0), 0);
    const lastMonthProfit = lastMonthRevenue - lastMonthExpenses;

    if (lastMonthProfit === 0) return 'N/A';
    const change = ((monthlyProfit - lastMonthProfit) / Math.abs(lastMonthProfit)) * 100;
    return change >= 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
  }, [monthlyProfit, treatmentRecords, expenses]);

  // Appointment Status Distribution (today)
  const appointmentStatusData = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todaysAppointments = appointments.filter(a => a.date === todayStr);
    const statusCounts: Record<string, number> = { Scheduled: 0, Completed: 0, Cancelled: 0 };

    todaysAppointments.forEach(apt => {
      statusCounts[apt.status] = (statusCounts[apt.status] || 0) + 1;
    });

    return Object.entries(statusCounts)
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));
  }, [appointments]);

  const appointmentStatusColors: Record<string, string> = {
    Scheduled: '#4F46E5',
    Completed: '#10B981',
    Cancelled: '#EF4444'
  };

  // Treatment Mix (top 8 procedures by count, last 30 days)
  const treatmentMixData = useMemo(() => {
    const today = new Date();
    const cutoff = new Date();
    cutoff.setDate(today.getDate() - 29);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const map = new Map<string, number>();

    treatmentRecords
      .filter(rec => rec.date >= cutoffStr)
      .forEach(rec => {
        const key = rec.description || 'Unknown';
        map.set(key, (map.get(key) || 0) + 1);
      });

    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({
        name: name.length > 18 ? name.substring(0, 18) + '...' : name,
        count
      }));
  }, [treatmentRecords]);

  const expenseCategoryData = useMemo(() => {
    const totals = new Map<string, number>();
    expenses.forEach(expense => {
      const key = expense.category?.trim() || 'Uncategorized';
      totals.set(key, (totals.get(key) || 0) + (expense.amount || 0));
    });

    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [expenses]);

  const expenseCategoryColors = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#14B8A6', '#8B5CF6', '#0EA5E9', '#F97316'];

  // Doctor Popularity (most treatments handled, last 30 days)
  const doctorPopularityData = useMemo(() => {
    const today = new Date();
    const cutoff = new Date();
    cutoff.setDate(today.getDate() - 29);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const map = new Map<string, number>();

    treatmentRecords
      .filter(rec => rec.date >= cutoffStr)
      .forEach(rec => {
        const doctorName = rec.doctor_name?.trim() || 'Unassigned Doctor';
        map.set(doctorName, (map.get(doctorName) || 0) + 1);
      });

    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({
        name: name.length > 18 ? `${name.substring(0, 18)}...` : name,
        count
      }));
  }, [treatmentRecords]);

  // New Patients by Month (last 6 months)
  const newPatientsMonthlyData = useMemo(() => {
    const now = new Date();
    const data: { name: string; count: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short' });

      const count = patients.filter(p => {
        if (!p.created_at) return false;
        const created = new Date(p.created_at);
        const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
        return key === monthKey;
      }).length;

      data.push({ name: label, count });
    }

    return data;
  }, [patients]);

  const monthlyProfitData = useMemo(() => {
    const now = new Date();
    const data: { label: string; profit: number; revenue: number; expenses: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const point = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = point.toISOString().slice(0, 7);
      const label = `${point.toLocaleString('default', { month: 'short' })} ${point.getFullYear()}`;
      const revenue = treatmentRecords
        .filter(record => record.date.startsWith(key))
        .reduce((sum, record) => sum + (record.cost || 0), 0);
      const totalExpense = expenses
        .filter(expense => expense.date.startsWith(key))
        .reduce((sum, expense) => sum + (expense.amount || 0), 0);
      data.push({
        label,
        revenue,
        expenses: totalExpense,
        profit: revenue - totalExpense
      });
    }

    return data;
  }, [treatmentRecords, expenses]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Dashboard Reporting</p>
            <h2 className="text-2xl font-bold text-gray-900">Branch Performance Overview</h2>
            <p className="text-sm text-gray-500 mt-1">
              Viewing metrics for <span className="font-semibold text-gray-700">{selectedLocationName}</span>.
            </p>
          </div>

          <div className="w-full md:w-72">
            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">
              <span className="inline-flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5" />
                Report Scope
              </span>
            </label>
            {canViewAllBranches ? (
              <select
                value={selectedLocationId}
                onChange={(e) => onLocationChange(e.target.value)}
                disabled={loading}
                className="w-full bg-white text-gray-800 text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value={allBranchesValue}>All Branches</option>
                {locations.map(location => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-700">
                {selectedLocationName}
              </div>
            )}
            {loading && <p className="mt-2 text-xs text-indigo-600">Refreshing dashboard data...</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatsCard title="Daily Revenue" value={formatCurrency(dailyRevenue, currency)} icon={<DollarSign className="text-green-600" />} trend={dailyTrend} />
        <StatsCard title="Monthly Revenue" value={formatCurrency(monthlyRevenue, currency)} icon={<Activity className="text-blue-600" />} trend={monthlyTrend} />
        <StatsCard title="Daily Expenses" value={formatCurrency(dailyExpenses, currency)} icon={<TrendingDown className="text-red-600" />} trend="Today" />
        <StatsCard title="Monthly Expenses" value={formatCurrency(monthlyExpenses, currency)} icon={<TrendingDown className="text-amber-600" />} trend={monthlyExpenseTrend} />
        <StatsCard title="Monthly Profit" value={formatCurrency(monthlyProfit, currency)} icon={<DollarSign className="text-emerald-600" />} trend={monthlyProfitTrend} />
        <StatsCard title="Active Patients" value={patients.length.toString()} icon={<Users className="text-indigo-600" />} trend="Stable" />
        <StatsCard title="Appointments Today" value={appointments.filter(a => a.date === new Date().toISOString().split('T')[0]).length.toString()} icon={<CalendarIcon className="text-orange-600" />} trend="Busy" />
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-6">Weekly Revenue Performance</h3>
        <div className="h-[300px] w-full min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weeklyRevenueData}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} />
              <Tooltip 
                formatter={(value: number) => [formatCurrency(value, currency), 'Revenue']}
              />
              <Area type="monotone" dataKey="value" stroke="#4F46E5" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Weekly Revenue vs Expenses</h3>
        <p className="text-xs text-gray-500 mb-4">Treatment revenue compared to operating expenses</p>
        <div className="h-[280px] w-full min-h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weeklyFinancialData}>
              <defs>
                <linearGradient id="colorWeeklyRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorWeeklyExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'revenue') return [formatCurrency(value, currency), 'Revenue'];
                  if (name === 'expenses') return [formatCurrency(value, currency), 'Expenses'];
                  return [formatCurrency(value, currency), 'Profit'];
                }}
              />
              <Legend />
              <Area type="monotone" dataKey="revenue" stroke="#4F46E5" strokeWidth={2} fill="url(#colorWeeklyRevenue)" />
              <Area type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={2} fill="url(#colorWeeklyExpense)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-6">Appointment Revenue Performance</h3>
          <div className="h-[300px] w-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={appointmentRevenueData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#6B7280', fontSize: 10}} 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} />
                <Tooltip 
                  formatter={(value: number, name: string) => {
                    if (name === 'revenue') {
                      return [formatCurrency(value, currency), 'Revenue'];
                    }
                    return [value, 'Appointments'];
                  }}
                />
                <Legend />
                <Bar dataKey="revenue" fill="#4F46E5" radius={[8, 8, 0, 0]} />
                <Bar dataKey="appointments" fill="#10B981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-6">Patient Revenue Performance</h3>
          <div className="h-[300px] w-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={patientRevenueData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#6B7280', fontSize: 10}} 
                  width={120}
                />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value, currency), 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#10B981" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800">Today's Appointment Status</h3>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500">
              <PieIcon className="w-3 h-3" /> Distribution
            </span>
          </div>
          <div className="h-[260px] w-full min-h-[260px] flex items-center justify-center">
            {appointmentStatusData.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No appointments scheduled today.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={appointmentStatusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                  >
                    {appointmentStatusData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={appointmentStatusColors[entry.name] || '#4B5563'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [`${value} appointments`, name]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Treatment Mix (Last 30 Days)</h3>
          <p className="text-xs text-gray-500 mb-4">Top procedures by frequency</p>
          <div className="h-[260px] w-full min-h-[260px]">
            {treatmentMixData.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No treatment activity recorded in the last 30 days.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={treatmentMixData} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6B7280', fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value} procedures`, 'Count']}
                  />
                  <Bar dataKey="count" fill="#6366F1" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Expense Breakdown</h3>
          <p className="text-xs text-gray-500 mb-4">Category distribution</p>
          <div className="h-[260px] w-full min-h-[260px] flex items-center justify-center">
            {expenseCategoryData.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No expense data available.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseCategoryData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={3}
                  >
                    {expenseCategoryData.map((entry, index) => (
                      <Cell key={`expense-cell-${index}`} fill={expenseCategoryColors[index % expenseCategoryColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string) => [formatCurrency(value, currency), name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Net Profit (Last 6 Months)</h3>
          <p className="text-xs text-gray-500 mb-4">Revenue minus expenses</p>
          <div className="h-[260px] w-full min-h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyProfitData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'profit') return [formatCurrency(value, currency), 'Net Profit'];
                    if (name === 'revenue') return [formatCurrency(value, currency), 'Revenue'];
                    return [formatCurrency(value, currency), 'Expenses'];
                  }}
                />
                <Legend />
                <Bar dataKey="profit" fill="#10B981" radius={[8, 8, 0, 0]} />
                <Bar dataKey="expenses" fill="#EF4444" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">New Patients (Last 6 Months)</h3>
        <p className="text-xs text-gray-500 mb-4">Monthly intake trend</p>
        <div className="h-[260px] w-full min-h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={newPatientsMonthlyData}>
              <defs>
                <linearGradient id="colorPatients" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
              <Tooltip formatter={(value: number) => [`${value} patients`, 'New Patients']} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#10B981"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorPatients)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Doctor Popularity (Last 30 Days)</h3>
        <p className="text-xs text-gray-500 mb-4">Most famous doctors by number of treatments completed</p>
        <div className="h-[300px] w-full min-h-[300px]">
          {doctorPopularityData.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No treatment records available in the last 30 days.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={doctorPopularityData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6B7280', fontSize: 11 }}
                  angle={-20}
                  textAnchor="end"
                  height={70}
                />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                <Tooltip formatter={(value: number) => [`${value} treatments`, 'Treatments']} />
                <Bar dataKey="count" fill="#F59E0B" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
