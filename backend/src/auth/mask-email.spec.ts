import { maskEmail } from './mask-email';

describe('maskEmail', () => {
  it('짧은 로컬은 2자까지 노출', () => {
    expect(maskEmail('ab@gmail.com')).toBe('ab***@gmail.com');
  });

  it('긴 로컬은 길이의 절반(최대 8자)까지 노출', () => {
    expect(maskEmail('john.doe.smith@gmail.com')).toBe(
      'john.do***@gmail.com',
    );
    expect(maskEmail('verylongemailaddress@outlook.com')).toBe(
      'verylong***@outlook.com',
    );
  });
});
