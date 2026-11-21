import { colors } from '../config/colors';
import { StyleSheet } from 'react-native';

const workspaceStyles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.primaryDark, paddingHorizontal: 28, paddingVertical: 16 },
  brand: { color: colors.onPrimary, fontSize: 22, fontWeight: '800' },
  subtitle: { color: colors.primaryLight, fontSize: 15, marginTop: 4 },
  hidden: { display: 'none' },
  content: { flex: 1, minHeight: 0 },
  page: { flexGrow: 1, width: '100%', maxWidth: 1100, alignSelf: 'center', padding: 24 },
  title: { color: colors.text, fontSize: 34, fontWeight: '800', marginBottom: 8 },
  body: { color: colors.textSecondary, fontSize: 17, lineHeight: 25, marginBottom: 12 },
  warning: { color: colors.warning, backgroundColor: colors.warningBg, alignSelf: 'flex-start', borderRadius: 4, paddingHorizontal: 8 },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, paddingHorizontal: 8, borderRadius: 4 },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 22, marginTop: 16 },
  heading: { color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: 8 },
  nav: { flexDirection: 'row', backgroundColor: colors.primaryDark, padding: 10, gap: 8 },
  tab: { flex: 1, minHeight: 56, padding: 8, justifyContent: 'center', alignItems: 'center', borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
  tabActive: { backgroundColor: colors.accent },
  tabFocus: { borderColor: colors.onPrimary },
  tabLabel: { color: colors.onPrimary, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  tabLabelActive: { color: colors.text },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  connected: { color: colors.accent, fontWeight: '700' },
  receipt: { borderTopWidth: 1, borderColor: colors.border, paddingVertical: 12 },
  fileName: { color: colors.primaryDark, fontSize: 17, fontWeight: '700' },
  sent: { color: colors.success, fontSize: 15, marginTop: 4 },
});

export default workspaceStyles;
