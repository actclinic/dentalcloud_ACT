import React, { useState, useMemo } from 'react';
import { Calendar, Plus, Loader2, Edit2, Trash2, Clock, User, FileText, ChevronLeft, ChevronRight, List, CalendarDays, Eye } from 'lucide-react';
import { Appointment } from '../types';
import { exportAppointmentsToPDF } from '../utils/pdfExport';
import { exportAppointmentsToExcel } from '../utils/excelExport';
import { parseAppointmentClinicalFocus } from '../utils/appointmentClinicalFocus';
import Pagination from './Pagination';
import { ConfirmDialog } from './Shared';
import ExportMenu from './ExportMenu';

interface AppointmentsViewProps {
  appointments: Appointment[];
  loading: boolean;
  onAddAppointment: () => void;
  onEditAppointment: (appointment: Appointment) => void;
  onDeleteAppointment: (id: string) => void;
  onUpdateStatus: (id: string, status: 'Scheduled' | 'Completed' | 'Cancelled') => void;
  onViewChart: (appointment: Appointment) => void;
  onOpenAppointmentLog?: () => void;
  onExportPDF?: () => Promise<void>;
  onExportExcel?: () => Promise<void>;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canViewChart?: boolean;
  canExport?: boolean;
  uiStyle?: 'table' | 'cards';
}

