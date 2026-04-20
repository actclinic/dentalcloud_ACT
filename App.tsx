
import React, { useState, useEffect, Suspense, useMemo, useRef } from 'react';
import {
  LayoutDashboard,
  Users,
  CreditCard, 
  Activity,
  Loader2,
  Stethoscope,
  ClipboardList,
  Calendar,
  UserCheck,
  Trash2,
  Settings,
  Shield,
  LogOut,
  Package,
  Sparkles,
  MapPin,
  Menu,
  X,
  MessageCircle,
  Monitor,
  AlertTriangle,
  BellRing,
  DollarSign
} from 'lucide-react';

import { Modal, Input, NavItem, Toast, ConfirmDialog } from './components/Shared';
import { SearchableSelect } from './components/SearchableSelect';
import { 
  Patient, 
  Appointment, 
  TreatmentType, 
  ClinicalRecord,
  PatientFile,
  Doctor,
  DoctorInput,
  DoctorSchedule,
  DoctorScheduleInput,
  User, 
  Medicine, 
  MedicineSale,
  Location,
  LoyaltyRule, 
  LoyaltyTransaction,
  Expense,
  Recall,
  ScheduledTask
} from './types';
import {
  TREATMENT_CATEGORIES,
  DEFAULT_NORMAL_TAB_PERMISSIONS,
  FLEXIBLE_STAFF_TABS,
  FULL_ACCESS_TAB_PERMISSIONS,
  type AppTabPermission
} from './constants';
import { api } from './services/api';
import { formatCurrency, getCurrencySymbol, Currency } from './utils/currency';
import { buildFinancialReport, renderFinancialReportMarkdown } from './utils/aiReport';
import { auth } from './services/auth';
import { getMyanmarCities, getTownshipsForCity } from './utils/myanmarCities';
import { supabase } from './services/supabase';
import { resolveAllowedTabs } from './utils/permissions';
import { loadEmailSettings } from './utils/emailSettings';

// Lazy Load Views
const DashboardView = React.lazy(() => import('./components/DashboardView'));
const PatientsView = React.lazy(() => import('./components/PatientsView'));
const AppointmentsView = React.lazy(() => import('./components/AppointmentsView'));
const DoctorsView = React.lazy(() => import('./components/DoctorsView'));
const ClinicalView = React.lazy(() => import('./components/ClinicalView'));
const TreatmentConfigView = React.lazy(() => import('./components/TreatmentConfigView'));
const RecordsView = React.lazy(() => import('./components/RecordsView'));
const SettingsView = React.lazy(() => import('./components/SettingsView'));
const Receipt = React.lazy(() => import('./components/Receipt'));
const TreatmentSelectionModal = React.lazy(() => import('./components/TreatmentSelectionModal'));
const LoginView = React.lazy(() => import('./components/LoginView'));
const PatientDashboardView = React.lazy(() => import('./components/PatientDashboardView'));
const UsersView = React.lazy(() => import('./components/UsersView'));
const InventoryView = React.lazy(() => import('./components/InventoryView'));
const MedicineSelectionModal = React.lazy(() => import('./components/MedicineSelectionModal'));
const AIAssistantView = React.lazy(() => import('./components/AIAssistantView'));
const MessagingView = React.lazy(() => import('./components/MessagingView'));
const PatientMessagingView = React.lazy(() => import('./components/PatientMessagingView'));
const RecallsView = React.lazy(() => import('./components/RecallsView'));
const ExpensesView = React.lazy(() => import('./components/ExpensesView'));

const ALL_BRANCHES_VALUE = '__all_branches__';

const isRecoveryFlowActive = (): boolean => {
  if (typeof window === 'undefined') return false;

  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return searchParams.get('reset') === 'password' || hashParams.get('type') === 'recovery';
};

type ViewState = AppTabPermission;

const getDefaultUserFormData = (): Partial<User> => ({
  username: '',
  password: '',
  role: 'normal',
  location_id: null,
  allowed_tabs: [...DEFAULT_NORMAL_TAB_PERMISSIONS]
});

