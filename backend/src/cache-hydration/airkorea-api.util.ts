/**
 * 에어코리아 ArpltnInforInqireSvc — 공공데이터포털 인증키·URL 조립
 * (MsrstnInfoInqireSvc 는 별도 활용신청 필요 → 사용하지 않음)
 */

/** 디코딩 키는 encode, 이미 인코딩된 키(% 포함)는 그대로 */
export function formatDataGoKrServiceKey(raw: string): string {
  const trimmed = raw.trim();
  if (/%[0-9A-Fa-f]{2}/.test(trimmed)) {
    return trimmed;
  }
  return encodeURIComponent(trimmed);
}

export function arpltnInforUrl(
  operation: string,
  params: Record<string, string>,
): string {
  const key = formatDataGoKrServiceKey(params.serviceKey);
  const parts = [
    `serviceKey=${key}`,
    ...Object.entries(params)
      .filter(([k]) => k !== 'serviceKey')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`),
  ];
  return (
    `https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/${operation}?` +
    parts.join('&')
  );
}
