import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import ActionButton from '../components/ActionButton';
import useConnectionStore from '../features/connection/useConnectionStore';
import DesignProjects from '../features/design-delivery/DesignProjects';
import type useDesignDelivery from '../features/design-delivery/useDesignDelivery';
import usePairingStore from '../features/pairing/usePairingStore';
import type { PairedDevice } from '../features/pairing/pairingSchema';
import getTransferPairing from '../features/portal-transfer/getTransferPairing';
import PortalTransferPanel from '../features/portal-transfer/PortalTransferPanel';
import designStorage from '../native/DesignDelivery';
import portalTransfer from '../native/PortalTransfer';
import HomeScreen from '../screens/HomeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PhaseZeroScreen from '../screens/PhaseZeroScreen';
import useRemoteRequest from '../features/remote-support/useRemoteRequest';
import RemoteRequestPrompt from '../features/remote-support/RemoteRequestPrompt';
import ScreenPeer, { supportsDesktopControl } from '../features/remote-support/ScreenPeer';
import RemoteSupportScreen from '../screens/RemoteSupportScreen';
import styles from '../components/workspaceStyles';

const TABS = ['Home', 'Files', 'Remote Support', 'Settings'] as const;
type Tab = typeof TABS[number];

const CONNECTION_LABELS = {
  idle: 'Checking connection',
  validating: 'Verifying session',
  reconnecting: 'Reconnecting',
  connected: 'Connected',
};

interface Props {
  device: PairedDevice;
  delivery: ReturnType<typeof useDesignDelivery>;
}

const MachineWorkspace = ({ device, delivery }: Props) => {
  const [tab, setTab] = useState<Tab>('Home');
  const [focusedTab, setFocusedTab] = useState<Tab>();
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const status = useConnectionStore(state => state.status);
  const isDisconnecting = usePairingStore(state => state.status === 'disconnecting');
  const remoteRequest = useRemoteRequest(device, !isDisconnecting);
  const scope = getTransferPairing(device);
  const currentDelivery = delivery?.scope === scope ? delivery : undefined;

  const deliveryMessage = currentDelivery?.message ?? (designStorage
    ? 'Checking saved projects…' : 'Install the latest Windows app to receive designs.');

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <Text style={styles.brand}>FIELD MACHINE</Text>
        <Text style={styles.subtitle}>
          {device.machine.label}  ·  <Text style={status === 'connected' && styles.connected}>{CONNECTION_LABELS[status]}</Text>  ·  Staging
        </Text>
      </View>
      <RemoteRequestPrompt {...remoteRequest} supportsDesktopControl={supportsDesktopControl} />
      {remoteRequest.activeId &&
        remoteRequest.activeId === remoteRequest.approvedId && (
        <ScreenPeer
          key={remoteRequest.activeId}
          sessionId={remoteRequest.activeId}
          deviceToken={device.deviceToken}
          isConnected={status === 'connected'}
          canControl={remoteRequest.canControl}
        />
      )}
      <View style={styles.content}>
        <View style={[styles.content, tab !== 'Files' && styles.hidden]}>
          <ScrollView contentContainerStyle={styles.page}>
            <Text accessibilityRole="header" style={styles.title}>Files</Text>
            {designStorage && (
              <DesignProjects
                scope={scope}
                projects={currentDelivery?.projects ?? []}
                message={deliveryMessage}
              />
            )}
            {portalTransfer.isSupported && <PortalTransferPanel device={device} />}
            {!designStorage && !portalTransfer.isSupported &&
              <Text style={styles.body}>File transfer is available on Windows.</Text>}
          </ScrollView>
        </View>
        {tab === 'Settings' && isDiagnosticsOpen && (
          <>
            <ActionButton title="Back to settings" onPress={() => setIsDiagnosticsOpen(false)} />
            <PhaseZeroScreen />
          </>
        )}
        {tab === 'Settings' && !isDiagnosticsOpen && (
          <SettingsScreen onOpenDiagnostics={() => setIsDiagnosticsOpen(true)} />
        )}
        {(tab === 'Home' || tab === 'Remote Support') && (
          <ScrollView contentContainerStyle={styles.page}>
            {tab === 'Home' ? (
              <HomeScreen
                machineLabel={device.machine.label}
                connectionLabel={CONNECTION_LABELS[status]}
                isConnected={status === 'connected'}
                projects={currentDelivery?.projects}
                deliveryMessage={deliveryMessage}
                onOpenFiles={() => setTab('Files')}
                onOpenSupport={() => setTab('Remote Support')}
              />
            ) : <RemoteSupportScreen checkError={remoteRequest.checkError} />}
          </ScrollView>
        )}
      </View>
      <View accessibilityRole="tablist" style={styles.nav}>
        {TABS.map(item => (
          <Pressable
            key={item}
            accessibilityRole="tab"
            accessibilityLabel={item}
            accessibilityState={{ selected: item === tab, disabled: isDisconnecting }}
            disabled={isDisconnecting}
            onPress={() => setTab(item)}
            onFocus={() => setFocusedTab(item)}
            onBlur={() => setFocusedTab(undefined)}
            style={[styles.tab, item === tab && styles.tabActive, item === focusedTab && styles.tabFocus]}
          >
            <Text style={[styles.tabLabel, item === tab && styles.tabLabelActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

export default MachineWorkspace;