const getDefaultExpenseFormData = (): Partial<Expense> => ({
  description: '',
  amount: 0,
  category: '',
  date: new Date().toISOString().split('T')[0]
});

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>(() => {
    // Restore last viewed page from localStorage on mount
    const savedView = localStorage.getItem('currentView');
    if (savedView) {
      return savedView as ViewState;
    }
    return 'dashboard';
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [allowedViews, setAllowedViews] = useState<ViewState[]>([]);
  const [currentUser, setCurrentUser] = useState<string>('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [currentLocationId, setCurrentLocationId] = useState<string>(() => {
    return localStorage.getItem('currentLocationId') || '';
  });
  
  // State for mobile device detection
  const [isMobileDevice, setIsMobileDevice] = useState(window.innerWidth < 768);
  
  // Effect to handle window resize events
  useEffect(() => {
    const handleResize = () => {
      setIsMobileDevice(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  // -- Data State --
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [treatmentHistory, setTreatmentHistory] = useState<ClinicalRecord[]>([]); 
  const [globalRecords, setGlobalRecords] = useState<ClinicalRecord[]>([]); 
  const [dashboardPatients, setDashboardPatients] = useState<Patient[]>([]);
  const [dashboardAppointments, setDashboardAppointments] = useState<Appointment[]>([]);
  const [dashboardRecords, setDashboardRecords] = useState<ClinicalRecord[]>([]);
  const [dashboardExpenses, setDashboardExpenses] = useState<Expense[]>([]);
  const [dashboardLocationId, setDashboardLocationId] = useState<string>(() => {
    return localStorage.getItem('dashboardLocationId') || ALL_BRANCHES_VALUE;
  });
  const [assistantPatients, setAssistantPatients] = useState<Patient[]>([]);
  const [assistantAppointments, setAssistantAppointments] = useState<Appointment[]>([]);
  const [assistantDoctors, setAssistantDoctors] = useState<Doctor[]>([]);
  const [assistantTreatmentTypes, setAssistantTreatmentTypes] = useState<TreatmentType[]>([]);
  const [assistantRecords, setAssistantRecords] = useState<ClinicalRecord[]>([]);
  const [assistantMedicines, setAssistantMedicines] = useState<Medicine[]>([]);
  const [assistantExpenses, setAssistantExpenses] = useState<Expense[]>([]);
  const [assistantRecalls, setAssistantRecalls] = useState<Recall[]>([]);
  const [treatmentTypes, setTreatmentTypes] = useState<TreatmentType[]>([]);
  const [patientFiles, setPatientFiles] = useState<PatientFile[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [topSellingMedicines, setTopSellingMedicines] = useState<{ medicine_id: string; medicine_name: string; total_quantity: number; total_revenue: number }[]>([]);
  const [loyaltyRules, setLoyaltyRules] = useState<LoyaltyRule[]>([]);
  const [loyaltyTransactions, setLoyaltyTransactions] = useState<LoyaltyTransaction[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [medicineSales, setMedicineSales] = useState<MedicineSale[]>([]);
  const [recalls, setRecalls] = useState<Recall[]>([]);
  const scheduledTaskProcessorRef = React.useRef<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const dashboardFetchRequestRef = React.useRef(0);
  
  // -- Selection State --
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [selectedTeeth, setSelectedTeeth] = useState<number[]>([]);
  const [useFlatRate, setUseFlatRate] = useState(false);
  const [editingTreatmentType, setEditingTreatmentType] = useState<TreatmentType | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  
  // -- Modals State --
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showTreatmentTypeModal, setShowTreatmentTypeModal] = useState(false);
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showTreatmentSelection, setShowTreatmentSelection] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showMedicineModal, setShowMedicineModal] = useState(false);
  const [showMedicineSelectionModal, setShowMedicineSelectionModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; show: boolean }>({ message: '', type: 'success', show: false });
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [lastPaymentAmount, setLastPaymentAmount] = useState<number>(0);
  const [selectedTreatmentsForReceipt, setSelectedTreatmentsForReceipt] = useState<ClinicalRecord[]>([]);
  const [selectedMedicineSalesForReceipt, setSelectedMedicineSalesForReceipt] = useState<MedicineSale[]>([]);
  const [currency, setCurrency] = useState<'USD' | 'MMK'>(() => {
    const savedCurrency = localStorage.getItem('currency');
    return (savedCurrency === 'USD' || savedCurrency === 'MMK') ? savedCurrency : 'USD';
  });
  const [loyaltyEnabled, setLoyaltyEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('loyalty_enabled');
    return saved === null ? true : saved === 'true';
  });
  
  const [messagingEnabled, setMessagingEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('messaging_enabled');
    return saved === null ? true : saved === 'true';
  });
  
  const handleCurrencyChange = (newCurrency: 'USD' | 'MMK') => {
    setCurrency(newCurrency);
    localStorage.setItem('currency', newCurrency);
  };

  const handleToggleLoyalty = (enabled: boolean) => {
    setLoyaltyEnabled(enabled);
    localStorage.setItem('loyalty_enabled', String(enabled));
  };
  
  const handleToggleMessaging = (enabled: boolean) => {
    setMessagingEnabled(enabled);
    localStorage.setItem('messaging_enabled', String(enabled));
    api.messages.toggleMessagingFeature(enabled);
  };

  const handleSaveClinicalFeeSettings = async (enabled: boolean, amount: number) => {
    const normalizedAmount = Math.max(0, Number(amount || 0));
    await api.appSettings.saveClinicalFeeSettings({
      enabled,
      amount: normalizedAmount
    });
    setClinicalFeeEnabled(enabled);
    setClinicalFeeAmount(normalizedAmount);
    setApplyClinicalFeeOnRegistration(enabled);
  };
  
  const handleRemoveAllMessages = async () => {
    if (window.confirm('Are you sure you want to remove ALL messages and conversations? This action cannot be undone.')) {
      try {
        await api.messages.removeAllMessages();
        alert('All messages and conversations have been removed successfully.');
        // Refresh the page or trigger a state update to reflect changes
        window.location.reload();
      } catch (error) {
        console.error('Error removing all messages:', error);
        alert('Failed to remove all messages. Please try again.');
      }
    }
  };
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [isResizing, setIsResizing] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // -- Form State --
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [newPatientData, setNewPatientData] = useState<Partial<Patient> & { password?: string }>({ 
      name: '', 
      email: '', 
      phone: '', 
      medicalHistory: '', 
      password: '',
      age: undefined,
      address: '',
      city: '',
      township: '',
      patient_type: 'Walk-in'
    });
  const [clinicalFeeEnabled, setClinicalFeeEnabled] = useState(false);
  const [clinicalFeeAmount, setClinicalFeeAmount] = useState(0);
  const [applyClinicalFeeOnRegistration, setApplyClinicalFeeOnRegistration] = useState(false);
  const [newAppointmentData, setNewAppointmentData] = useState<Partial<Appointment>>({ date: '', time: '', type: '', status: 'Scheduled', patient_id: '', doctor_id: '' });
  const [doctorSearchQuery, setDoctorSearchQuery] = useState('');
  const [showDoctorDropdown, setShowDoctorDropdown] = useState(false);
  const doctorDropdownRef = useRef<HTMLDivElement>(null);
  
  // Service deletion confirmation state
  const [deleteServiceConfirmOpen, setDeleteServiceConfirmOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<{id: string, name: string} | null>(null);

  // Filter doctors based on search query
  const filteredDoctors = doctors.filter(doctor => {
    if (!doctorSearchQuery.trim()) return true;
    const query = doctorSearchQuery.toLowerCase();
    const name = doctor.name.toLowerCase();
    const spec = doctor.specialization?.toLowerCase() || '';
    return name.startsWith(query) || spec.startsWith(query);
  });
  const [newTreatmentTypeData, setNewTreatmentTypeData] = useState<Partial<TreatmentType>>({ name: '', cost: 0, category: '' });
  const [newDoctorData, setNewDoctorData] = useState<Partial<DoctorInput>>({ name: '', email: '', phone: '', specialization: '', schedules: [] });
  const [newUserData, setNewUserData] = useState<Partial<User>>(getDefaultUserFormData());
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newMedicineData, setNewMedicineData] = useState<Partial<Medicine>>({
    name: '',
    description: '',
    unit: 'pack',
    item_type: 'Medicine',
    price: 0,
    stock: 0,
    min_stock: 0,
    quantity_step: 1,
    category: ''
  });
  const [newExpenseData, setNewExpenseData] = useState<Partial<Expense>>(getDefaultExpenseFormData());
  const emailSettings = useMemo(() => loadEmailSettings(), []);
  const cityOptions = useMemo(
    () => getMyanmarCities().map((city) => ({ value: city, label: city })),
    []
  );
  const appointmentTypeOptions = useMemo(() => {
    const unique = [...new Set(treatmentTypes.map((type) => (type.name || '').trim()).filter(Boolean))];
    return unique.sort((a, b) => a.localeCompare(b));
  }, [treatmentTypes]);
  const appointmentTypeOptionsForModal = useMemo(() => {
    const currentType = (newAppointmentData.type || '').trim();
    if (!currentType || appointmentTypeOptions.includes(currentType)) {
      return appointmentTypeOptions;
    }
    return [...appointmentTypeOptions, currentType];
  }, [appointmentTypeOptions, newAppointmentData.type]);
  const treatmentCategorySuggestions = useMemo(() => {
    const existing = treatmentTypes.map((type) => (type.category || '').trim()).filter(Boolean);
    return [...new Set([...TREATMENT_CATEGORIES, ...existing])].sort((a, b) => a.localeCompare(b));
  }, [treatmentTypes]);
  const townshipOptionsForNewPatient = useMemo(
    () => getTownshipsForCity(newPatientData.city || '').map((township) => ({ value: township, label: township })),
    [newPatientData.city]
  );

  const applySessionState = (session: ReturnType<typeof auth.getSession>) => {
    if (!session) {
      return;
    }

    setIsAuthenticated(true);
    setIsAdmin(session.role === 'admin');
    setCurrentUser(session.username);

    if (session.role === 'patient') {
      setAllowedViews([]);
      return;
    }

    const nextAllowedViews = resolveAllowedTabs(session.role, session.allowed_tabs) as ViewState[];
    setAllowedViews(nextAllowedViews);
  };

  const resetStaffSession = () => {
    setIsAuthenticated(false);
    setIsAdmin(false);
    setAllowedViews([]);
    setCurrentUser('');
  };

  const canAccessView = (view: ViewState): boolean => {
    return allowedViews.includes(view);
  };

  const toggleUserTabAccess = (tab: ViewState) => {
    setUserFormError(null);
    setNewUserData(prev => {
      const currentTabs = resolveAllowedTabs('normal', prev.allowed_tabs) as ViewState[];
      const nextTabs = currentTabs.includes(tab)
        ? currentTabs.filter(currentTab => currentTab !== tab)
        : [...currentTabs, tab];

      return {
        ...prev,
        allowed_tabs: nextTabs
      };
    });
  };

  const handleUserRoleChange = (role: User['role']) => {
    setUserFormError(null);
    setNewUserData(prev => ({
      ...prev,
      role,
      allowed_tabs: role === 'admin'
        ? [...FULL_ACCESS_TAB_PERMISSIONS]
        : resolveAllowedTabs('normal', prev.allowed_tabs)
    }));
  };

  const syncCurrentSessionUser = async (updatedUser: User) => {
    const session = auth.getSession();
    if (!session || session.role === 'patient' || session.userId !== updatedUser.id) {
      return;
    }

    const updatedSession = {
      ...session,
      username: updatedUser.username,
      role: updatedUser.role,
      allowed_tabs: resolveAllowedTabs(updatedUser.role, updatedUser.allowed_tabs),
      location_id: updatedUser.location_id || null
    };

    auth.setSession(updatedSession);
    applySessionState(updatedSession);

    if (updatedSession.location_id) {
      setCurrentLocationId(updatedSession.location_id);
      localStorage.setItem('currentLocationId', updatedSession.location_id);
      setDashboardLocationId(updatedSession.location_id);
      localStorage.setItem('dashboardLocationId', updatedSession.location_id);
      await fetchInitialData(updatedSession.location_id);
      return;
    }

    const unrestrictedDashboardScope = updatedSession.role === 'admin'
      ? ALL_BRANCHES_VALUE
      : currentLocationId || dashboardLocationId || locations[0]?.id || '';

    if (unrestrictedDashboardScope) {
      setDashboardLocationId(unrestrictedDashboardScope);
      localStorage.setItem('dashboardLocationId', unrestrictedDashboardScope);
    }

    await fetchInitialData(currentLocationId || undefined);
  };

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const session = auth.getSession();
      if (session) {
        applySessionState(session);
        // Initialize default admin and fetch data
        await auth.initializeDefaultAdmin();
        fetchInitialData();
        fetchUsers();
        return;
      }

      const restoredSession = await auth.restoreSupabaseSession();
      if (restoredSession) {
        applySessionState(restoredSession);

        if (restoredSession.role !== 'patient') {
          fetchInitialData();
          fetchUsers();
        }
        return;
      }

      resetStaffSession();
      // Still initialize default admin for first-time setup
      auth.initializeDefaultAdmin();
    };
    
    checkAuth().catch(err => {
      console.warn('Authentication bootstrap failed:', err);
      resetStaffSession();
    });
    
  }, [isAuthenticated]);

  useEffect(() => {
    let mounted = true;
    api.appSettings.getClinicalFeeSettings()
      .then((settings) => {
        if (!mounted) return;
        setClinicalFeeEnabled(settings.enabled);
        setClinicalFeeAmount(settings.amount);
        setApplyClinicalFeeOnRegistration(settings.enabled);
      })
      .catch((err) => {
        console.warn('Failed to load clinical fee settings:', err);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleLoginSuccess = () => {
    const session = auth.getSession();
    if (session) {
      applySessionState(session);

      const canSeeAllBranches = session.role === 'admin' && !session.location_id;
      const initialDashboardScope = canSeeAllBranches
        ? ALL_BRANCHES_VALUE
        : (session.location_id || currentLocationId || localStorage.getItem('currentLocationId') || '');
      setDashboardLocationId(initialDashboardScope);
      localStorage.setItem('dashboardLocationId', initialDashboardScope);
      
      // If user is restricted to a location, set it
      if (session.location_id) {
        setCurrentLocationId(session.location_id);
        localStorage.setItem('currentLocationId', session.location_id);
      }
      
      // For patients, don't fetch admin data
      if (session.role !== 'patient') {
        fetchInitialData();
        fetchUsers();
      }
    }
  };

  const handleLogout = () => {
    auth.logout();
    resetStaffSession();
    setCurrentView('dashboard');
    localStorage.removeItem('currentView');
    // Reset all data state
    setPatients([]);
    setAppointments([]);
    setDoctors([]);
    setTreatmentHistory([]);
    setGlobalRecords([]);
    setTreatmentTypes([]);
    setPatientFiles([]);
    setUsers([]);
    setMedicines([]);
    setLoyaltyRules([]);
    setLoyaltyTransactions([]);
    setExpenses([]);
    setMedicineSales([]);
    setRecalls([]);
    setDashboardPatients([]);
    setDashboardAppointments([]);
    setDashboardRecords([]);
    setDashboardLocationId(ALL_BRANCHES_VALUE);
    setAssistantPatients([]);
    setAssistantAppointments([]);
    setAssistantDoctors([]);
    setAssistantTreatmentTypes([]);
    setAssistantRecords([]);
    setAssistantMedicines([]);
    setAssistantExpenses([]);
    setAssistantRecalls([]);
    localStorage.removeItem('dashboardLocationId');
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    const newWidth = e.clientX;
    if (newWidth >= 200 && newWidth <= 400) {
      setSidebarWidth(newWidth);
    }
  }, [isResizing]);

  const handleMouseUp = React.useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const fetchUsers = async () => {
    if (!isAdmin) return;
    try {
      const usersData = await api.users.getAll();
      setUsers(usersData);
    } catch (err: any) {
      console.warn('Error fetching users:', err);
    }
  };

  const fetchDashboardData = async (scopeLocationId?: string, knownLocations?: Location[]) => {
    const requestId = ++dashboardFetchRequestRef.current;
    const session = auth.getSession();
    const restrictedLocationId = session?.location_id || '';
    const canViewAllBranches = session?.role === 'admin' && !restrictedLocationId;
    const availableLocations = knownLocations || locations;
    const requestedScope = canViewAllBranches
      ? (scopeLocationId || dashboardLocationId || ALL_BRANCHES_VALUE)
      : (restrictedLocationId || scopeLocationId || currentLocationId || availableLocations[0]?.id || '');
    const hasMatchingLocation = requestedScope !== ALL_BRANCHES_VALUE && availableLocations.some(loc => loc.id === requestedScope);
    const sanitizedScope = restrictedLocationId || (
      canViewAllBranches
        ? (requestedScope === ALL_BRANCHES_VALUE || hasMatchingLocation ? requestedScope : ALL_BRANCHES_VALUE)
        : (hasMatchingLocation ? requestedScope : (availableLocations[0]?.id || requestedScope))
    );
    const queryLocationId = sanitizedScope === ALL_BRANCHES_VALUE ? undefined : sanitizedScope;

    const [patData, aptData, recordsData, expenseData] = await Promise.all([
      api.patients.getAll(queryLocationId),
      api.appointments.getAll(queryLocationId),
      api.treatments.getAllRecords(queryLocationId),
      api.expenses.getAll(queryLocationId)
    ]);

    if (requestId !== dashboardFetchRequestRef.current) {
      return;
    }

    setDashboardPatients(patData);
    setDashboardAppointments(aptData);
    setDashboardRecords(recordsData);
    setDashboardExpenses(expenseData);
    setDashboardLocationId(sanitizedScope);
    localStorage.setItem('dashboardLocationId', sanitizedScope);
  };

  const fetchAssistantData = async () => {
    const session = auth.getSession();
    const restrictedLocationId = session?.location_id || '';
    const queryLocationId = restrictedLocationId || currentLocationId || undefined;
    const canAccessAllLocations = isAdmin && !restrictedLocationId;
    const assistantLocationId = canAccessAllLocations ? undefined : queryLocationId;

    const [patData, aptData, docData, typeData, recordsData, medData, expenseData, recallData] = await Promise.all([
      api.patients.getAll(assistantLocationId),
      api.appointments.getAll(assistantLocationId),
      api.doctors.getAll(assistantLocationId),
      api.treatments.getTypes(assistantLocationId),
      api.treatments.getAllRecords(assistantLocationId),
      api.medicines.getAll(assistantLocationId),
      api.expenses.getAll(assistantLocationId),
      api.recalls.getAll(assistantLocationId)
    ]);

    setAssistantPatients(patData);
    setAssistantAppointments(aptData);
    setAssistantDoctors(docData);
    setAssistantTreatmentTypes(typeData);
    setAssistantRecords(recordsData);
    setAssistantMedicines(medData);
    setAssistantExpenses(expenseData);
    setAssistantRecalls(recallData);
  };

  const fetchInitialData = async (overrideLocationId?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      api.recalls.updateOverdueStatus(overrideLocationId || currentLocationId || undefined).catch(err => {
        console.warn('Failed to update overdue recalls:', err);
      });
      
      const locData = await api.locations.getAll();
      setLocations(locData);
      const session = auth.getSession();
      const restrictedLocationId = session?.location_id || '';

      if (restrictedLocationId && currentLocationId !== restrictedLocationId) {
        setCurrentLocationId(restrictedLocationId);
        localStorage.setItem('currentLocationId', restrictedLocationId);
      }
      
      // If no location selected but locations exist, select first one
      let locId = restrictedLocationId || overrideLocationId || currentLocationId;
      if (!locId && locData.length > 0) {
        locId = locData[0].id;
        setCurrentLocationId(locId);
        localStorage.setItem('currentLocationId', locId);
      }
      
      // If still no location, try to create a default one
      if (!locId) {
        try {
          const defaultLocation = await api.locations.create({
            name: 'Main Clinic',
            address: 'Default Address',
            phone: '000-000-0000'
          });
          locId = defaultLocation.id;
          setCurrentLocationId(locId);
          localStorage.setItem('currentLocationId', locId);
          setLocations([defaultLocation]);
        } catch (createError) {
          console.error('Failed to create default location:', createError);
        }
      }
      
      // Only fetch data if we have a valid location
      if (locId) {
        const [patData, aptData, docData, typeData, recordsData, medData, loyaltyData, expenseData, recallData, salesData] = await Promise.all([
          api.patients.getAll(locId),
          api.appointments.getAll(locId),
          api.doctors.getAll(locId),
          api.treatments.getTypes(locId),
          api.treatments.getAllRecords(locId),
          api.medicines.getAll(locId),
          api.loyalty.getRules(locId),
          api.expenses.getAll(locId),
          api.recalls.getAll(locId),
          api.medicines.getSales(locId)
        ]);
        setPatients(patData);
        setAppointments(aptData);
        setDoctors(docData);
        setTreatmentTypes(typeData);
        setGlobalRecords(recordsData);
        setMedicines(medData);
        setLoyaltyRules(loyaltyData);
        setExpenses(expenseData);
        setRecalls(recallData);
        setMedicineSales(salesData);
      }

      await fetchDashboardData(undefined, locData);
    } catch (err: any) {
      console.error('Error fetching initial data:', err);
      setError(err.message || "Failed to connect to database. Please check your network.");
    } finally {
      setLoading(false);
    }
  };

  const handleLocationChange = (locId: string) => {
    setCurrentLocationId(locId);
    localStorage.setItem('currentLocationId', locId);
    fetchInitialData(locId);
  };

  const handleDashboardLocationChange = async (locId: string) => {
    try {
      setLoading(true);
      setError(null);
      setDashboardLocationId(locId);
      localStorage.setItem('dashboardLocationId', locId);
      setDashboardPatients([]);
      setDashboardAppointments([]);
      setDashboardRecords([]);
      setDashboardExpenses([]);
      await fetchDashboardData(locId);
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message || 'Failed to update dashboard reporting.');
    } finally {
      setLoading(false);
    }
  };

  const refreshAssistantData = async () => {
    await fetchInitialData(currentLocationId || undefined);
    await fetchAssistantData();
    if (isAdmin) {
      await fetchUsers();
    }
  };

  const buildDailyReportEmailBody = async (task: ScheduledTask) => {
    const locationId = task.location_id || currentLocationId || undefined;
    const [reportTreatments, reportExpenses, reportMedicines, reportMedicineSales] = await Promise.all([
      api.treatments.getAllRecords(locationId),
      api.expenses.getAll(locationId),
      api.medicines.getAll(locationId),
      api.medicines.getSales(locationId)
    ]);

    const taskCurrency = (task.payload?.currency === 'MMK' || task.payload?.currency === 'USD')
      ? task.payload.currency
      : currency;

    const report = buildFinancialReport(reportTreatments, reportExpenses, reportMedicines, taskCurrency, undefined, reportMedicineSales);
    const reportMarkdown = renderFinancialReportMarkdown(report, taskCurrency);
    const clinicLabel = locations.find(loc => loc.id === locationId)?.name || 'Dental Clinic';

    return `Daily clinic report for ${clinicLabel}\n\n${reportMarkdown}`;
  };

  const processScheduledTask = async (task: ScheduledTask) => {
    const payload = task.payload || {};
    const to = payload.to;
    const subject = payload.subject || (task.task_type === 'DAILY_REPORT_EMAIL' ? 'Daily Clinic Report' : 'Scheduled Email');
    const body = task.task_type === 'DAILY_REPORT_EMAIL'
      ? await buildDailyReportEmailBody(task)
      : (payload.body || '');

    if (!to) {
      throw new Error('Scheduled task is missing recipient email.');
    }

    await api.email.sendManagerEmail({
      to,
      subject,
      body,
      fromName: payload.fromName,
      fromEmail: payload.fromEmail,
      replyTo: payload.replyTo
    });
  };

  const processDueScheduledTasks = async () => {
    if (!isAuthenticated || !currentLocationId || scheduledTaskProcessorRef.current) return;

    scheduledTaskProcessorRef.current = true;
    try {
      const dueTasks = await api.scheduledTasks.getDue(new Date().toISOString(), currentLocationId);
      for (const task of dueTasks) {
        try {
          await api.scheduledTasks.markProcessing(task.id);
          await processScheduledTask(task);
          await api.scheduledTasks.markCompleted(task.id);
        } catch (error: any) {
          console.error('Scheduled task processing failed:', error);
          await api.scheduledTasks.markFailed(task.id, error?.message || 'Failed to process scheduled task.');
        }
      }
    } finally {
      scheduledTaskProcessorRef.current = false;
    }
  };

  useEffect(() => {
    if (currentView === 'users' && canAccessView('users')) {
      fetchUsers();
    }
    if (currentView === 'inventory' && canAccessView('inventory')) {
      fetchMedicines();
    }
    if (currentView === 'expenses' && canAccessView('expenses')) {
      fetchExpenses();
      fetchMedicineSales();
    }
    if (currentView === 'ai-assistant' && canAccessView('ai-assistant')) {
      fetchAssistantData().catch(err => {
        console.warn('Error fetching AI assistant data:', err);
      });
    }
  }, [currentView, currentLocationId, allowedViews]);

  useEffect(() => {
    if (!isAuthenticated || auth.isPatient() || allowedViews.length === 0) {
      return;
    }

    if (!canAccessView(currentView)) {
      const fallbackView = allowedViews.includes('dashboard' as ViewState) ? 'dashboard' as ViewState : allowedViews[0];
      setCurrentView(fallbackView);
    } else {
      // Persist the current view to localStorage
      localStorage.setItem('currentView', currentView);
    }
  }, [allowedViews, currentView, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !currentLocationId) return;

    void processDueScheduledTasks();
    const interval = window.setInterval(() => {
      void processDueScheduledTasks();
    }, 30000);

    return () => window.clearInterval(interval);
  }, [isAuthenticated, currentLocationId, currency, locations]);

  const fetchMedicines = async () => {
    try {
      if (!currentLocationId) {
        setMedicines([]);
        setTopSellingMedicines([]);
        return;
      }
      const medData = await api.medicines.getAll(currentLocationId);
      setMedicines(medData);
      // Fetch top selling medicines for reporting
      const topSellingData = await api.medicines.getTopSelling(currentLocationId, 10);
      setTopSellingMedicines(topSellingData);
    } catch (err: any) {
      console.warn('Error fetching medicines:', err);
    }
  };

  const fetchExpenses = async () => {
    try {
      if (!currentLocationId) {
        setExpenses([]);
        return;
      }
      const expenseData = await api.expenses.getAll(currentLocationId);
      setExpenses(expenseData);
    } catch (err: any) {
      console.warn('Error fetching expenses:', err);
    }
  };

  const fetchMedicineSales = async () => {
    try {
      if (!currentLocationId) {
        setMedicineSales([]);
        return;
      }
      const salesData = await api.medicines.getSales(currentLocationId);
      setMedicineSales(salesData);
    } catch (err: any) {
      console.warn('Error fetching medicine sales:', err);
    }
  };

  const handlePatientSelect = async (patient: Patient) => {
    setSelectedPatient(patient);
    setSelectedDoctorId('');
    setSelectedTeeth([]); 
    try {
      const history = await api.treatments.getHistory(patient.id);
      setTreatmentHistory(history);
    } catch (e) {
      setTreatmentHistory([]);
    }
    try {
      const txs = await api.loyalty.getTransactions(patient.id, currentLocationId || patient.location_id);
      setLoyaltyTransactions(txs);
    } catch (e) {
      setLoyaltyTransactions([]);
    }
    try {
      const files = await api.files.list(patient.id);
      setPatientFiles(files);
    } catch (e) {
      setPatientFiles([]);
    }
    setCurrentView('finance');
  };

  const fetchGlobalRecords = async () => {
    setLoading(true);
    try {
      const records = await api.treatments.getAllRecords(currentLocationId || undefined);
      setGlobalRecords(records);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentView === 'records') fetchGlobalRecords();
  }, [currentView]);

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      console.log('Creating patient with location_id:', currentLocationId);
      const registrationFee = applyClinicalFeeOnRegistration ? Math.max(0, Number(clinicalFeeAmount || 0)) : 0;
      await api.patients.create({
        ...newPatientData,
        location_id: currentLocationId,
        balance: registrationFee
      });
      setShowPatientModal(false);
      fetchInitialData(); 
      setNewPatientData({ 
        name: '', 
        email: '', 
        phone: '', 
        medicalHistory: '', 
        password: '',
        age: undefined,
        address: '',
        city: '',
        township: '',
        patient_type: 'Walk-in'
      });
      setApplyClinicalFeeOnRegistration(clinicalFeeEnabled);
      if (registrationFee > 0) {
        setToast({
          message: `Patient registered with clinical fee: ${formatCurrency(registrationFee, currency)}.`,
          type: 'success',
          show: true
        });
      }
    } catch (err: any) {
      console.error('Patient creation error:', err);
      alert(`Error creating patient: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePatient = async (id: string) => {
    try {
      await api.patients.delete(id);
      if (selectedPatient?.id === id) {
        handleClosePatient();
      }
      fetchInitialData();
      alert('Patient deleted successfully.');
    } catch (err: any) {
      alert(err.message || 'Failed to delete patient.');
      throw err;
    }
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (editingAppointment) {
        await api.appointments.update(editingAppointment.id, newAppointmentData);
      } else {
        await api.appointments.create({ ...newAppointmentData, location_id: currentLocationId });
      }
      setShowAppointmentModal(false);
      fetchInitialData();
      setEditingAppointment(null);
      setNewAppointmentData({ date: '', time: '', type: appointmentTypeOptions[0] || '', status: 'Scheduled', patient_id: '', doctor_id: '' });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateAppointmentFromClinical = async (data: Partial<Appointment>) => {
    if (!data?.patient_id) {
      throw new Error('Please select a patient before scheduling an appointment.');
    }
    if (!data?.date || !data?.time) {
      throw new Error('Appointment date and time are required.');
    }
    if (!data?.type) {
      throw new Error('Please select a treatment type.');
    }
    if (!currentLocationId) {
      throw new Error('Select a branch before creating appointments.');
    }

    await api.appointments.create({
      ...data,
      location_id: currentLocationId,
      status: 'Scheduled'
    });

    await fetchInitialData();
  };

  const handleDoctorChange = (doctorId: string) => {
    setNewAppointmentData({ ...newAppointmentData, doctor_id: doctorId });
  };

  const handleDateChange = (date: string) => {
    setNewAppointmentData({ ...newAppointmentData, date });
  };

  const handleCreateDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    // Validate schedules before submitting
    const schedules = (newDoctorData.schedules || []).filter(sched => {
      // Filter out schedules with missing or invalid times
      if (!sched.start_time || !sched.end_time) return false;
      
      // Validate that end_time > start_time
      const start = new Date(`2000-01-01T${sched.start_time}`);
      const end = new Date(`2000-01-01T${sched.end_time}`);
      if (end <= start) {
        alert(`Invalid schedule: End time must be after start time for ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][sched.day_of_week]}`);
        return false;
      }
      return true;
    }).map(sched => ({
      // Remove id if present (will be auto-generated) and ensure proper structure
      day_of_week: sched.day_of_week,
      start_time: sched.start_time,
      end_time: sched.end_time
    }));

    // Check for duplicate day_of_week entries
    const daySet = new Set(schedules.map(s => s.day_of_week));
    if (daySet.size !== schedules.length) {
      alert('Error: You cannot have multiple schedules for the same day. Please combine them into one schedule with a longer time range.');
      return;
    }

    try {
      const doctorDataToSave = {
        ...newDoctorData,
        location_id: currentLocationId,
        schedules: schedules
      };

      if (editingDoctor) {
        await api.doctors.update(editingDoctor.id, doctorDataToSave);
      } else {
        await api.doctors.create(doctorDataToSave);
      }
      setShowDoctorModal(false);
      fetchInitialData();
      setEditingDoctor(null);
      setNewDoctorData({ name: '', email: '', phone: '', specialization: '', schedules: [] });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDoctor = async (id: string) => {
    try {
      await api.doctors.delete(id);
      fetchInitialData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteAllRecords = async () => {
    try {
      await api.treatments.deleteAllRecords();
      fetchGlobalRecords();
      alert('All audit log records have been deleted successfully.');
    } catch (err: any) {
      alert(err.message || 'Failed to delete records');
    }
  };

  const handleDeleteAppointment = async (id: string) => {
    try {
      await api.appointments.delete(id);
      fetchInitialData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const buildUserPayload = (userData: Partial<User>): Partial<User> => {
    const nextRole = userData.role || 'normal';
    const nextAllowedTabs = nextRole === 'admin'
      ? FULL_ACCESS_TAB_PERMISSIONS
      : resolveAllowedTabs('normal', userData.allowed_tabs);

    return {
      ...userData,
      location_id: userData.location_id || null,
      role: nextRole,
      allowed_tabs: nextAllowedTabs
    };
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setUserFormError(null);
    setIsSubmitting(true);
    try {
      const payload = buildUserPayload(newUserData);
      if (payload.role === 'normal' && (!payload.allowed_tabs || payload.allowed_tabs.length === 0)) {
        setUserFormError('Select at least one tab for this normal account.');
        setIsSubmitting(false);
        return;
      }

      if (editingUser) {
        const updatedUser = await api.users.update(editingUser.id, payload);
        await syncCurrentSessionUser(updatedUser);
      } else {
        if (!newUserData.password || newUserData.password === '') {
          setUserFormError('Password is required for a new user account.');
          setIsSubmitting(false);
          return;
        }
        await api.users.create(payload);
      }
      setShowUserModal(false);
      setEditingUser(null);
      setUserFormError(null);
      setNewUserData(getDefaultUserFormData());
      if (auth.getSession()?.role === 'admin') {
        fetchUsers();
      } else {
        setUsers([]);
      }
      setToast({
        message: editingUser ? 'User account updated successfully.' : 'User account created successfully.',
        type: 'success',
        show: true
      });
    } catch (err: any) {
      setUserFormError(err.message || 'Unable to save this user right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await api.users.delete(id);
      fetchUsers();
      setToast({
        message: 'User account deleted successfully.',
        type: 'success',
        show: true
      });
    } catch (err: any) {
      setToast({
        message: err.message || 'Failed to delete this user account.',
        type: 'error',
        show: true
      });
    }
  };

  const handleCreateMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (editingMedicine) {
        await api.medicines.update(editingMedicine.id, newMedicineData);
      } else {
        await api.medicines.create({ ...newMedicineData, location_id: currentLocationId });
      }
      setShowMedicineModal(false);
      setEditingMedicine(null);
      setNewMedicineData({ name: '', description: '', unit: 'pack', item_type: 'Medicine', price: 0, stock: 0, min_stock: 0, quantity_step: 1, category: '' });
      fetchMedicines();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMedicine = async (id: string) => {
    try {
      await api.medicines.delete(id);
      fetchMedicines();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (!currentLocationId) {
        throw new Error('Please select a clinic location before logging expenses.');
      }
      if (editingExpense) {
        await api.expenses.update(editingExpense.id, newExpenseData);
      } else {
        await api.expenses.create({ ...newExpenseData, location_id: currentLocationId });
      }
      setShowExpenseModal(false);
      setEditingExpense(null);
      setNewExpenseData(getDefaultExpenseFormData());
      fetchExpenses();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await api.expenses.delete(id);
      fetchExpenses();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateAppointmentStatus = async (id: string, status: 'Scheduled' | 'Completed' | 'Cancelled') => {
    try {
      await api.appointments.updateStatus(id, status);
      fetchInitialData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateLocation = async (locData: Partial<Location>) => {
    try {
      await api.locations.create(locData);
      fetchInitialData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateRecall = async (data: Partial<Recall>, sendEmail: boolean = false) => {
    try {
      await api.recalls.create({ ...data, location_id: currentLocationId });
      const updated = await api.recalls.getAll(currentLocationId);
      setRecalls(updated);
      
      // Send recall email if requested
      if (sendEmail && data.patient_id) {
        const patient = patients.find(p => p.id === data.patient_id);
        if (patient && patient.email) {
          try {
            await handleSendRecallEmail(
              updated[0]?.id || '', // Get the newly created recall ID
              patient.email,
              patient.name,
              data.title || 'Recall',
              data.due_date || ''
            );
            setToast({ message: `Recall created and email sent to ${patient.name}.`, type: 'success', show: true });
          } catch (emailErr: any) {
            console.error('Failed to send recall email:', emailErr);
            setToast({ message: `Recall created but email failed: ${emailErr.message}`, type: 'info', show: true });
          }
        }
      } else {
        setToast({ message: 'Recall created successfully.', type: 'success', show: true });
      }
    } catch (err: any) {
      alert(err.message);
      throw err;
    }
  };

  const handleSendRecallEmail = async (
    recallId: string,
    patientEmail: string,
    patientName: string,
    recallTitle: string,
    dueDate: string
  ) => {
    try {
      // Format the due date for better readability
      const formattedDate = new Date(dueDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🦷 Dental Recall Notice</h1>
          </div>
          
          <div style="padding: 30px; background: #f9fafb;">
            <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">Dear <strong>${patientName}</strong>,</p>
            
            <p style="font-size: 15px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
              This is a friendly reminder from your dental clinic that you have an upcoming recall appointment scheduled.
            </p>
            
            <div style="background: white; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 8px;">
              <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">📋 Recall Details</h2>
              <p style="margin: 8px 0; color: #374151;"><strong>Type:</strong> ${recallTitle}</p>
              <p style="margin: 8px 0; color: #374151;"><strong>Due Date:</strong> ${formattedDate}</p>
            </div>
            
            <p style="font-size: 15px; color: #4b5563; line-height: 1.6; margin: 20px 0 0 0;">
              Please contact our clinic to confirm your appointment or if you need to reschedule. We look forward to seeing you!
            </p>
          </div>
          
          <div style="background: #f3f4f6; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 13px; margin: 0;">
              This is an automated recall notification from DentalCloud Clinic Management System.
            </p>
          </div>
        </div>
      `;

      await api.email.sendManagerEmail({
        to: patientEmail,
        subject: `🦷 Dental Recall Reminder: ${recallTitle}`,
        html: emailHtml,
        fromName: emailSettings.senderName || 'DentalCloud Clinic',
        fromEmail: emailSettings.senderEmail
      });

      // Mark the recall as reminded
      if (recallId) {
        await api.recalls.markReminded(recallId);
        const updated = await api.recalls.getAll(currentLocationId);
        setRecalls(updated);
      }

      console.log(`[Recall Email] Sent to ${patientName} (${patientEmail})`);
    } catch (error: any) {
      console.error('[Recall Email] Failed to send:', error);
      throw error;
    }
  };

  const handleUpdateRecallStatus = async (id: string, status: Recall['status']) => {
    try {
      await api.recalls.updateStatus(id, status);
      const updated = await api.recalls.getAll(currentLocationId);
      setRecalls(updated);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateRecall = async (id: string, data: Partial<Recall>) => {
    try {
      await api.recalls.update(id, data);
      const updated = await api.recalls.getAll(currentLocationId);
      setRecalls(updated);
      setToast({ message: 'Recall updated successfully.', type: 'success', show: true });
    } catch (err: any) {
      alert(err.message);
      throw err;
    }
  };

  const handleDeleteRecall = async (id: string) => {
    try {
      await api.recalls.delete(id);
      const updated = await api.recalls.getAll(currentLocationId);
      setRecalls(updated);
      setToast({ message: 'Recall deleted successfully.', type: 'success', show: true });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteAllRecalls = async () => {
    try {
      await api.recalls.deleteAll(currentLocationId);
      const updated = await api.recalls.getAll(currentLocationId);
      setRecalls(updated);
      setToast({ message: 'Entire recall history deleted.', type: 'success', show: true });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateLoyaltyRule = async (id: string, data: Partial<LoyaltyRule>) => {
    try {
      await api.loyalty.updateRule(id, data);
      const updated = await api.loyalty.getRules(currentLocationId);
      setLoyaltyRules(updated);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateLoyaltyRule = async (data: Partial<LoyaltyRule>) => {
    try {
      await api.loyalty.createRule({ ...data, location_id: currentLocationId });
      const updated = await api.loyalty.getRules(currentLocationId);
      setLoyaltyRules(updated);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteLoyaltyRule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this loyalty rule?')) return;
    try {
      await api.loyalty.deleteRule(id);
      const updated = await api.loyalty.getRules(currentLocationId);
      setLoyaltyRules(updated);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResetAllLoyaltyPoints = async () => {
    if (!confirm('CRITICAL ACTION: This will permanently reset ALL loyalty points for ALL patients across the entire system. Transaction history will also be cleared. Continue?')) return;
    
    setLoading(true);
    try {
      await api.loyalty.resetAllPoints();
      fetchInitialData();
      alert('System-wide loyalty reset successful.');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeemPoints = async (points: number, amount: number, patientObj?: Patient) => {
    const targetPatient = patientObj || selectedPatient;
    if (!targetPatient) return;
    try {
      const res = await api.loyalty.redeemPoints(targetPatient.id, currentLocationId, points, amount);
      if (patientObj) {
        // Update in list
        setPatients(prev => prev.map(p => p.id === targetPatient.id ? { ...p, balance: res.new_balance, loyalty_points: res.new_points } : p));
      }
      if (selectedPatient && targetPatient.id === selectedPatient.id) {
        setSelectedPatient({ ...selectedPatient, balance: res.new_balance, loyalty_points: res.new_points });
      }
      if (amount > 0) {
        setToast({ message: `Redeemed ${points} points for ${amount} MMK discount!`, type: 'success', show: true });
      } else {
        setToast({ message: `Redeemed ${points} points successfully.`, type: 'success', show: true });
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateTreatmentType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (editingTreatmentType) {
        await api.treatments.updateType(editingTreatmentType.id, newTreatmentTypeData);
      } else {
        await api.treatments.createType({ ...newTreatmentTypeData, location_id: currentLocationId });
      }
      const updatedTypes = await api.treatments.getTypes(currentLocationId);
      setTreatmentTypes(updatedTypes);
      setShowTreatmentTypeModal(false);
      setEditingTreatmentType(null);
      setNewTreatmentTypeData({ name: '', cost: 0, category: '' });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTreatmentType = async (id: string) => {
    try {
      await api.treatments.deleteType(id);
      setTreatmentTypes(treatmentTypes.filter(t => t.id !== id));
      setServiceToDelete(null);
      setDeleteServiceConfirmOpen(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTreatmentSubmit = async (treatment: TreatmentType) => {
    if (!selectedPatient) return;
    
    // If flat rate is enabled, use treatment cost as-is (not multiplied by teeth count)
    // Otherwise, multiply by number of selected teeth
    const totalCost = useFlatRate ? treatment.cost : (treatment.cost * (selectedTeeth.length || 1));
    
    try {
      const res = await api.treatments.record({
        location_id: currentLocationId,
        patient_id: selectedPatient.id,
        doctor_id: selectedDoctorId || undefined,
        teeth: selectedTeeth,
        description: treatment.name,
        cost: totalCost
      });
      
      setSelectedPatient({ ...selectedPatient, balance: res.new_balance });
      
      setTreatmentHistory([res.record, ...treatmentHistory]);
      setSelectedTeeth([]);
      setUseFlatRate(false); // Reset flat rate after treatment
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUndoTreatment = async (record: ClinicalRecord) => {
    if (!selectedPatient) return;
    
    try {
      const res = await api.treatments.undoRecord(record.id, selectedPatient.id, record.cost);
      
      setSelectedPatient({ ...selectedPatient, balance: res.new_balance });
      setTreatmentHistory(treatmentHistory.filter(t => t.id !== record.id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddMedicines = () => {
    if (!selectedPatient) return;
    setShowMedicineSelectionModal(true);
  };

  const handleMedicineSelectionConfirm = async (selectedMedicines: { medicine: Medicine; quantity: number }[]) => {
    if (!selectedPatient) return;
    
    if (selectedMedicines.length === 0) {
      setShowMedicineSelectionModal(false);
      return;
    }
    
    setShowMedicineSelectionModal(false);
    
    // Calculate medicine cost
    const medicineCost = selectedMedicines.reduce((sum, item) => sum + (item.medicine.price * item.quantity), 0);
    
    try {
      // Record medicine sales
      for (const item of selectedMedicines) {
        await api.medicines.sell(
          selectedPatient.id,
          item.medicine.id,
          item.quantity,
          currentLocationId
        );
      }

      // Update patient balance (medicines already updated it in the sell function)
      const { data: patient } = await supabase
        .from('patients')
        .select('balance')
        .eq('id', selectedPatient.id)
        .single();

      if (patient) {
        setSelectedPatient({ ...selectedPatient, balance: patient.balance });
      }
      
      // Refresh medicines to update stock
      await fetchMedicines();
      
      // Show success message
      setToast({
        message: `Successfully added ${selectedMedicines.length} inventory item(s) to patient's bill. Total: ${formatCurrency(medicineCost, currency)}`,
        type: 'success',
        show: true
      });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    try {
      const res = await api.finance.processPayment(selectedPatient.id, paymentAmount);
      setSelectedPatient({ ...selectedPatient, balance: res.new_balance });
      setLastPaymentAmount(paymentAmount);
      setSelectedTreatmentsForReceipt([]);
      setSelectedMedicineSalesForReceipt([]);
      setShowPaymentModal(false);
      // Show treatment selection first, then receipt
      setShowTreatmentSelection(true);
      fetchInitialData(); 
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleGenerateReceipt = () => {
    setLastPaymentAmount(0);
    setSelectedTreatmentsForReceipt([]);
    setSelectedMedicineSalesForReceipt([]);
    setShowTreatmentSelection(true);
  };

  const handleTreatmentSelectionConfirm = (selectedTreatments: ClinicalRecord[]) => {
    const selectedTreatmentIds = new Set(selectedTreatments.map((treatment) => treatment.id));
    const selectedDates = new Set(selectedTreatments.map((treatment) => treatment.date));
    const matchedMedicineSales = medicineSales.filter((sale) => {
      if (!selectedPatient || sale.patient_id !== selectedPatient.id) {
        return false;
      }

      // Prefer direct treatment linkage; fall back to same-date patient sales.
      return (sale.treatment_id && selectedTreatmentIds.has(sale.treatment_id)) || selectedDates.has(sale.date);
    });

    setSelectedTreatmentsForReceipt(selectedTreatments);
    setSelectedMedicineSalesForReceipt(matchedMedicineSales);
    setShowTreatmentSelection(false);
    setShowReceipt(true);
  };

  const handleUploadFiles = async (files: FileList | File[]) => {
    if (!selectedPatient) return;
    const uploadList = Array.from(files);
    if (uploadList.length === 0) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(uploadList.map(f => api.files.upload(selectedPatient.id, f)));
      setPatientFiles(prev => [...uploaded, ...prev]);
    } catch (err: any) {
      alert(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadFilesWithProgress = async (
    files: File[],
    onProgress: (progress: { fileName: string; bytesUploaded: number; bytesTotal: number; percentage: number }) => void
  ): Promise<void> => {
    if (!selectedPatient) return;
    if (files.length === 0) return;

    setUploading(true);
    try {
      // Log smart upload configuration
      console.log(`[Upload Handler] Uploading ${files.length} file(s) with smart chunking`);
      
      // Upload files sequentially to show proper progress for each
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
        const chunkSizeMB = (api.files.calculateOptimalChunkSize(file.size) / 1024 / 1024).toFixed(2);
        
        console.log(`[Upload Handler] File ${i + 1}/${files.length}: ${file.name} (${fileSizeMB}MB, chunks: ${chunkSizeMB}MB)`);
        
        await api.files.uploadWithTus(
          selectedPatient.id,
          file,
          (bytesUploaded, bytesTotal) => {
            const percentage = Math.round((bytesUploaded / bytesTotal) * 100);
            onProgress({
              fileName: file.name,
              bytesUploaded,
              bytesTotal,
              percentage
            });
          },
          (chunkSize, bytesAccepted, bytesTotal) => {
            // Log chunk completion for debugging
            console.log(`[Upload Handler] Chunk uploaded: ${(chunkSize / 1024 / 1024).toFixed(2)}MB`);
          }
        );
        
        console.log(`[Upload Handler] Completed file ${i + 1}/${files.length}: ${file.name}`);
      }

      // Refresh the file list after upload
      const updatedFiles = await api.files.list(selectedPatient.id);
      setPatientFiles(updatedFiles);
      
      console.log(`[Upload Handler] All ${files.length} file(s) uploaded successfully`);
    } catch (err: any) {
      console.error('[Upload Handler] Upload failed:', err);
      alert(err.message || 'Upload failed');
      throw err;
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (path: string) => {
    if (!selectedPatient) return;
    try {
      await api.files.remove(path);
      setPatientFiles(prev => prev.filter(f => f.path !== path));
    } catch (err: any) {
      alert(err.message || 'Failed to delete file');
    }
  };

  const handleClosePatient = () => {
    setSelectedPatient(null);
    setSelectedDoctorId('');
    setSelectedTeeth([]);
    setTreatmentHistory([]);
    setPatientFiles([]);
    setUseFlatRate(false); // Reset flat rate when closing patient
  };

  // Password recovery must stay on the login/reset screen even if this device
  // still has an older local auth session saved.
  if (isRecoveryFlowActive()) {
    return (
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="animate-spin text-indigo-600 w-10 h-10" />
        </div>
      }>
        <LoginView onLoginSuccess={handleLoginSuccess} />
      </Suspense>
    );
  }

  // Show patient dashboard if patient is logged in
  if (isAuthenticated && auth.isPatient()) {
    return (
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="animate-spin text-indigo-600 w-10 h-10" />
        </div>
      }>
        <PatientDashboardView onLogout={handleLogout} messagingEnabled={messagingEnabled} />
      </Suspense>
    );
  }

  // Show mobile warning modal if admin is on mobile device
  if (isAuthenticated && isAdmin && isMobileDevice) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-gray-200">
          <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-6">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Not Designed for Mobile</h2>
          <p className="text-gray-600 mb-6">
            This application is only designed for tablets and desktops.
            Please access the admin dashboard from a larger screen device.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-800 rounded-lg border border-amber-200">
            <Monitor className="w-4 h-4" />
            <span className="text-sm font-medium">Desktop/Tablet Only</span>
          </div>
        </div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return (
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="animate-spin text-indigo-600 w-10 h-10" />
        </div>
      }>
        <LoginView onLoginSuccess={handleLoginSuccess} />
      </Suspense>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl text-center border border-red-100">
          <Activity className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Connection Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button onClick={() => fetchInitialData()} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700">
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const isWorkspaceView = currentView === 'ai-assistant' || currentView === 'messaging' || currentView === 'patients' || currentView === 'appointments';
  const editableAllowedTabs = resolveAllowedTabs('normal', newUserData.allowed_tabs) as ViewState[];

  return (
    <div className="min-h-screen flex bg-gray-50 flex-col md:flex-row">
      {/* Toast Notification */}
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ ...toast, show: false })}
        />
      )}
      
      {/* Mobile Header */}
      <header className="md:hidden bg-gray-900 text-white p-4 flex items-center justify-between sticky top-0 z-50">
        <span className="text-lg font-black tracking-tight">DentalCloud<span className="text-indigo-400">Pro</span></span>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside 
        style={{ width: `${sidebarWidth}px` }}
        className={`bg-gray-900 fixed md:sticky top-0 h-screen z-50 md:z-40 border-r border-gray-800 flex flex-col overflow-hidden transition-transform duration-300 md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-8 flex items-center justify-center flex-shrink-0">
          <span className="text-xl font-black text-white tracking-tight text-center">DentalCloud<span className="text-indigo-400">Pro</span></span>
        </div>
        
        <nav className="sidebar-scrollbar mt-2 px-6 space-y-2 flex-1 min-h-0 overflow-y-auto overscroll-contain pb-4">
          {canAccessView('dashboard') && <NavItem icon={<LayoutDashboard size={18} />} label="Overview" active={currentView === 'dashboard'} onClick={() => { setCurrentView('dashboard'); setIsMobileMenuOpen(false); }} />}
          {canAccessView('patients') && <NavItem icon={<Users size={18} />} label="Patients" active={currentView === 'patients'} onClick={() => { setCurrentView('patients'); setIsMobileMenuOpen(false); }} />}
          {canAccessView('appointments') && <NavItem icon={<Calendar size={18} />} label="Appointments" active={currentView === 'appointments'} onClick={() => { setCurrentView('appointments'); setIsMobileMenuOpen(false); }} />}
          {canAccessView('doctors') && <NavItem icon={<UserCheck size={18} />} label="Doctors" active={currentView === 'doctors'} onClick={() => { setCurrentView('doctors'); setIsMobileMenuOpen(false); }} />}
          
          <div className="pt-8 pb-2">
             <p className="px-3 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Operations</p>
             {canAccessView('treatments') && (
               <NavItem icon={<Stethoscope size={18} />} label="Service Menu" active={currentView === 'treatments'} onClick={() => { setCurrentView('treatments'); setIsMobileMenuOpen(false); }} />
             )}
             {canAccessView('records') && (
               <NavItem icon={<ClipboardList size={18} />} label="Audit Log" active={currentView === 'records'} onClick={() => { setCurrentView('records'); setIsMobileMenuOpen(false); }} />
             )}
             {canAccessView('finance') && <NavItem icon={<CreditCard size={18} />} label="Clinical Focus" active={currentView === 'finance'} onClick={() => { setCurrentView('finance'); setIsMobileMenuOpen(false); }} />}
             {canAccessView('expenses') && (
               <NavItem icon={<DollarSign size={18} />} label="Expenses" active={currentView === 'expenses'} onClick={() => { setCurrentView('expenses'); setIsMobileMenuOpen(false); }} />
             )}
             {canAccessView('inventory') && (
               <NavItem icon={<Package size={18} />} label="Inventory" active={currentView === 'inventory'} onClick={() => { setCurrentView('inventory'); setIsMobileMenuOpen(false); }} />
             )}
             {canAccessView('messaging') && (
               <NavItem icon={<MessageCircle size={18} />} label="Messaging" active={currentView === 'messaging'} onClick={() => { setCurrentView('messaging'); setIsMobileMenuOpen(false); }} />
             )}
             {canAccessView('recalls') && (
               <NavItem icon={<BellRing size={18} />} label="Recalls" active={currentView === 'recalls'} onClick={() => { setCurrentView('recalls'); setIsMobileMenuOpen(false); }} />
             )}
             {canAccessView('ai-assistant') && <NavItem icon={<Sparkles size={18} />} label="AI Assistant" active={currentView === 'ai-assistant'} onClick={() => { setCurrentView('ai-assistant'); setIsMobileMenuOpen(false); }} />}
          </div>
          
          <div className="pt-8 pb-2">
             <p className="px-3 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">System</p>
             {canAccessView('users') && (
               <NavItem icon={<Shield size={18} />} label="Users" active={currentView === 'users'} onClick={() => { setCurrentView('users'); setIsMobileMenuOpen(false); }} />
             )}
             {canAccessView('settings') && (
               <NavItem icon={<Settings size={18} />} label="Settings" active={currentView === 'settings'} onClick={() => { setCurrentView('settings'); setIsMobileMenuOpen(false); }} />
             )}
          </div>
        </nav>

        <div className="p-8 pt-4 flex-shrink-0 border-t border-gray-800">
           <div className="p-4 bg-gray-800 rounded-2xl border border-gray-700">
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Logged in as</p>
              <div className="flex items-center justify-between">
                 <span className="text-xs text-gray-300 font-medium">{currentUser}</span>
                 {isAdmin && (
                   <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 uppercase">Admin</span>
                 )}
              </div>
              <button
                onClick={handleLogout}
                className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs font-medium transition-colors"
              >
                <LogOut size={14} />
                Logout
              </button>
           </div>
        </div>
        
        {/* Resize Handle */}
        <div
          onMouseDown={handleMouseDown}
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-500 transition-colors z-30"
          style={{ 
            backgroundColor: isResizing ? '#6366f1' : 'transparent'
          }}
        />
      </aside>

      <main className={isWorkspaceView ? "flex min-w-0 flex-1 flex-col p-0 md:h-screen" : "flex-1 min-w-0 p-4 md:p-10"}>
        <div className={isWorkspaceView ? "flex min-h-0 flex-1 flex-col" : "max-w-6xl mx-auto"}>
          <Suspense fallback={<div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-600 w-10 h-10" /></div>}>
            {currentView === 'dashboard' && canAccessView('dashboard') && <DashboardView
                patients={dashboardPatients}
                appointments={dashboardAppointments}
                treatmentRecords={dashboardRecords}
                expenses={dashboardExpenses}
                currency={currency}
                locations={locations}
                selectedLocationId={dashboardLocationId}
                allBranchesValue={ALL_BRANCHES_VALUE}
                canViewAllBranches={isAdmin && !auth.getSession()?.location_id}
                onLocationChange={handleDashboardLocationChange}
                loading={loading}
              />}
            {currentView === 'patients' && canAccessView('patients') && <PatientsView 
                patients={patients} 
                loading={loading} 
                currency={currency} 
                loyaltyEnabled={loyaltyEnabled} 
                loyaltyRules={loyaltyRules}
                onSelectPatient={handlePatientSelect} 
                onAddPatient={() => {
                  setApplyClinicalFeeOnRegistration(clinicalFeeEnabled);
                  setShowPatientModal(true);
                }} 
                onExportPDF={async () => {
                   const freshPatients = await api.patients.getAll(currentLocationId || undefined);
                   const { exportPatientsToPDF } = await import('./utils/pdfExport');
                   exportPatientsToPDF(freshPatients, currency);
                }}
                onExportExcel={async () => {
                   const freshPatients = await api.patients.getAll(currentLocationId || undefined);
                   const { exportPatientsToExcel } = await import('./utils/excelExport');
                   await exportPatientsToExcel(freshPatients, currency);
                }}
                onUpdatePatient={async (id, data) => {
                  try {
                    await api.patients.update(id, data);
                    fetchInitialData();
                    alert('Patient profile updated successfully!');
                  } catch (err: any) {
                    alert('Error: ' + err.message);
                    throw err;
                  }
                }}
                onDeletePatient={handleDeletePatient}
                onRedeemPoints={(patient, points, amount) => handleRedeemPoints(points, amount, patient)}
                onUpdatePatientAuth={async (patient, password) => {
                  try {
                    await api.patients.updateAccount(patient.id, patient.email || null, password, patient.phone || null);
                    alert('Patient portal account updated successfully!');
                    fetchInitialData(); // Refresh to update has_account status
                  } catch (err: any) {
                    alert('Error: ' + err.message);
                  }
                }}
            />}
            {currentView === 'appointments' && canAccessView('appointments') && <AppointmentsView 
                appointments={appointments} 
                loading={loading} 
                onAddAppointment={() => {setEditingAppointment(null); setNewAppointmentData({ date: '', time: '', type: appointmentTypeOptions[0] || '', status: 'Scheduled', patient_id: '', doctor_id: '' }); setShowAppointmentModal(true)}} 
                onEditAppointment={(apt) => {setEditingAppointment(apt); setNewAppointmentData({ date: apt.date, time: apt.time, type: apt.type || '', status: apt.status, patient_id: apt.patient_id, doctor_id: apt.doctor_id, notes: apt.notes }); setShowAppointmentModal(true)}} 
                onDeleteAppointment={handleDeleteAppointment} 
                onUpdateStatus={handleUpdateAppointmentStatus} 
                onExportPDF={async () => {
                   const freshAppointments = await api.appointments.getAll(currentLocationId || undefined);
                   const { exportAppointmentsToPDF } = await import('./utils/pdfExport');
                   exportAppointmentsToPDF(freshAppointments);
                }}
                onExportExcel={async () => {
                   const freshAppointments = await api.appointments.getAll(currentLocationId || undefined);
                   const { exportAppointmentsToExcel } = await import('./utils/excelExport');
                   await exportAppointmentsToExcel(freshAppointments);
                }}
            />}
            {currentView === 'doctors' && canAccessView('doctors') && <DoctorsView doctors={doctors} loading={loading} onAdd={() => {setEditingDoctor(null); setNewDoctorData({ name: '', email: '', phone: '', specialization: '', schedules: [] }); setShowDoctorModal(true)}} onEdit={(doc) => {setEditingDoctor(doc); setNewDoctorData(doc); setShowDoctorModal(true)}} onDelete={handleDeleteDoctor} />}
            {currentView === 'treatments' && canAccessView('treatments') && <TreatmentConfigView treatmentTypes={treatmentTypes} currency={currency} onAdd={() => {setEditingTreatmentType(null); setNewTreatmentTypeData({ name: '', cost: 0, category: '' }); setShowTreatmentTypeModal(true)}} onEdit={(t) => {setEditingTreatmentType(t); setNewTreatmentTypeData(t); setShowTreatmentTypeModal(true)}} onDelete={(id) => { const treatment = treatmentTypes.find(t => t.id === id); if (treatment) { setServiceToDelete({ id: treatment.id, name: treatment.name }); setDeleteServiceConfirmOpen(true); } }} />}
            {currentView === 'records' && canAccessView('records') && <RecordsView records={globalRecords} loading={loading} onRefresh={fetchGlobalRecords} onDeleteAll={handleDeleteAllRecords} currency={currency} />}
            {currentView === 'inventory' && canAccessView('inventory') && <InventoryView medicines={medicines} topSelling={topSellingMedicines} loading={loading} currency={currency} onAdd={() => {setEditingMedicine(null); setNewMedicineData({ name: '', description: '', unit: 'pack', item_type: 'Medicine', price: 0, stock: 0, min_stock: 0, quantity_step: 1, category: '' }); setShowMedicineModal(true)}} onEdit={(med) => {setEditingMedicine(med); setNewMedicineData(med); setShowMedicineModal(true)}} onDelete={handleDeleteMedicine} />}
            {currentView === 'expenses' && canAccessView('expenses') && (
              <ExpensesView
                expenses={expenses}
                treatmentRecords={globalRecords}
                medicineSales={medicineSales}
                loading={loading}
                currency={currency}
                onAdd={() => {setEditingExpense(null); setNewExpenseData(getDefaultExpenseFormData()); setShowExpenseModal(true);}}
                onEdit={(expense) => {setEditingExpense(expense); setNewExpenseData({ description: expense.description, amount: expense.amount, category: expense.category, date: expense.date }); setShowExpenseModal(true);}}
                onDelete={handleDeleteExpense}
              />
            )}
            {currentView === 'users' && canAccessView('users') && <UsersView users={users} loading={loading} isAdmin={isAdmin} onAdd={() => {setEditingUser(null); setUserFormError(null); setNewUserData(getDefaultUserFormData()); setShowUserModal(true)}} onEdit={(user) => {setEditingUser(user); setUserFormError(null); setNewUserData({ username: user.username, password: '', role: user.role, location_id: user.location_id, allowed_tabs: resolveAllowedTabs(user.role, user.allowed_tabs) }); setShowUserModal(true)}} onDelete={handleDeleteUser} />}
            {currentView === 'settings' && canAccessView('settings') && <SettingsView 
                currency={currency} 
                onCurrencyChange={handleCurrencyChange} 
                locations={locations} 
                currentLocationId={currentLocationId}
                onLocationChange={handleLocationChange}
                onAddLocation={handleCreateLocation} 
                loyaltyRules={loyaltyRules} 
                onUpdateLoyaltyRule={handleUpdateLoyaltyRule} 
                onCreateLoyaltyRule={handleCreateLoyaltyRule} 
                onDeleteLoyaltyRule={handleDeleteLoyaltyRule}
                onResetAllLoyaltyPoints={handleResetAllLoyaltyPoints}
                loyaltyEnabled={loyaltyEnabled}
                onToggleLoyalty={handleToggleLoyalty}
                messagingEnabled={messagingEnabled}
                onToggleMessaging={handleToggleMessaging}
                onRemoveAllMessages={handleRemoveAllMessages}
                clinicalFeeEnabled={clinicalFeeEnabled}
                clinicalFeeAmount={clinicalFeeAmount}
                onSaveClinicalFeeSettings={handleSaveClinicalFeeSettings}
                isAdmin={isAdmin} 
            />}
            {currentView === 'ai-assistant' && canAccessView('ai-assistant') && <AIAssistantView 
                patients={assistantPatients} 
                treatmentRecords={assistantRecords} 
                appointments={assistantAppointments}
                doctors={assistantDoctors}
                treatmentTypes={assistantTreatmentTypes}
                users={users}
                medicines={assistantMedicines}
                expenses={assistantExpenses}
                recalls={assistantRecalls}
                locations={locations}
                currentLocationId={currentLocationId}
                canAccessAllLocations={isAdmin && !auth.getSession()?.location_id}
                currentAdminId={auth.getCurrentUser()?.userId}
                currency={currency}
                onDataRefresh={refreshAssistantData}
              />}
            {currentView === 'messaging' && canAccessView('messaging') && <MessagingView 
              patients={patients} 
              users={users} 
              messagingEnabled={messagingEnabled}
            />}
            {currentView === 'recalls' && canAccessView('recalls') && <RecallsView
              recalls={recalls}
              patients={patients}
              loading={loading}
              onCreateRecall={handleCreateRecall}
              onUpdateStatus={handleUpdateRecallStatus}
              onDeleteRecall={handleDeleteRecall}
              onDeleteAllRecalls={handleDeleteAllRecalls}
              onSendRecallEmail={handleSendRecallEmail}
            />}
            {currentView === 'finance' && <ClinicalView 
                selectedPatient={selectedPatient} 
                doctors={doctors}
                selectedDoctorId={selectedDoctorId}
                selectedTeeth={selectedTeeth} 
                treatmentTypes={treatmentTypes} 
                treatmentHistory={treatmentHistory}
                patientFiles={patientFiles}
                uploadingFiles={uploading}
                useFlatRate={useFlatRate}
                currency={currency}
                onUploadFiles={handleUploadFiles}
                onUploadFilesWithProgress={handleUploadFilesWithProgress}
                onDeleteFile={handleDeleteFile}
                onToggleTooth={(id) => setSelectedTeeth(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])}
                onDoctorChange={setSelectedDoctorId}
                onDeselectAll={() => setSelectedTeeth([])}
                onTreatmentSubmit={handleTreatmentSubmit}
                onPaymentRequest={(amount) => { setPaymentAmount(amount); setShowPaymentModal(true); }}
                onClosePatient={handleClosePatient}
                onOpenDirectory={() => setCurrentView('patients')}
                onGenerateReceipt={handleGenerateReceipt}
                onAddMedicines={handleAddMedicines}
                onToggleFlatRate={setUseFlatRate}
                onUndoTreatment={handleUndoTreatment}
                onRedeemPoints={handleRedeemPoints}
                onUpdatePatient={async (id, data) => {
                  try {
                    await api.patients.update(id, data);
                    fetchInitialData();
                    // update selectedPatient to reflect changes
                    const updated = await api.patients.getAll(currentLocationId || undefined);
                    const p = updated.find(x => x.id === id);
                    if (p) setSelectedPatient(p);
                  } catch (err: any) {
                    alert('Error: ' + err.message);
                  }
                }}
                onUpdateAccount={async (patient, password) => {
                  try {
                    await api.patients.updateAccount(patient.id, patient.email || null, password, patient.phone || null);
                    alert('Patient account updated successfully!');
                    fetchInitialData();
                  } catch (err: any) {
                    alert('Error: ' + err.message);
                  }
                }}
                onCreateAppointment={handleCreateAppointmentFromClinical}
                onOpenAppointments={() => setCurrentView('appointments')}
                loyaltyEnabled={loyaltyEnabled}
                loyaltyRules={loyaltyRules}
                loyaltyTransactions={loyaltyTransactions}
            />}
          </Suspense>
        </div>
      </main>

      {/* Modals */}
      {showPatientModal && (
        <Modal title="Register Clinical Patient" onClose={() => setShowPatientModal(false)}>
          <form onSubmit={handleCreatePatient} className="space-y-5">
            <Input label="Full Patient Name" required value={newPatientData.name} onChange={(e: any) => setNewPatientData({...newPatientData, name: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
               <Input label="Primary Email" type="email" value={newPatientData.email} onChange={(e: any) => setNewPatientData({...newPatientData, email: e.target.value})} />
               <Input label="Mobile Contact" required value={newPatientData.phone} onChange={(e: any) => setNewPatientData({...newPatientData, phone: e.target.value})} />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5">Age</label>
                <input
                  type="number"
                  min="0"
                  max="150"
                  className="w-full border-gray-200 border rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  value={newPatientData.age || ''}
                  onChange={(e) => setNewPatientData({...newPatientData, age: e.target.value ? parseInt(e.target.value) : undefined})}
                  placeholder="Enter age"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5">Patient Type</label>
                <select
                  className="w-full border-gray-200 border rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                  value={newPatientData.patient_type || 'Walk-in'}
                  onChange={(e) => setNewPatientData({...newPatientData, patient_type: e.target.value as Patient['patient_type']})}
                >
                  <option value="Walk-in">Walk-in</option>
                  <option value="ONP">ONP</option>
                  <option value="RNP">RNP</option>
                  <option value="Hotline">Hotline</option>
                  <option value="Rec-ph call">Rec-ph call</option>
                  <option value="Tiktok">Tiktok</option>
                  <option value="Tiktok Hotline">Tiktok Hotline</option>
                </select>
              </div>
            </div>

            <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4">
              <p className="text-[10px] font-black uppercase tracking-wide text-indigo-700 mb-2">Clinical Fee on Registration</p>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="applyClinicalFee"
                    checked={applyClinicalFeeOnRegistration}
                    onChange={() => setApplyClinicalFeeOnRegistration(true)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  Apply
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="applyClinicalFee"
                    checked={!applyClinicalFeeOnRegistration}
                    onChange={() => setApplyClinicalFeeOnRegistration(false)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  Skip
                </label>
                <span className="ml-auto text-xs font-semibold text-indigo-700">
                  Amount: {formatCurrency(Math.max(0, Number(clinicalFeeAmount || 0)), currency)}
                </span>
              </div>
              {!clinicalFeeEnabled && (
                <p className="mt-2 text-xs text-amber-700">Global clinical fee is disabled in Settings. You can still keep this off for this patient.</p>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5">Address</label>
              <input
                type="text"
                className="w-full border-gray-200 border rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                value={newPatientData.address || ''}
                onChange={(e) => setNewPatientData({...newPatientData, address: e.target.value})}
                placeholder="Street address"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5">City</label>
                <SearchableSelect
                  value={newPatientData.city || ''}
                  onChange={(selectedCity) => {
                    const allowedTownships = getTownshipsForCity(selectedCity);
                    const nextTownship = allowedTownships.includes(newPatientData.township || '') ? newPatientData.township : '';
                    setNewPatientData({ ...newPatientData, city: selectedCity, township: nextTownship });
                  }}
                  options={cityOptions}
                  placeholder="Select City"
                  emptyMessage="No city found"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5">Township</label>
                <SearchableSelect
                  value={newPatientData.township || ''}
                  onChange={(selectedTownship) => setNewPatientData({ ...newPatientData, township: selectedTownship })}
                  options={townshipOptionsForNewPatient}
                  placeholder={newPatientData.city ? 'Select Township' : 'Select City first'}
                  emptyMessage={newPatientData.city ? 'No township found for this city' : 'Choose city first'}
                />
              </div>
            </div>
            
            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
              <p className="text-[10px] font-black text-indigo-600 uppercase mb-2">Patient Portal Account (Optional)</p>
              <Input 
                label="Set Password" 
                type="password" 
                placeholder="Leave blank to create without account"
                value={newPatientData.password} 
                onChange={(e: any) => setNewPatientData({...newPatientData, password: e.target.value})} 
              />
              <p className="text-[10px] text-indigo-400 mt-2 italic">If set, patient can log in using their Name/Phone and this password.</p>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5">Relevant Medical History</label>
              <textarea className="w-full border-gray-200 border rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" rows={4}
                value={newPatientData.medicalHistory} onChange={e => setNewPatientData({...newPatientData, medicalHistory: e.target.value})} />
            </div>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Processing...' : 'Finalize Registration'}
            </button>
          </form>
        </Modal>
      )}

      {showAppointmentModal && (
        <Modal title={editingAppointment ? "Edit Appointment" : "New Appointment"} onClose={() => {setShowAppointmentModal(false); setEditingAppointment(null);}}>
          <form onSubmit={handleCreateAppointment} className="space-y-5">
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5">Patient</label>
              <select 
                className="w-full border-gray-200 border rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500"
                required
                value={newAppointmentData.patient_id} 
                onChange={(e: any) => setNewAppointmentData({...newAppointmentData, patient_id: e.target.value})}
              >
                <option value="">Select a patient</option>
                {patients.map(patient => (
                  <option key={patient.id} value={patient.id}>{patient.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5">Doctor (Optional)</label>
              <div className="relative" ref={doctorDropdownRef}>
                <div className="relative">
                  <input
                    type="text"
                    className="w-full border-gray-200 border rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 pr-10"
                    placeholder="Search doctor..."
                    value={doctorSearchQuery}
                    onChange={(e) => {
                      setDoctorSearchQuery(e.target.value);
                      setShowDoctorDropdown(true);
                    }}
                    onFocus={() => setShowDoctorDropdown(true)}
                    onBlur={() => {
                      // Delay hiding to allow click events
                      setTimeout(() => setShowDoctorDropdown(false), 200);
                    }}
                  />
                  {newAppointmentData.doctor_id && (
                    <button
                      onClick={() => {
                        handleDoctorChange('');
                        setDoctorSearchQuery('');
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                
                {/* Dropdown */}
                {showDoctorDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                    <button
                      className="w-full px-4 py-2.5 text-sm text-left hover:bg-gray-50 border-b border-gray-100"
                      onClick={() => {
                        handleDoctorChange('');
                        setDoctorSearchQuery('');
                        setShowDoctorDropdown(false);
                      }}
                    >
                      <span className="text-gray-500">No specific doctor</span>
                    </button>
                    {filteredDoctors.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500 text-center">No doctors found</div>
                    ) : (
                      filteredDoctors.map(doctor => (
                        <button
                          key={doctor.id}
                          className={`w-full px-4 py-2.5 text-sm text-left hover:bg-indigo-50 ${
                            newAppointmentData.doctor_id === doctor.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'
                          }`}
                          onClick={() => {
                            handleDoctorChange(doctor.id);
                            setDoctorSearchQuery(doctor.name);
                            setShowDoctorDropdown(false);
                          }}
                        >
                          <div className="font-medium">{doctor.name}</div>
                          {doctor.specialization && (
                            <div className="text-xs text-gray-500">{doctor.specialization}</div>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Input 
                  label="Date" 
                  type="date" 
                  required 
                  value={newAppointmentData.date} 
                  onChange={(e: any) => handleDateChange(e.target.value)} 
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5">Time</label>
                <Input 
                  type="time" 
                  required 
                  value={newAppointmentData.time} 
                  onChange={(e: any) => setNewAppointmentData({...newAppointmentData, time: e.target.value})} 
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5">Type</label>
                <SearchableSelect
                  value={newAppointmentData.type || ''}
                  onChange={(selectedType) => setNewAppointmentData({ ...newAppointmentData, type: selectedType })}
                  options={appointmentTypeOptionsForModal.map((typeName) => ({ value: typeName, label: typeName }))}
                  placeholder="Select treatment type"
                  emptyMessage="No treatment type found"
                />
                {appointmentTypeOptions.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">No treatment types configured yet. Add services in Treatment Config first.</p>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5">Status</label>
                <select 
                  className="w-full border-gray-200 border rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500"
                  value={newAppointmentData.status} 
                  onChange={(e: any) => setNewAppointmentData({...newAppointmentData, status: e.target.value})}
                >
                  <option value="Scheduled">Scheduled</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5">Notes</label>
              <textarea 
                className="w-full border-gray-200 border rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" 
                rows={3}
                value={newAppointmentData.notes || ''} 
                onChange={(e: any) => setNewAppointmentData({...newAppointmentData, notes: e.target.value})}
                placeholder="Optional notes about this appointment..."
              />
            </div>
            <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-600/20">
              {editingAppointment ? 'Update Appointment' : 'Create Appointment'}
            </button>
          </form>
        </Modal>
      )}

      {showDoctorModal && (
        <Modal title={editingDoctor ? "Edit Doctor" : "New Doctor"} onClose={() => {setShowDoctorModal(false); setEditingDoctor(null);}}>
          <form onSubmit={handleCreateDoctor} className="space-y-5">
            <Input label="Doctor Name" required value={newDoctorData.name} onChange={(e: any) => setNewDoctorData({...newDoctorData, name: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Email" type="email" value={newDoctorData.email} onChange={(e: any) => setNewDoctorData({...newDoctorData, email: e.target.value})} />
              <Input label="Phone" value={newDoctorData.phone} onChange={(e: any) => setNewDoctorData({...newDoctorData, phone: e.target.value})} />
            </div>
            <Input label="Specialization" value={newDoctorData.specialization} onChange={(e: any) => setNewDoctorData({...newDoctorData, specialization: e.target.value})} placeholder="e.g., Orthodontics, Oral Surgery" />
            
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5">Working Schedule</label>
              <div className="space-y-3 border border-gray-200 rounded-xl p-4 bg-gray-50">
                {(newDoctorData.schedules || []).map((schedule, index) => (
                  <div key={index} className="flex gap-2 items-end bg-white p-3 rounded-lg border border-gray-200">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-600 mb-1">Day</label>
                      <select
                        className="w-full border-gray-200 border rounded-lg p-2 text-sm"
                        value={schedule.day_of_week}
                        onChange={(e: any) => {
                          const updated = [...(newDoctorData.schedules || [])];
                          updated[index].day_of_week = parseInt(e.target.value);
                          setNewDoctorData({...newDoctorData, schedules: updated});
                        }}
                      >
                        <option value={0}>Sunday</option>
                        <option value={1}>Monday</option>
                        <option value={2}>Tuesday</option>
                        <option value={3}>Wednesday</option>
                        <option value={4}>Thursday</option>
                        <option value={5}>Friday</option>
                        <option value={6}>Saturday</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-600 mb-1">Start Time</label>
                      <input
                        type="time"
                        className="w-full border-gray-200 border rounded-lg p-2 text-sm"
                        value={schedule.start_time}
                        onChange={(e: any) => {
                          const updated = [...(newDoctorData.schedules || [])];
                          updated[index].start_time = e.target.value;
                          setNewDoctorData({...newDoctorData, schedules: updated});
                        }}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-600 mb-1">End Time</label>
                      <input
                        type="time"
                        className="w-full border-gray-200 border rounded-lg p-2 text-sm"
                        value={schedule.end_time}
                        onChange={(e: any) => {
                          const updated = [...(newDoctorData.schedules || [])];
                          updated[index].end_time = e.target.value;
                          setNewDoctorData({...newDoctorData, schedules: updated});
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...(newDoctorData.schedules || [])];
                        updated.splice(index, 1);
                        setNewDoctorData({...newDoctorData, schedules: updated});
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setNewDoctorData({
                      ...newDoctorData,
                      schedules: [...(newDoctorData.schedules || []), { id: '', day_of_week: 1, start_time: '09:00', end_time: '17:00' }]
                    });
                  }}
                  className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
                >
                  + Add Schedule
                </button>
              </div>
            </div>
            <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-600/20">
              {editingDoctor ? 'Update Doctor' : 'Create Doctor'}
            </button>
          </form>
        </Modal>
      )}

      {showTreatmentTypeModal && (
        <Modal title={editingTreatmentType ? "Update Service Definition" : "New Service Definition"} onClose={() => setShowTreatmentTypeModal(false)}>
          <form onSubmit={handleCreateTreatmentType} className="space-y-5">
            <Input label="Service Description" required value={newTreatmentTypeData.name} onChange={(e: any) => setNewTreatmentTypeData({...newTreatmentTypeData, name: e.target.value})} />
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5">Specialty Department</label>
              <input
                list="treatment-category-suggestions"
                className="w-full border-gray-200 border rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
                value={newTreatmentTypeData.category || ''}
                onChange={(e) => setNewTreatmentTypeData({ ...newTreatmentTypeData, category: e.target.value })}
                placeholder="Type or pick a specialty category"
              />
              <datalist id="treatment-category-suggestions">
                {treatmentCategorySuggestions.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </div>
            <Input label={`Standard Fee (${getCurrencySymbol(currency)})`} type="number" required min="0" value={newTreatmentTypeData.cost} onChange={(e: any) => setNewTreatmentTypeData({...newTreatmentTypeData, cost: parseFloat(e.target.value)})} />
            <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg">Save Configuration</button>
          </form>
        </Modal>
      )}

      {showUserModal && isAdmin && (
        <Modal title={editingUser ? "Edit User" : "New User"} onClose={() => {setShowUserModal(false); setEditingUser(null); setUserFormError(null); setNewUserData(getDefaultUserFormData());}}>
          <form onSubmit={handleCreateUser} className="space-y-5">
            <Input 
              label="Username" 
              required 
              value={newUserData.username} 
              onChange={(e: any) => {setUserFormError(null); setNewUserData({...newUserData, username: e.target.value});}} 
              placeholder="Enter username"
            />
            <Input 
              label={editingUser ? "New Password (leave blank to keep current)" : "Password"} 
              type="password"
              required={!editingUser}
              value={newUserData.password || ''} 
              onChange={(e: any) => {setUserFormError(null); setNewUserData({...newUserData, password: e.target.value});}} 
              placeholder="Enter password"
            />
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5">Assign Location</label>
              <select 
                className="w-full border-gray-200 border rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500"
                value={newUserData.location_id || ''} 
                onChange={(e: any) => {setUserFormError(null); setNewUserData({...newUserData, location_id: e.target.value || null});}}
              >
                <option value="">{newUserData.role === 'admin' ? 'All Locations (Global Manager)' : 'All Assigned Locations'}</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5">Role</label>
              <select 
                className="w-full border-gray-200 border rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500"
                value={newUserData.role} 
                onChange={(e: any) => handleUserRoleChange(e.target.value)}
              >
                <option value="normal">Normal Staff</option>
                <option value="admin">Manager</option>
              </select>
            </div>
            {newUserData.role === 'admin' ? (
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                <p className="text-sm font-semibold text-indigo-900">Manager accounts always get full system access.</p>
                <p className="mt-1 text-xs text-indigo-700">Users and Settings remain manager-only. Staff permissions below are only for normal accounts.</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5">Tab Access</label>
                    <p className="text-sm text-gray-500">Choose which tabs this normal account can open.</p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600">
                    {editableAllowedTabs.length} tab{editableAllowedTabs.length === 1 ? '' : 's'} selected
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {FLEXIBLE_STAFF_TABS.map(tab => {
                    const checked = editableAllowedTabs.includes(tab.key);
                    return (
                      <label
                        key={tab.key}
                        className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition ${
                          checked ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleUserTabAccess(tab.key)}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{tab.label}</p>
                          <p className="mt-1 text-xs text-gray-500">{tab.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
                {editableAllowedTabs.length === 0 && (
                  <p className="mt-3 text-xs font-medium text-red-600">Select at least one tab for this account.</p>
                )}
              </div>
            )}
            {userFormError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm font-semibold text-red-900">Couldn&apos;t save this user yet</p>
                <p className="mt-1 text-xs text-red-700">{userFormError}</p>
              </div>
            )}
            <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-600/20">
              {editingUser ? 'Update User' : 'Create User'}
            </button>
          </form>
        </Modal>
      )}

      {showMedicineModal && (
        <Modal title={editingMedicine ? "Edit Inventory Item" : "New Inventory Item"} onClose={() => {setShowMedicineModal(false); setEditingMedicine(null); setNewMedicineData({ name: '', description: '', unit: 'pack', item_type: 'Medicine', price: 0, stock: 0, min_stock: 0, quantity_step: 1, category: '' });}}>
          <form onSubmit={handleCreateMedicine} className="space-y-5">
            <Input 
              label="Item Name" 
              required 
              value={newMedicineData.name} 
              onChange={(e: any) => setNewMedicineData({...newMedicineData, name: e.target.value})} 
              placeholder="e.g., Amoxicillin, Toothbrush, Mouthwash"
            />
            <Input 
              label="Description" 
              value={newMedicineData.description || ''} 
              onChange={(e: any) => setNewMedicineData({...newMedicineData, description: e.target.value})} 
              placeholder="Optional description"
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5">Item Type</label>
                <select 
                  className="w-full border-gray-200 border rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500"
                  value={newMedicineData.item_type || 'Medicine'} 
                  onChange={(e: any) => setNewMedicineData({...newMedicineData, item_type: e.target.value as Medicine['item_type']})}
                >
                  <option value="Medicine">Medicine</option>
                  <option value="Retail">Retail Item</option>
                  <option value="Supply">Supply</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5">Unit</label>
                <select 
                  className="w-full border-gray-200 border rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500"
                  value={newMedicineData.unit} 
                  onChange={(e: any) => setNewMedicineData({...newMedicineData, unit: e.target.value})}
                >
                  <option value="pack">Pack</option>
                  <option value="bottle">Bottle</option>
                  <option value="box">Box</option>
                  <option value="card">Card</option>
                  <option value="strip">Strip</option>
                  <option value="tube">Tube</option>
                  <option value="piece">Piece</option>
                  <option value="unit">Unit</option>
                  <option value="tablet">Tablet</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input 
                label="Category" 
                value={newMedicineData.category || ''} 
                onChange={(e: any) => setNewMedicineData({...newMedicineData, category: e.target.value})} 
                placeholder="e.g., Antibiotics, Oral Care"
              />
              <Input
                label="Dispense Step"
                type="number"
                min="0.01"
                step="0.01"
                value={newMedicineData.quantity_step || 1}
                onChange={(e: any) => setNewMedicineData({...newMedicineData, quantity_step: Math.max(0.01, parseFloat(e.target.value) || 1)})}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input 
                label={`Price (${getCurrencySymbol(currency)})`} 
                type="number" 
                required 
                min="0" 
                step="0.01"
                value={newMedicineData.price || 0} 
                onChange={(e: any) => setNewMedicineData({...newMedicineData, price: parseFloat(e.target.value) || 0})} 
              />
              <Input 
                label="Stock" 
                type="number" 
                required 
                min="0"
                step="0.01"
                value={newMedicineData.stock || 0} 
                onChange={(e: any) => setNewMedicineData({...newMedicineData, stock: parseFloat(e.target.value) || 0})} 
              />
              <Input 
                label="Min Stock" 
                type="number" 
                min="0"
                step="0.01"
                value={newMedicineData.min_stock || 0} 
                onChange={(e: any) => setNewMedicineData({...newMedicineData, min_stock: parseFloat(e.target.value) || 0})} 
              />
            </div>
            <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-600/20">
              {editingMedicine ? 'Update Item' : 'Create Item'}
            </button>
          </form>
        </Modal>
      )}

      {showExpenseModal && (
        <Modal title={editingExpense ? "Edit Expense" : "New Expense"} onClose={() => {setShowExpenseModal(false); setEditingExpense(null); setNewExpenseData(getDefaultExpenseFormData());}}>
          <form onSubmit={handleCreateExpense} className="space-y-5">
            <Input
              label="Description"
              required
              value={newExpenseData.description || ''}
              onChange={(e: any) => setNewExpenseData({ ...newExpenseData, description: e.target.value })}
              placeholder="e.g., Supplies, Utilities, Rent"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Category"
                required
                value={newExpenseData.category || ''}
                onChange={(e: any) => setNewExpenseData({ ...newExpenseData, category: e.target.value })}
                placeholder="e.g., Operations"
              />
              <Input
                label={`Amount (${getCurrencySymbol(currency)})`}
                type="number"
                required
                min="0"
                step="0.01"
                value={newExpenseData.amount || 0}
                onChange={(e: any) => setNewExpenseData({ ...newExpenseData, amount: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <Input
              label="Date"
              type="date"
              required
              value={newExpenseData.date || ''}
              onChange={(e: any) => setNewExpenseData({ ...newExpenseData, date: e.target.value })}
            />
            <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-600/20">
              {editingExpense ? 'Update Expense' : 'Create Expense'}
            </button>
          </form>
        </Modal>
      )}

      {showMedicineSelectionModal && (
        <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"><Loader2 className="animate-spin text-white w-10 h-10" /></div>}>
          <MedicineSelectionModal
            medicines={medicines}
            currency={currency}
            onConfirm={handleMedicineSelectionConfirm}
            onClose={() => {
              setShowMedicineSelectionModal(false);
            }}
          />
        </Suspense>
      )}

      {showPaymentModal && (
        <Modal title="Financial Processing" onClose={() => setShowPaymentModal(false)}>
          <div className="mb-8 p-4 bg-gray-50 rounded-2xl border border-gray-100 text-center">
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Outstanding Balance</p>
            <p className="text-3xl font-black text-gray-900">{formatCurrency(selectedPatient?.balance || 0, currency)}</p>
          </div>
          <form onSubmit={handlePaymentSubmit} className="space-y-5">
            <Input label={`Payment Amount Recieved (${getCurrencySymbol(currency)})`} type="number" required min="0.01" step="0.01" max={selectedPatient?.balance}
              value={paymentAmount} onChange={(e: any) => setPaymentAmount(parseFloat(e.target.value))} />
            <button type="submit" className="w-full bg-green-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-green-600/20">Post Payment & Clear Balance</button>
          </form>
        </Modal>
      )}

      {showTreatmentSelection && selectedPatient && (
        <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"><Loader2 className="animate-spin text-white w-10 h-10" /></div>}>
          <TreatmentSelectionModal
            treatments={treatmentHistory}
            currency={currency}
            onConfirm={handleTreatmentSelectionConfirm}
            onClose={() => setShowTreatmentSelection(false)}
          />
        </Suspense>
      )}

      {showReceipt && selectedPatient && (
        <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"><Loader2 className="animate-spin text-white w-10 h-10" /></div>}>
          <Receipt
            patient={selectedPatient}
            treatments={selectedTreatmentsForReceipt.length > 0 ? selectedTreatmentsForReceipt : treatmentHistory}
            medicines={selectedMedicineSalesForReceipt}
            paymentAmount={lastPaymentAmount}
            currency={currency}
            onClose={() => {
              setShowReceipt(false);
              setSelectedTreatmentsForReceipt([]);
              setSelectedMedicineSalesForReceipt([]);
            }}
          />
        </Suspense>
      )}

      {/* Service Deletion Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteServiceConfirmOpen}
        title="Delete Service"
        message={`Are you sure you want to delete "${serviceToDelete?.name}"? Treatment history will be preserved, but this service will no longer be available for new appointments.`}
        confirmText="Delete Service"
        cancelText="Cancel"
        type="danger"
        onConfirm={() => {
          if (serviceToDelete) {
            handleDeleteTreatmentType(serviceToDelete.id);
          }
        }}
        onCancel={() => {
          setServiceToDelete(null);
          setDeleteServiceConfirmOpen(false);
        }}
      />
    </div>
  );
};

export default App;
