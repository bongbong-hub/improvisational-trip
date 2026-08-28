// 튜닝 상수는 전부 여기 모은다. 호출부에 숫자를 직접 쓰지 않는다 (SDD 7장).
// PRD 오픈 이슈로 남은 값들은 실제 API 응답을 보고 조정해야 한다 — 아래 주석의 O번호 참고.

/**
 * 다트가 떨어지는 범위: 경기도와 그 안의 서울·인천을 감싸는 근사 bounding box.
 * 사각형이라 서해와 접경지도 함께 들어온다 — 그런 자리에는 갈 만한 곳이 없어
 * 후보가 비므로, 던지는 쪽에서 DART_MAX_TRIES 만큼 다시 던진다 (O4).
 */
export const DEMO_BBOX = {
  minLat: 36.9,
  maxLat: 38.3,
  minLng: 126.3,
  maxLng: 127.9,
} as const;

export const DEMO_AREA_LABEL = "경기·서울";

/** 바다·접경지에 연달아 꽂혔을 때 포기하는 횟수. 사용자를 무한정 기다리게 두지 않는다 */
export const DART_MAX_TRIES = 6;

/**
 * 여행 범위 단위별 상수 (O1).
 * sampleRadiusM 이 좁으면 넓은 단위에서 후보가 한두 개로 줄고, 넓으면 엉뚱한 시·도까지 끌어온다.
 * poiRadiusM 은 지역끼리 밀도를 견주는 자로만 쓰이므로 단위 안에서만 일관되면 된다.
 */
export const REGION_SCOPES = {
  // 20000 은 Kakao 카테고리 검색의 최대 반경이다. 더 좁히면 표본이 바다·산에 떨어진 지역이
  // POI 몇 개로 잡혀 순위가 뒤집힌다
  광역: { sampleRadiusM: 60000, poiRadiusM: 20000 },
  기초: { sampleRadiusM: 15000, poiRadiusM: 5000 },
  읍면동: { sampleRadiusM: 5000, poiRadiusM: 1000 },
} as const;

export type RegionScope = keyof typeof REGION_SCOPES;

/** 읍면동은 하루 여행에 너무 좁고 광역은 너무 넓다. 시·군·구를 기본으로 둔다 */
export const DEFAULT_SCOPE: RegionScope = "기초";

/** 거리가중치 감쇠의 반감기 — 이 거리마다 가중치가 절반이 된다 (O1) */
export const DISTANCE_HALFLIFE_M = 2000;

/** 다트 주변에서 역지오코딩할 표본 점 개수. 늘리면 지역 다양성이 오르고 API 호출도 는다 */
export const REGION_SAMPLE_COUNT = 12;

/** 사용자에게 제시할 지역 카드 최대 개수 (PRD 3단계: 최소 1, 최대 3) */
export const MAX_REGION_CANDIDATES = 3;

/** 지역 POI 밀도를 셀 때 세는 카테고리 — 관광명소·음식점·카페 (O1) */
export const POI_CATEGORY_CODES = ["AT4", "FD6", "CE7"] as const;

/** 추천 후보를 찾는 반경. 이동수단 가정이 확정되면 바뀐다 (O5) */
export const SEARCH_RADIUS_M = 2000;

/**
 * 위 반경 안이 비었을 때 한 번만 넓혀 보는 반경.
 * 여행이 길어져 근처를 다 돌았거나, 지역 대표 좌표가 드물게 한적한 곳일 때를 위한 안전망이다.
 */
export const SEARCH_RADIUS_FALLBACK_M = 6000;

/** 사진 인증 통과 거리. 실기기 GPS 오차 테스트 후 확정 (O2) */
export const VERIFY_THRESHOLD_M = 200;

/** 추천 후보를 모으는 카테고리 — 관광명소·문화시설·음식점·카페 */
export const RECOMMEND_CATEGORY_CODES = ["AT4", "CT1", "FD6", "CE7"] as const;

/** 숙소가 있을 때 숙소 인근에서 끌어와 후보군에 섞는 개수 */
export const LODGING_BIAS_COUNT = 5;

/** 한 번에 사용자에게 보여주는 추천 개수. 전체 코스를 노출하지 않는 것이 제품의 핵심이다 */
export const PICK_COUNT = 2;

/** 도보 속도(m/분). 예상 이동시간 표시용이고 실제 경로탐색은 하지 않는다 (O5) */
export const WALK_SPEED_M_PER_MIN = 70;

/** 프롬프트에 싣는 후보 개수 상한. 후보 수에 비례해 토큰이 늘기 때문에 자른다 */
export const LLM_CANDIDATE_LIMIT = 20;

export const LLM_TIMEOUT_MS = 8000;
