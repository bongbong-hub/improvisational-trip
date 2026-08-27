"use client";

import exifr from "exifr";
import { useRef, useState } from "react";

import { isNear, type Point } from "@/lib/domain/geo.ts";
import type { Recommendation } from "@/lib/domain/recommend.ts";
import type { Mission } from "@/lib/domain/session.ts";
import { putPhoto } from "@/lib/storage/photo-store.ts";

type Props = {
  regionName: string;
  places: Recommendation[];
  loading: boolean;
  error: string | null;
  onPick: (place: Recommendation) => void;
  onRetry: () => void;
  onFinish: () => void;
};

/**
 * 첫 추천과 다음 추천이 같은 화면이다. 한 번에 1~2곳만 보여주는 것이 제품의 핵심이라
 * 남은 후보나 전체 코스를 여기서 노출하지 않는다.
 */
export function Recommendations({
  regionName,
  places,
  loading,
  error,
  onPick,
  onRetry,
  onFinish,
}: Props) {
  return (
    <section className="panel panelFull">
      <h1 className="title">{regionName}</h1>
      <p className="sub">
        {loading ? "다음 장소를 고르는 중…" : "다음에 갈 곳이에요. 하나 골라 미션을 시작하세요."}
      </p>

      {error && (
        <>
          <p className="error">{error}</p>
          <button className="secondary" onClick={onRetry}>
            다시 시도
          </button>
        </>
      )}

      <ul className="cards">
        {places.map((place) => (
          <li key={place.id}>
            <button className="card" onClick={() => onPick(place)}>
              <strong>{place.name}</strong>
              <span>
                {place.category} · {place.distanceM ?? "?"}m · 걸어서 {place.etaMin}분
              </span>
              <span className="reason">{place.reason}</span>
            </button>
          </li>
        ))}
      </ul>

      {!loading && (
        <button className="secondary" onClick={onFinish}>
          여행 종료
        </button>
      )}
    </section>
  );
}

type Verified = NonNullable<Mission["verified_by"]>;

function currentPosition(): Promise<Point> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 10000 },
    ),
  );
}

/**
 * EXIF GPS → Geolocation → 수동 확인 순의 3단 폴백 (PRD 4-3).
 * iOS 사파리는 촬영한 사진의 EXIF GPS 를 지워서 내려주는 일이 많아 2단이 실제로는 주력이다.
 */
async function verifyPhoto(file: File, target: Point): Promise<Verified | null> {
  try {
    const gps = await exifr.gps(file);
    if (gps && isNear({ lat: gps.latitude, lng: gps.longitude }, target)) return "exif";
  } catch {
    // EXIF 가 없거나 못 읽는 것은 정상 경로다. 다음 단계로 넘어간다
  }

  try {
    if (isNear(await currentPosition(), target)) return "geolocation";
  } catch {
    // 권한 거부·타임아웃도 마찬가지다
  }

  return null;
}

type MissionCardProps = {
  mission: Mission;
  onVerified: (photoKey: string, verifiedBy: Verified) => void;
  onSkip: () => void;
};

export function MissionCard({ mission, onVerified, onSkip }: MissionCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [checking, setChecking] = useState(false);
  const [failedFile, setFailedFile] = useState<File | null>(null);

  async function handleFile(file: File) {
    setChecking(true);
    setFailedFile(null);
    const verified = await verifyPhoto(file, { lat: mission.lat, lng: mission.lng });
    if (verified) {
      await putPhoto(mission.mission_id, file);
      onVerified(mission.mission_id, verified);
    } else {
      setFailedFile(file);
    }
    setChecking(false);
  }

  return (
    <section className="panel panelFull">
      <p className="sub">지금 미션</p>
      <h1 className="title">{mission.place_name}</h1>
      <p className="reason">{mission.recommend_reason}</p>

      {/* capture 속성이 모바일에서 카메라를 바로 연다. 데스크톱에서는 그냥 파일 선택창이 된다 */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />

      <button className="primary" onClick={() => inputRef.current?.click()} disabled={checking}>
        {checking ? "위치 확인 중…" : "도착 사진 찍기"}
      </button>

      {failedFile && (
        <>
          <p className="error">
            사진과 위치 정보로 도착을 확인하지 못했습니다.
          </p>
          <button
            className="secondary"
            onClick={async () => {
              await putPhoto(mission.mission_id, failedFile);
              onVerified(mission.mission_id, "manual");
            }}
          >
            여기 맞아요 (직접 확인)
          </button>
        </>
      )}

      <button className="secondary" onClick={onSkip} disabled={checking}>
        여기 갈 수 없어요
      </button>
    </section>
  );
}
