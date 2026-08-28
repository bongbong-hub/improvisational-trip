import { searchNearby } from "@/lib/clients/kakao.ts";
import { chatJson } from "@/lib/clients/llm.ts";
import {
  LODGING_BIAS_COUNT,
  RECOMMEND_CATEGORY_CODES,
  SEARCH_RADIUS_FALLBACK_M,
  SEARCH_RADIUS_M,
} from "@/lib/config.ts";
import type { Point } from "@/lib/domain/geo.ts";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  dedupe,
  fallbackPicks,
  shortlist,
  validatePicks,
  type VisitedPlace,
} from "@/lib/domain/recommend.ts";
import type { Preferences } from "@/lib/domain/session.ts";

type Body = {
  region: { name: string; lat: number; lng: number };
  preferences: Preferences;
  current: Point;
  history: VisitedPlace[];
  accommodation: Point | null;
  exclude: string[];
};

/**
 * 첫 추천과 다음 추천이 같은 경로다. 입력값(current, history)만 다르다 (CLAUDE.md 설계 제약).
 * 무상태다 — 세션은 클라이언트가 매번 실어 보낸다.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as Body;
  if (!body?.current || !body?.region) {
    return Response.json({ error: "region 과 current 좌표가 필요합니다." }, { status: 400 });
  }

  /** 한 반경에서 후보를 긁어 중복·방문지를 걷어낸다 */
  const collect = async (radiusM: number) => {
    const nearby = await Promise.all(
      RECOMMEND_CATEGORY_CODES.map((code) => searchNearby(body.current, radiusM, code)),
    );
    const lodging = body.accommodation
      ? (await searchNearby(body.accommodation, radiusM, "AT4")).slice(0, LODGING_BIAS_COUNT)
      : [];
    return shortlist(dedupe([...nearby.flat(), ...lodging], body.exclude ?? []));
  };

  let candidates;
  try {
    candidates = await collect(SEARCH_RADIUS_M);
    // 근처를 다 돌았거나 한적한 곳이면 한 번만 넓혀 본다. 여행이 여기서 끊기면 안 된다
    if (candidates.length === 0) candidates = await collect(SEARCH_RADIUS_FALLBACK_M);
  } catch (error) {
    // Kakao 자체가 실패한 것은 폴백하지 않는다 (SDD 5장)
    return Response.json({ error: (error as Error).message }, { status: 502 });
  }

  if (candidates.length === 0) {
    return Response.json({ error: "주변에서 갈 만한 곳을 찾지 못했습니다." }, { status: 404 });
  }

  try {
    const raw = await chatJson(
      SYSTEM_PROMPT,
      buildUserPrompt({
        regionName: body.region.name,
        preferences: body.preferences,
        history: body.history ?? [],
        hasAccommodation: Boolean(body.accommodation),
        candidates,
      }),
    );
    const picks = validatePicks(raw, candidates);
    if (picks) return Response.json({ places: picks });
  } catch {
    // 타임아웃·형식 오류 모두 같은 폴백으로 간다. 재시도하지 않는다 (SDD 5장)
  }

  return Response.json({ places: fallbackPicks(candidates), fallback: true });
}
