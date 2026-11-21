import React from 'react';
import { Text, View } from 'react-native';
import ActionButton from '../components/ActionButton';
import styles from '../components/workspaceStyles';
const RemoteSupportScreen = ({ checkError }: { checkError?: string }) => (
  <>
    <Text accessibilityRole="header" style={styles.title}>Remote Support</Text>
    {checkError && <Text accessibilityLiveRegion="polite" style={styles.body}>{checkError}</Text>}
    <View style={styles.card}>
      <Text style={styles.heading}>Portal support</Text>
      <Text style={styles.body}>Approve an incoming request and choose a screen to share. Remote desktop input is unavailable.</Text>
      <View style={styles.row}>
        <ActionButton title="Request help" disabled onPress={() => undefined} />
      </View>
    </View>
  </>
);

export default RemoteSupportScreen;
