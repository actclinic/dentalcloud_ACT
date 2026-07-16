import React, { useMemo } from 'react';
import { Users, Activity, CalendarCheck2, TrendingUp, DollarSign } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Appointment, ClinicalRecord, Location, Patient } from '../types';
import PatientQRScanButton from './PatientQRScanButton';

interface DoctorHomeViewProps {
  appointments: Appointment[];
  treatmentRecords: ClinicalRecord[];
  patients: Patient[];
  locations: Location[];
  activeLocationIds?: string[];
  onSelectPatient: (patient: Patient) => void;
  onOpenAppointmentsForDate: (filter: 'today' | 'tomorrow') => void;
}

const DoctorHomeView: React.FC<DoctorHomeViewProps> = ({
  appointments,
  treatmentRecords,
  patients,
  locations,
  activeLocationIds = [],
  onSelectPatient,
  onOpenAppointmentsForDate
}) => {
  const toLocalISODate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const today = useMemo(() => toLocalISODate(new Date()), []);
  const tomorrow = useMemo(() => {
    const nextDay = new Date();
    nextDay.setDate(nextDay.getDate() + 1);
    return toLocalISODate(nextDay);
  }, []);
  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const weekRange = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    const dayIndex = (now.getDay() + 6) % 7; // Monday = 0
    weekStart.setDate(now.getDate() - dayIndex);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    return { weekStart, weekEnd };
  }, []);

  const treatedPatientCount = useMemo(() => {
    return new Set(treatmentRecords.map((record) => record.patient_id)).size;
  }, [treatmentRecords]);

  const completedAppointments = useMemo(() => {
    return appointments.filter((appointment) => appointment.status === 'Completed').length;
  }, [appointments]);

  const todayAppointments = useMemo(() => {
    return appointments.filter((appointment) => appointment.date === today).length;
  }, [appointments, today]);

  const tomorrowAppointments = useMemo(() => {
    return appointments.filter((appointment) => appointment.date === tomorrow).length;
  }, [appointments, tomorrow]);

  const branchNameById = useMemo(() => {
    const map = new Map<string, string>();
    locations.forEach((location, index) => {
      map.set(location.id, location.name?.trim() || `Branch-${index + 1}`);
    });
    return map;
  }, [locations]);

  const getBranchName = (locationId: string | undefined, fallbackIndex = 0) => {
    if (!locationId) return 'Unassigned branch';
    return branchNameById.get(locationId) || `Branch-${fallbackIndex + 1}`;
  };

  const visibleBranchIds = useMemo(() => {
    const ids = new Set<string>();
    activeLocationIds.forEach((locationId) => {
      if (locationId) ids.add(locationId);
    });
    appointments.forEach((appointment) => {
      if (appointment.location_id) ids.add(appointment.location_id);
    });
    treatmentRecords.forEach((record) => {
      if (record.location_id) ids.add(record.location_id);
    });
    return Array.from(ids);
  }, [activeLocationIds, appointments, treatmentRecords]);

  const buildBranchTotals = <T extends { location_id?: string }>(
    items: T[],
    valueSelector: (item: T) => number,
    includeLocationIds: string[] = []
  ) => {
    const totals = new Map<string, { locationId: string; name: string; value: number }>();
    includeLocationIds.forEach((locationId, index) => {
      totals.set(locationId, {
        locationId,
        name: getBranchName(locationId, index),
        value: 0
      });
    });
    items.forEach((item) => {
      const locationId = item.location_id || 'unassigned';
      const current = totals.get(locationId) || {
        locationId,
        name: getBranchName(item.location_id, totals.size),
        value: 0
      };
      current.value += valueSelector(item);
      totals.set(locationId, current);
    });

    return Array.from(totals.values()).sort((a, b) => a.name.localeCompare(b.name));
  };

  const todayIncomeByBranch = useMemo(() => {
    return buildBranchTotals(
      treatmentRecords.filter((record) => record.date === today),
      (record) => Number(record.cost || 0),
      visibleBranchIds
    );
  }, [treatmentRecords, today, branchNameById, visibleBranchIds]);

  const todayAppointmentsByBranch = useMemo(() => {
    return buildBranchTotals(
      appointments.filter((appointment) => appointment.date === today),
      () => 1,
      visibleBranchIds
    );
  }, [appointments, today, branchNameById, visibleBranchIds]);

  const tomorrowAppointmentsByBranch = useMemo(() => {
    return buildBranchTotals(
      appointments.filter((appointment) => appointment.date === tomorrow),
      () => 1,
      visibleBranchIds
    );
  }, [appointments, tomorrow, branchNameById, visibleBranchIds]);
  
  const monthlyIncome = useMemo(() => {
    return treatmentRecords
      .filter((record) => (record.date || '').slice(0, 7) === currentMonthKey)
      .reduce((sum, record) => sum + Number(record.cost || 0), 0);
  }, [treatmentRecords, currentMonthKey]);

  const monthlyCommission = useMemo(() => {
    return treatmentRecords
      .flatMap((record) => record.doctorEarningEntries || [])
      .filter((entry) => (entry.paymentDate || '').slice(0, 7) === currentMonthKey)
      .reduce((sum, entry) => sum + Number(entry.earnings || 0), 0);
  }, [treatmentRecords, currentMonthKey]);

  const weeklyCommission = useMemo(() => {
    return treatmentRecords
      .flatMap((record) => record.doctorEarningEntries || [])
      .filter((entry) => {
        if (!entry.paymentDate) return false;
        const paymentDate = new Date(`${entry.paymentDate}T00:00:00`);
        return paymentDate >= weekRange.weekStart && paymentDate <= weekRange.weekEnd;
      })
      .reduce((sum, entry) => sum + Number(entry.earnings || 0), 0);
  }, [treatmentRecords, weekRange]);


  const weeklyProceeds = useMemo(() => {
    return treatmentRecords
      .filter((record) => {
        if (!record.date) return false;
        const recordDate = new Date(`${record.date}T00:00:00`);
        return recordDate >= weekRange.weekStart && recordDate <= weekRange.weekEnd;
      })
      .reduce((sum, record) => sum + Number(record.cost || 0), 0);
  }, [treatmentRecords, weekRange]);

  const topTreatments = useMemo(() => {
    const countMap = new Map<string, number>();
    treatmentRecords.forEach((record) => {
      const key = (record.description || 'Unknown').trim() || 'Unknown';
      countMap.set(key, (countMap.get(key) || 0) + 1);
    });

    return Array.from(countMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({
        name: name.length > 22 ? `${name.slice(0, 22)}...` : name,
        count
      }));
  }, [treatmentRecords]);

  const chartData = topTreatments.length > 0 ? topTreatments : [{ name: 'No Data', count: 1 }];
  const pieColors = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#f97316', '#8b5cf6'];

  const renderBranchBreakdown = (
    rows: Array<{ locationId: string; name: string; value: number }>,
    formatter: (value: number) => string,
    emptyText: string
  ) => (
    <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-2">
      {rows.length === 0 ? (
        <p className="text-[11px] font-medium text-gray-400">{emptyText}</p>
      ) : rows.map((row) => (
        <div key={row.locationId} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-2 py-1">
          <span className="truncate text-[11px] font-semibold text-gray-500">{row.name}</span>
          <span className="text-[11px] font-black text-gray-900">{formatter(row.value)}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-gray-900">Doctor Dashboard</h2>
          <p className="text-xs font-medium text-gray-500">Scan a patient QR code to open their chart quickly.</p>
        </div>
        <PatientQRScanButton
          patients={patients}
          onSelectPatient={onSelectPatient}
          className="inline-flex w-full sm:w-auto items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <div className="rounded-xl border border-indigo-100 bg-white p-3">
          <div className="mb-1 flex items-center gap-2 text-indigo-600">
            <Users className="h-4 w-4" />
            <p className="text-[11px] font-semibold uppercase tracking-wide">Patients Treated</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{treatedPatientCount}</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-white p-3">
          <div className="mb-1 flex items-center gap-2 text-emerald-600">
            <Activity className="h-4 w-4" />
            <p className="text-[11px] font-semibold uppercase tracking-wide">Treatments Done</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{treatmentRecords.length}</p>
        </div>
        <div className="rounded-xl border border-sky-100 bg-white p-3">
          <div className="mb-1 flex items-center gap-2 text-sky-600">
            <CalendarCheck2 className="h-4 w-4" />
            <p className="text-[11px] font-semibold uppercase tracking-wide">Completed Appointments</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{completedAppointments}</p>
        </div>
        <button
          type="button"
          onClick={() => onOpenAppointmentsForDate('today')}
          className="rounded-xl border border-amber-100 bg-white p-3 text-left transition-all hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <div className="mb-1 flex items-center gap-2 text-amber-600">
            <TrendingUp className="h-4 w-4" />
            <p className="text-[11px] font-semibold uppercase tracking-wide">Today Appointments</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{todayAppointments}</p>
          {renderBranchBreakdown(todayAppointmentsByBranch, (value) => `${value} apt${value === 1 ? '' : 's'}`, 'No appointments today.')}
        </button>
        <button
          type="button"
          onClick={() => onOpenAppointmentsForDate('tomorrow')}
          className="rounded-xl border border-blue-100 bg-white p-3 text-left transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <div className="mb-1 flex items-center gap-2 text-blue-600">
            <CalendarCheck2 className="h-4 w-4" />
            <p className="text-[11px] font-semibold uppercase tracking-wide">Tomorrow Appointments</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{tomorrowAppointments}</p>
          {renderBranchBreakdown(tomorrowAppointmentsByBranch, (value) => `${value} apt${value === 1 ? '' : 's'}`, 'No appointments tomorrow.')}
        </button>
        <div className="rounded-xl border border-teal-100 bg-white p-3">
          <div className="mb-1 flex items-center gap-2 text-teal-600">
            <DollarSign className="h-4 w-4" />
            <p className="text-[11px] font-semibold uppercase tracking-wide">Today Income Total</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {todayIncomeByBranch.reduce((sum, row) => sum + row.value, 0).toLocaleString()} MMK
          </p>
          {renderBranchBreakdown(todayIncomeByBranch, (value) => `${value.toLocaleString()} MMK`, 'No income recorded today.')}
        </div>
        <div className="rounded-xl border border-purple-100 bg-white p-3">
          <div className="mb-1 flex items-center gap-2 text-purple-600">
            <DollarSign className="h-4 w-4" />
            <p className="text-[11px] font-semibold uppercase tracking-wide">Monthly Proceeds</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{monthlyIncome.toLocaleString()} MMK</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-white p-3">
          <div className="mb-1 flex items-center gap-2 text-emerald-600">
            <DollarSign className="h-4 w-4" />
            <p className="text-[11px] font-semibold uppercase tracking-wide">Monthly Commission</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{monthlyCommission.toLocaleString()} MMK</p>
        </div>
        <div className="rounded-xl border border-cyan-100 bg-white p-3">
          <div className="mb-1 flex items-center gap-2 text-cyan-600">
            <DollarSign className="h-4 w-4" />
            <p className="text-[11px] font-semibold uppercase tracking-wide">Weekly Commission</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{weeklyCommission.toLocaleString()} MMK</p>
        </div>

      </div>

      {/* Treatment Distribution Chart */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-bold text-gray-900">Treatment Distribution</h3>
        <p className="mb-3 mt-1 text-xs text-gray-500">Most performed treatments as a pie chart.</p>
        <div className="w-full">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                <Tooltip />
                <Pie
                  data={chartData}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="42%"
                  outerRadius={80}
                  label={({ cx, cy, midAngle, outerRadius, percent }) => {
                    const RADIAN = Math.PI / 180;
                    const radius = outerRadius * 0.6;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                    return (
                      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold">
                        {`${(percent * 100).toFixed(0)}%`}
                      </text>
                    );
                  }}
                  labelLine={false}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${entry.name}-${index}`} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Custom color legend */}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 px-1">
            {chartData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-xs text-gray-700">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: pieColors[index % pieColors.length] }}
                />
                <span className="truncate max-w-[140px]">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorHomeView;
