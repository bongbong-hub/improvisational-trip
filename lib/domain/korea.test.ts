import assert from "node:assert/strict";
import { test } from "node:test";

import { KOREA_BBOX, MAINLAND_PATH, MAP_H, MAP_W, project, unproject } from "./korea.ts";

test("투영과 역투영은 서로를 되돌린다", () => {
  for (const p of [
    { lat: 37.5665, lng: 126.978 },
    { lat: 35.1796, lng: 129.0756 },
    { lat: 33.4, lng: 126.55 },
  ]) {
    const { x, y } = project(p);
    const back = unproject(x, y);
    assert.ok(Math.abs(back.lat - p.lat) < 1e-9, `lat ${back.lat} vs ${p.lat}`);
    assert.ok(Math.abs(back.lng - p.lng) < 1e-9, `lng ${back.lng} vs ${p.lng}`);
  }
});

test("bbox 모서리가 뷰박스 모서리로 간다", () => {
  const topLeft = project({ lat: KOREA_BBOX.maxLat, lng: KOREA_BBOX.minLng });
  assert.equal(topLeft.x, 0);
  assert.equal(topLeft.y, 0);

  const bottomRight = project({ lat: KOREA_BBOX.minLat, lng: KOREA_BBOX.maxLng });
  assert.ok(Math.abs(bottomRight.x - MAP_W) < 1e-9);
  assert.ok(Math.abs(bottomRight.y - MAP_H) < 1e-9);
});

test("서울은 지도 위쪽 절반, 부산은 아래쪽에 놓인다", () => {
  const seoul = project({ lat: 37.5665, lng: 126.978 });
  const busan = project({ lat: 35.1796, lng: 129.0756 });
  assert.ok(seoul.y < MAP_H / 2);
  assert.ok(busan.y > seoul.y);
  assert.ok(busan.x > seoul.x);
});

test("외곽선 path 는 닫힌 도형이고 좌표가 뷰박스 안에 있다", () => {
  assert.ok(MAINLAND_PATH.startsWith("M"));
  assert.ok(MAINLAND_PATH.endsWith("Z"));
  for (const [, , x, y] of MAINLAND_PATH.matchAll(/([ML])(-?[\d.]+) (-?[\d.]+)/g)) {
    assert.ok(Number(x) >= 0 && Number(x) <= MAP_W, `x ${x}`);
    assert.ok(Number(y) >= 0 && Number(y) <= MAP_H, `y ${y}`);
  }
});
