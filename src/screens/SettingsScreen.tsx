import React, { useEffect } from 'react';
import { ScrollView } from 'react-native';
import ActionButton from '../components/ActionButton';
import PrivacyPolicyLink from '../components/PrivacyPolicyLink';
import styles from '../features/pairing/pairingStyles';
import HomeDisconnect from '../features/pairing/HomeDisconnect';
import TabletAccessCard from '../features/tablet-access/TabletAccessCard';
import useTabletAccessStore from '../features/tablet-access/useTabletAccessStore';
import tabletAccessStore from '../native/TabletAccessStore';
import PairingScreen from './PairingScreen';

interface Props {
  onOpenDiagnostics: () => void;
}

// Android and Windows LTSC show the FIELD ID; other builds keep code pairing.
const SettingsScreen = ({ onOpenDiagnostics }: Props) => {
  const load = useTabletAccessStore(state => state.load);
  useEffect(() => {
    if (tabletAccessStore.isSupported) load();
  }, [load]);

  if (!tabletAccessStore.isSupported) {
    return (
      <>
        <PairingScreen isSettings />
        <ActionButton title="Diagnostics" onPress={onOpenDiagnostics} />
      </>
    );
  }
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.container}>
      <TabletAccessCard />
      <HomeDisconnect />
      <ActionButton title="Diagnostics" onPress={onOpenDiagnostics} />
      <PrivacyPolicyLink />
    </ScrollView>
  );
};

export default SettingsScreen;
