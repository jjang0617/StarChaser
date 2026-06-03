import {
  formatUnmeasurableStarIndexLabel,
  STAR_INDEX_DISPLAY_MIN_SCORE,
} from './star-index-display';

/** MAIN 화면 헤드라인 — 점수 구간별 UX 카피 */
export type StarIndexHeadline = {
  line1: string;
  highlight: string;
  line2: string;
  hint: string;
};

export function getStarIndexHeadline(score: number): StarIndexHeadline {
  const n = Math.round(score);

  if (!Number.isFinite(n) || n < STAR_INDEX_DISPLAY_MIN_SCORE) {
    return {
      line1: '현재 하늘은',
      highlight: formatUnmeasurableStarIndexLabel(score),
      line2: '예요',
      hint: '조건이 좋지 않아요. 잠시 후 다시 확인해 보세요.',
    };
  }

  if (n >= 95) {
    return {
      line1: '오늘 밤,',
      highlight: '은하수',
      line2: '가 육안으로도 보여요',
      hint: '도심에서도 은하수 중심부가 선명할 수 있는 밤이에요.',
    };
  }

  if (n >= 90) {
    return {
      line1: '오늘 밤,',
      highlight: '은하수',
      line2: '를 찍기 좋은 밤이에요',
      hint: '장노출 사진으로 은하수를 담기에 아주 좋은 조건이에요.',
    };
  }

  if (n >= 85) {
    return {
      line1: '오늘 밤,',
      highlight: '별',
      line2: '이 아주 잘 보여요',
      hint: '밤하늘이 선명해요. 희미한 별까지 눈에 들어올 수 있어요.',
    };
  }

  if (n >= 80) {
    return {
      line1: '오늘 밤,',
      highlight: '별',
      line2: '을 만나기 좋은 밤이에요',
      hint: '산책하며 하늘을 올려다보기 좋은 관측 조건이에요.',
    };
  }

  if (n >= 70) {
    return {
      line1: '오늘 밤,',
      highlight: '별',
      line2: '은 보이지만 은하수는 어려울 수 있어요',
      hint: '밝은 별은 괜찮지만, 은하수·희미한 별은 기대하기 어려워요.',
    };
  }

  return {
    line1: '현재 하늘은',
    highlight: '흐릿',
    line2: '할 수 있어요',
    hint: '별이 잘 안 보일 수 있어요.',
  };
}

function scoreBandLabel(score: number): string {
  if (score >= 95) return '최상';
  if (score >= 90) return '매우 좋음';
  if (score >= 85) return '좋음';
  if (score >= 80) return '양호';
  if (score >= 70) return '보통';
  if (score >= STAR_INDEX_DISPLAY_MIN_SCORE) return '나쁨';
  return formatUnmeasurableStarIndexLabel(score);
}

export function windLabelFromScore(windScore: number): string {
  if (windScore >= 80) return '약풍';
  if (windScore >= 55) return '보통';
  return '강풍';
}

export function humidityLabelFromScore(humidityScore: number): string {
  if (humidityScore >= 75) return '쾌적';
  if (humidityScore >= 50) return '보통';
  return '습함';
}

export { scoreBandLabel };
