import React, { useState, useEffect } from 'react';
import { Home, Calendar, FileText, User, LogOut, Settings } from 'lucide-react';
import { auth } from '../services/auth';
import { api } from '../services/api';
import { Patient, Appointment, ClinicalRecord } from '../types';

interface PatientDashboardProps {
  onLogout: () => void;
}

const PatientDashboard: React.FC<PatientDashboardProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'home' | 'appointments' | 'records' | 'profile'>('home');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [treatmentRecords, setTreatmentRecords] = useState<ClinicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPatientData();
  }, []);

  const fetchPatientData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const patientId = auth.getCurrentPatientId();
      if (!patientId) {
        throw new Error('No patient session found');
      }
      
      // Fetch patient profile
      const allPatients = await api.patients.getAll();
      const patientData = allPatients.find(p => p.id === patientId);
      if (!patientData) {
        throw new Error('Patient data not found');
      }
      setPatient(patientData);
      
      // Fetch appointments
      const allAppointments = await api.appointments.getAll(patientData.location_id);
      const patientAppointments = allAppointments.filter(apt => apt.patient_id === patientId);
      setAppointments(patientAppointments);
      
      // Fetch treatment records
      const records = await api.treatments.getHistory(patientId);
      setTreatmentRecords(records);
      
    } catch (err: any) {
      setError(err.message || 'Failed to load patient data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    auth.logout();
    onLogout();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-6 max-w-md text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Dashboard</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchPatientData}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Patient data not available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Hello, {patient.name}</h1>
            <p className="text-sm text-gray-500">Patient Dashboard</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('profile')}
              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <User className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 rounded-full bg-red-100 hover:bg-red-200 transition-colors"
            >
              <LogOut className="w-5 h-5 text-red-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto pb-20">
        {activeTab === 'home' && (
          <div className="p-4 space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="text-2xl font-bold text-indigo-600">{appointments.length}</div>
                <div className="text-sm text-gray-600">Appointments</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="text-2xl font-bold text-green-600">{treatmentRecords.length}</div>
                <div className="text-sm text-gray-600">Treatments</div>
              </div>
            </div>

            {/* Upcoming Appointments */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Upcoming Appointments</h2>
              </div>
              <div className="p-4">
                {appointments.filter(apt => apt.status === 'Scheduled').length > 0 ? (
                  <div className="space-y-3">
                    {appointments
                      .filter(apt => apt.status === 'Scheduled')
                      .slice(0, 3)
                      .map(apt => (
                        <div key={apt.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-indigo-600" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{apt.date}</p>
                            <p className="text-sm text-gray-600">{apt.time} • {apt.type}</p>
                          </div>
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            {apt.status}
                          </span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No upcoming appointments</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Treatments */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Recent Treatments</h2>
              </div>
              <div className="p-4">
                {treatmentRecords.length > 0 ? (
                  <div className="space-y-3">
                    {treatmentRecords
                      .slice(0, 3)
                      .map(record => (
                        <div key={record.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <FileText className="w-5 h-5 text-green-600" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{record.description}</p>
                            <p className="text-sm text-gray-600">{record.date}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No treatment records yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'appointments' && (
          <div className="p-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">My Appointments</h2>
              </div>
              <div className="p-4">
                {appointments.length > 0 ? (
                  <div className="space-y-3">
                    {appointments.map(apt => (
                      <div key={apt.id} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-medium text-gray-900">{apt.type}</h3>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            apt.status === 'Scheduled' ? 'bg-blue-100 text-blue-800' :
                            apt.status === 'Completed' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {apt.status}
                          </span>
                        </div>
                        <p className="text-gray-600 mb-1">
                          <Calendar className="w-4 h-4 inline mr-1" />
                          {apt.date} at {apt.time}
                        </p>
                        {apt.doctor_name && (
                          <p className="text-gray-600 mb-2">
                            <User className="w-4 h-4 inline mr-1" />
                            Dr. {apt.doctor_name}
                          </p>
                        )}
                        {apt.notes && (
                          <p className="text-sm text-gray-500 mt-2">{apt.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Appointments</h3>
                    <p className="text-gray-500">You don't have any appointments scheduled.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'records' && (
          <div className="p-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Treatment Records</h2>
              </div>
              <div className="p-4">
                {treatmentRecords.length > 0 ? (
                  <div className="space-y-4">
                    {treatmentRecords.map(record => (
                      <div key={record.id} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-medium text-gray-900">{record.description}</h3>
                          <span className="text-sm text-gray-500">{record.date}</span>
                        </div>
                        <p className="text-gray-600 mb-2">
                          <FileText className="w-4 h-4 inline mr-1" />
                          Treatment Record
                        </p>
                        {record.teeth && record.teeth.length > 0 && (
                          <p className="text-sm text-gray-500">
                            Teeth: {record.teeth.join(', ')}
                          </p>
                        )}
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <span className="text-lg font-semibold text-green-600">
                            {record.cost.toLocaleString()} MMK
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Treatment Records</h3>
                    <p className="text-gray-500">You don't have any treatment records yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="p-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">My Profile</h2>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
                    <User className="w-8 h-8 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{patient.name}</h3>
                    <p className="text-gray-600">Patient ID: {patient.id.substring(0, 8)}...</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium text-gray-900">{patient.email}</p>
                  </div>
                  
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="font-medium text-gray-900">{patient.phone || 'Not provided'}</p>
                  </div>
                  
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Account Balance</p>
                    <p className="font-medium text-gray-900">{patient.balance.toLocaleString()} MMK</p>
                  </div>
                  
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Loyalty Points</p>
                    <p className="font-medium text-gray-900">{patient.loyalty_points} points</p>
                  </div>
                </div>
                
                {patient.medicalHistory && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Medical History</p>
                    <p className="text-gray-900">{patient.medicalHistory}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2">
        <div className="flex justify-around">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${
              activeTab === 'home' 
                ? 'text-indigo-600 bg-indigo-50' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Home className="w-6 h-6 mb-1" />
            <span className="text-xs">Home</span>
          </button>
          
          <button
            onClick={() => setActiveTab('appointments')}
            className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${
              activeTab === 'appointments' 
                ? 'text-indigo-600 bg-indigo-50' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Calendar className="w-6 h-6 mb-1" />
            <span className="text-xs">Appointments</span>
          </button>
          
          <button
            onClick={() => setActiveTab('records')}
            className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${
              activeTab === 'records' 
                ? 'text-indigo-600 bg-indigo-50' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="w-6 h-6 mb-1" />
            <span className="text-xs">Records</span>
          </button>
          
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${
              activeTab === 'profile' 
                ? 'text-indigo-600 bg-indigo-50' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <User className="w-6 h-6 mb-1" />
            <span className="text-xs">Profile</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PatientDashboard;