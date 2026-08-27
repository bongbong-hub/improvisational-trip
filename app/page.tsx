"use client";

import { useEffect, useMemo, useState } from "react";

import { Home } from "@/components/Home";
import KoreaMap from "@/components/KoreaMap";
import { Menu, type Panel } from "@/components/Menu";
import { MissionCard, Recommendations } from "@/components/Mission";
import { Onboarding } from "@/components/Setup";
import { Summary } from "@/components/Summary";
import { DEFAULT_SCOPE, REGION_SCOPES, SEOUL_WEST_BBOX, type RegionScope } from "@/lib/config.ts";
import { randomPointInBbox, type Point } from "@/lib/domain/geo.ts";
import type { Recommendation } from "@/lib/domain/recommend.ts";
import {
  PREVIOUS_PHASE,
  newMission,
  newSession,
  type Accommodation,
  type Mission,
  type TripSession,
} from "@/lib/domain/session.ts";
import { scoreRegions, type Region } from "@/lib/domain/scoring.ts";
import {
  archiveTrip,
  loadHistory,
  loadTrip,
  saveHistory,
  saveTrip,
  type StoredTrip,
} from "@/lib/storage/session-store.ts";

const freshTrip = (): StoredTrip => ({
  session: newSession(),
  missions: [],
  phase: "onboarding",
});

