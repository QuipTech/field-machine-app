import React, { useState } from 'react';
import RemoteControlConsent from './RemoteControlConsent';
import useRemoteControlConsent from './useRemoteControlConsent';
import useRemoteInputAccess from './useRemoteInputAccess';

// Shows the disclosure once on a paired tablet. Later changes are made from
// the Remote Support screen. Renders nothing where no setup exists (Windows).
const RemoteControlConsentPrompt = () => {
  const { isSetupRequired, isConsentDecided } = useRemoteInputAccess();
  const { submit, isSubmitting, error } = useRemoteControlConsent();
  const [isDismissed, setIsDismissed] = useState(false);
  if (!isSetupRequired || isConsentDecided !== false || isDismissed) return null;
  const decline = async () => {
    // Declining must never trap the operator, even if saving fails.
    setIsDismissed(true);
    await submit(false);
  };
  return (
    <RemoteControlConsent
      error={error}
      isSubmitting={isSubmitting}
      onAccept={() => { submit(true); }}
      onDecline={() => { decline(); }}
    />
  );
};

export default RemoteControlConsentPrompt;
