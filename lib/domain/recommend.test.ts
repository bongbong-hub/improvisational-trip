import assert from "node:assert/strict";
import { test } from "node:test";

import { dedupe, fallbackPicks, validatePicks, type PlaceCandidate } from "./recommend.ts";

const place = (id: string, distanceM: number): PlaceCandidate => ({
  id,
  name: `장소${id}`,
  lat: 37.5,
  lng: 127,
  category: "카페",
  address: "주소",
  distanceM,
});

const candidates = [place("a", 100), place("b", 50), place("c", 300)];

test("중복 id 와 exclude 는 후보에서 빠진다", () => {
  const result = dedupe([...candidates, place("a", 100)], ["c"]);
  assert.deepEqual(
    result.map((p) => p.id),
    ["a", "b"],
  );
});

test("후보에 없는 id 를 고르면 폐기한다", () => {
  assert.equal(validatePicks({ picks: [{ id: "없는id", reason: "그냥" }] }, candidates), null);
});

test("정상 응답은 후보의 이름·좌표로 채워진다", () => {
  const picks = validatePicks({ picks: [{ id: "b", reason: "가까워서" }] }, candidates);
  assert.equal(picks?.[0].name, "장소b");
  assert.equal(picks?.[0].reason, "가까워서");
  assert.equal(picks?.[0].lat, 37.5);
});

test("picks 가 배열이 아니면 폐기한다", () => {
  assert.equal(validatePicks({ picks: "b" }, candidates), null);
  assert.equal(validatePicks(null, candidates), null);
});

test("폴백은 가까운 순으로 고르고 이유를 채운다", () => {
  const picks = fallbackPicks(candidates);
  assert.deepEqual(
    picks.map((p) => p.id),
    ["b", "a"],
  );
  assert.ok(picks[0].reason.length > 0);
});
