import React, { useMemo, useState } from 'react';
import { DollarSign, Activity, Users, Calendar as CalendarIcon, PieChart as PieIcon, MapPin, TrendingDown, LineChart as LineChartIcon, Trophy } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { Patient, Appointment, ClinicalRecord, Location, Expense, PaymentRecord } from '../types';
import { formatCurrency, Currency } from '../utils/currency';

interface DashboardViewProps {
  patients: Patient[];
  appointments: Appointment[];
  treatmentRecords: ClinicalRecord[];
  expenses: Expense[];
  paymentRecords: PaymentRecord[];
  currency: Currency;
  locations: Location[];
  selectedLocationId: string;
  allBranchesValue: string;
  canViewAllBranches: boolean;
  onLocationChange: (locationId: string) => void;
  loading?: boolean;
}

const toLocalISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const DashboardView: React.FC<DashboardViewProps> = ({
  patients,
  appointments,
  treatmentRecords,
  expenses,
  paymentRecords,
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

  const todayKey = useMemo(() => toLocalISODate(new Date()), []);
  const [dateFrom, setDateFrom] = useState(todayKey);
  const [dateTo, setDateTo] = useState(todayKey);

  const handleDateFromChange = (value: string) => {
    setDateFrom(value);
    if (value > dateTo) {
      setDateTo(value);
    }
  };

  const handleDateToChange = (value: string) => {
    setDateTo(value);
    if (value < dateFrom) {
      setDateFrom(value);
    }
  };

  const isWithinRange = (dateStr?: string) => {
    if (!dateStr) return false;
    return dateStr >= dateFrom && dateStr <= dateTo;
  };

  const rangeDates = useMemo(() => {
    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
    const dates: string[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      dates.push(cursor.toISOString().split('T')[0]);
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }, [dateFrom, dateTo]);

  const rangeMonths = useMemo(() => {
    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
    const months: { key: string; label: string }[] = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const endCursor = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cursor <= endCursor) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      const label = `${cursor.toLocaleString('default', { month: 'short' })} ${cursor.getFullYear()}`;
      months.push({ key, label });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return months;
  }, [dateFrom, dateTo]);

  const chartDates = useMemo(() => {
    if (rangeDates.length <= 31) return rangeDates;
    return rangeDates.slice(-31);
  }, [rangeDates]);

  const filteredTreatmentRecords = useMemo(
    () => treatmentRecords.filter(record => isWithinRange(record.date)),
    [treatmentRecords, dateFrom, dateTo]
  );

  const filteredExpenses = useMemo(
    () => expenses.filter(expense => isWithinRange(expense.date)),
    [expenses, dateFrom, dateTo]
  );

  const filteredAppointments = useMemo(
    () => appointments.filter(appointment => isWithinRange(appointment.date)),
    [appointments, dateFrom, dateTo]
  );

  const filteredPaymentRecords = useMemo(
    () => paymentRecords.filter(record => isWithinRange(record.date)),
    [paymentRecords, dateFrom, dateTo]
  );

  const rangeTreatmentRevenue = useMemo(
    () => filteredTreatmentRecords.reduce((sum, record) => sum + (record.cost || 0), 0),
    [filteredTreatmentRecords]
  );

  const rangeCollectedPayments = useMemo(
    () => filteredPaymentRecords.reduce((sum, payment) => sum + (payment.amount || 0), 0),
    [filteredPaymentRecords]
  );

  const rangeRevenue = useMemo(
    () => rangeTreatmentRevenue + rangeCollectedPayments,
    [rangeTreatmentRevenue, rangeCollectedPayments]
  );

  const rangeExpenses = useMemo(
    () => filteredExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0),
    [filteredExpenses]
  );

  const rangeProfit = useMemo(() => rangeRevenue - rangeExpenses, [rangeRevenue, rangeExpenses]);

  const rangeAppointments = useMemo(() => filteredAppointments.length, [filteredAppointments]);

  const rangeNewPatients = useMemo(
    () => patients.filter(patient => isWithinRange(patient.created_at?.slice(0, 10))).length,
    [patients, dateFrom, dateTo]
  );

  const rangeDayCount = Math.max(rangeDates.length, 1);
  const avgDailyRevenue = rangeRevenue / rangeDayCount;

  const dailyFinancialData = useMemo(() => {
    return chartDates.map(dateStr => {
      const dateLabel = new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const treatmentRevenue = filteredTreatmentRecords
        .filter(record => record.date === dateStr)
        .reduce((sum, record) => sum + (record.cost || 0), 0);
      const collectedPayment = filteredPaymentRecords
        .filter(payment => payment.date === dateStr)
        .reduce((sum, payment) => sum + (payment.amount || 0), 0);
      const revenue = treatmentRevenue + collectedPayment;
      const totalExpense = filteredExpenses
        .filter(expense => expense.date === dateStr)
        .reduce((sum, expense) => sum + (expense.amount || 0), 0);
      return {
        name: dateLabel,
        revenue,
        expenses: totalExpense,
        profit: revenue - totalExpense,
        date: dateStr
      };
    });
  }, [chartDates, filteredTreatmentRecords, filteredPaymentRecords, filteredExpenses]);

  const dailyAppointmentData = useMemo(() => {
    return chartDates.map(dateStr => {
      const dateLabel = new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const treatmentRevenue = filteredTreatmentRecords
        .filter(record => record.date === dateStr)
        .reduce((sum, record) => sum + (record.cost || 0), 0);
      const collectedPayment = filteredPaymentRecords
        .filter(payment => payment.date === dateStr)
        .reduce((sum, payment) => sum + (payment.amount || 0), 0);
      const revenue = treatmentRevenue + collectedPayment;
      const appointmentsCount = filteredAppointments.filter(apt => apt.date === dateStr).length;
      return { name: dateLabel, revenue, appointments: appointmentsCount, date: dateStr };
    });
  }, [chartDates, filteredTreatmentRecords, filteredPaymentRecords, filteredAppointments]);

  // Patient Revenue Performance (top 10 patients by total revenue in range)
  const patientRevenueData = useMemo(() => {
    const patientMap = new Map<string, { name: string; revenue: number }>();
    
    filteredTreatmentRecords.forEach(record => {
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
      .map((patient) => ({
        name: patient.name.length > 15 ? patient.name.substring(0, 15) + '...' : patient.name,
        revenue: patient.revenue
      }));
  }, [filteredTreatmentRecords]);

  // Appointment Status Distribution (range)
  const appointmentStatusData = useMemo(() => {
    const statusCounts: Record<string, number> = { Scheduled: 0, Completed: 0, Cancelled: 0 };

    filteredAppointments.forEach(apt => {
      statusCounts[apt.status] = (statusCounts[apt.status] || 0) + 1;
    });

    return Object.entries(statusCounts)
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));
  }, [filteredAppointments]);

  const appointmentStatusColors: Record<string, string> = {
    Scheduled: '#4F46E5',
    Completed: '#10B981',
    Cancelled: '#EF4444'
  };

  // Treatment Mix (top 8 procedures by count, range)
  const treatmentMixData = useMemo(() => {
    const map = new Map<string, number>();

    filteredTreatmentRecords.forEach(rec => {
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
  }, [filteredTreatmentRecords]);

  const expenseCategoryData = useMemo(() => {
    const totals = new Map<string, number>();
    filteredExpenses.forEach(expense => {
      const key = expense.category?.trim() || 'Uncategorized';
      totals.set(key, (totals.get(key) || 0) + (expense.amount || 0));
    });

    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [filteredExpenses]);

  const expenseCategoryColors = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#14B8A6', '#8B5CF6', '#0EA5E9', '#F97316'];

  const topExpenses = useMemo(() => {
    return [...filteredExpenses]
      .sort((a, b) => (b.amount || 0) - (a.amount || 0))
      .slice(0, 8);
  }, [filteredExpenses]);

  const topPatientsByRevenue = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number }>();
    filteredTreatmentRecords.forEach(record => {
      const name = record.patient_name || 'Unknown';
      const current = map.get(record.patient_id) || { name, revenue: 0 };
      current.revenue += record.cost || 0;
      map.set(record.patient_id, current);
    });
    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
  }, [filteredTreatmentRecords]);

  const doctorEarningsData = useMemo(() => {
    const map = new Map<string, { name: string; earnings: number; treatments: number }>();
    filteredTreatmentRecords.forEach(record => {
      if (!record.doctor_name || !record.doctorEarnings) return;
      const doctorName = record.doctor_name;
      const current = map.get(doctorName) || { name: doctorName, earnings: 0, treatments: 0 };
      current.earnings += Number(record.doctorEarnings || 0);
      current.treatments += 1;
      map.set(doctorName, current);
    });
    return Array.from(map.values())
      .sort((a, b) => b.earnings - a.earnings);
  }, [filteredTreatmentRecords]);


  const topAppointmentCreators = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();

    filteredAppointments.forEach(appointment => {
      const key = appointment.created_by_user_id || appointment.created_by_user_name || 'unknown';
      const name = appointment.created_by_user_name || 'Unknown';
      const current = map.get(key) || { name, count: 0 };
      current.count += 1;
      map.set(key, current);
    });

    return Array.from(map.values())
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [filteredAppointments]);

  // New Patients by Month (range)
  const newPatientsMonthlyData = useMemo(() => {
    return rangeMonths.map(month => {
      const count = patients.filter(p => {
        if (!p.created_at) return false;
        const created = new Date(p.created_at);
        const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
        return key === month.key;
      }).length;
      return { name: month.label, count };
    });
  }, [patients, rangeMonths]);

  const monthlyProfitData = useMemo(() => {
    return rangeMonths.map(month => {
      const revenue = filteredTreatmentRecords
        .filter(record => record.date.startsWith(month.key))
        .reduce((sum, record) => sum + (record.cost || 0), 0);
      const totalExpense = filteredExpenses
        .filter(expense => expense.date.startsWith(month.key))
        .reduce((sum, expense) => sum + (expense.amount || 0), 0);
      return {
        label: month.label,
        revenue,
        expenses: totalExpense,
        profit: revenue - totalExpense
      };
    });
  }, [filteredTreatmentRecords, filteredExpenses, rangeMonths]);

  const serviceMonitorData = useMemo(() => {
    const monitoredServices = ['X-ray (OBU)', 'X-ray (CBTC)', 'X Ray (Lateral)', 'X-ray (PA)'];

    return monitoredServices.map((service) => {
      const serviceRecords = filteredTreatmentRecords.filter((record) => (record.description || '').trim() === service);
      const count = serviceRecords.length;
      const revenue = serviceRecords.reduce((sum, record) => sum + (record.cost || 0), 0);
      return {
        name: service,
        patients: count,
        revenue
      };
    });
  }, [filteredTreatmentRecords]);

  const serviceMonitorHasData = useMemo(
    () => serviceMonitorData.some((item) => item.patients > 0),
    [serviceMonitorData]
  );

  const totalXrayPatients = useMemo(
    () => {
      const monitoredServices = new Set(['X-ray (OBU)', 'X-ray (CBTC)', 'X Ray (Lateral)', 'X-ray (PA)']);
      const uniquePatientIds = new Set<string>();

      filteredTreatmentRecords.forEach((record) => {
        const serviceName = (record.description || '').trim();
        if (!monitoredServices.has(serviceName)) return;
        if (record.patient_id) {
          uniquePatientIds.add(record.patient_id);
        }
      });

      return uniquePatientIds.size;
    },
    [filteredTreatmentRecords]
  );

  const totalXrayRevenue = useMemo(
    () => serviceMonitorData.reduce((sum, item) => sum + item.revenue, 0),
    [serviceMonitorData]
  );

  const topXrayService = useMemo(() => {
    const ranked = [...serviceMonitorData].sort((a, b) => b.patients - a.patients);
    return ranked[0];
  }, [serviceMonitorData]);

  const xrayXAxisMax = useMemo(() => {
    const currentMax = Math.max(...serviceMonitorData.map((item) => item.patients), 0);
    return Math.max(currentMax, 2);
  }, [serviceMonitorData]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Overview</p>
            <h2 className="text-2xl font-bold text-gray-900">Performance Snapshot</h2>
            <p className="text-sm text-gray-500 mt-1">
              Showing results for <span className="font-semibold text-gray-700">{selectedLocationName}</span>.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full lg:w-auto">
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">
                Date From
              </label>
              <input
                type="date"
                value={dateFrom}
                max={dateTo}
                onChange={(e) => handleDateFromChange(e.target.value)}
                className="w-full bg-white text-gray-800 text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">
                Date To
              </label>
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                onChange={(e) => handleDateToChange(e.target.value)}
                className="w-full bg-white text-gray-800 text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
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
                  className="w-full bg-white text-gray-800 text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
              {loading && <p className="mt-2 text-xs text-[var(--hover-600)]">Refreshing dashboard data...</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
        {[
          { label: 'Revenue (Range)', value: formatCurrency(rangeRevenue, currency), note: `${rangeDayCount} days`, icon: <DollarSign className="w-4 h-4 text-emerald-600" /> },
          { label: 'Expenses (Range)', value: formatCurrency(rangeExpenses, currency), note: 'Operating spend', icon: <TrendingDown className="w-4 h-4 text-red-600" /> },
          { label: 'Net Profit', value: formatCurrency(rangeProfit, currency), note: 'Revenue - expenses', icon: <Activity className="w-4 h-4 text-indigo-600" /> },
          { label: 'Avg Daily Revenue', value: formatCurrency(avgDailyRevenue, currency), note: 'Daily average', icon: <LineChartIcon className="w-4 h-4 text-sky-600" /> },
          { label: 'Appointments', value: rangeAppointments.toString(), note: 'In selected range', icon: <CalendarIcon className="w-4 h-4 text-amber-600" /> },
          { label: 'New Patients', value: rangeNewPatients.toString(), note: 'Created in range', icon: <Users className="w-4 h-4 text-purple-600" /> }
        ].map(item => (
          <div key={item.label} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs text-gray-500 uppercase tracking-widest">
              <span>{item.label}</span>
              {item.icon}
            </div>
            <div className="mt-3 text-lg font-bold text-gray-900">{item.value}</div>
            <div className="mt-1 text-xs text-gray-500">{item.note}</div>
          </div>
        ))}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Revenue vs Expenses</h3>
            <p className="text-xs text-gray-500">Daily totals within the selected range</p>
          </div>
          <span className="inline-flex items-center gap-2 text-xs text-gray-500">
            <LineChartIcon className="w-4 h-4" />
            Trend
          </span>
        </div>
        <div className="h-[320px] w-full min-h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyFinancialData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 11}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 11}} />
              <Tooltip
                formatter={(value: number | undefined, name?: string) => {
                  const amount = value ?? 0;
                  if (name === 'revenue') return [formatCurrency(amount, currency), 'Revenue'];
                  if (name === 'expenses') return [formatCurrency(amount, currency), 'Expenses'];
                  return [formatCurrency(amount, currency), 'Profit'];
                }}
              />
              <Legend />
              <Area type="monotone" dataKey="revenue" stroke="#4F46E5" strokeWidth={2} fill="url(#colorRevenue)" />
              <Area type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={2} fill="url(#colorExpenses)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Largest Expenses</h3>
          <p className="text-xs text-gray-500 mb-4">Highest single expenses in the selected range</p>
          {topExpenses.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No expenses recorded in this range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-gray-400 border-b border-gray-100">
                  <tr>
                    <th className="text-left py-2 pr-4">Date</th>
                    <th className="text-left py-2 pr-4">Description</th>
                    <th className="text-left py-2 pr-4">Category</th>
                    <th className="text-right py-2">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topExpenses.map(expense => (
                    <tr key={expense.id} className="text-gray-700">
                      <td className="py-2 pr-4 whitespace-nowrap">{expense.date}</td>
                      <td className="py-2 pr-4 font-medium text-gray-900">{expense.description}</td>
                      <td className="py-2 pr-4">{expense.category || 'Uncategorized'}</td>
                      <td className="py-2 text-right font-semibold text-gray-900">{formatCurrency(expense.amount || 0, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Top Patients (Table)</h3>
          <p className="text-xs text-gray-500 mb-4">Revenue contribution in the selected range</p>
          {topPatientsByRevenue.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No patient revenue data in this range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-gray-400 border-b border-gray-100">
                  <tr>
                    <th className="text-left py-2 pr-4">Patient</th>
                    <th className="text-right py-2">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topPatientsByRevenue.map((patient, index) => (
                    <tr key={`${patient.name}-${index}`} className="text-gray-700">
                      <td className="py-2 pr-4 font-medium text-gray-900">{patient.name}</td>
                      <td className="py-2 text-right font-semibold text-gray-900">{formatCurrency(patient.revenue, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Doctor Earnings (Commission)</h3>
            <p className="text-xs text-gray-500">Calculated commission for each doctor in the selected range</p>
          </div>
          <span className="inline-flex items-center gap-2 text-xs text-gray-500">
            <DollarSign className="w-4 h-4 text-emerald-500" />
            Commission
          </span>
        </div>
        {doctorEarningsData.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No doctor earnings data in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-gray-400 border-b border-gray-100">
                <tr>
                  <th className="text-left py-2 pr-4">Doctor</th>
                  <th className="text-right py-2 pr-4">Treatments</th>
                  <th className="text-right py-2">Commission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {doctorEarningsData.map((doctor, index) => (
                  <tr key={`${doctor.name}-${index}`} className="text-gray-700">
                    <td className="py-2 pr-4 font-medium text-gray-900">{doctor.name}</td>
                    <td className="py-2 text-right text-gray-600">{doctor.treatments}</td>
                    <td className="py-2 text-right font-semibold text-emerald-700">{formatCurrency(doctor.earnings, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Appointment Makers</h3>
            <p className="text-xs text-gray-500">Users who created the most appointments in the selected range</p>
          </div>
          <span className="inline-flex items-center gap-2 text-xs text-gray-500">
            <Trophy className="w-4 h-4 text-amber-500" />
            Marketing performance
          </span>
        </div>
        {topAppointmentCreators.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No appointment creator data in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-gray-400 border-b border-gray-100">
                <tr>
                  <th className="text-left py-2 pr-4">Rank</th>
                  <th className="text-left py-2 pr-4">User</th>
                  <th className="text-right py-2">Appointments Made</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {topAppointmentCreators.map((creator, index) => (
                  <tr key={`${creator.name}-${index}`} className="text-gray-700">
                    <td className="py-2 pr-4 font-semibold text-gray-500">#{index + 1}</td>
                    <td className="py-2 pr-4 font-medium text-gray-900">{creator.name}</td>
                    <td className="py-2 text-right font-semibold text-gray-900">{creator.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Appointments vs Revenue</h3>
          <p className="text-xs text-gray-500 mb-4">Daily appointment count compared to revenue</p>
          <div className="h-[300px] w-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyAppointmentData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{fill: '#6B7280', fontSize: 10}}
                  angle={-30}
                  textAnchor="end"
                  height={70}
                />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} />
                <Tooltip
                  formatter={(value: number | undefined, name?: string) => {
                    const amount = value ?? 0;
                    if (name === 'revenue') return [formatCurrency(amount, currency), 'Revenue'];
                    return [amount, 'Appointments'];
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
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Top Patients by Revenue</h3>
          <p className="text-xs text-gray-500 mb-4">Highest contributors in the selected range</p>
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
                  formatter={(value: number | undefined) => [formatCurrency(value ?? 0, currency), 'Revenue']}
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
            <h3 className="text-lg font-semibold text-gray-800">Appointment Status</h3>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500">
              <PieIcon className="w-3 h-3" /> Distribution
            </span>
          </div>
          <div className="h-[260px] w-full min-h-[260px] flex items-center justify-center">
            {appointmentStatusData.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No appointments in this range.</p>
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
                    formatter={(value: number | undefined, name?: string) => [`${value ?? 0} appointments`, name || 'Appointments']}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Treatment Mix (Range)</h3>
          <p className="text-xs text-gray-500 mb-4">Top procedures by frequency in the selected range</p>
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
                    formatter={(value: number | undefined) => [`${value ?? 0} procedures`, 'Count']}
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
          <p className="text-xs text-gray-500 mb-4">Category distribution in the selected range</p>
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
                  <Tooltip formatter={(value: number | undefined, name?: string) => [formatCurrency(value ?? 0, currency), name || 'Expense']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Net Profit by Month</h3>
          <p className="text-xs text-gray-500 mb-4">Revenue minus expenses within the range</p>
          <div className="h-[260px] w-full min-h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyProfitData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number | undefined, name?: string) => {
                    const amount = value ?? 0;
                    if (name === 'profit') return [formatCurrency(amount, currency), 'Net Profit'];
                    if (name === 'revenue') return [formatCurrency(amount, currency), 'Revenue'];
                    return [formatCurrency(amount, currency), 'Expenses'];
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
        <h3 className="text-lg font-semibold text-gray-800 mb-2">New Patients by Month</h3>
        <p className="text-xs text-gray-500 mb-4">Monthly intake within the selected range</p>
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
              <Tooltip formatter={(value: number | undefined) => [`${value ?? 0} patients`, 'New Patients']} />
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
        <div className="flex flex-col gap-2 mb-5">
          <h3 className="text-lg font-semibold text-gray-800">X-Ray Service Monitor</h3>
          <p className="text-xs text-gray-500">Daily usage visibility for key X-ray services in the selected date range</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4">
            <p className="text-[10px] uppercase tracking-wider font-bold text-indigo-500">Total X-Ray Patients</p>
            <p className="text-2xl font-bold text-indigo-700 mt-1">{totalXrayPatients}</p>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-500">Total X-Ray Revenue</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{formatCurrency(totalXrayRevenue, currency)}</p>
          </div>
          <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
            <p className="text-[10px] uppercase tracking-wider font-bold text-amber-500">Top Service Today</p>
            <p className="text-sm font-bold text-amber-700 mt-1">{topXrayService?.name || 'N/A'}</p>
            <p className="text-xs text-amber-600 mt-1">{topXrayService?.patients || 0} patient(s)</p>
          </div>
        </div>

        <div className="h-[320px] w-full min-h-[320px]">
          {serviceMonitorHasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serviceMonitorData} layout="vertical" margin={{ top: 10, right: 24, left: 12, bottom: 10 }} barCategoryGap={20}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  domain={[0, xrayXAxisMax]}
                  tickCount={xrayXAxisMax + 1}
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#4B5563', fontSize: 12, fontWeight: 600 }}
                  width={140}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 12, borderColor: '#E5E7EB' }}
                  formatter={(value: number | undefined, name?: string) => {
                    const amount = value ?? 0;
                    if (name === 'patients') return [`${amount}`, 'Patients'];
                    return [formatCurrency(amount, currency), 'Revenue'];
                  }}
                  labelFormatter={(label) => `Service: ${label}`}
                />
                <Bar dataKey="patients" radius={[8, 8, 8, 8]}>
                  {serviceMonitorData.map((entry, index) => {
                    const colors = ['#6366F1', '#3B82F6', '#8B5CF6', '#14B8A6'];
                    return <Cell key={`xray-service-${entry.name}-${index}`} fill={colors[index % colors.length]} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50">
              <p className="text-sm text-gray-500 italic">No X-ray activity found for the selected date range.</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default DashboardView;
