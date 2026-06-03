export type FieldStatus = 'idle' | 'checking' | 'success' | 'error';

export function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  const [local, domain, ...rest] = email.split('@');
  if (!local || !domain || rest.length > 0) return false;
  if (local.length > 64) return false;
  if (domain.includes('..')) return false;
  const domainParts = domain.split('.');
  if (domainParts.length < 2) return false;
  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2) return false;
  return domainParts.every((p) => p.length > 0 && /^[a-zA-Z0-9-]+$/.test(p));
}

export function emailValidationError(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return '이메일을 입력해 주세요.';
  if (!isValidEmail(trimmed)) return '올바른 이메일 형식이 아닙니다.';
  return null;
}

export function passwordValidationError(password: string): string | null {
  if (!password) return '비밀번호를 입력해 주세요.';
  if (password.length < 6) return '비밀번호는 6자 이상이어야 합니다.';
  return null;
}

export function codeValidationError(code: string): string | null {
  if (!code) return '인증번호를 입력해 주세요.';
  if (code.length !== 6) return '인증번호는 6자리여야 합니다.';
  return null;
}

export function nicknameValidationError(nickname: string): string | null {
  const trimmed = nickname.trim();
  if (!trimmed) return '닉네임을 입력해 주세요.';
  if (trimmed.length < 2) return '닉네임은 2자 이상이어야 합니다.';
  if (trimmed.length > 30) return '닉네임은 30자 이하여야 합니다.';
  return null;
}
