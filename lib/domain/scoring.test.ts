import assert from "node:assert/strict";
import { test } from "node:test";

import { haversineM, samplePointsInCircle } from "./geo.ts";
import { distanceWeight, scoreRegions } from "./scoring.ts";

const dart = { lat: 37.56, lng: 126.9 };

test("haversine: 서울시청~강남역 실제 거리(약 8.5km) 근처", () => {
  const d = haversineM({ lat: 37.5665, lng: 126.978 }, { lat: 37.4979, lng: 127.0276 });
  assert.ok(d > 8000 && d < 9500, `got ${d}`);
});

test("거리가중치는 반감기에서 정확히 절반", () => {
  assert.equal(distanceWeight(0, 2000), 1);
  assert.equal(distanceWeight(2000, 2000), 0.5);
});

test("표본 점은 모두 반경 안에 들어온다", () => {
  for (const p of samplePointsInCircle(dart, 5000, 50)) {
    assert.ok(haversineM(dart, p) <= 5000 + 1);
  }
});

test("sensitivity 0 이면 POI 밀도만으로 정렬된다", () => {
  const regions = [
    { name: "먼곳", lat: 37.62, lng: 126.9, poiCount: 100 },
    { name: "가까운곳", lat: 37.561, lng: 126.9, poiCount: 50 },
  ];
  assert.equal(scoreRegions(dart, regions, 0)[0].name, "먼곳");
});

test("sensitivity 를 올리면 가까운 곳이 역전할 수 있다", () => {
  const regions = [
    { name: "먼곳", lat: 37.62, lng: 126.9, poiCount: 100 },
    { name: "가까운곳", lat: 37.561, lng: 126.9, poiCount: 90 },
  ];
  assert.equal(scoreRegions(dart, regions, 1)[0].name, "가까운곳");
});

test("POI 가 0 인 지역은 후보에서 빠지고 최대 3개까지만 나온다", () => {
  const regions = Array.from({ length: 5 }, (_, i) => ({
    name: `r${i}`,
    lat: 37.56 + i * 0.01,
    lng: 126.9,
    poiCount: i, // r0 은 0
  }));
  const result = scoreRegions(dart, regions, 0.5);
  assert.equal(result.length, 3);
  assert.ok(!result.some((r) => r.name === "r0"));
});
