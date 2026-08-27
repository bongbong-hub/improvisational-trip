import { VERIFY_THRESHOLD_M } from "../config.ts";

export type Point = { lat: number; lng: number };

const EARTH_RADIUS_M = 6371000;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** 두 좌표 사이 대권 거리(m) */
export function haversineM(a: Point, b: Point): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** 사진 인증 판정. 임계 거리는 실기기 GPS 오차를 보고 확정해야 한다 (O2) */
export function isNear(a: Point, b: Point, thresholdM = VERIFY_THRESHOLD_M): boolean {
  return haversineM(a, b) <= thresholdM;
}

export type Bbox = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

/** rand 를 주입받는 이유는 테스트에서 다트 좌표를 고정하기 위해서다 */
export function randomPointInBbox(bbox: Bbox, rand: () => number = Math.random): Point {
  return {
    lat: bbox.minLat + rand() * (bbox.maxLat - bbox.minLat),
    lng: bbox.minLng + rand() * (bbox.maxLng - bbox.minLng),
  };
}

/**
 * 중심점 주변 원 안의 표본 점들. 이 점들을 역지오코딩해서 지역 후보를 얻는다.
 * 반지름에 sqrt 를 씌우지 않으면 표본이 중심에 몰린다 — 면적은 r^2 에 비례하므로.
 */
export function samplePointsInCircle(
  center: Point,
  radiusM: number,
  count: number,
  rand: () => number = Math.random,
): Point[] {
  const latPerM = 1 / 111320;
  const lngPerM = latPerM / Math.cos(toRad(center.lat));

  return Array.from({ length: count }, () => {
    const r = radiusM * Math.sqrt(rand());
    const theta = 2 * Math.PI * rand();
    return {
      lat: center.lat + r * Math.sin(theta) * latPerM,
      lng: center.lng + r * Math.cos(theta) * lngPerM,
    };
  });
}
