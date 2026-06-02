import React, { useRef, useState } from 'react';
import { CheckCircle, ScanLine } from 'lucide-react';
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
  const [successPatient, setSuccessPatient] = useState<Patient | null>(null);
  const scannerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const hasHandledScanRef = useRef(false);

  const stopScanner = () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (scannerRef.current) {
      scannerRef.current.innerHTML = '';
    }
  };

  const closeScanner = () => {
    setShowQRScanner(false);
    setScannerError(null);
    hasHandledScanRef.current = false;
    stopScanner();
  };

  const openScannedPatientChart = () => {
    if (!successPatient) return;

    const patientToOpen = successPatient;
    setSuccessPatient(null);
    onSelectPatient(patientToOpen);
  };

  React.useEffect(() => {
    if (!showQRScanner) return;

    let stopped = false;
    hasHandledScanRef.current = false;

    const startScanner = async () => {
      try {
        if (!scannerRef.current) return;

        scannerRef.current.innerHTML = '';

        const video = document.createElement('video');
        video.id = 'patient-qr-scanner-video';
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.className = 'absolute inset-0 h-full w-full object-cover';
        scannerRef.current.appendChild(video);
        videoRef.current = video;

        // iOS Safari can report zero video/container dimensions if the camera starts
        // before the modal and video element finish layout.
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (stopped) return;

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera scanning is not supported by this browser.');
        }

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch (advancedConstraintError) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false,
          });
        }

        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        video.srcObject = stream;
        await video.play();

        const { default: jsQR } = await import('jsqr');
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('Unable to prepare QR scanner canvas.');

        const handleDecodedText = (decodedText: string) => {
          if (hasHandledScanRef.current) return;

          const rawId = decodePatientQR(decodedText);
          if (!rawId) {
            setScannerError('QR code detected, but it is not a valid patient QR code.');
            return;
          }

          const matchedPatient = patients.find(
            (p) => p.patient_unique_id === rawId || p.id === rawId
          );

          if (!matchedPatient) {
            setScannerError(`Patient with ID "${rawId}" not found in the current branch.`);
            return;
          }

          hasHandledScanRef.current = true;
          stopScanner();
          setScannerError(null);
          setShowQRScanner(false);
          setSuccessPatient(matchedPatient);
        };

        const scanFrame = () => {
          if (stopped || hasHandledScanRef.current || !videoRef.current) return;

          if (
            video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
            video.videoWidth > 0 &&
            video.videoHeight > 0
          ) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'attemptBoth',
            });

            if (qrCode?.data) {
              handleDecodedText(qrCode.data);
              if (hasHandledScanRef.current) return;
            }
          }

          animationFrameRef.current = requestAnimationFrame(scanFrame);
        };

        animationFrameRef.current = requestAnimationFrame(scanFrame);

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack?.applyConstraints) {
          videoTrack.applyConstraints({
            advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet],
          }).catch(() => {});
        }

        setScannerError(null);
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
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-[62%] w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-2xl border-4 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.18)]" />
            </div>
            <p className="text-xs text-gray-500 text-center">
              Keep the QR code inside the green box and hold still for a moment.
            </p>
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

      {successPatient && (
        <Modal title="Patient Chart Opened" maxWidthClassName="max-w-md" onClose={openScannedPatientChart}>
          <div className="flex flex-col items-center text-center gap-5">
            <div className="w-16 h-16 rounded-3xl bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="w-9 h-9 text-emerald-600" />
            </div>
            <div>
              <p className="text-lg font-black text-gray-900">
                Successfully opened &quot;{successPatient.name}&quot; Chart
              </p>
              <p className="text-sm text-gray-500 mt-2">
                The scanned patient chart is ready to view.
              </p>
            </div>
            <button
              onClick={openScannedPatientChart}
              className="w-full px-6 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
            >
              OK
            </button>
          </div>
        </Modal>
      )}
    </>
  );
};

export default PatientQRScanButton;