import React from 'react';
import { Text, View } from 'react-native';
import ActionButton from '../components/ActionButton';
import styles from '../components/workspaceStyles';
import RemoteInputSetup from '../features/remote-support/RemoteInputSetup';

const RemoteSupportScreen = ({ checkError }: { checkError?: string }) => (
  <>
    <Text accessibilityRole="header" style={styles.title}>Remote Support</Text>
    {checkError && <Text accessibilityLiveRegion="polite" style={styles.body}>{checkError}</Text>}
    <View style={styles.card}>
      <Text style={styles.heading}>Portal support</Text>
      <Text style={styles.body}>
        Share this tablet’s screen during a session. Support staff with the tablet password can start a session without asking; other requests need your approval.
      </Text>
      <RemoteInputSetup />
      <View style={styles.row}>
        <ActionButton title="Request help" disabled onPress={() => undefined} />
      </View>
    </View>
  </>
);

export default RemoteSupportScreen;
