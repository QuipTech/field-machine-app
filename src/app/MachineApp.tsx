import { colors } from '../config/colors';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import ActionButton from '../components/ActionButton';
import PairingScreen from '../screens/PairingScreen';
import PhaseZeroScreen from '../screens/PhaseZeroScreen';
import useDeviceConnection from '../features/connection/useDeviceConnection';
import usePairingStore from '../features/pairing/usePairingStore';
import useDesignDelivery from '../features/design-delivery/useDesignDelivery';

import MachineWorkspace from './MachineWorkspace';
import getTransferPairing from '../features/portal-transfer/getTransferPairing';

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexShrink: 0, backgroundColor: colors.background },
  content: { flex: 1, minHeight: 0 },
});

const MachineApp = () => {
  useDeviceConnection();
  const delivery = useDesignDelivery();
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const pairingStatus = usePairingStore(state => state.status);
  const device = usePairingStore(state => state.pairedDevice);
  useEffect(() => {
    if (['forgetting', 'unpaired', 'clear-failed'].includes(pairingStatus)) {
      setIsDiagnosticsOpen(false);
    }
  }, [pairingStatus]);
  if (device && (pairingStatus === 'paired' || pairingStatus === 'disconnecting')) {
    return <MachineWorkspace key={getTransferPairing(device)} device={device} delivery={delivery} />;
  }
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ActionButton
          title={isDiagnosticsOpen ? 'Back to pairing' : 'Diagnostics'}
          onPress={() => setIsDiagnosticsOpen(isOpen => !isOpen)}
        />
      </View>
      <View style={styles.content}>
        {isDiagnosticsOpen ? <PhaseZeroScreen /> : <PairingScreen />}
      </View>
    </View>
  );
};

export default MachineApp;
