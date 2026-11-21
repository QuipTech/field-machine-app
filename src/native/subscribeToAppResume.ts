import { AppState } from 'react-native';

const subscribeToAppResume = (
  onResume: () => void,
  _onUnavailable?: () => void,
) => {
  const subscription = AppState.addEventListener('change', state => {
    if (state === 'active') {
      onResume();
    }
  });
  return () => subscription.remove();
};

export default subscribeToAppResume;
