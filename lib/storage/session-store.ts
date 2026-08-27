import type { Mission, Phase, TripSession } from "../domain/session.ts";

const KEY = "trip:session";
const HISTORY_KEY = "trip:history";

/**
 * 진행 중인 여행은 `trip:session` 하나에 통째로 저장한다 (SDD 6장).
 * PRD 의 TripSession·Mission 은 그대로 두고, 데모에서만 필요한 것(현재 화면 위치, 미션 배열)을
 * 바깥 봉투에 담는다 — 서버 DB 로 옮길 때 session/missions 만 떼어내면 된다.
 */
export type StoredTrip = {
  session: TripSession;
  missions: Mission[];
  phase: Phase;
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    // 손상된 JSON 때문에 앱이 못 뜨는 것보다 빈 상태로 시작하는 편이 낫다
    return fallback;
  }
}

export const loadTrip = () => read<StoredTrip | null>(KEY, null);

export function saveTrip(trip: StoredTrip): void {
  localStorage.setItem(KEY, JSON.stringify(trip));
}

export function clearTrip(): void {
  localStorage.removeItem(KEY);
}

/** 끝난 여행. 홈에서 목록으로 보여준다. 최신이 앞이다 */
export const loadHistory = () => read<StoredTrip[]>(HISTORY_KEY, []);

/** 여행을 마치면 진행 중 자리를 비우고 기록으로 옮긴다 */
export function archiveTrip(trip: StoredTrip): StoredTrip[] {
  const history = [trip, ...loadHistory()];
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  clearTrip();
  return history;
}

/** 위시리스트에서 지난 여행의 항목을 지울 때 쓴다 */
export function saveHistory(history: StoredTrip[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}