export default function App() {
  const [trip, setTrip] = useState<StoredTrip | null>(null);
  const [history, setHistory] = useState<StoredTrip[]>([]);
  const [loaded, setLoaded] = useState(false);
  /** 홈은 phase 가 아니라 별도 상태다. 홈에 들렀다 와도 하던 화면이 그대로 남는다 */
  const [atHome, setAtHome] = useState(true);
  const [panel, setPanel] = useState<Panel | null>(null);

  /** 지역을 다트로 뽑을지 직접 고를지 */
  const [mode, setMode] = useState<"dart" | "manual">("dart");
  /** 여행 범위 단위. 바꾸면 표본 반경이 달라져 지역 후보를 다시 받아야 한다 */
  const [scope, setScope] = useState<RegionScope>(DEFAULT_SCOPE);
  const [regions, setRegions] = useState<Region[]>([]);
  const [sensitivity, setSensitivity] = useState(0.5);
  const [picked, setPicked] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);

  // localStorage 는 서버 렌더에 없으므로 마운트 후에 읽는 것 말고는 방법이 없다.
  // react-hooks/set-state-in-effect 는 이 경우까지 막아서 여기서만 끈다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTrip(loadTrip());
    setHistory(loadHistory());
    setLoaded(true);
  }, []);

  const origin = trip?.session.dart_point ?? null;

  const candidates = useMemo(
    () => (origin ? scoreRegions(origin, regions, sensitivity) : []),
    [origin, regions, sensitivity],
  );

  if (!loaded) return null;

  /** 쓰기는 phase 전이 시점에만 일어난다 (SDD 6장). 이어서 쓸 수 있게 갱신된 값을 돌려준다 */
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
          // 첫 추천은 지역 중심이 아니라 찍은 지점에서 시작한다 — 광역 단위의 중심은 산속일 수도 있다
          current: last ?? from.session.dart_point ?? region,
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

  /** 다트로 뽑든 직접 찍든 여기서 만나 지역 후보를 가져온다 */
  async function loadRegions(point: Point, nextScope: RegionScope = scope) {
    setRegions([]);
    setPicked(null);
    setError(null);
    setLoading(true);
    const started = commit({ phase: "dart" }, { dart_point: point, selected_region: null });
    try {
      const res = await fetch("/api/regions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dart: point, scope: nextScope }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "지역을 불러오지 못했습니다.");
      setRegions(data.regions);
      apply(started, { phase: "region_select" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function searchRegion() {
    if (!query.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "검색에 실패했습니다.");
      const place = data.places[0];
      if (!place) throw new Error("그 이름으로는 찾지 못했습니다.");
      await loadRegions({ lat: place.lat, lng: place.lng });
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  /** 진행 중 여행과 지난 여행에서 접어둔 곳을 한 목록으로 본다 */
  const wishlist = [...(trip?.missions ?? []), ...history.flatMap((t) => t.missions)].filter(
    (m) => m.status === "스킵됨",
  );

  function removeWish(missionId: string) {
    if (trip?.missions.some((m) => m.mission_id === missionId)) {
      commit({ missions: trip.missions.filter((m) => m.mission_id !== missionId) });
      return;
    }
    const next = history.map((t) => ({
      ...t,
      missions: t.missions.filter((m) => m.mission_id !== missionId),
    }));
    saveHistory(next);
    setHistory(next);
  }

  function setAccommodation(accommodation: Accommodation) {
    commit({}, { accommodation });
  }

  const menu = (
    <Menu
      accommodation={trip?.session.accommodation ?? null}
      wishlist={wishlist}
      onSetAccommodation={setAccommodation}
      onRemoveWish={removeWish}
      onHome={() => {
        setPanel(null);
        setAtHome(true);
      }}
      panel={panel}
      setPanel={setPanel}
    />
  );

  if (atHome || !trip) {
    return (
      <main className="page">
        {panel && menu}
        <Home
          history={history}
          active={trip}
          wishCount={wishlist.length}
          onStart={() => {
            const started = freshTrip();
            saveTrip(started);
            setTrip(started);
            setRegions([]);
            setRecs([]);
            setPicked(null);
            setAtHome(false);
          }}
          onResume={() => setAtHome(false)}
          onOpenWishlist={() => setPanel("wishlist")}
        />
      </main>
    );
  }

  /** 뒤로가기는 화면마다 한 단계다. 갈 곳이 없으면 버튼을 숨긴다 */
  function goBack() {
    const target = PREVIOUS_PHASE[trip!.phase];
    if (!target) return;
    if (target === "home") {
      setAtHome(true);
      return;
    }
    if (target === "recommending") {
      // 미션을 물렸으니 그 미션은 없던 일이 된다. 위시리스트에도 남기지 않는다
      const active = trip!.missions.find((m) => m.status === "진행중");
      const next = commit({
        phase: "recommending",
        missions: trip!.missions.filter((m) => m.mission_id !== active?.mission_id),
      });
      if (recs.length === 0) fetchRecs(next);
      return;
    }
    if (target === "dart") {
      setRegions([]);
      setPicked(null);
    }
    commit({ phase: target });
  }

  const backable =
    PREVIOUS_PHASE[trip.phase] !== undefined &&
    // 여행이 시작된 뒤에는 지역을 되돌릴 수 없다
    !(trip.phase === "recommending" && trip.missions.length > 0);

  const bar = (
    <div className="topbar">
      {backable ? (
        <button className="back" onClick={goBack}>
          ← 뒤로
        </button>
      ) : (
        <span />
      )}
      {menu}
    </div>
  );

  if (trip.phase === "onboarding") {
    return (
      <main className="page">
        {bar}
        <Onboarding onDone={(preferences) => commit({ phase: "dart" }, { preferences })} />
      </main>
    );
  }

  if (trip.phase === "summary") {
    return (
      <main className="page">
        {bar}
        <Summary
          missions={trip.missions}
          onRestart={() => {
            setHistory(archiveTrip(trip));
            setTrip(null);
            setRegions([]);
            setPicked(null);
            setRecs([]);
            setAtHome(true);
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
        {bar}
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
        {bar}
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
      {bar}
      <KoreaMap
        point={origin}
        animateDrop={mode === "dart"}
        showTarget={mode === "dart"}
        candidates={candidates}
        selectedName={picked}
        onPickPoint={mode === "manual" && !loading ? loadRegions : undefined}
      />

      <section className="panel">
        <div className="tabs">
          {(["dart", "manual"] as const).map((m) => (
            <button
              key={m}
              className={`tab${mode === m ? " tabOn" : ""}`}
              onClick={() => setMode(m)}
            >
              {m === "dart" ? "다트 던지기" : "직접 고르기"}
            </button>
          ))}
        </div>

        {mode === "manual" && (
          <form
            className="searchRow"
            onSubmit={(e) => {
              e.preventDefault();
              searchRegion();
            }}
          >
            <input
              className="input"
              placeholder="지역 이름으로 찾기"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="secondary" type="submit" disabled={loading}>
              찾기
            </button>
          </form>
        )}

        <div className="choice">
          <span className="choiceLabel">여행 범위</span>
          <div className="chips">
            {(Object.keys(REGION_SCOPES) as RegionScope[]).map((s) => (
              <button
                key={s}
                className={`chip${scope === s ? " chipOn" : ""}`}
                disabled={loading}
                onClick={() => {
                  setScope(s);
                  // 이미 찍은 지점이 있으면 그 자리에서 범위만 바꿔 다시 뽑는다
                  if (origin) loadRegions(origin, s);
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {!origin && (
          <p className="sub">
            {mode === "dart"
              ? "서울 서부 어딘가에 다트를 던져 여행할 지역을 뽑습니다."
              : "지도를 눌러 찍거나 지역 이름으로 찾으세요."}
          </p>
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
                    <span className="meta">
                      볼거리 {candidate.poiCount}곳 · {(candidate.distanceM / 1000).toFixed(1)}km
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
          mode === "dart" && (
            <button
              className="primary"
              onClick={() => loadRegions(randomPointInBbox(SEOUL_WEST_BBOX))}
              disabled={loading}
            >
              {origin ? "다시 던지기" : "다트 던지기"}
            </button>
          )
        )}
      </section>
    </main>
  );
}
