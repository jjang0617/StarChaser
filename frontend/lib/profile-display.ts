/** 프로필 사진 없을 때 원형 아바타에 쓸 글자 */
export function profileLetter(nickname: string | null | undefined): string {
  const trimmed = nickname?.trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0);
}
