import React, { useMemo } from 'react';
import { Users, Activity, CalendarCheck2, TrendingUp, DollarSign } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { Appointment, ClinicalRecord } from '../types';

interface DoctorHomeViewProps {
  appointments: Appointment[];
  treatmentRecords: ClinicalRecord[];
}

const DoctorHomeView: React.FC<DoctorHomeViewProps> = ({ appointments, treatmentRecords }) => {
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
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
  
  const monthlyIncome = useMemo(() => {
    return treatmentRecords
      .filter((record) => (record.date || '').slice(0, 7) === currentMonthKey)
      .reduce((sum, record) => sum + Number(record.cost || 0), 0);
  }, [treatmentRecords, currentMonthKey]);

  const monthlyCommission = useMemo(() => {
    return treatmentRecords
      .filter((record) => (record.date || '').slice(0, 7) === currentMonthKey)
      .reduce((sum, record) => sum + Number(record.doctorEarnings || 0), 0);
  }, [treatmentRecords, currentMonthKey]);

  const weeklyCommission = useMemo(() => {
    return treatmentRecords
      .filter((record) => {
        if (!record.date) return false;
        const recordDate = new Date(`${record.date}T00:00:00`);
        return recordDate >= weekRange.weekStart && recordDate <= weekRange.weekEnd;
      })
      .reduce((sum, record) => sum + Number(record.doctorEarnings || 0), 0);
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

  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-3">
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
        <div className="rounded-xl border border-amber-100 bg-white p-3">
          <div className="mb-1 flex items-center gap-2 text-amber-600">
            <TrendingUp className="h-4 w-4" />
            <p className="text-[11px] font-semibold uppercase tracking-wide">Today Appointments</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{todayAppointments}</p>
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

      <div className="rounded-xl border border-gray-200 bg-white p-4">
      </div>

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
