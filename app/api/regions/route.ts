import { coord2region, countPoisNear, type KakaoRegion } from "@/lib/clients/kakao.ts";
import {
  DART_SEARCH_RADIUS_M,
  POI_CATEGORY_CODES,
  POI_COUNT_RADIUS_M,
  REGION_SAMPLE_COUNT,
} from "@/lib/config.ts";
import { samplePointsInCircle, type Point } from "@/lib/domain/geo.ts";
import type { Region } from "@/lib/domain/scoring.ts";

/**
 * 다트 좌표 주변을 표본 추출해 행정동 목록을 만들고 각 동의 POI 개수를 붙여 돌려준다.
 * 점수 계산과 상위 3개 자르기는 클라이언트가 한다 — 슬라이더를 움직일 때마다
 * 이 라우트를 다시 부르면 Kakao 호출이 슬라이더 조작 횟수만큼 늘어난다 (SDD 3장).
 */
export async function POST(request: Request) {
  const { dart } = (await request.json()) as { dart: Point };
  if (typeof dart?.lat !== "number" || typeof dart?.lng !== "number") {
    return Response.json({ error: "dart 좌표가 필요합니다." }, { status: 400 });
  }

  try {
    const samples = samplePointsInCircle(dart, DART_SEARCH_RADIUS_M, REGION_SAMPLE_COUNT);
    const resolved = await Promise.all(samples.map(coord2region));

    const unique = new Map<string, KakaoRegion>();
    for (const region of resolved) {
      if (region) unique.set(region.name, region);
    }
    if (unique.size === 0) {
      return Response.json({ error: "주변에서 지역을 찾지 못했습니다." }, { status: 404 });
    }

    const regions: Region[] = await Promise.all(
      [...unique.values()].map(async (region) => {
        const counts = await Promise.all(
          POI_CATEGORY_CODES.map((code) => countPoisNear(region, POI_COUNT_RADIUS_M, code)),
        );
        return { ...region, poiCount: counts.reduce((a, b) => a + b, 0) };
      }),
    );

    return Response.json({ regions });
  } catch (error) {
    // Kakao 실패는 폴백하지 않는다 — 후보가 없으면 추천 자체가 성립하지 않는다 (SDD 5장)
    return Response.json({ error: (error as Error).message }, { status: 502 });
  }
}
