import React, { useSyncExternalStore } from 'react';
import { Rabbit } from 'lucide-react';
import { backendConnection, getBackendLatencyBand } from '../services/backendConnection';

const getConnectionLabel = (latencyMs: number | null, band: ReturnType<typeof getBackendLatencyBand>): string => {
  if (band === 'unavailable') return 'Server connection unavailable';
  return `Server response time ${latencyMs} ms — ${band}`;
};

export const BackendLatencyRabbit: React.FC = () => {
  useSyncExternalStore(backendConnection.subscribe, backendConnection.getSnapshot, backendConnection.getSnapshot);
  const latencyMs = backendConnection.getLatencyMs();
  const band = getBackendLatencyBand(latencyMs, backendConnection.getStatus());
  const label = getConnectionLabel(latencyMs, band);

  return (
    <div className={`backend-latency-rabbit backend-latency-rabbit--${band}`} role="status" aria-label={label} title={label}>
      <Rabbit aria-hidden="true" size={17} strokeWidth={2.4} />
      {latencyMs !== null && <span className="backend-latency-rabbit__latency">{latencyMs}</span>}
    </div>
  );
};