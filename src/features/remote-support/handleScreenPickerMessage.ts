import recordSessionDiagnostic from '../connection/sessionDiagnostics';
import recordPeerSignal from './recordPeerSignal';

interface Handlers {
  setIsChoosingScreen: (isChoosing: boolean) => void;
  setSelectedSurface: (surface: 'monitor' | 'window') => void;
  onLoaded: () => void;
  onControlMessage: (message: string) => void;
  retry: () => void;
}

const handleScreenPickerMessage = (message: string, handlers: Handlers) => {
  switch (message) {
    case 'screen-picker-ready':
      handlers.setIsChoosingScreen(true);
      recordSessionDiagnostic('remote:picker', 'ready');
      break;
    case 'screen-picker-selected-monitor':
    case 'screen-picker-selected-window':
      handlers.setSelectedSurface(message === 'screen-picker-selected-monitor' ? 'monitor' : 'window');
      handlers.setIsChoosingScreen(false);
      break;
    case 'screen-picker-page-loaded':
      recordSessionDiagnostic('remote:picker', 'webview_loaded');
      handlers.onLoaded();
      break;
    case 'reconnect-screen-peer':
      handlers.retry();
      break;
    default:
      handlers.onControlMessage(message);
      recordPeerSignal(message);
  }
};

export default handleScreenPickerMessage;
