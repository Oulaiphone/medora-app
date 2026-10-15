import { useNetInfo } from '@react-native-community/netinfo';

import { useStore } from './store';

export type SyncKind = 'ok' | 'waiting' | 'attention';
export interface SyncStatus {
  kind: SyncKind;
  label: 'Up to date' | 'Waiting to sync' | 'Needs attention';
  detail: string;
  online: boolean;
}

/** The three states from the team brief: Up to date, Waiting to sync, Needs attention. */
export function useSyncStatus(): SyncStatus {
  const pending = useStore((s) => s.sharing.outbox.length);
  const lastError = useStore((s) => s.sharing.lastError);
  const backedUp = useStore((s) => !!s.sharing.circleId);
  const net = useNetInfo();
  const online = net.isConnected !== false;
  if (lastError) return { kind: 'attention', label: 'Needs attention', detail: lastError, online };
  if (pending > 0) {
    return {
      kind: 'waiting',
      label: 'Waiting to sync',
      detail: `${pending} change${pending === 1 ? '' : 's'} saved on this phone. ${online ? 'Sending now…' : 'They will sync when you are back online.'}`,
      online,
    };
  }
  return {
    kind: 'ok',
    label: 'Up to date',
    detail: backedUp ? 'Everything is saved on this phone and backed up to your account.' : 'Everything is saved on this phone.',
    online,
  };
}
