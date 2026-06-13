import { StyleSheet } from 'react-native';
import { spacing } from '../../../themes/design-tokens';

export const authFormStyles = StyleSheet.create({
  form: {
    gap: spacing.md,
  },
  err: {
    fontSize: 12,
  },
  codeRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  codeInputWrap: {
    flex: 1,
  },
  codeButtonWrap: {
    paddingBottom: 2,
  },
  forgotLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  forgotLink: {
    fontSize: 13,
  },
  hintBlock: {
    fontSize: 12,
    lineHeight: 18,
  },
  maskedEmail: {
    fontSize: 18,
    fontFamily: 'SpaceMono-Regular',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  doneText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: spacing.xs,
  },
  termsCheck: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  termsCheckMark: {
    fontSize: 12,
    fontWeight: '700',
    color: '#030712',
  },
  termsText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});
