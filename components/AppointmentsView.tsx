import React, { useState, useMemo } from 'react';
import { Calendar, Plus, Loader2, Edit2, Trash2, Clock, User, FileText, ChevronLeft, ChevronRight, List, CalendarDays, Eye } from 'lucide-react';
import { Appointment, Patient } from '../types';
import { exportAppointmentsToPDF } from '../utils/pdfExport';
import { exportAppointmentsToExcel } from '../utils/excelExport';
import { parseAppointmentClinicalFocus } from '../utils/appointmentClinicalFocus';
import Pagination from './Pagination';
import { ConfirmDialog } from './Shared';
import ExportMenu from './ExportMenu';
import PatientQRScanButton from './PatientQRScanButton';

interface AppointmentsViewProps {
  appointments: Appointment[];
  patients: Patient[];
  loading: boolean;
  onAddAppointment: () => void;
  onEditAppointment: (appointment: Appointment) => void;
  onDeleteAppointment: (id: string) => void;
  onUpdateStatus: (id: string, status: 'Scheduled' | 'Completed' | 'Cancelled') => void;
  onViewChart: (appointment: Appointment) => void;
  onSelectPatient: (patient: Patient) => void;
  onConvertLead?: (appointment: Appointment) => void;
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
  patients,
  loading,
  onAddAppointment,
  onEditAppointment,
  onDeleteAppointment,
  onUpdateStatus,
  onViewChart,
  onSelectPatient,
  onConvertLead,
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
  const [dateQuickFilter, setDateQuickFilter] = useState<'all' | 'tomorrow' | 'today' | 'custom'>('today');
  const [dateFilter, setDateFilter] = useState('');
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

