import React, { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import legal from '../config/legal';
import ActionButton from './ActionButton';
import workspaceStyles from './workspaceStyles';

const styles = StyleSheet.create({
  container: { marginTop: 16 },
});

const PrivacyPolicyLink = () => {
  const [hasFailed, setHasFailed] = useState(false);
  const open = async () => {
    try {
      setHasFailed(false);
      await Linking.openURL(legal.privacyPolicyUrl);
    } catch {
      setHasFailed(true);
    }
  };
  return (
    <View style={styles.container}>
      <ActionButton title="Privacy policy" onPress={() => { open(); }} />
      {hasFailed && (
        // Cab tablets may have no browser, so the address must stay readable.
        <Text accessibilityLiveRegion="polite" style={workspaceStyles.body}>
          Could not open a browser. Read the policy at {legal.privacyPolicyUrl}
        </Text>
      )}
    </View>
  );
};

export default PrivacyPolicyLink;
