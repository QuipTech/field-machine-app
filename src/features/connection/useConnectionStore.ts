import { create } from 'zustand';

export type ConnectionStatus =
  | 'idle'
  | 'validating'
  | 'reconnecting'
  | 'connected';
interface ConnectionState {
  status: ConnectionStatus;
  isSessionValid: boolean;
  diagnostics: string[];
  remoteSessionRevision: number;
}

const useConnectionStore = create<ConnectionState>(() => ({
  status: 'idle',
  isSessionValid: false,
  diagnostics: [],
  remoteSessionRevision: 0,
}));

export default useConnectionStore;
