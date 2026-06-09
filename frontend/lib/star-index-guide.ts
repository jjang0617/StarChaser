import { STAR_INDEX_DISPLAY_MIN_SCORE } from './star-index-display';

export type StarIndexGuideRow = {
  minScore: number | null;
  maxScore: number | null;
  badge: string;
  title: string;
  body: string;
};

/** MAIN 정보(i) 시트 — 헤드라인·게이지와 맞춘 점수 가이드 */
export const STAR_INDEX_GUIDE_ROWS: StarIndexGuideRow[] = [
  {
    minScore: null,
    maxScore: STAR_INDEX_DISPLAY_MIN_SCORE - 1,
    badge: '관측 어려움',
    title: `${STAR_INDEX_DISPLAY_MIN_SCORE}점 미만`,
    body: '구름·미세먼지·달빛 등 여러 조건이 겹쳐 점수가 매우 낮은 구간이에요. 별을 관측하기 어려운 밤이에요.',
  },
  {
    minScore: STAR_INDEX_DISPLAY_MIN_SCORE,
    maxScore: 69,
    badge: '흐림',
    title: '50 ~ 69점',
    body: '별이 잘 안 보일 수 있어요. 밝은 별 위주로만 확인하기 어려운 밤이에요.',
  },
  {
    minScore: 70,
    maxScore: 79,
    badge: '보통',
    title: '70점 이상',
    body: '밝은 별은 육안으로 한두 개 확인할 수 있어요. 은하수·희미한 별은 기대하기 어려울 수 있어요.',
  },
  {
    minScore: 80,
    maxScore: 84,
    badge: '양호',
    title: '80점 이상',
    body: '산책하며 하늘을 올려다보기 좋은 밤이에요. 스마트폰으로 별 사진을 찍기 시작하기 괜찮은 조건이에요.',
  },
  {
    minScore: 85,
    maxScore: 89,
    badge: '좋음',
    title: '85점 이상',
    body: '밤하늘이 선명해요. 희미한 별까지 눈에 들어올 수 있는 관측 조건이에요.',
  },
  {
    minScore: 90,
    maxScore: 94,
    badge: '매우 좋음',
    title: '90점 이상',
    body: '장노출 사진으로 은하수를 담기에 아주 좋은 밤이에요. 카메라 촬영을 적극 추천해요.',
  },
  {
    minScore: 95,
    maxScore: null,
    badge: '최상',
    title: '95점 이상',
    body: '도심에서도 은하수 중심부가 선명할 수 있는 밤이에요. 육안으로도 은하수를 볼 여지가 있어요.',
  },
];
