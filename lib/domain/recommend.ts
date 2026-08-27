import { LLM_CANDIDATE_LIMIT, PICK_COUNT, WALK_SPEED_M_PER_MIN } from "../config.ts";
import type { Preferences } from "./session.ts";

/** clients/kakao.ts 의 KakaoPlace 와 구조가 같다. domain 은 clients 를 import 하지 않는다 (SDD 1장) */
export type PlaceCandidate = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  address: string;
  distanceM: number | null;
};

export type Recommendation = PlaceCandidate & { reason: string; etaMin: number };

export type VisitedPlace = { name: string; category: string };

export function etaMin(distanceM: number | null): number {
  return Math.max(1, Math.round((distanceM ?? 0) / WALK_SPEED_M_PER_MIN));
}

/** 같은 장소가 카테고리별 검색에 중복으로 잡힌다. 가까운 순으로 자르기 전에 id 로 걷어낸다 */
export function dedupe(candidates: PlaceCandidate[], exclude: string[]): PlaceCandidate[] {
  const blocked = new Set(exclude);
  const seen = new Set<string>();
  return candidates.filter((place) => {
    if (blocked.has(place.id) || seen.has(place.id)) return false;
    seen.add(place.id);
    return true;
  });
}

export function shortlist(candidates: PlaceCandidate[]): PlaceCandidate[] {
  return [...candidates]
    .sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity))
    .slice(0, LLM_CANDIDATE_LIMIT);
}

export const SYSTEM_PROMPT = [
  "너는 한국 여행 코스를 짜는 가이드다.",
  "반드시 주어진 후보 목록 안에서만 고른다. 목록에 없는 장소를 지어내면 안 된다.",
  `정확히 ${PICK_COUNT}개를 고르고, 아래 JSON 만 출력한다. 다른 말은 쓰지 않는다.`,
  '{"picks":[{"id":"후보의 id","reason":"한국어 한두 문장"}]}',
].join("\n");

export function buildUserPrompt(input: {
  regionName: string;
  preferences: Preferences;
  history: VisitedPlace[];
  hasAccommodation: boolean;
  candidates: PlaceCandidate[];
}): string {
  const { regionName, preferences, history, hasAccommodation, candidates } = input;
  return [
    `지역: ${regionName}`,
    `여행 템포: ${preferences.tempo} / 동행: ${preferences.companion} / 예산: ${preferences.budget}`,
    `선호 테마: ${preferences.themes.join(", ") || "없음"}`,
    history.length
      ? `이미 다녀온 곳: ${history.map((h) => `${h.name}(${h.category})`).join(", ")}`
      : "아직 다녀온 곳 없음. 첫 장소를 고른다.",
    hasAccommodation ? "숙소 방향 후보가 목록에 섞여 있다. 동선이 자연스러우면 우대한다." : "",
    "",
    "후보 목록:",
    ...candidates.map(
      (c) => `- id=${c.id} | ${c.name} | ${c.category} | ${c.distanceM ?? "?"}m`,
    ),
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * LLM 이 돌려준 id 가 후보에 실재하는지 대조한다.
 * 이름·좌표·카테고리는 후보에서 채운다 — LLM 이 지어낸 좌표는 지도에 찍히지 않는다.
 * 하나라도 대조에 실패하면 null 을 돌려 호출부가 폴백하게 한다 (SDD 5장).
 */
export function validatePicks(
  raw: unknown,
  candidates: PlaceCandidate[],
): Recommendation[] | null {
  const picks = (raw as { picks?: { id?: unknown; reason?: unknown }[] })?.picks;
  if (!Array.isArray(picks) || picks.length === 0) return null;

  const byId = new Map(candidates.map((c) => [c.id, c]));
  const result: Recommendation[] = [];
  for (const pick of picks.slice(0, PICK_COUNT)) {
    const place = typeof pick?.id === "string" ? byId.get(pick.id) : undefined;
    if (!place) return null;
    result.push({
      ...place,
      reason: typeof pick.reason === "string" ? pick.reason : templateReason(place),
      etaMin: etaMin(place.distanceM),
    });
  }
  return result;
}

function templateReason(place: PlaceCandidate): string {
  return `여기서 가장 가까운 ${place.category}입니다.`;
}

/** LLM 이 죽어도 여행 루프는 끊기면 안 된다. 거리순 상위 몇 개 + 템플릿 문장 (SDD 5장) */
export function fallbackPicks(candidates: PlaceCandidate[]): Recommendation[] {
  return shortlist(candidates)
    .slice(0, PICK_COUNT)
    .map((place) => ({
      ...place,
      reason: templateReason(place),
      etaMin: etaMin(place.distanceM),
    }));
}
