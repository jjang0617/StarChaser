import { Dimensions, StyleSheet } from 'react-native';
import { spacing } from '../../themes/design-tokens';

export const AUTH_SHEET_BG = 'rgba(5, 10, 22, 0.96)';

const { height: WINDOW_HEIGHT } = Dimensions.get('window');

export const authSheetStyles = StyleSheet.create({
  sheetHost: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: WINDOW_HEIGHT * 0.94,
    paddingHorizontal: spacing.lg,
    zIndex: 10,
  },
  sheetCard: {
    flex: 1,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetHeader: {
    paddingHorizontal: spacing.lg,
  },
  sheetHandleHit: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    opacity: 0.45,
  },
  sheetBrand: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  sheetScroll: {
    flex: 1,
  },
  sheetScrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  sectionPanel: {
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
});
