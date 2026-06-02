import React, { useRef, useState } from 'react';
import { ScanLine } from 'lucide-react';
import { Patient } from '../types';
import { Modal } from './Shared';
import { decodePatientQR } from './PatientQRCode';

interface PatientQRScanButtonProps {
  patients: Patient[];
  onSelectPatient: (patient: Patient) => void;
  className?: string;
}

const PatientQRScanButton: React.FC<PatientQRScanButtonProps> = ({
  patients,
  onSelectPatient,
  className = 'flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors'
}) => {
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const scannerRef = useRef<HTMLDivElement | null>(null);
  const html5QrCodeRef = useRef<any>(null);

  const stopScanner = () => {
    if (html5QrCodeRef.current) {
      try {
        html5QrCodeRef.current.stop().catch(() => {});
      } catch (e) {}
      html5QrCodeRef.current = null;
    }
  };

  const closeScanner = () => {
    setShowQRScanner(false);
    setScannerError(null);
    stopScanner();
  };

  React.useEffect(() => {
    if (!showQRScanner) return;

    let stopped = false;

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');

        const scannerId = 'patient-qr-scanner';
        let existingEl = document.getElementById(scannerId);
        if (!existingEl) {
          const div = document.createElement('div');
          div.id = scannerId;
          if (scannerRef.current) {
            scannerRef.current.innerHTML = '';
            scannerRef.current.appendChild(div);
          }
        }

        const html5QrCode = new Html5Qrcode(scannerId);
        html5QrCodeRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
              const size = Math.min(
                Math.min(viewfinderWidth, viewfinderHeight) * 0.65,
                280
              );
              return { width: size, height: size };
            },
          },
          (decodedText) => {
            const rawId = decodePatientQR(decodedText);
            if (!rawId) {
              setScannerError('Invalid QR code format. Please scan a valid patient QR code.');
              return;
            }

            const matchedPatient = patients.find(
              (p) => p.patient_unique_id === rawId || p.id === rawId
            );

            if (!matchedPatient) {
              setScannerError(`Patient with ID "${rawId}" not found in the current branch.`);
              return;
            }

            stopScanner();
            setScannerError(null);
            setShowQRScanner(false);
            onSelectPatient(matchedPatient);
          },
          () => {
            // Ignore scan failures and keep trying.
          }
        );
      } catch (err: any) {
        if (stopped) return;
        if (err?.toString()?.includes('NotAllowedError') || err?.toString()?.includes('Permission')) {
          setScannerError('Camera access denied. Please allow camera permissions and try again.');
        } else if (err?.toString()?.includes('NotFoundError')) {
          setScannerError('No camera found on this device. Please use a device with a camera.');
        } else {
          setScannerError(`Failed to start scanner: ${err?.message || err}`);
        }
      }
    };

    startScanner();

    return () => {
      stopped = true;
      stopScanner();
    };
  }, [showQRScanner, patients, onSelectPatient]);

  return (
    <>
      <button
        onClick={() => setShowQRScanner(true)}
        className={className}
        title="Scan patient QR code to quickly open their chart"
      >
        <ScanLine className="w-4 h-4" /> <span className="hidden sm:inline">Scan QR</span>
      </button>

      {showQRScanner && (
        <Modal title="Scan Patient QR Code" maxWidthClassName="max-w-xl" onClose={closeScanner}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Point your camera at the patient&apos;s QR code to automatically open their chart.
            </p>
            {scannerError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm font-semibold text-red-700">{scannerError}</p>
              </div>
            )}
            <div className="relative w-full overflow-hidden rounded-xl bg-gray-900 mx-auto" style={{ maxWidth: '520px', aspectRatio: '4 / 3' }}>
              <div
                ref={(el) => { if (!el) return; scannerRef.current = el; }}
                className="absolute inset-0 w-full h-full"
              />
            </div>
            <div className="flex justify-center">
              <button
                onClick={closeScanner}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default PatientQRScanButton;