  const parseLocalDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
  };

  const resetAppointmentPages = () => {
    setUpcomingPage(1);
    setPastPage(1);
  };

  const applyQuickDateFilter = (filter: 'all' | 'tomorrow' | 'today') => {
    setDateQuickFilter(filter);
    setDateFilter('');
    setSelectedCalendarDate(null);
    resetAppointmentPages();
  };

  const applySingleDateFilter = (isoDate: string) => {
    setDateQuickFilter('custom');
    setDateFilter(isoDate);
    setSelectedCalendarDate(isoDate);
    setCalendarDate(parseLocalDate(isoDate));
    resetAppointmentPages();
  };

  const clearDateFilter = () => {
    setDateQuickFilter('all');
    setDateFilter('');
    setSelectedCalendarDate(null);
    resetAppointmentPages();
  };

  const tomorrowISO = useMemo(() => {
    const nextDay = new Date();
    nextDay.setDate(nextDay.getDate() + 1);
    return toLocalISODate(nextDay);
  }, []);

  const todayLocalISO = useMemo(() => toLocalISODate(new Date()), []);

  const formatDate = (dateString: string) => {
    const date = parseLocalDate(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDateDDMMYYYY = (dateString: string) => {
    const date = parseLocalDate(dateString);
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

  const isNewPatientAppointment = (appointment: Appointment) => !appointment.patient_id;
  const renderNewPatientBadge = (compact = false) => (
    <span className={`rounded bg-amber-100 ${compact ? 'px-1.5' : 'px-2'} py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700`}>
      New Patient
    </span>
  );

  const activeVisitAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.status !== 'Cancelled'),
    [appointments]
  );

  const firstVisitDateByPatient = useMemo(() => {
    const map = new Map<string, string>();
    activeVisitAppointments.forEach((appointment) => {
      if (!appointment.patient_id) return;
      const current = map.get(appointment.patient_id);
      if (!current || appointment.date < current) {
        map.set(appointment.patient_id, appointment.date);
      }
    });
    return map;
  }, [activeVisitAppointments]);

  const isNewPatientToday = (patientId: string) => firstVisitDateByPatient.get(patientId) === todayLocalISO;

  const searchFilteredAppointments = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return appointments.filter(apt => {
      const clinicalPlan = parseAppointmentClinicalFocus(apt.notes);
      const focusTeethText = clinicalPlan.targetTeeth.join(', ');
      const matchesSearch = !searchTerm || (
        apt.patient_name?.toLowerCase().includes(term) ||
        apt.guest_phone?.toLowerCase().includes(term) ||
        apt.guest_source?.toLowerCase().includes(term) ||
        apt.guest_notes?.toLowerCase().includes(term) ||
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
      return true;
    });
  }, [appointments, searchTerm]);

  const filteredAppointments = useMemo(() => {
    return searchFilteredAppointments.filter(apt => {
      if (dateQuickFilter === 'tomorrow') return apt.date === tomorrowISO;
      if (dateQuickFilter === 'today') return apt.date === todayLocalISO;
      if (dateQuickFilter === 'custom' && dateFilter) return apt.date === dateFilter;
      return true;
    });
  }, [searchFilteredAppointments, dateQuickFilter, tomorrowISO, todayLocalISO, dateFilter]);

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
      cells.push({ date, isoDate: toLocalISODate(date), inCurrentMonth: true });
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

    searchFilteredAppointments.forEach((apt) => {
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
  }, [searchFilteredAppointments]);

  const selectedDayAppointments = useMemo(() => {
    if (!selectedCalendarDate) return [];
    return appointmentMapByDate.get(selectedCalendarDate) || [];
  }, [selectedCalendarDate, appointmentMapByDate]);

  const monthLabel = calendarDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  const todayISO = todayLocalISO;

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
    {/* Header: Title + Action Buttons (no search) */}
    <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-white sticky top-0 z-10">
      <div>
        <h2 className="text-lg md:text-xl font-bold text-gray-800">Appointment Schedule</h2>
        <p className="text-xs md:text-sm text-gray-500">Manage patient appointments and scheduling</p>
      </div>
      <div className="flex flex-wrap gap-2 w-full md:w-auto">
        <div className="inline-flex flex-1 md:flex-initial rounded-lg border border-gray-200 bg-gray-50 p-1">
          <button
            onClick={() => setViewMode('current')}
            className={`inline-flex flex-1 md:flex-initial items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors ${
              viewMode === 'current' ? 'bg-white text-indigo-700 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'
            }`}
            title="List view"
          >
            <List className="w-3.5 h-3.5" />
            List
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`inline-flex flex-1 md:flex-initial items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors ${
              viewMode === 'calendar' ? 'bg-white text-indigo-700 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'
            }`}
            title="Calendar view"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            Calendar
          </button>
        </div>
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
        <PatientQRScanButton
          patients={patients}
          onSelectPatient={onSelectPatient}
          className="flex-1 md:flex-initial flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
        />
        {canCreate && (
          <button
            onClick={onAddAppointment}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">New Appointment</span>
          </button>
        )}
      </div>
    </div>

    {/* Toolbar: Search + Date Filters (below header) */}
    <div className="px-4 md:px-6 py-2 md:py-3 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row gap-2 md:gap-3 items-start md:items-center">
      <div className="relative w-full md:w-72 lg:w-80">
        <input
          type="text"
          placeholder="Search appointments..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            resetAppointmentPages();
          }}
          className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full bg-white"
        />
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto md:ml-auto">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 whitespace-nowrap">
            <span>Filter day</span>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => {
                const nextDate = e.target.value;
                if (nextDate) {
                  applySingleDateFilter(nextDate);
                } else {
                  clearDateFilter();
                }
              }}
              className="h-8 rounded-lg border border-gray-200 px-2 text-sm font-normal text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </label>
          <button
            onClick={clearDateFilter}
            className="h-8 inline-flex items-center justify-center rounded-lg border border-gray-200 px-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors bg-white"
          >
            Clear
          </button>
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
          <button
            onClick={() => {
              applyQuickDateFilter('all');
            }}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md transition-colors ${
              dateQuickFilter === 'all' ? 'bg-white text-indigo-700 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All
          </button>
          <button
            onClick={() => {
              applyQuickDateFilter('tomorrow');
            }}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md transition-colors ${
              dateQuickFilter === 'tomorrow' ? 'bg-white text-indigo-700 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Tomorrow
          </button>
          <button
            onClick={() => {
              applyQuickDateFilter('today');
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
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-semibold text-gray-900">{appointment.patient_name || 'Unknown Patient'}</p>
                                  {isNewPatientAppointment(appointment) && renderNewPatientBadge()}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                  Dr. {appointment.doctor_name || '-'} • {formatDateDDMMYYYY(appointment.date)} • {formatTime(appointment.time)}
                                </p>
                                {isNewPatientAppointment(appointment) && (
                                  <p className="text-xs text-amber-700 mt-1">
                                    {appointment.guest_phone || 'No phone'}{appointment.guest_source ? ` • ${appointment.guest_source}` : ''}
                                  </p>
                                )}
                                <p className="text-xs text-gray-600 mt-1">{appointment.type || 'Checkup'}</p>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getStatusColor(appointment.status)}`}>
                                {appointment.status}
                              </span>
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                              {canViewChart && appointment.patient_id && (
                                <button onClick={() => onViewChart(appointment)} className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors">
                                  <Eye className="w-3.5 h-3.5" />
                                  View Chart
                                </button>
                              )}
                              {isNewPatientAppointment(appointment) && onConvertLead && (
                                <button onClick={() => onConvertLead(appointment)} className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors">
                                  <User className="w-3.5 h-3.5" />
                                  Convert
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
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-semibold text-gray-800">{appointment.patient_name || 'Unknown Patient'}</p>
                                  {isNewPatientAppointment(appointment) && renderNewPatientBadge()}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                  Dr. {appointment.doctor_name || '-'} • {formatDateDDMMYYYY(appointment.date)} • {formatTime(appointment.time)}
                                </p>
                                {isNewPatientAppointment(appointment) && (
                                  <p className="text-xs text-amber-700 mt-1">
                                    {appointment.guest_phone || 'No phone'}{appointment.guest_source ? ` • ${appointment.guest_source}` : ''}
                                  </p>
                                )}
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
                    <div className="max-h-[calc(100vh-260px)] overflow-auto">
                      <table className="min-w-[960px] w-full text-sm">
                        <thead className="bg-indigo-50 border-b border-indigo-200">
                          <tr className="text-indigo-700">
                            <th className="sticky top-0 z-20 bg-indigo-50 px-3 py-3 text-left font-bold uppercase text-xs tracking-wide">No.</th>
                            <th className="sticky top-0 z-20 bg-indigo-50 px-3 py-3 text-left font-bold uppercase text-xs tracking-wide">Dr. Name</th>
                            <th className="sticky top-0 z-20 bg-indigo-50 px-3 py-3 text-left font-bold uppercase text-xs tracking-wide">Date</th>
                            <th className="sticky top-0 z-20 bg-indigo-50 px-3 py-3 text-left font-bold uppercase text-xs tracking-wide">Time</th>
                            <th className="sticky top-0 z-20 bg-indigo-50 px-3 py-3 text-left font-bold uppercase text-xs tracking-wide">Pt Name</th>
                            <th className="sticky top-0 z-20 bg-indigo-50 px-3 py-3 text-left font-bold uppercase text-xs tracking-wide">Tx</th>
                            <th className="sticky top-0 z-20 bg-indigo-50 px-3 py-3 text-left font-bold uppercase text-xs tracking-wide">Status</th>
                            <th className="sticky top-0 z-20 bg-indigo-50 px-3 py-3 text-left font-bold uppercase text-xs tracking-wide">Actions</th>
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
                                  <td className="px-3 py-3 align-top font-medium text-gray-900">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span>{appointment.patient_name || 'Unknown Patient'}</span>
                                      {isNewPatientAppointment(appointment) && renderNewPatientBadge(true)}
                                    </div>
                                    {isNewPatientAppointment(appointment) && (
                                      <div className="mt-1 text-xs font-normal text-amber-700">
                                        {appointment.guest_phone || 'No phone'}{appointment.guest_source ? ` • ${appointment.guest_source}` : ''}
                                      </div>
                                    )}
                                  </td>
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
                                      {canViewChart && appointment.patient_id && (
                                        <button
                                          onClick={() => onViewChart(appointment)}
                                          className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                                          title="Open patient chart"
                                        >
                                          <Eye className="w-3.5 h-3.5" />
                                          Chart
                                        </button>
                                      )}
                                      {isNewPatientAppointment(appointment) && onConvertLead && (
                                        <button
                                          onClick={() => onConvertLead(appointment)}
                                          className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
                                          title="Convert new patient to registered patient"
                                        >
                                          <User className="w-3.5 h-3.5" />
                                          Convert
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
              {/* Calendar Navigation */}
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <button
                  onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}
                  className="p-1.5 md:p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                  title="Previous month"
                >
                  <ChevronLeft className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </button>
                <h3 className="text-sm md:text-lg font-semibold text-gray-800">{monthLabel}</h3>
                <button
                  onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}
                  className="p-1.5 md:p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                  title="Next month"
                >
                  <ChevronRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </button>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-0.5 md:gap-2 mb-1 md:mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="text-[10px] md:text-xs font-bold text-gray-500 uppercase text-center py-0.5 md:py-1">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-0.5 md:gap-2">
                {calendarGrid.map((cell, idx) => {
                  const dayAppointments = cell.isoDate ? (appointmentMapByDate.get(cell.isoDate) || []) : [];
                  const isSelected = !!cell.isoDate && cell.isoDate === selectedCalendarDate;
                  const isToday = !!cell.isoDate && cell.isoDate === todayISO;

                  return (
                    <button
                      key={`${cell.isoDate || 'empty'}-${idx}`}
                      onClick={() => cell.isoDate && applySingleDateFilter(cell.isoDate)}
                      disabled={!cell.isoDate}
                      className={`min-h-[36px] md:min-h-[80px] text-left border rounded md:rounded-xl p-0.5 md:p-2 transition-colors ${
                        !cell.inCurrentMonth
                          ? 'bg-gray-50 border-gray-100 cursor-default'
                          : isSelected
                          ? 'bg-indigo-50 border-indigo-300'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {cell.date && (
                        <>
                          <div className={`text-[11px] md:text-xs font-semibold mb-0 md:mb-1 ${isToday ? 'text-indigo-700' : 'text-gray-700'}`}>
                            {cell.date.getDate()}
                          </div>
                          <div className="hidden md:block space-y-0.5 md:space-y-1">
                            {dayAppointments.slice(0, 2).map((apt) => (
                              <div
                                key={apt.id}
                                className={`text-[9px] md:text-[10px] px-1 md:px-1.5 py-0.5 rounded truncate border ${getStatusColor(apt.status)}`}
                                title={`${formatTime(apt.time)} - ${apt.patient_name || 'Unknown Patient'}`}
                              >
                                {formatTime(apt.time)} {apt.patient_name || 'Unknown'}
                              </div>
                            ))}
                            {dayAppointments.length > 2 && (
                              <div className="text-[9px] md:text-[10px] text-gray-500">+{dayAppointments.length - 2} more</div>
                            )}
                          </div>
                          {/* Mobile: show dot indicators for appointments */}
                          <div className="flex md:hidden gap-0.5 mt-0.5 flex-wrap">
                            {dayAppointments.slice(0, 4).map((apt) => (
                              <span
                                key={apt.id}
                                className={`inline-block w-1.5 h-1.5 rounded-full ${
                                  apt.status === 'Scheduled' ? 'bg-blue-500' :
                                  apt.status === 'Completed' ? 'bg-emerald-500' :
                                  'bg-red-400'
                                }`}
                                title={`${formatTime(apt.time)} - ${apt.patient_name || 'Unknown Patient'}`}
                              />
                            ))}
                            {dayAppointments.length > 4 && (
                              <span className="text-[8px] text-gray-400">+{dayAppointments.length - 4}</span>
                            )}
                          </div>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Selected Day Appointments */}
              <div className="mt-3 md:mt-6 border border-gray-200 rounded-lg md:rounded-xl p-3 md:p-4">
                <h4 className="text-xs md:text-sm font-semibold text-gray-800 mb-2 md:mb-3">
                  {selectedCalendarDate
                    ? `Appointments for ${formatDate(selectedCalendarDate)}`
                    : 'Select a date to view appointments'}
                </h4>

                {!selectedCalendarDate || selectedDayAppointments.length === 0 ? (
                  <p className="text-xs md:text-sm text-gray-500 italic">No appointments found for this date.</p>
                ) : (
                  <div className="space-y-1.5 md:space-y-2">
                    {selectedDayAppointments.map((appointment) => {
                      const clinicalPlan = parseAppointmentClinicalFocus(appointment.notes);
                      return (
                        <div key={appointment.id} className="flex flex-col md:flex-row md:items-center justify-between p-2 md:p-3 border border-gray-200 rounded-lg gap-2 md:gap-0">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 md:gap-2 text-xs md:text-sm font-medium text-gray-900">
                              <span className="truncate">{appointment.patient_name || 'Unknown Patient'}</span>
                              {isNewPatientAppointment(appointment) && renderNewPatientBadge(true)}
                            </div>
                            <div className="text-[11px] md:text-xs text-gray-500 mt-0.5 truncate">
                              {formatTime(appointment.time)} • {appointment.type || 'Checkup'}
                              {appointment.doctor_name ? ` • Dr. ${appointment.doctor_name}` : ''}
                            </div>
                            {isNewPatientAppointment(appointment) && (
                              <div className="mt-0.5 text-[11px] md:text-xs text-amber-700 truncate">
                                {appointment.guest_phone || 'No phone'}{appointment.guest_source ? ` • ${appointment.guest_source}` : ''}
                              </div>
                            )}
                            {(clinicalPlan.clinicalFocus || clinicalPlan.targetTeeth.length > 0) && (
                              <div className="mt-0.5 text-[11px] md:text-xs text-indigo-700 truncate">
                                {clinicalPlan.clinicalFocus ? `Focus: ${clinicalPlan.clinicalFocus}` : ''}
                                {clinicalPlan.clinicalFocus && clinicalPlan.targetTeeth.length > 0 ? ' • ' : ''}
                                {clinicalPlan.targetTeeth.length > 0 ? `Teeth: ${clinicalPlan.targetTeeth.join(', ')}` : ''}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
                            {canViewChart && appointment.patient_id ? (
                              <button
                                onClick={() => onViewChart(appointment)}
                                className="inline-flex items-center gap-1 md:gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2 md:px-2.5 py-1 md:py-1.5 text-[11px] md:text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                                title="Open patient chart"
                              >
                                <Eye className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                <span className="hidden sm:inline">View Chart</span>
                                <span className="sm:hidden">Chart</span>
                              </button>
                            ) : isNewPatientAppointment(appointment) && onConvertLead ? (
                              <button
                                onClick={() => onConvertLead(appointment)}
                                className="inline-flex items-center gap-1 md:gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 md:px-2.5 py-1 md:py-1.5 text-[11px] md:text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
                                title="Convert new patient to registered patient"
                              >
                                <User className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                <span className="hidden sm:inline">Convert</span>
                                <span className="sm:hidden">New Patient</span>
                              </button>
                            ) : null}
                            <select
                              value={appointment.status}
                              onChange={(e) => onUpdateStatus(appointment.id, e.target.value as any)}
                              className="text-[11px] md:text-xs border border-gray-200 rounded-lg px-1.5 md:px-2 py-1"
                            >
                              <option value="Scheduled">Scheduled</option>
                              <option value="Completed">Completed</option>
                              <option value="Cancelled">Cancelled</option>
                            </select>
                            {canEdit && (
                              <button onClick={() => onEditAppointment(appointment)} className="p-1.5 md:p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg">
                                <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => {
                                  setAppointmentToDelete(appointment.id);
                                  setDeleteConfirmOpen(true);
                                }}
                                className="p-1.5 md:p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              >
                                <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                              </button>
                            )}
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




