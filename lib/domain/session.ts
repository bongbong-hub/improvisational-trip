// 필드명은 PRD 5단계를 그대로 쓴다. 데모의 localStorage 를 나중에 서버 DB 로 옮기는 것이 전제라
// 여기서 이름을 바꾸면 그만큼이 이관 비용이 된다.

export type Preferences = {
  tempo: "느긋" | "보통" | "빡빡";
  themes: string[];
  companion: "혼자" | "커플" | "친구" | "가족";
  budget: "저가" | "중가" | "고가";
};

export type Accommodation = { lat: number; lng: number; address: string };

export type TripSession = {
  session_id: string;
  created_at: string;
  preferences: Preferences;
  accommodation: Accommodation | null;
  dart_point: { lat: number; lng: number } | null;
  selected_region: { name: string; lat: number; lng: number } | null;
  status: "진행중" | "종료";
};

export type MissionStatus = "추천됨" | "진행중" | "완료" | "스킵됨";

export type Mission = {
  mission_id: string;
  session_id: string;
  /** Kakao place id. PRD 목록에는 없지만 재추천 때 이미 간 곳을 걸러내려면 이름 말고 id 가 필요하다 */
  place_id: string;
  place_name: string;
  lat: number;
  lng: number;
  category: string;
  recommend_reason: string;
  order_index: number;
  status: MissionStatus;
  /** IndexedDB 키. Blob 을 직접 넣으면 세션 JSON 이 localStorage 한도에 먼저 걸린다 */
  photo: string | null;
  verified_by: "exif" | "geolocation" | "manual" | null;
  completed_at: string | null;
};

/** 화면 위치. TripSession.status(진행중/종료)와는 별개다 (SDD 2장) */
export type Phase =
  | "home"
  | "onboarding"
  | "dart"
  | "region_select"
  | "recommending"
  | "mission_active"
  | "summary";

/**
 * 뒤로가기가 갈 곳. 없는 화면에서는 버튼을 숨긴다.
 * region_select 에서 dart 로 가면 던진 결과가 지워지므로 다시 던지거나 직접 고르면 된다.
 */
export const PREVIOUS_PHASE: Partial<Record<Phase, Phase>> = {
  onboarding: "home",
  dart: "onboarding",
  region_select: "dart",
  recommending: "region_select",
  mission_active: "recommending",
};

export const DEFAULT_PREFERENCES: Preferences = {
  tempo: "보통",
  themes: [],
  companion: "혼자",
  budget: "중가",
};

export const THEME_OPTIONS = ["자연", "맛집", "카페·감성", "액티비티", "역사문화"];

export function newSession(): TripSession {
  return {
    session_id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    preferences: DEFAULT_PREFERENCES,
    accommodation: null,
    dart_point: null,
    selected_region: null,
    status: "진행중",
  };
}

export function newMission(
  session_id: string,
  order_index: number,
  place: {
    place_id: string;
    place_name: string;
    lat: number;
    lng: number;
    category: string;
    recommend_reason: string;
  },
): Mission {
  return {
    mission_id: crypto.randomUUID(),
    session_id,
    ...place,
    order_index,
    status: "진행중",
    photo: null,
    verified_by: null,
    completed_at: null,
  };
}
