// 남한 실루엣과 위경도↔SVG 좌표 변환.
// 외곽선은 실제 국경 데이터가 아니라 주요 곶·만을 이어 손으로 찍은 근사치다.
// 다트가 떨어지는 곳과 클릭 좌표는 아래 투영으로 정확히 계산되므로 기능에는 영향이 없다.

import type { Point } from "./geo.ts";

export const KOREA_BBOX = {
  minLat: 33.0,
  maxLat: 38.75,
  minLng: 125.7,
  maxLng: 129.85,
} as const;

/** 경도 1도는 위도 1도보다 짧다. 지도 중앙 위도의 비율로 x 를 줄이지 않으면 남한이 옆으로 퍼진다 */
const LNG_SCALE = Math.cos((36.5 * Math.PI) / 180);

/** 1도를 SVG 몇 단위로 볼지. 좌표를 정수 근처로 두려는 것뿐이라 값 자체에 의미는 없다 */
const UNIT = 100;

export const MAP_W = (KOREA_BBOX.maxLng - KOREA_BBOX.minLng) * LNG_SCALE * UNIT;
export const MAP_H = (KOREA_BBOX.maxLat - KOREA_BBOX.minLat) * UNIT;

export function project(p: Point): { x: number; y: number } {
  return {
    x: (p.lng - KOREA_BBOX.minLng) * LNG_SCALE * UNIT,
    y: (KOREA_BBOX.maxLat - p.lat) * UNIT,
  };
}

export function unproject(x: number, y: number): Point {
  return {
    lng: x / (LNG_SCALE * UNIT) + KOREA_BBOX.minLng,
    lat: KOREA_BBOX.maxLat - y / UNIT,
  };
}

/** [위도, 경도]. 고성에서 시계방향으로 동해안·남해안·서해안·휴전선 순 */
const MAINLAND: [number, number][] = [
  [38.62, 128.36],
  [38.2, 128.6],
  [37.9, 128.83],
  [37.75, 128.95],
  [37.43, 129.17],
  [37.0, 129.4],
  [36.65, 129.46],
  [36.4, 129.42],
  [36.08, 129.57],
  [35.95, 129.42],
  [35.65, 129.47],
  [35.48, 129.42],
  [35.2, 129.24],
  [35.08, 129.08],
  [35.05, 128.8],
  [34.88, 128.62],
  [34.83, 128.42],
  [34.85, 128.05],
  [34.72, 127.9],
  [34.75, 127.7],
  [34.55, 127.5],
  [34.42, 127.3],
  [34.6, 127.1],
  [34.45, 126.9],
  [34.3, 126.75],
  [34.3, 126.52],
  [34.55, 126.4],
  [34.79, 126.38],
  [35.05, 126.35],
  [35.35, 126.45],
  [35.62, 126.47],
  [35.85, 126.6],
  [36.0, 126.68],
  [36.2, 126.5],
  [36.45, 126.42],
  [36.75, 126.15],
  [36.95, 126.35],
  [37.05, 126.62],
  [37.25, 126.6],
  [37.45, 126.42],
  [37.65, 126.32],
  [37.8, 126.42],
  [37.9, 126.68],
  [38.05, 126.95],
  [38.25, 127.35],
  [38.35, 127.8],
  [38.45, 128.1],
];

const JEJU: [number, number][] = [
  [33.55, 126.15],
  [33.5, 126.3],
  [33.55, 126.55],
  [33.53, 126.8],
  [33.45, 126.94],
  [33.3, 126.85],
  [33.22, 126.6],
  [33.24, 126.32],
  [33.35, 126.16],
];

function toPath(points: [number, number][]): string {
  const d = points
    .map(([lat, lng], i) => {
      const { x, y } = project({ lat, lng });
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return `${d} Z`;
}

export const MAINLAND_PATH = toPath(MAINLAND);
export const JEJU_PATH = toPath(JEJU);
