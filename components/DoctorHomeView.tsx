import React, { useEffect, useMemo, useState } from 'react';
import { Users, Activity, CalendarCheck2, TrendingUp, DollarSign, CalendarRange, RotateCcw } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Appointment, ClinicalRecord, Location, Patient } from '../types';
import PatientQRScanButton from './PatientQRScanButton';
import {
  buildDoctorReportingSummary,
  formatDoctorReportingRange,
  getThisMonthReportingRange,
  getThisWeekReportingRange,
  getTodayReportingRange,
  toLocalISODate,
  validateDoctorReportingRange,
  type DoctorReportingRange
} from '../utils/doctorDashboardReporting';

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
  const [calendarNow, setCalendarNow] = useState(() => new Date());
  const today = useMemo(() => toLocalISODate(calendarNow), [calendarNow]);
  const tomorrow = useMemo(() => {
    const nextDay = new Date(calendarNow);
    nextDay.setDate(nextDay.getDate() + 1);
    return toLocalISODate(nextDay);
  }, [calendarNow]);
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const scheduleNextMidnight = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
      timeoutId = setTimeout(() => {
        setCalendarNow(new Date());
        scheduleNextMidnight();
      }, nextMidnight.getTime() - now.getTime());
    };
    scheduleNextMidnight();
    return () => clearTimeout(timeoutId);
  }, []);
  const initialRange = useMemo(() => getTodayReportingRange(), []);
  const [draftRange, setDraftRange] = useState<DoctorReportingRange>(initialRange);
  const [appliedRange, setAppliedRange] = useState<DoctorReportingRange>(initialRange);
  const [rangeError, setRangeError] = useState('');

  const reportingSummary = useMemo(
    () => buildDoctorReportingSummary(appointments, treatmentRecords, appliedRange),
    [appointments, treatmentRecords, appliedRange]
  );

  const applyRange = (range: DoctorReportingRange) => {
    const validationError = validateDoctorReportingRange(range);
    if (validationError) {
      setRangeError(validationError);
      return;
    }
    setDraftRange(range);
    setAppliedRange(range);
    setRangeError('');
  };

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

  const rangeProductionByBranch = useMemo(() => {
    return buildBranchTotals(
      reportingSummary.treatmentRecords,
      (record) => Number(record.cost || 0),
      visibleBranchIds
    );
  }, [reportingSummary.treatmentRecords, branchNameById, visibleBranchIds]);

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
  
  const topTreatments = useMemo(() => {
    const countMap = new Map<string, number>();
    reportingSummary.treatmentRecords.forEach((record) => {
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
  }, [reportingSummary.treatmentRecords]);

  const chartData = topTreatments;
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

      <section className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/90 via-white to-cyan-50/60 p-4 shadow-sm" aria-labelledby="doctor-reporting-period-heading">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-indigo-700">
              <CalendarRange size={18} aria-hidden="true" />
              <h3 id="doctor-reporting-period-heading" className="text-sm font-black uppercase tracking-wide">Reporting Period</h3>
            </div>
            <p className="mt-1 text-xs font-semibold text-gray-600">Showing report figures for {formatDoctorReportingRange(appliedRange)}.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => applyRange(getTodayReportingRange())} className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">Today</button>
              <button type="button" onClick={() => applyRange(getThisWeekReportingRange())} className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">This Week</button>
              <button type="button" onClick={() => applyRange(getThisMonthReportingRange())} className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">This Month</button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:min-w-[31rem] lg:grid-cols-[1fr_1fr_auto]">
            <label className="min-w-0">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-gray-500">Start Date</span>
              <input type="date" value={draftRange.startDate} aria-invalid={Boolean(rangeError)} aria-describedby={rangeError ? 'doctor-reporting-range-error' : undefined} onChange={(event) => { setDraftRange((current) => ({ ...current, startDate: event.target.value })); setRangeError(''); }} className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
            </label>
            <label className="min-w-0">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-gray-500">End Date</span>
              <input type="date" value={draftRange.endDate} aria-invalid={Boolean(rangeError)} aria-describedby={rangeError ? 'doctor-reporting-range-error' : undefined} onChange={(event) => { setDraftRange((current) => ({ ...current, endDate: event.target.value })); setRangeError(''); }} className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
            </label>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
              <button type="button" onClick={() => applyRange(draftRange)} className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">Apply</button>
              <button type="button" onClick={() => applyRange(getTodayReportingRange())} title="Reset reporting period to today" aria-label="Reset reporting period to today" className="rounded-xl border border-indigo-200 bg-white p-2.5 text-indigo-700 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><RotateCcw size={18} /></button>
            </div>
          </div>
        </div>
        {rangeError && <p id="doctor-reporting-range-error" role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{rangeError}</p>}
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <div className="rounded-xl border border-indigo-100 bg-white p-3">
          <div className="mb-1 flex items-center gap-2 text-indigo-600">
            <Users className="h-4 w-4" />
            <p className="text-[11px] font-semibold uppercase tracking-wide">Patients Treated</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{reportingSummary.treatedPatientCount}</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-white p-3">
          <div className="mb-1 flex items-center gap-2 text-emerald-600">
            <Activity className="h-4 w-4" />
            <p className="text-[11px] font-semibold uppercase tracking-wide">Treatments Done</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{reportingSummary.treatmentCount}</p>
        </div>
        <div className="rounded-xl border border-sky-100 bg-white p-3">
          <div className="mb-1 flex items-center gap-2 text-sky-600">
            <CalendarCheck2 className="h-4 w-4" />
            <p className="text-[11px] font-semibold uppercase tracking-wide">Completed Appointments</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{reportingSummary.completedAppointmentCount}</p>
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
            <p className="text-[11px] font-semibold uppercase tracking-wide">Selected Period Production</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {reportingSummary.production.toLocaleString()} MMK
          </p>
          {renderBranchBreakdown(rangeProductionByBranch, (value) => `${value.toLocaleString()} MMK`, 'No production recorded in this period.')}
        </div>
        <div className="rounded-xl border border-purple-100 bg-white p-3">
          <div className="mb-1 flex items-center gap-2 text-purple-600">
            <DollarSign className="h-4 w-4" />
            <p className="text-[11px] font-semibold uppercase tracking-wide">Selected Period Commission</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{reportingSummary.commission.toLocaleString()} MMK</p>
          <p className="mt-2 text-[10px] font-semibold text-gray-400">
            {reportingSummary.legacyCommissionEntryCount > 0
              ? 'Includes legacy earnings dated by treatment where payment-date ledger data is unavailable.'
              : 'Based on payments collected in this period.'}
          </p>
        </div>

      </div>

      {/* Treatment Distribution Chart */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-bold text-gray-900">Treatment Distribution</h3>
        <p className="mb-3 mt-1 text-xs text-gray-500">Most performed treatments for {formatDoctorReportingRange(appliedRange)}.</p>
        {chartData.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 text-center">
            <Activity size={34} className="mb-3 text-gray-300" aria-hidden="true" />
            <p className="font-bold text-gray-600">No treatments in this reporting period.</p>
            <p className="mt-1 text-xs text-gray-400">Choose another date range to review treatment distribution.</p>
          </div>
        ) : <div className="w-full">
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
        </div>}
      </div>
    </div>
  );
};

export default DoctorHomeView;
