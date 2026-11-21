import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface ScreenCaptureModule extends TurboModule {
  // Phase 0 captures the whole primary monitor after the explicit Start action.
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<string>;
  getSnapshot(): Promise<string>;
}

const getScreenCapture = () => {
  return TurboModuleRegistry.get<ScreenCaptureModule>(
    'FieldMachineScreenCapture',
  );
};

export default getScreenCapture;
