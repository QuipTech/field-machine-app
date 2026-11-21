import { colors } from '../config/colors';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

interface ActionButtonProps {
  title: string;
  disabled?: boolean;
  variant?: 'default' | 'danger';
  onPress: () => void;
}

const ActionButton = ({
  title,
  disabled = false,
  variant = 'default',
  onPress,
}: ActionButtonProps) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={title}
    accessibilityState={{ disabled }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [
      styles.button,
      pressed && styles.pressed,
      variant === 'danger' && (pressed ? styles.dangerPressed : styles.danger),
      disabled && styles.disabled,
    ]}
  >
    <Text style={[styles.label, variant === 'danger' && styles.dangerLabel, disabled && styles.disabledLabel]}>{title}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: 4,
  },
  danger: { backgroundColor: colors.danger, borderColor: colors.danger },
  dangerPressed: { backgroundColor: colors.danger, borderColor: colors.danger, opacity: 0.85 },
  dangerLabel: { color: colors.onPrimary, fontWeight: '700' },
  pressed: { backgroundColor: colors.surface, borderColor: colors.primaryBright },
  disabled: { backgroundColor: colors.border, borderColor: colors.border, opacity: 1 },
  disabledLabel: { color: colors.textSecondary },
  label: { color: colors.primaryDark, fontSize: 14, textAlign: 'center' },
});

export default ActionButton;
