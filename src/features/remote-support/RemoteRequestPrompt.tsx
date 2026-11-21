import React from 'react';
import { Text, View } from 'react-native';
import ActionButton from '../../components/ActionButton';
import styles from '../../components/workspaceStyles';

import type useRemoteRequest from './useRemoteRequest';

const RemoteRequestPrompt = ({
  request, activeId, approvedId, isControlRequested, isRecordingExpected, recordingStatus,
  isSubmitting, error, onAction, onResume,
}: ReturnType<typeof useRemoteRequest>) => (
  <>
    {request && (
      <View style={styles.card}>
        <Text accessibilityLiveRegion="polite" style={styles.heading}>
          Support request from {request.requester?.name ?? 'Portal support'}
        </Text>
        <Text style={styles.body}>Expires at {new Date(request.expiresAt).toLocaleTimeString()}</Text>
        <Text style={styles.body}>
          {request.scope.control ? 'Desktop viewing and control requested.' : 'Desktop viewing requested.'}
          {request.scope.record ? ' The Portal will record an approved session.' : ''}
        </Text>
        <Text style={styles.body}>After approval, choose a window for viewing only or share the entire screen.</Text>
        <View style={styles.row}>
          {request.scope.view && request.scope.control && (
            <ActionButton title="Allow with control access" disabled={isSubmitting}
              onPress={() => onAction(request.id, { decision: 'allow', allowControl: true })} />
          )}
          {request.scope.view && (
            <ActionButton title="Allow view only" disabled={isSubmitting}
              onPress={() => onAction(request.id, { decision: 'allow', allowControl: false })} />
          )}
          <ActionButton title="Decline" disabled={isSubmitting}
            onPress={() => onAction(request.id, { decision: 'decline' })} />
        </View>
      </View>
    )}
    {activeId && (
      <View style={styles.card}>
        <Text accessibilityLiveRegion="polite" style={styles.heading}>Portal session active</Text>
        {isRecordingExpected && (
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.body, recordingStatus === 'failed' ? styles.error : styles.warning]}
          >
            {recordingStatus === 'failed' ? 'Recording failed'
              : recordingStatus === 'recording' ? 'Recording' : 'Recording enabled'}
          </Text>
        )}
        {activeId !== approvedId && (
          <>
            <Text style={styles.body}>
              Approve screen sharing on this tablet for this session.
            </Text>
            <View style={styles.row}>
              {isControlRequested && (
                <ActionButton title="Allow with control access" disabled={isSubmitting}
                  onPress={() => onResume(true)} />
              )}
              <ActionButton title="Allow view only" disabled={isSubmitting}
                onPress={() => onResume(false)} />
            </View>
          </>
        )}
        <ActionButton
          title="End remote access"
          variant="danger"
          disabled={isSubmitting}
          onPress={() => onAction(activeId, 'end')}
        />
      </View>
    )}
    {error && <Text accessibilityLiveRegion="polite" style={[styles.body, styles.error]}>{error}</Text>}
  </>
);

export default RemoteRequestPrompt;