const AppointmentsView: React.FC<AppointmentsViewProps> = ({
  appointments,
  loading,
  onAddAppointment,
  onEditAppointment,
  onDeleteAppointment,
  onUpdateStatus,
  onViewChart,
  onOpenAppointmentLog,
  onExportPDF,
  onExportExcel,
  canCreate = true,
  canEdit = true,
  canDelete = true,
  canViewChart = true,
  canExport = true,
  uiStyle = 'table'
}) => {
  const [viewMode, setViewMode] = useState<'current' | 'calendar'>('current');
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [pastPage, setPastPage] = useState(1);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [showAllPast, setShowAllPast] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateQuickFilter, setDateQuickFilter] = useState<'all' | 'tomorrow' | 'today'>('today');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null);
  const itemsPerPage = 10;

  const toLocalISODate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const tomorrowISO = useMemo(() => {
    const nextDay = new Date();
    nextDay.setDate(nextDay.getDate() + 1);
    return toLocalISODate(nextDay);
  }, []);

  const todayLocalISO = useMemo(() => toLocalISODate(new Date()), []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDateDDMMYYYY = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatTime = (timeString: string) => {
    // Handle both "HH:MM:SS" and "HH:MM" formats
    const time = timeString.split(':').slice(0, 2).join(':');
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Scheduled':
        return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'Completed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Cancelled':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  const activeVisitAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.status !== 'Cancelled'),
    [appointments]
  );

  const firstVisitDateByPatient = useMemo(() => {
    const map = new Map<string, string>();
    activeVisitAppointments.forEach((appointment) => {
      const current = map.get(appointment.patient_id);
      if (!current || appointment.date < current) {
        map.set(appointment.patient_id, appointment.date);
      }
    });
    return map;
  }, [activeVisitAppointments]);

  const isNewPatientToday = (patientId: string) => firstVisitDateByPatient.get(patientId) === todayLocalISO;

  // Filtered data based on search term
  const filteredAppointments = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return appointments.filter(apt => {
      const clinicalPlan = parseAppointmentClinicalFocus(apt.notes);
      const focusTeethText = clinicalPlan.targetTeeth.join(', ');
      const matchesSearch = !searchTerm || (
        apt.patient_name?.toLowerCase().includes(term) ||
        apt.type?.toLowerCase().includes(term) ||
        apt.doctor_name?.toLowerCase().includes(term) ||
        apt.date.toLowerCase().includes(term) ||
        apt.time.toLowerCase().includes(term) ||
        apt.status.toLowerCase().includes(term) ||
        apt.notes?.toLowerCase().includes(term) ||
        clinicalPlan.clinicalFocus.toLowerCase().includes(term) ||
        focusTeethText.includes(term)
      );

      if (!matchesSearch) return false;
      if (dateQuickFilter === 'tomorrow') return apt.date === tomorrowISO;
      if (dateQuickFilter === 'today') return apt.date === todayLocalISO;
      return true;
    });
  }, [appointments, searchTerm, dateQuickFilter, tomorrowISO, todayLocalISO]);

  // Separate upcoming and past appointments
  const upcomingAppointments = filteredAppointments.filter(apt => {
    const aptDate = new Date(apt.date);
    aptDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return aptDate >= today && apt.status === 'Scheduled';
  }).sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.time.localeCompare(b.time);
  });

  const pastAppointments = filteredAppointments.filter(apt => {
    const aptDate = new Date(apt.date);
    aptDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return aptDate < today || apt.status !== 'Scheduled';
  }).sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    return b.time.localeCompare(a.time);
  });

  // Paginated data
  const paginatedUpcoming = useMemo(() => {
    if (showAllUpcoming) return upcomingAppointments;
    const startIndex = (upcomingPage - 1) * itemsPerPage;
    return upcomingAppointments.slice(startIndex, startIndex + itemsPerPage);
  }, [upcomingAppointments, upcomingPage, showAllUpcoming]);

  const paginatedPast = useMemo(() => {
    if (showAllPast) return pastAppointments;
    const startIndex = (pastPage - 1) * itemsPerPage;
    return pastAppointments.slice(startIndex, startIndex + itemsPerPage);
  }, [pastAppointments, pastPage, showAllPast]);

  const [exporting, setExporting] = useState(false);

  const handleDownloadPDF = async () => {
    if (onExportPDF) {
      setExporting(true);
      try {
        await onExportPDF();
      } finally {
        setExporting(false);
      }
    } else {
      exportAppointmentsToPDF(appointments);
    }
  };

  const handleDownloadExcel = async () => {
    if (onExportExcel) {
      setExporting(true);
      try {
        await onExportExcel();
      } finally {
        setExporting(false);
      }
    } else {
      await exportAppointmentsToExcel(appointments);
    }
  };

  const toISODate = (date: Date) => date.toISOString().split('T')[0];

  const calendarGrid = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();
    const startWeekday = firstDay.getDay();

    const cells: Array<{ date: Date | null; isoDate: string | null; inCurrentMonth: boolean }> = [];

    for (let i = 0; i < startWeekday; i++) {
      cells.push({ date: null, isoDate: null, inCurrentMonth: false });
    }

    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, month, day);
      cells.push({ date, isoDate: toISODate(date), inCurrentMonth: true });
    }

    const remainder = cells.length % 7;
    if (remainder !== 0) {
      for (let i = 0; i < 7 - remainder; i++) {
        cells.push({ date: null, isoDate: null, inCurrentMonth: false });
      }
    }

    return cells;
  }, [calendarDate]);

  const appointmentMapByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();

    filteredAppointments.forEach((apt) => {
      const dateKey = apt.date;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(apt);
    });

    map.forEach((apts) => {
      apts.sort((a, b) => a.time.localeCompare(b.time));
    });

    return map;
  }, [filteredAppointments]);

  const selectedDayAppointments = useMemo(() => {
    if (!selectedCalendarDate) return [];
    return appointmentMapByDate.get(selectedCalendarDate) || [];
  }, [selectedCalendarDate, appointmentMapByDate]);

  const monthLabel = calendarDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  const todayISO = toISODate(new Date());

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
    <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white sticky top-0 z-10">
      <div>
        <h2 className="text-xl font-bold text-gray-800">Appointment Schedule</h2>
        <p className="text-sm text-gray-500">Manage patient appointments and scheduling</p>
      </div>
      <div className="flex flex-col gap-3 w-full md:w-auto md:items-end">
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Search appointments..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setUpcomingPage(1); // Reset to first page when searching
              setPastPage(1);
            }}
            className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {onOpenAppointmentLog && (
            <button
              onClick={onOpenAppointmentLog}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 border border-indigo-200 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
            >
              <FileText className="w-4 h-4" /> <span className="hidden sm:inline">Appointment Log</span>
            </button>
          )}
          {canExport && (
            <ExportMenu
              disabled={appointments.length === 0 || exporting}
              onExportPDF={handleDownloadPDF}
              onExportExcel={handleDownloadExcel}
              className="flex-1 md:flex-initial"
            />
          )}
          {canCreate && (
            <button
              onClick={onAddAppointment}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">New Appointment</span>
            </button>
          )}
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 w-full md:w-auto">
          <button
            onClick={() => {
              setDateQuickFilter('all');
              setUpcomingPage(1);
              setPastPage(1);
            }}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md transition-colors ${
              dateQuickFilter === 'all' ? 'bg-white text-indigo-700 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All
          </button>
          <button
            onClick={() => {
              setDateQuickFilter('tomorrow');
              setUpcomingPage(1);
              setPastPage(1);
            }}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md transition-colors ${
              dateQuickFilter === 'tomorrow' ? 'bg-white text-indigo-700 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Tomorrow
          </button>
          <button
            onClick={() => {
              setDateQuickFilter('today');
              setUpcomingPage(1);
              setPastPage(1);
            }}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md transition-colors ${
              dateQuickFilter === 'today' ? 'bg-white text-emerald-700 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Today
          </button>
        </div>
      </div>
    </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center p-12">
          <Loader2 className="animate-spin text-[var(--hover-600)] w-10 h-10" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0 p-6">
          {viewMode === 'current' ? (
            <>
              {uiStyle === 'cards' ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-indigo-600" />
                      Upcoming Appointments
                    </h3>
                    {paginatedUpcoming.length === 0 ? (
                      <div className="text-center py-8 text-gray-400 italic text-sm">No upcoming appointments.</div>
                    ) : (
                      <div className="space-y-3">
                        {paginatedUpcoming.map((appointment) => (
                          <div key={appointment.id} className="rounded-xl border border-gray-200 bg-white p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-gray-900">{appointment.patient_name || 'Unknown Patient'}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  Dr. {appointment.doctor_name || '-'} • {formatDateDDMMYYYY(appointment.date)} • {formatTime(appointment.time)}
                                </p>
                                <p className="text-xs text-gray-600 mt-1">{appointment.type || 'Checkup'}</p>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getStatusColor(appointment.status)}`}>
                                {appointment.status}
                              </span>
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                              {canViewChart && (
                                <button onClick={() => onViewChart(appointment)} className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors">
                                  <Eye className="w-3.5 h-3.5" />
                                  View Chart
                                </button>
                              )}
                              <select value={appointment.status} onChange={(e) => onUpdateStatus(appointment.id, e.target.value as any)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                                <option value="Scheduled">Scheduled</option>
                                <option value="Completed">Completed</option>
                                <option value="Cancelled">Cancelled</option>
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-gray-600" />
                      Past Appointments
                    </h3>
                    {paginatedPast.length === 0 ? (
                      <div className="text-center py-8 text-gray-400 italic text-sm">No past appointments.</div>
                    ) : (
                      <div className="space-y-3">
                        {paginatedPast.map((appointment) => (
                          <div key={appointment.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4 opacity-90">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-gray-800">{appointment.patient_name || 'Unknown Patient'}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  Dr. {appointment.doctor_name || '-'} • {formatDateDDMMYYYY(appointment.date)} • {formatTime(appointment.time)}
                                </p>
                                <p className="text-xs text-gray-600 mt-1">{appointment.type || 'Checkup'}</p>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getStatusColor(appointment.status)}`}>
                                {appointment.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (() => {
                const tableRows = dateQuickFilter === 'today'
                  ? filteredAppointments
                      .slice()
                      .sort((a, b) => a.time.localeCompare(b.time))
                  : [...paginatedUpcoming, ...paginatedPast];

                return (
                  <div className="rounded-2xl border border-indigo-200 bg-white shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-[960px] w-full text-sm">
                        <thead className="sticky top-0 z-10 bg-indigo-50 border-b border-indigo-200">
                          <tr className="text-indigo-700">
                            <th className="px-3 py-3 text-left font-bold uppercase text-xs tracking-wide">No.</th>
                            <th className="px-3 py-3 text-left font-bold uppercase text-xs tracking-wide">Dr. Name</th>
                            <th className="px-3 py-3 text-left font-bold uppercase text-xs tracking-wide">Date</th>
                            <th className="px-3 py-3 text-left font-bold uppercase text-xs tracking-wide">Time</th>
                            <th className="px-3 py-3 text-left font-bold uppercase text-xs tracking-wide">Pt Name</th>
                            <th className="px-3 py-3 text-left font-bold uppercase text-xs tracking-wide">Tx</th>
                            <th className="px-3 py-3 text-left font-bold uppercase text-xs tracking-wide">Status</th>
                            <th className="px-3 py-3 text-left font-bold uppercase text-xs tracking-wide">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tableRows.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="px-3 py-8 text-center text-gray-400 italic">
                                No appointments found.
                              </td>
                            </tr>
                          ) : (
                            tableRows.map((appointment, index) => {
                              const rowNo = index + 1;
                              const rowStyle = appointment.status === 'Cancelled'
                                ? 'bg-red-100/80 border-l-4 border-l-red-500'
                                : appointment.status === 'Completed'
                                ? 'bg-emerald-100/80 border-l-4 border-l-emerald-500'
                                : 'bg-white';
                              return (
                                <tr key={appointment.id} className={`${rowStyle} border-b border-gray-100 last:border-b-0`}>
                                  <td className="px-3 py-3 align-top font-semibold text-gray-700">{rowNo}</td>
                                  <td className="px-3 py-3 align-top text-gray-800">{appointment.doctor_name ? `Dr. ${appointment.doctor_name}` : '-'}</td>
                                  <td className="px-3 py-3 align-top text-gray-700 whitespace-nowrap">{formatDateDDMMYYYY(appointment.date)}</td>
                                  <td className="px-3 py-3 align-top text-gray-700 whitespace-nowrap">{formatTime(appointment.time)}</td>
                                  <td className="px-3 py-3 align-top font-medium text-gray-900">{appointment.patient_name || 'Unknown Patient'}</td>
                                  <td className="px-3 py-3 align-top text-gray-700">{appointment.type || 'Checkup'}</td>
                                  <td className="px-3 py-3 align-top">
                                    <select
                                      value={appointment.status}
                                      onChange={(e) => onUpdateStatus(appointment.id, e.target.value as any)}
                                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                    >
                                      <option value="Scheduled">Scheduled</option>
                                      <option value="Completed">Completed</option>
                                      <option value="Cancelled">Cancelled</option>
                                    </select>
                                  </td>
                                  <td className="px-3 py-3 align-top">
                                    <div className="flex items-center gap-1.5">
                                      {canViewChart && (
                                        <button
                                          onClick={() => onViewChart(appointment)}
                                          className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                                          title="Open patient chart"
                                        >
                                          <Eye className="w-3.5 h-3.5" />
                                          Chart
                                        </button>
                                      )}
                                      {canEdit && (
                                        <button
                                          onClick={() => onEditAppointment(appointment)}
                                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                                          title="Edit appointment"
                                        >
                                          <Edit2 className="w-4 h-4" />
                                        </button>
                                      )}
                                      {canDelete && (
                                        <button
                                          onClick={() => {
                                            setAppointmentToDelete(appointment.id);
                                            setDeleteConfirmOpen(true);
                                          }}
                                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                          title="Delete appointment"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {dateQuickFilter !== 'today' && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-gray-100 bg-white p-3">
                    <p className="text-xs font-semibold text-gray-500 mb-2">Upcoming Pagination</p>
                    <Pagination
                      totalItems={upcomingAppointments.length}
                      itemsPerPage={itemsPerPage}
                      currentPage={upcomingPage}
                      onPageChange={setUpcomingPage}
                      showAll={showAllUpcoming}
                      onToggleShowAll={() => setShowAllUpcoming(!showAllUpcoming)}
                    />
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-white p-3">
                    <p className="text-xs font-semibold text-gray-500 mb-2">Past Pagination</p>
                    <Pagination
                      totalItems={pastAppointments.length}
                      itemsPerPage={itemsPerPage}
                      currentPage={pastPage}
                      onPageChange={setPastPage}
                      showAll={showAllPast}
                      onToggleShowAll={() => setShowAllPast(!showAllPast)}
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                  title="Previous month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h3 className="text-lg font-semibold text-gray-800">{monthLabel}</h3>
                <button
                  onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                  title="Next month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-2 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="text-xs font-bold text-gray-500 uppercase text-center py-1">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {calendarGrid.map((cell, idx) => {
                  const dayAppointments = cell.isoDate ? (appointmentMapByDate.get(cell.isoDate) || []) : [];
                  const isSelected = !!cell.isoDate && cell.isoDate === selectedCalendarDate;
                  const isToday = !!cell.isoDate && cell.isoDate === todayISO;

                  return (
                    <button
                      key={`${cell.isoDate || 'empty'}-${idx}`}
                      onClick={() => cell.isoDate && setSelectedCalendarDate(cell.isoDate)}
                      disabled={!cell.isoDate}
                      className={`min-h-[96px] text-left border rounded-xl p-2 transition-colors ${
                        !cell.inCurrentMonth
                          ? 'bg-gray-50 border-gray-100 cursor-default'
                          : isSelected
                          ? 'bg-indigo-50 border-indigo-300'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {cell.date && (
                        <>
                          <div className={`text-xs font-semibold mb-1 ${isToday ? 'text-indigo-700' : 'text-gray-700'}`}>
                            {cell.date.getDate()}
                          </div>
                          <div className="space-y-1">
                            {dayAppointments.slice(0, 3).map((apt) => (
                              <div
                                key={apt.id}
                                className={`text-[10px] px-1.5 py-0.5 rounded truncate border ${getStatusColor(apt.status)}`}
                                title={`${formatTime(apt.time)} - ${apt.patient_name || 'Unknown Patient'}`}
                              >
                                {formatTime(apt.time)} {apt.patient_name || 'Unknown'}
                              </div>
                            ))}
                            {dayAppointments.length > 3 && (
                              <div className="text-[10px] text-gray-500">+{dayAppointments.length - 3} more</div>
                            )}
                          </div>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 border border-gray-200 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-gray-800 mb-3">
                  {selectedCalendarDate
                    ? `Appointments for ${formatDate(selectedCalendarDate)}`
                    : 'Select a date to view appointments'}
                </h4>

                {!selectedCalendarDate || selectedDayAppointments.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No appointments found for this date.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDayAppointments.map((appointment) => {
                      const clinicalPlan = parseAppointmentClinicalFocus(appointment.notes);
                      return (
                        <div key={appointment.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{appointment.patient_name || 'Unknown Patient'}</div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {formatTime(appointment.time)} • {appointment.type || 'Checkup'}
                              {appointment.doctor_name ? ` • Dr. ${appointment.doctor_name}` : ''}
                            </div>
                            {(clinicalPlan.clinicalFocus || clinicalPlan.targetTeeth.length > 0) && (
                              <div className="mt-1 text-xs text-indigo-700">
                                {clinicalPlan.clinicalFocus ? `Focus: ${clinicalPlan.clinicalFocus}` : ''}
                                {clinicalPlan.clinicalFocus && clinicalPlan.targetTeeth.length > 0 ? ' • ' : ''}
                                {clinicalPlan.targetTeeth.length > 0 ? `Teeth: ${clinicalPlan.targetTeeth.join(', ')}` : ''}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => onViewChart(appointment)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                              title="Open patient chart"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View Chart
                            </button>
                            <select
                              value={appointment.status}
                              onChange={(e) => onUpdateStatus(appointment.id, e.target.value as any)}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1"
                            >
                              <option value="Scheduled">Scheduled</option>
                              <option value="Completed">Completed</option>
                              <option value="Cancelled">Cancelled</option>
                            </select>
                            <button onClick={() => onEditAppointment(appointment)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setAppointmentToDelete(appointment.id);
                                setDeleteConfirmOpen(true);
                              }}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {canDelete && (
        <ConfirmDialog
          isOpen={deleteConfirmOpen}
          title="Delete Appointment"
          message="Are you sure you want to delete this appointment? This action cannot be undone."
          confirmText="Delete Appointment"
          cancelText="Cancel"
          type="danger"
          onConfirm={() => {
            if (appointmentToDelete) {
              onDeleteAppointment(appointmentToDelete);
              setAppointmentToDelete(null);
            }
            setDeleteConfirmOpen(false);
          }}
          onCancel={() => {
            setAppointmentToDelete(null);
            setDeleteConfirmOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default AppointmentsView;




