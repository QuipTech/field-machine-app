import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface InputControlModule extends TurboModule {
  // Native code must target only the dedicated Phase 0 test window.
  clickTestTarget(): Promise<void>;
}

const getInputControl = () => {
  return TurboModuleRegistry.get<InputControlModule>(
    'FieldMachineInputControl',
  );
};

export default getInputControl;
