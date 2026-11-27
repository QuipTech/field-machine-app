import React, { useEffect } from 'react';
import { ScrollView, Text } from 'react-native';
import styles from '../features/pairing/pairingStyles';
import usePairingStore from '../features/pairing/usePairingStore';
import TabletAccessCard from '../features/tablet-access/TabletAccessCard';
import useTabletAccessStore from '../features/tablet-access/useTabletAccessStore';

// Shown while the tablet has no device token: registers it and waits for a
// Portal user to add it by FIELD ID and password.
const TabletAccessScreen = () => {
  const pairingStatus = usePairingStore(state => state.status);
  const pairingError = usePairingStore(state => state.error);
  const start = useTabletAccessStore(state => state.start);

  useEffect(() => {
    if (pairingStatus === 'unpaired') start();
  }, [pairingStatus, start]);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.container}>
      <Text style={styles.title}>FIELD Machine</Text>
      <Text style={styles.text}>STAGING · Tablet access</Text>
      {pairingStatus === 'loading' && <Text style={styles.text}>Reading secure storage…</Text>}
      {pairingError && <Text accessibilityRole="alert" style={styles.error}>{pairingError}</Text>}
      <TabletAccessCard />
    </ScrollView>
  );
};

export default TabletAccessScreen;
