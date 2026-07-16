import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';

import type { Location } from '../types';

interface BranchSwitcherViewProps {
  locations: Location[];
  currentLocationId: string;
  onLocationChange: (locationId: string) => Promise<void>;
}

const BranchSwitcherView: React.FC<BranchSwitcherViewProps> = ({
  locations,
  currentLocationId,
  onLocationChange
}) => {
  const [selectedBranchId, setSelectedBranchId] = useState(currentLocationId);
  const [isSwitching, setIsSwitching] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    setSelectedBranchId(currentLocationId);
  }, [currentLocationId]);

  const currentBranch = locations.find((location) => location.id === currentLocationId);
  const selectedBranch = locations.find((location) => location.id === selectedBranchId);
  const canSwitch = !!selectedBranchId && selectedBranchId !== currentLocationId && !isSwitching;

  const handleSwitch = async () => {
    if (!canSwitch || !selectedBranch) return;
    setErrorMessage('');
    setSuccessMessage('');
    setIsSwitching(true);
    try {
      await onLocationChange(selectedBranchId);
      setSuccessMessage(`You are now working in ${selectedBranch.name}.`);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Unable to switch branches. Your previous branch is still active. Please try again.');
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-6xl animate-fade-in overflow-hidden rounded-[2rem] border border-emerald-100 bg-white shadow-[0_24px_70px_-36px_rgba(15,118,110,0.4)]">
      <header className="relative overflow-hidden border-b border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-200/30 blur-3xl" aria-hidden="true" />
        <div className="relative flex max-w-3xl items-start gap-4 sm:gap-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 sm:h-16 sm:w-16">
            <Building2 size={28} aria-hidden="true" />
          </div>
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Branch workspace</p>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Choose where you’re working</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Switch your active clinic branch safely. Patient, appointment, doctor, and operational information will reload for your selection.
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-0 lg:grid-cols-[0.9fr_1.35fr]">
        <aside className="border-b border-slate-200 bg-slate-50/80 p-5 sm:p-8 lg:border-b-0 lg:border-r lg:p-10">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Currently active</p>
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <MapPin size={22} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                  Active now
                </div>
                <p className="mt-1 break-words text-lg font-black text-slate-950">
                  {currentBranch?.name || 'No active branch selected'}
                </p>
                {currentBranch?.address && (
                  <p className="mt-1 text-sm leading-5 text-slate-500">{currentBranch.address}</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 shrink-0 text-emerald-600" size={20} aria-hidden="true" />
              <div>
                <p className="text-sm font-bold text-slate-800">Your access stays the same</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Only the active branch and branch-specific data will change.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <RefreshCw className="mt-0.5 shrink-0 text-cyan-700" size={19} aria-hidden="true" />
              <div>
                <p className="text-sm font-bold text-slate-800">Fresh branch data</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Open patient files and unsaved screen state are cleared during the switch.</p>
              </div>
            </div>
          </div>
        </aside>

        <form
          className="p-5 sm:p-8 lg:p-10"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSwitch();
          }}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Select destination</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Switch to another branch</h2>
            </div>
            <p className="text-sm font-semibold text-slate-500">{locations.length} branch{locations.length === 1 ? '' : 'es'} available</p>
          </div>

          <div className="mt-6">
            <label htmlFor="marketing-active-branch" className="block text-sm font-bold text-slate-800">
              Clinic branch
            </label>
            <p id="branch-select-help" className="mt-1 text-sm text-slate-500">Choose the branch whose daily operations you want to access.</p>
            <div className="relative mt-3">
              <MapPin className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} aria-hidden="true" />
              <select
                id="marketing-active-branch"
                aria-describedby="branch-select-help"
                value={selectedBranchId}
                onChange={(event) => {
                  setSelectedBranchId(event.target.value);
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                disabled={isSwitching || locations.length === 0}
                className="min-h-14 w-full cursor-pointer appearance-auto rounded-2xl border border-slate-300 bg-white py-3 pl-12 pr-4 text-base font-bold text-slate-900 outline-none transition duration-200 hover:border-emerald-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                <option value="">Select a branch</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}{location.id === currentLocationId ? ' — Current branch' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={`mt-6 rounded-2xl border p-5 transition duration-200 ${
            canSwitch ? 'border-cyan-200 bg-cyan-50/70' : 'border-slate-200 bg-slate-50'
          }`}>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Switch preview</p>
            <div className="mt-3 flex items-center gap-3 sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-500">From</p>
                <p className="mt-1 truncate text-sm font-black text-slate-900 sm:text-base">{currentBranch?.name || 'Not selected'}</p>
              </div>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${canSwitch ? 'bg-cyan-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                <ArrowRight size={19} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1 text-right">
                <p className="text-xs font-semibold text-slate-500">To</p>
                <p className="mt-1 truncate text-sm font-black text-slate-900 sm:text-base">
                  {canSwitch ? selectedBranch?.name : 'Choose another branch'}
                </p>
              </div>
            </div>
          </div>

          {errorMessage && (
            <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-700">
              {errorMessage}
            </p>
          )}

          {successMessage && (
            <p aria-live="polite" className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              <CheckCircle2 size={18} aria-hidden="true" />
              {successMessage}
            </p>
          )}

          <div className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-slate-500">The switch completes only after the selected branch loads successfully.</p>
            <button
              type="submit"
              disabled={!canSwitch}
              className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition duration-200 hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none sm:w-auto"
            >
              {isSwitching ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={18} aria-hidden="true" />}
              {isSwitching ? 'Loading branch...' : 'Switch active branch'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};

export default BranchSwitcherView;
