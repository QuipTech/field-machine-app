import React from 'react';
import { Button, Text, TextInput, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { pairingCodeSchema } from './pairingSchema';
import pairingStyles from './pairingStyles';

interface PairingCodeFormProps {
  isBusy: boolean;
  onSubmit: (code: string) => Promise<void>;
}

const PairingCodeForm = ({ isBusy, onSubmit }: PairingCodeFormProps) => {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: { code: '' },
  });
  const submitCode = handleSubmit(async values => onSubmit(values.code));

  return (
    <View>
      <Text style={pairingStyles.heading}>Enter pairing code</Text>
      <Text style={pairingStyles.text}>
        Ask your Portal operator for the six-digit code. It expires after 15
        minutes.
      </Text>
      <Controller
        control={control}
        name="code"
        rules={{
          validate: value =>
            pairingCodeSchema.safeParse(value).success ||
            'Enter the six-digit pairing code.',
        }}
        render={({ field: { value, onChange, onBlur } }) => (
          <TextInput
            accessibilityLabel="Pairing code"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isBusy}
            keyboardType="number-pad"
            maxLength={20}
            onBlur={onBlur}
            onChangeText={onChange}
            placeholder="123 456"
            style={pairingStyles.input}
            value={value}
          />
        )}
      />
      {errors.code && (
        <Text accessibilityRole="alert" style={pairingStyles.error}>
          {errors.code.message}
        </Text>
      )}
      <Button
        title={isBusy ? 'Pairing…' : 'Pair tablet'}
        disabled={isBusy}
        onPress={submitCode}
      />
    </View>
  );
};

export default PairingCodeForm;
