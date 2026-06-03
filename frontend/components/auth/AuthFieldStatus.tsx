import React from 'react';
import { StyleSheet, Text } from 'react-native';
import type { FieldStatus } from './auth-validation';

export function StatusText({
  status,
  message,
  successColor,
  errorColor,
}: {
  status: FieldStatus;
  message: string;
  successColor: string;
  errorColor: string;
}) {
  if (status === 'idle' || status === 'checking' || !message) return null;
  return (
    <Text
      style={[
        styles.statusText,
        { color: status === 'success' ? successColor : errorColor },
      ]}
    >
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  statusText: {
    fontSize: 11,
    marginTop: -6,
  },
});
