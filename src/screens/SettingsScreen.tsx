import React from 'react';
import ActionButton from '../components/ActionButton';
import PairingScreen from './PairingScreen';

interface Props {
  onOpenDiagnostics: () => void;
}

const SettingsScreen = ({ onOpenDiagnostics }: Props) => (
  <>
    <PairingScreen isSettings />
    <ActionButton title="Diagnostics" onPress={onOpenDiagnostics} />
  </>
);

export default SettingsScreen;
