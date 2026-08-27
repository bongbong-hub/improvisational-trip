"use client";

import { DEMO_BBOX } from "@/lib/config.ts";
import { JEJU_PATH, MAINLAND_PATH, MAP_H, MAP_W, project } from "@/lib/domain/korea.ts";
import type { StoredTrip } from "@/lib/storage/session-store.ts";

type Props = {
  history: StoredTrip[];
  /** 진행 중인 여행이 있으면 새로 시작하는 대신 이어서 간다 */
  active: StoredTrip | null;
  wishCount: number;
  onStart: () => void;
  onResume: () => void;
  onOpenWishlist: () => void;
};

const target = project({
  lat: (DEMO_BBOX.minLat + DEMO_BBOX.maxLat) / 2,
  lng: (DEMO_BBOX.minLng + DEMO_BBOX.maxLng) / 2,
});

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" });

export function Home({
  history,
  active,
  wishCount,
  onStart,
  onResume,
  onOpenWishlist,
}: Props) {
  return (
    <section className="panel panelFull home">
      <header className="brand">
        {/* 로고마크는 앱이 다루는 것 그대로다 — 남한, 그리고 다트가 꽂힌 자리 */}
        <svg
          className="brandMark"
          viewBox={`0 0 ${MAP_W.toFixed(1)} ${MAP_H.toFixed(1)}`}
          aria-hidden
        >
          <path d={MAINLAND_PATH} />
          <path d={JEJU_PATH} />
          <circle className="brandPin" cx={target.x} cy={target.y} r={11} />
        </svg>
        <h1 className="wordmark">GMG</h1>
        <p className="wordmarkSub">가면가</p>
      </header>

      <p className="pitch">
        어디로 갈지는 다트가 정합니다.
        <br />한 번에 한 곳씩, 도착해야 다음이 열립니다.
      </p>

      {active ? (
        <button className="primary" onClick={onResume}>
          가던 여행 이어서
        </button>
      ) : (
        <button className="primary" onClick={onStart}>
          여행 시작
        </button>
      )}

      <button className="secondary" onClick={onOpenWishlist}>
        위시리스트 {wishCount}곳
      </button>

      <div className="trips">
        <p className="eyebrow">다녀온 여행 {history.length}</p>
        {history.length === 0 ? (
          <p className="sub">아직 없습니다. 첫 다트를 던지면 여기 쌓입니다.</p>
        ) : (
          <ul className="cards">
            {history.map((trip) => {
              const done = trip.missions.filter((m) => m.status === "완료").length;
              return (
                <li key={trip.session.session_id} className="card cardStatic">
                  <strong>{trip.session.selected_region?.name ?? "지역 미정"}</strong>
                  <span className="meta">
                    {dateLabel(trip.session.created_at)} · {done}곳 방문
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="fineprint away">
        로그인 없이 이 브라우저에만 저장됩니다. 브라우저 기록을 지우면 함께 사라집니다.
      </p>
    </section>
  );
}
