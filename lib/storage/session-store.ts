import type { Mission, Phase, TripSession } from "../domain/session.ts";

const KEY = "trip:session";

/**
 * localStorage 키는 이것 하나다 (SDD 6장).
 * PRD 의 TripSession·Mission 은 그대로 두고, 데모에서만 필요한 것(현재 화면 위치, 미션 배열)을
 * 바깥 봉투에 담는다 — 서버 DB 로 옮길 때 session/missions 만 떼어내면 된다.
 */
export type StoredTrip = {
  session: TripSession;
  missions: Mission[];
  phase: Phase;
};

export function loadTrip(): StoredTrip | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredTrip) : null;
  } catch {
    // 손상된 JSON 때문에 앱이 못 뜨는 것보다 새 여행으로 시작하는 편이 낫다
    return null;
  }
}

export function saveTrip(trip: StoredTrip): void {
  localStorage.setItem(KEY, JSON.stringify(trip));
}

export function clearTrip(): void {
  localStorage.removeItem(KEY);
}
