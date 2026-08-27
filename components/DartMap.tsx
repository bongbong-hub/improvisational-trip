"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

import type { Point } from "@/lib/domain/geo.ts";
import type { RegionCandidate } from "@/lib/domain/scoring.ts";

// 프로토콜을 https 로 박아둔다 — 카카오 문서의 `//dapi...` 형태는 http 로 띄운 로컬 개발서버에서
// http 로 해석되고, 그러면 SDK 가 503 을 돌려준다
const SDK_URL = `https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=${process.env.NEXT_PUBLIC_KAKAO_JS_KEY}`;

/** 다트가 화면 밖에서 떨어져 꽂히는 시간. CSS 애니메이션 길이와 맞춰야 한다 */
const DROP_MS = 700;

type Props = {
  center: Point;
  dart: Point | null;
  candidates: RegionCandidate[];
  selectedName: string | null;
};

/**
 * 지도를 다트 좌표로 먼저 이동시킨 뒤 컨테이너 정중앙에 다트를 떨어뜨린다.
 * 좌표를 픽셀로 투영(getProjection)하지 않아도 되는 대신, 다트는 항상 화면 중앙에 꽂힌다.
 */
export default function DartMap({ center, dart, candidates, selectedName }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<kakao.maps.Map | null>(null);
  const markersRef = useRef<kakao.maps.Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [dropping, setDropping] = useState(false);

  const initMap = () => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = new window.kakao.maps.Map(containerRef.current, {
      center: new window.kakao.maps.LatLng(center.lat, center.lng),
      level: 7,
    });
    setReady(true);
  };

  // 다트가 새로 꽂힐 때마다 지도를 옮기고 낙하 애니메이션을 다시 튼다
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !dart) return;
    map.panTo(new window.kakao.maps.LatLng(dart.lat, dart.lng));
    setDropping(true);
    const timer = setTimeout(() => setDropping(false), DROP_MS);
    return () => clearTimeout(timer);
  }, [dart]);

  // 후보 마커는 매번 통째로 갈아끼운다 — 개수가 3개 이하라 diff 할 이유가 없다
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const marker of markersRef.current) marker.setMap(null);
    markersRef.current = candidates.map(
      (candidate) =>
        new window.kakao.maps.Marker({
          position: new window.kakao.maps.LatLng(candidate.lat, candidate.lng),
          map,
          title: candidate.name,
        }),
    );
  }, [candidates, ready]);

  useEffect(() => {
    const map = mapRef.current;
    const picked = candidates.find((c) => c.name === selectedName);
    if (!map || !picked) return;
    map.panTo(new window.kakao.maps.LatLng(picked.lat, picked.lng));
    map.setLevel(5);
  }, [selectedName, candidates]);

  return (
    <div className="mapWrap">
      <Script
        src={SDK_URL}
        onLoad={() => window.kakao.maps.load(initMap)}
        onError={() => setFailed(true)}
      />
      <div ref={containerRef} className="map" />
      {failed && <div className="mapMsg">지도를 불러오지 못했습니다. 새로고침해 주세요.</div>}
      {!ready && !failed && <div className="mapMsg">지도 불러오는 중…</div>}
      {dart && <div className={`dart${dropping ? " dartDropping" : ""}`}>📍</div>}
    </div>
  );
}
