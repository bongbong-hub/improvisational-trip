import { DISTANCE_HALFLIFE_M, MAX_REGION_CANDIDATES } from "../config.ts";
import { haversineM, type Point } from "./geo.ts";

export type Region = {
  name: string;
  lat: number;
  lng: number;
  poiCount: number;
};

export type RegionCandidate = Region & { score: number; distanceM: number };

/** 가까울수록 1 에 가깝고 멀수록 0 으로 떨어지는 지수감쇠 (O1: 형태 자체가 튜닝 대상) */
export function distanceWeight(distanceM: number, halfLifeM = DISTANCE_HALFLIFE_M): number {
  return 2 ** (-distanceM / halfLifeM);
}

/**
 * PRD 4-1 의 산식: 점수 = POI밀도 x (1 + 사용자설정값 x 거리가중치).
 * sensitivity 0 이면 순수 POI 밀도순, 1 이면 다트 바로 옆 지역이 최대 2배까지 밀린다.
 */
export function scoreRegions(
  dart: Point,
  regions: Region[],
  sensitivity: number,
  limit = MAX_REGION_CANDIDATES,
): RegionCandidate[] {
  return regions
    .map((region) => {
      const distanceM = haversineM(dart, region);
      return {
        ...region,
        distanceM,
        score: region.poiCount * (1 + sensitivity * distanceWeight(distanceM)),
      };
    })
    .filter((candidate) => candidate.poiCount > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
