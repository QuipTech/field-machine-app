import { useState } from 'react';
import useRemoteInputAccess from './useRemoteInputAccess';

const SAVE_ERROR = 'Your choice could not be saved. Try again.';

// Saves the operator's choice; Accessibility settings open only after consent.
const useRemoteControlConsent = () => {
  const { isServiceEnabled, setConsent, openSettings } = useRemoteInputAccess();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (isAccepted: boolean) => {
    setIsSubmitting(true);
    setError(undefined);
    const isSaved = await setConsent(isAccepted);
    setIsSubmitting(false);
    if (!isSaved) {
      setError(SAVE_ERROR);
      return false;
    }
    if (isAccepted && !isServiceEnabled) openSettings();
    return true;
  };

  return { submit, isSubmitting, error, clearError: () => setError(undefined) };
};

export default useRemoteControlConsent;
