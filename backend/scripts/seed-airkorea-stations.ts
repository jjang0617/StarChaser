/**
 * 전국 에어코리아 측정소 좌표 JSON 생성 (개발자 로컬 1회 실행)
 *
 *   cd backend
 *   npx ts-node scripts/seed-airkorea-stations.ts
 *
 * 필요: backend/.env 에 AIRKOREA_API_KEY
 * 소요: Nominatim 1req/s → 약 10~15분
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SIDOS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
] as const;

type StationRow = { stationName: string; sidoName: string };

function formatServiceKey(raw: string): string {
  const t = raw.trim();
  return /%[0-9A-Fa-f]{2}/.test(t) ? t : encodeURIComponent(t);
}

function extractItems(body: unknown): Array<{ stationName?: string }> {
  const b = body as {
    items?: Array<{ stationName?: string }> | { item?: unknown };
  };
  const items = b?.items;
  if (!items) return [];
  if (Array.isArray(items)) return items;
  const item = items.item;
  if (!item) return [];
  return Array.isArray(item) ? item : [item as { stationName?: string }];
}

async function fetchSidoStations(
  serviceKey: string,
  sidoName: string,
): Promise<StationRow[]> {
  const url =
    'https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty' +
    `?serviceKey=${formatServiceKey(serviceKey)}&returnType=json&numOfRows=500&pageNo=1` +
    `&sidoName=${encodeURIComponent(sidoName)}&ver=1.0`;
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${sidoName} HTTP ${res.status}: ${text.slice(0, 120)}`);
  }
  const parsed = JSON.parse(text) as {
    response?: { header?: { resultCode?: string }; body?: unknown };
  };
  const code = parsed.response?.header?.resultCode;
  if (code && code !== '00') {
    throw new Error(`${sidoName} API ${code}`);
  }
  const rows: StationRow[] = [];
  for (const item of extractItems(parsed.response?.body)) {
    const name = item.stationName?.trim();
    if (name) rows.push({ stationName: name, sidoName });
  }
  return rows;
}

async function geocodeStation(
  stationName: string,
  sidoName: string,
): Promise<{ lat: number; lng: number } | null> {
  await new Promise((r) => setTimeout(r, 1100));
  const q = encodeURIComponent(`${stationName}, ${sidoName}, South Korea`);
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'StarChaser/1.0 (seed-airkorea-stations)' },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ lat: string; lon: string }>;
  const hit = rows[0];
  if (!hit) return null;
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

async function main(): Promise<void> {
  const key = process.env.AIRKOREA_API_KEY?.trim();
  if (!key) {
    console.error('AIRKOREA_API_KEY 없음 — backend/.env 확인');
    process.exit(1);
  }

  const byKey = new Map<string, StationRow>();
  for (const sido of SIDOS) {
    const rows = await fetchSidoStations(key, sido);
    for (const r of rows) {
      byKey.set(`${r.sidoName}::${r.stationName}`, r);
    }
    console.log(`${sido} — 목록 ${rows.length}곳`);
  }

  const list = [...byKey.values()];
  console.log(`\n지오코딩 시작 — ${list.length}곳\n`);

  const stations: Array<{
    stationName: string;
    sidoName: string;
    lat: number;
    lng: number;
  }> = [];
  let fail = 0;

  for (let i = 0; i < list.length; i += 1) {
    const { stationName, sidoName } = list[i];
    const coords = await geocodeStation(stationName, sidoName);
    if (coords) {
      stations.push({ stationName, sidoName, ...coords });
      process.stdout.write(
        `\r[${i + 1}/${list.length}] ${sidoName} ${stationName} OK`,
      );
    } else {
      fail += 1;
      process.stdout.write(
        `\r[${i + 1}/${list.length}] ${sidoName} ${stationName} FAIL`,
      );
    }
  }

  const outPath = path.join(
    __dirname,
    '..',
    'src',
    'cache-hydration',
    'data',
    'airkorea-stations.json',
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    stations,
  };
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(`\n\n완료 — 성공 ${stations.length}, 실패 ${fail}`);
  console.log(`저장: ${outPath}`);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
