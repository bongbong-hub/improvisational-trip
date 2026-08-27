"use client";

import { useEffect, useMemo, useState } from "react";

import DartMap from "@/components/DartMap";
import { MissionCard, Recommendations } from "@/components/Mission";
import { AccommodationStep, Onboarding } from "@/components/Setup";
import { Summary } from "@/components/Summary";
import { SEOUL_WEST_BBOX } from "@/lib/config.ts";
import { randomPointInBbox, type Point } from "@/lib/domain/geo.ts";
import type { Recommendation } from "@/lib/domain/recommend.ts";
import { newMission, newSession, type Mission, type TripSession } from "@/lib/domain/session.ts";
import { scoreRegions, type Region } from "@/lib/domain/scoring.ts";
import { clearTrip, loadTrip, saveTrip, type StoredTrip } from "@/lib/storage/session-store.ts";

const MAP_CENTER: Point = {
  lat: (SEOUL_WEST_BBOX.minLat + SEOUL_WEST_BBOX.maxLat) / 2,
  lng: (SEOUL_WEST_BBOX.minLng + SEOUL_WEST_BBOX.maxLng) / 2,
};

const freshTrip = (): StoredTrip => ({
  session: newSession(),
  missions: [],
  phase: "onboarding",
});

export default function Home() {
  const [trip, setTrip] = useState<StoredTrip | null>(null);

  // 다트 결과는 세션에 저장하지 않는다 — 지역 후보 전체를 들고 있는 것은 슬라이더 재정렬용
  // 임시 상태일 뿐이라 새로고침하면 다시 던지면 된다
  const [regions, setRegions] = useState<Region[]>([]);
  const [sensitivity, setSensitivity] = useState(0.5);
  const [picked, setPicked] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);

  // localStorage 는 서버 렌더에 없으므로 마운트 후에 읽는 것 말고는 방법이 없다.
  // react-hooks/set-state-in-effect 는 이 경우까지 막아서 여기서만 끈다.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setTrip(loadTrip() ?? freshTrip()), []);

  const dart = trip?.session.dart_point ?? null;

  const candidates = useMemo(
    () => (dart ? scoreRegions(dart, regions, sensitivity) : []),
    [dart, regions, sensitivity],
  );

  if (!trip) return null;

  /**
   * 쓰기는 phase 전이 시점에만 일어난다 (SDD 6장).
   * base 를 명시로 받는 이유는 한 핸들러에서 두 번 전이할 때다 — 렌더 클로저의 trip 을 그대로
   * 쓰면 두 번째 전이가 첫 번째 전이를 되돌린다.
   */
  function apply(
    base: StoredTrip,
    patch: Partial<StoredTrip>,
    sessionPatch?: Partial<TripSession>,
  ): StoredTrip {
    const next: StoredTrip = {
      ...base,
      ...patch,
      session: { ...base.session, ...sessionPatch },
    };
    saveTrip(next);
    setTrip(next);
    return next;
  }

  const commit = (patch: Partial<StoredTrip>, sessionPatch?: Partial<TripSession>) =>
    apply(trip!, patch, sessionPatch);

  /**
   * 첫 추천과 다음 추천이 같은 호출이다. 입력값(current, history)만 다르다.
   * effect 가 아니라 전이 시점에서 직접 부른다 — 어디서 추천이 시작되는지가 코드에 드러난다.
   */
  async function fetchRecs(from: StoredTrip) {
    const region = from.session.selected_region;
    if (!region) return;

    const done = from.missions.filter((m) => m.status === "완료");
    const last = done[done.length - 1];

    setRecs([]);
    setRecError(null);
    setRecLoading(true);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region,
          preferences: from.session.preferences,
          current: last ? { lat: last.lat, lng: last.lng } : { lat: region.lat, lng: region.lng },
          history: done.map((m) => ({ name: m.place_name, category: m.category })),
          accommodation: from.session.accommodation,
          exclude: from.missions.map((m) => m.place_id),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "추천을 불러오지 못했습니다.");
      setRecs(data.places);
    } catch (e) {
      setRecError((e as Error).message);
    } finally {
      setRecLoading(false);
    }
  }

  async function throwDart() {
    const point = randomPointInBbox(SEOUL_WEST_BBOX);
    setRegions([]);
    setPicked(null);
    setError(null);
    setLoading(true);
    const thrown = commit({ phase: "dart" }, { dart_point: point, selected_region: null });
    try {
      const res = await fetch("/api/regions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dart: point }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "지역을 불러오지 못했습니다.");
      setRegions(data.regions);
      apply(thrown, { phase: "region_select" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (trip.phase === "onboarding") {
    return (
      <main className="page">
        <Onboarding onDone={(preferences) => commit({ phase: "accommodation" }, { preferences })} />
      </main>
    );
  }

  if (trip.phase === "accommodation") {
    return (
      <main className="page">
        <AccommodationStep
          onDone={(accommodation) => commit({ phase: "dart" }, { accommodation })}
        />
      </main>
    );
  }

  if (trip.phase === "summary") {
    return (
      <main className="page">
        <Summary
          missions={trip.missions}
          onRestart={() => {
            clearTrip();
            setRegions([]);
            setPicked(null);
            setRecs([]);
            setTrip(freshTrip());
          }}
        />
      </main>
    );
  }

  const active = trip.missions.find((m) => m.status === "진행중");

  if (trip.phase === "mission_active" && active) {
    /** 인증도 스킵도 결국 같은 자리로 돌아온다 — 다음 추천 (SDD 2장) */
    const closeMission = (patch: Partial<Mission>) =>
      fetchRecs(
        commit({
          phase: "recommending",
          missions: trip.missions.map((m) =>
            m.mission_id === active.mission_id ? { ...m, ...patch } : m,
          ),
        }),
      );

    return (
      <main className="page">
        <MissionCard
          mission={active}
          onVerified={(photo, verified_by) =>
            closeMission({
              status: "완료",
              photo,
              verified_by,
              completed_at: new Date().toISOString(),
            })
          }
          onSkip={() => closeMission({ status: "스킵됨" })}
        />
      </main>
    );
  }

  if (trip.phase === "recommending") {
    return (
      <main className="page">
        <Recommendations
          regionName={trip.session.selected_region?.name ?? ""}
          places={recs}
          loading={recLoading}
          error={recError}
          onRetry={() => fetchRecs(trip)}
          onPick={(place) => {
            const mission = newMission(trip.session.session_id, trip.missions.length, {
              place_id: place.id,
              place_name: place.name,
              lat: place.lat,
              lng: place.lng,
              category: place.category,
              recommend_reason: place.reason,
            });
            setRecs([]);
            commit({ phase: "mission_active", missions: [...trip.missions, mission] });
          }}
          onFinish={() => commit({ phase: "summary" }, { status: "종료" })}
        />
      </main>
    );
  }

  const chosen = candidates.find((c) => c.name === picked);

  return (
    <main className="page">
      <DartMap center={MAP_CENTER} dart={dart} candidates={candidates} selectedName={picked} />

      <section className="panel">
        {!dart && (
          <>
            <h1 className="title">어디로 갈지는 다트가 정한다</h1>
            <p className="sub">서울 서부 어딘가에 다트를 던져 여행할 지역을 뽑습니다.</p>
          </>
        )}

        {error && <p className="error">{error}</p>}
        {loading && <p className="sub">주변 지역을 살펴보는 중…</p>}

        {candidates.length > 0 && (
          <>
            <label className="slider">
              <span>가까운 곳 우선</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={sensitivity}
                onChange={(e) => setSensitivity(Number(e.target.value))}
              />
            </label>

            <ul className="cards">
              {candidates.map((candidate) => (
                <li key={candidate.name}>
                  <button
                    className={`card${picked === candidate.name ? " cardOn" : ""}`}
                    onClick={() => setPicked(candidate.name)}
                  >
                    <strong>{candidate.name}</strong>
                    <span>
                      볼거리 {candidate.poiCount}곳 · 다트에서{" "}
                      {(candidate.distanceM / 1000).toFixed(1)}km
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {chosen ? (
          <button
            className="primary"
            onClick={() =>
              fetchRecs(
                commit(
                  { phase: "recommending" },
                  { selected_region: { name: chosen.name, lat: chosen.lat, lng: chosen.lng } },
                ),
              )
            }
          >
            {chosen.name}에서 여행 시작
          </button>
        ) : (
          <button className="primary" onClick={throwDart} disabled={loading}>
            {dart ? "다시 던지기" : "다트 던지기"}
          </button>
        )}
      </section>
    </main>
  );
}
