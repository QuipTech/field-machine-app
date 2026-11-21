import React from 'react';
import { Text, View } from 'react-native';
import ActionButton from '../../components/ActionButton';
import styles from '../../components/workspaceStyles';
import useRemoteInputAccess from './useRemoteInputAccess';

const SERVICE_NAME = 'FIELD Machine remote control';

// Explains the one-time Android accessibility step that remote control needs.
// Renders nothing where no setup exists (Windows).
const RemoteInputSetup = () => {
  const { isSetupRequired, isEnabled, openSettings } = useRemoteInputAccess();
  if (!isSetupRequired) return null;
  if (isEnabled === undefined) {
    return <Text style={styles.body}>Checking remote control access…</Text>;
  }
  if (isEnabled) {
    return (
      <Text style={styles.body}>
        Remote control is set up. Portal support can control this tablet only during a session where you allow control.
      </Text>
    );
  }
  return (
    <View>
      <Text accessibilityLiveRegion="polite" style={styles.body}>
        Remote control is off. Screen viewing still works. To let Portal support control this tablet,
        open Accessibility settings, choose “{SERVICE_NAME}” (under Downloaded or Installed apps), and turn it on.
      </Text>
      <View style={styles.row}>
        <ActionButton title="Open accessibility settings" onPress={() => { openSettings(); }} />
      </View>
    </View>
  );
};

export default RemoteInputSetup;
