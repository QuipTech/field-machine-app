import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import ActionButton from '../../components/ActionButton';
import styles from '../pairing/pairingStyles';
import { tabletPasswordSchema } from './tabletAccessSchema';

interface Props {
  onSubmit: (password: string) => Promise<string | undefined>;
}

// Allowed only before the tablet has ever been added to a machine.
const ChangePasswordForm = ({ onSubmit }: Props) => {
  const [result, setResult] = useState<string>();
  const { control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { password: '' },
  });
  const submit = handleSubmit(async ({ password }) => {
    const error = await onSubmit(password);
    setResult(error ?? 'Password changed.');
    if (!error) reset();
  });

  return (
    <View style={styles.action}>
      <Controller
        control={control}
        name="password"
        rules={{
          validate: value => tabletPasswordSchema.safeParse(value).success || 'Use 8 to 128 characters.',
        }}
        render={({ field: { value, onChange, onBlur } }) => (
          <TextInput
            accessibilityLabel="New tablet password"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isSubmitting}
            maxLength={128}
            onBlur={onBlur}
            onChangeText={onChange}
            placeholder="New password (8 or more characters)"
            style={styles.input}
            value={value}
          />
        )}
      />
      {errors.password && <Text accessibilityRole="alert" style={styles.error}>{errors.password.message}</Text>}
      <ActionButton title={isSubmitting ? 'Changing…' : 'Change password'} disabled={isSubmitting} onPress={submit} />
      {result && <Text accessibilityLiveRegion="polite" style={styles.text}>{result}</Text>}
    </View>
  );
};

export default ChangePasswordForm;
