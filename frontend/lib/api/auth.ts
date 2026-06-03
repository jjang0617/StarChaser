import { getApiBaseUrl } from '../config';
import type { AuthTokensResponseDto } from '../types/api';
import { ApiRequestError, clientErrorMessage, parseJsonSafe } from './http';

export async function postAuthJson(
  path: '/auth/login' | '/auth/register',
  payload:
    | { email: string; password: string }
    | { email: string; password: string; nickname: string; verificationCode: string },
): Promise<AuthTokensResponseDto> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await parseJsonSafe(res);
  if (!res.ok) {
    const fallback =
      path === '/auth/register'
        ? '회원가입에 실패했습니다.'
        : '로그인에 실패했습니다.';
    throw new ApiRequestError(
      clientErrorMessage(res.status, body, fallback),
      res.status,
      body,
    );
  }
  const data = body as AuthTokensResponseDto;
  if (!data.accessToken || !data.refreshToken || !data.user) {
    throw new ApiRequestError('인증 응답 형식이 올바르지 않습니다.', res.status, body);
  }
  return data;
}

export async function checkEmail(email: string): Promise<{ available: boolean }> {
  const res = await fetch(`${getApiBaseUrl()}/auth/check-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const body = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiRequestError(
      clientErrorMessage(res.status, body, '이메일 확인에 실패했습니다.'),
      res.status,
      body,
    );
  }
  return body as { available: boolean };
}

export async function findEmailByNickname(
  nickname: string,
): Promise<{ maskedEmail: string }> {
  const res = await fetch(`${getApiBaseUrl()}/auth/find-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname }),
  });
  const body = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiRequestError(
      clientErrorMessage(res.status, body, '이메일 찾기에 실패했습니다.'),
      res.status,
      body,
    );
  }
  return body as { maskedEmail: string };
}

export async function checkNickname(nickname: string): Promise<{ available: boolean }> {
  const res = await fetch(`${getApiBaseUrl()}/auth/check-nickname`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname }),
  });
  const body = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiRequestError(
      clientErrorMessage(res.status, body, '닉네임 확인에 실패했습니다.'),
      res.status,
      body,
    );
  }
  return body as { available: boolean };
}

export async function sendVerificationCode(
  email: string,
  purpose: 'register' | 'reset-password',
): Promise<{ message: string }> {
  const res = await fetch(`${getApiBaseUrl()}/auth/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, purpose }),
  });
  const body = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiRequestError(
      clientErrorMessage(res.status, body, '인증번호 발송에 실패했습니다.'),
      res.status,
      body,
    );
  }
  return body as { message: string };
}

export async function verifyCode(
  email: string,
  code: string,
  purpose: 'register' | 'reset-password',
): Promise<{ verified: boolean }> {
  const res = await fetch(`${getApiBaseUrl()}/auth/verify-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code, purpose }),
  });
  const body = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiRequestError(
      clientErrorMessage(res.status, body, '인증번호 확인에 실패했습니다.'),
      res.status,
      body,
    );
  }
  return body as { verified: boolean };
}

export async function resetPassword(
  email: string,
  verificationCode: string,
  password: string,
): Promise<{ message: string }> {
  const res = await fetch(`${getApiBaseUrl()}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, verificationCode, password }),
  });
  const body = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiRequestError(
      clientErrorMessage(res.status, body, '비밀번호 변경에 실패했습니다.'),
      res.status,
      body,
    );
  }
  return body as { message: string };
}
