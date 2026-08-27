// Kakao Local REST 래퍼. 서버에서만 import 한다 (SDD 1장) — REST 키가 번들에 실리면 안 된다.
import type { Point } from "../domain/geo.ts";

const BASE = "https://dapi.kakao.com/v2/local";

/** 모듈 로드 시점이 아니라 호출 시점에 읽는다. 키가 없어도 빌드는 통과해야 한다 */
function authHeader(): Record<string, string> {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) throw new Error("KAKAO_REST_API_KEY 가 설정되지 않았습니다.");
  return { Authorization: `KakaoAK ${key}` };
}

async function get<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const query = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  );
  const res = await fetch(`${BASE}${path}?${query}`, { headers: authHeader() });
  if (!res.ok) {
    throw new Error(`Kakao ${path} ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export type KakaoRegion = { name: string; lat: number; lng: number };

type RegionCodeResponse = {
  documents: {
    region_type: "B" | "H";
    region_2depth_name: string;
    region_3depth_name: string;
    x: string;
    y: string;
  }[];
};

/**
 * 좌표를 행정동으로 바꾼다. region_type 이 B(법정동)/H(행정동) 둘 다 오므로 H 를 쓴다 —
 * 사용자에게 보여줄 지역명은 행정동 쪽이 실제 생활권에 가깝다.
 */
export async function coord2region(point: Point): Promise<KakaoRegion | null> {
  const data = await get<RegionCodeResponse>("/geo/coord2regioncode.json", {
    x: point.lng,
    y: point.lat,
  });
  const doc = data.documents.find((d) => d.region_type === "H") ?? data.documents[0];
  if (!doc || !doc.region_3depth_name) return null;
  return {
    name: `${doc.region_2depth_name} ${doc.region_3depth_name}`,
    lat: Number(doc.y),
    lng: Number(doc.x),
  };
}

export type KakaoPlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  address: string;
  distanceM: number | null;
};

type PlaceDocument = {
  id: string;
  place_name: string;
  category_group_name: string;
  category_name: string;
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
  distance?: string;
};

function toPlace(doc: PlaceDocument): KakaoPlace {
  return {
    id: doc.id,
    name: doc.place_name,
    lat: Number(doc.y),
    lng: Number(doc.x),
    // category_group_name 은 빈 문자열로 오는 경우가 흔하다. 세부 분류를 폴백으로 쓴다
    category: doc.category_group_name || doc.category_name.split(">").pop()!.trim(),
    address: doc.road_address_name || doc.address_name,
    distanceM: doc.distance ? Number(doc.distance) : null,
  };
}

/** 주소·건물명·상호를 가리지 않고 찾는다. 숙소 입력에서 쓴다 */
export async function searchKeyword(query: string, size = 5): Promise<KakaoPlace[]> {
  const data = await get<{ documents: PlaceDocument[] }>("/search/keyword.json", { query, size });
  return data.documents.map(toPlace);
}

/** 카테고리별 주변 검색. 추천 후보를 모을 때 쓴다 */
export async function searchNearby(
  center: Point,
  radiusM: number,
  categoryCode: string,
  size = 15,
): Promise<KakaoPlace[]> {
  const data = await get<{ documents: PlaceDocument[] }>("/search/category.json", {
    category_group_code: categoryCode,
    x: center.lng,
    y: center.lat,
    radius: radiusM,
    size,
    sort: "distance",
  });
  return data.documents.map(toPlace);
}

type CategorySearchResponse = { meta: { total_count: number } };

/** size=1 로 요청해도 meta.total_count 는 전체 개수라 문서 본문을 받을 필요가 없다 */
export async function countPoisNear(
  point: Point,
  radiusM: number,
  categoryCode: string,
): Promise<number> {
  const data = await get<CategorySearchResponse>("/search/category.json", {
    category_group_code: categoryCode,
    x: point.lng,
    y: point.lat,
    radius: radiusM,
    size: 1,
  });
  return data.meta.total_count;
}
