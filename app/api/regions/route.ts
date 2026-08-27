import { coord2region, countPoisNear } from "@/lib/clients/kakao.ts";
import {
  DEFAULT_SCOPE,
  POI_CATEGORY_CODES,
  REGION_SAMPLE_COUNT,
  REGION_SCOPES,
  type RegionScope,
} from "@/lib/config.ts";
import { samplePointsInCircle, type Point } from "@/lib/domain/geo.ts";
import type { Region } from "@/lib/domain/scoring.ts";

const mean = (points: Point[]): Point => ({
  lat: points.reduce((sum, p) => sum + p.lat, 0) / points.length,
  lng: points.reduce((sum, p) => sum + p.lng, 0) / points.length,
});

/**
 * 다트 좌표 주변을 표본 추출해 지역 목록을 만들고 각 지역의 POI 개수를 붙여 돌려준다.
 * 점수 계산과 상위 3개 자르기는 클라이언트가 한다 — 슬라이더를 움직일 때마다
 * 이 라우트를 다시 부르면 Kakao 호출이 슬라이더 조작 횟수만큼 늘어난다 (SDD 3장).
 */
export async function POST(request: Request) {
  const { dart, scope = DEFAULT_SCOPE } = (await request.json()) as {
    dart: Point;
    scope?: RegionScope;
  };
  if (typeof dart?.lat !== "number" || typeof dart?.lng !== "number") {
    return Response.json({ error: "dart 좌표가 필요합니다." }, { status: 400 });
  }
  const radii = REGION_SCOPES[scope];
  if (!radii) {
    return Response.json({ error: `모르는 범위 단위입니다: ${scope}` }, { status: 400 });
  }

  try {
    const samples = samplePointsInCircle(dart, radii.sampleRadiusM, REGION_SAMPLE_COUNT);
    const names = await Promise.all(samples.map((p) => coord2region(p, scope)));

    // 같은 지역으로 떨어진 표본들을 모은다. 그 평균이 이 지역의 대표 좌표가 된다
    const grouped = new Map<string, Point[]>();
    names.forEach((name, i) => {
      if (name) grouped.set(name, [...(grouped.get(name) ?? []), samples[i]]);
    });
    if (grouped.size === 0) {
      return Response.json({ error: "주변에서 지역을 찾지 못했습니다." }, { status: 404 });
    }

    const regions: Region[] = await Promise.all(
      [...grouped].map(async ([name, points]) => {
        const center = mean(points);
        const counts = await Promise.all(
          POI_CATEGORY_CODES.map((code) => countPoisNear(center, radii.poiRadiusM, code)),
        );
        return { name, ...center, poiCount: counts.reduce((a, b) => a + b, 0) };
      }),
    );

    return Response.json({ regions });
  } catch (error) {
    // Kakao 실패는 폴백하지 않는다 — 후보가 없으면 추천 자체가 성립하지 않는다 (SDD 5장)
    return Response.json({ error: (error as Error).message }, { status: 502 });
  }
}
