import { colors } from '../../config/colors';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import environment from '../../config/environment';
import useConnectionStore from './useConnectionStore';

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: colors.surface, marginBottom: 20 },
  text: { color: colors.text, fontSize: 14, marginBottom: 8 },
});

const ConnectionDiagnostics = () => {
  const { status, diagnostics } = useConnectionStore();
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Live session: {status}</Text>
      <Text style={styles.text}>Backend: {environment.apiBaseUrl}</Text>
      <Text style={styles.text}>
        Namespace: {environment.socketNamespace} · Path:{' '}
        {environment.socketPath}
      </Text>
      {[...diagnostics].reverse().map(entry => (
        <Text selectable style={styles.text} key={entry}>
          {entry}
        </Text>
      ))}
    </View>
  );
};

export default ConnectionDiagnostics;
