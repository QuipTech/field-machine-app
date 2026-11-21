import { colors } from '../../config/colors';
import { StyleSheet } from 'react-native';

const pairingStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  container: { padding: 32, width: '100%', maxWidth: 800, alignSelf: 'center' },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.primaryDark,
    marginBottom: 16,
  },
  text: { fontSize: 17, lineHeight: 26, color: colors.textSecondary, marginBottom: 20 },
  error: { fontSize: 16, color: colors.danger, marginVertical: 16 },
  card: {
    padding: 24,
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginVertical: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.textSecondary,
    borderRadius: 6,
    padding: 16,
    fontSize: 24,
    color: colors.text,
    marginBottom: 20,
  },
  overlay: {
    flex: 1,
    backgroundColor: `${colors.text}80`,
    justifyContent: 'center',
    padding: 24,
  },
  dialog: {
    padding: 24,
    backgroundColor: colors.surface,
    borderRadius: 12,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  action: { marginTop: 20 },
});

export default pairingStyles;
