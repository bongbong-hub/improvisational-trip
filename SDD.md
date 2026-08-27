# SDD — GMG(가면가) 데모

PRD 는 무엇을·왜, CLAUDE.md 는 작업 규칙, 이 문서는 **어떻게**만 다룬다. 중복되는 내용은 여기 없다.

## 1. 파일 경계

```
app/
  page.tsx                 단일 페이지. 홈과 phase 로 화면 전환
  api/regions/route.ts     다트 좌표 → 지역 후보
  api/recommend/route.ts   추천 엔진. 첫 추천·다음 추천·스킵이 모두 이 하나
  api/geocode/route.ts     숙소 주소·상호 → 좌표
lib/
  domain/                  순수 함수. 네트워크·브라우저 API 의존 없음
    scoring.ts             POI 밀도 × 거리가중치
    geo.ts                 haversine, 인증 거리 판정
    session.ts             TripSession·Mission 타입과 생성자, phase 와 뒤로가기 표
    korea.ts               남한 외곽선 좌표와 위경도↔SVG 투영
    recommend.ts           프롬프트 구성, LLM 응답 검증, 폴백
  clients/
    kakao.ts               Local REST 래퍼
    llm.ts                 OpenRouter 래퍼
  storage/
    session-store.ts       localStorage
    photo-store.ts         IndexedDB
  config.ts                튜닝 상수 전부
components/
  Home.tsx                 GMG 홈. 지난 여행, 위시리스트 진입
  KoreaMap.tsx             남한 SVG, 다트 낙하, 직접 고르기 클릭
  Menu.tsx                 햄버거. 위시리스트, 숙소 등록
  Setup.tsx                취향 설문, 숙소 검색
  Mission.tsx              추천 카드, 미션 인증·위시리스트 담기
  Summary.tsx              기록 타임라인, 캡션 오버레이 저장
```

**레이어 규칙 (단방향)**

- `domain` 은 `config.ts` 말고는 아무것도 import 하지 않는다. 여기만 단위 검증이 쉬워야 한다.
- `clients` 는 서버에서만 import 한다. `components` 가 import 하면 REST 키가 번들에 실린다.
- `components` → `storage` · `domain` 만 허용.
- Kakao 는 REST 키 하나만 쓴다. 지도는 외부 SDK 가 아니라 `korea.ts` 의 좌표로 직접 그린다 — 사용자가 확대·이동할 수 없어야 다트와 과녁이 성립한다.

## 2. phase 상태 머신

```
home → onboarding → dart → region_select
  → recommending → mission_active
       ├ 인증 성공 → recommending
       ├ 위시리스트 담기 → recommending
       └ 여행 종료 → summary → (기록으로 옮기고) home
```

홈은 phase 가 아니라 별도 상태다 — 언제든 들렀다 하던 화면으로 돌아온다. 뒤로가기는 `PREVIOUS_PHASE` 한 단계씩이고, 여행이 시작된 뒤에는 지역을 되돌릴 수 없다. 숙소는 순서에서 빠지고 메뉴에서 아무 때나 등록한다 — 등록 시점부터 추천에 반영된다. phase 는 `TripSession.status` 와 별개다 — status 는 진행중/종료 둘뿐이고, phase 는 화면 위치다.

## 3. API 계약

세 route 모두 **무상태**다. 세션 상태는 클라이언트가 매 호출마다 실어 보낸다. 서버 DB 가 붙어도 route 시그니처는 그대로 두고 내부만 바꾼다.

```
POST /api/regions
  { dart: {lat,lng} }
→ { regions: [{ name, lat, lng, poiCount }] }              // 표본에서 나온 행정동 전체

POST /api/recommend
  { region, preferences, current: {lat,lng},
    history: [{ name, category }],
    accommodation: {lat,lng} | null,
    exclude: string[] }                                    // 완료·스킵된 place id
→ { places: [{ id, name, lat, lng, category, address, reason, distanceM, etaMin }],
    fallback?: true }                                      // 1~2개

POST /api/geocode
  { query: string }                                        // 숙소 이름이나 주소
→ { places: [{ id, name, lat, lng, category, address, distanceM }] }
```

슬라이더를 움직일 때마다 `/api/regions` 를 다시 부르지 않는다. **점수 계산과 상위 3개 자르기는 서버가 하지 않는다** — 응답에 후보 전체와 각 `poiCount` 를 받아두고 `domain/scoring.ts` 로 클라이언트에서 재정렬한다.

## 4. 추천 파이프라인 (`/api/recommend` 내부)

1. `kakao.searchNearby()` 를 카테고리별로 호출, 반경은 `config.SEARCH_RADIUS_M`
2. place id 로 중복 제거 → `exclude` 에 있는 것 제거
3. 숙소가 있으면 숙소 방향 후보를 `config.LODGING_BIAS_COUNT` 개만큼 병합
4. 상위 `config.LLM_CANDIDATE_LIMIT` 개만 프롬프트에 싣는다 (전부 실으면 토큰이 후보 수에 비례해 늘어난다)
5. LLM 호출 → JSON
6. **검증**: 반환된 id 가 4번 후보 목록에 실재하는지 대조

**LLM 은 장소를 만들지 않고 고르기만 한다.**

```
요청  후보 목록 [{id, name, category, distanceM}] + 취향 + 이력
응답  { "picks": [ { "id": "...", "reason": "..." } ] }
```

이름·좌표·카테고리는 서버가 후보에서 채운다. LLM 이 좌표를 지어내면 지도에 찍히지 않고, 이름만 받으면 후보와 대조할 수가 없다.

## 5. 실패 처리 등급

| 실패 | 처리 |
|---|---|
| Kakao API | 즉시 실패 노출. 후보가 없으면 추천 자체가 성립하지 않는다 |
| LLM 호출·타임아웃(`config.LLM_TIMEOUT_MS`) | 거리순 상위 2개로 폴백, reason 은 템플릿 문장. 여행 루프가 끊기면 안 된다 |
| LLM 응답이 후보에 없는 id 반환 | 폐기 후 위와 같은 폴백. 재시도하지 않는다 |

## 6. 저장

- localStorage 키는 둘이다. `trip:session` 은 진행 중인 여행 하나, `trip:history` 는 끝난 여행 배열. 둘 다 `{ session, missions, phase }` 봉투에 담는다 — `session`·`missions` 는 PRD 필드명 그대로라 서버 DB 로 옮길 때 떼어내면 된다.
- 위시리스트는 별도 저장소가 아니다. 진행 중 여행과 지난 여행에서 `status` 가 `스킵됨` 인 Mission 을 모아 보여준다.
- 쓰기는 **phase 전이 시점에만**. 설문 항목을 고를 때마다 쓰지 않는다.
- 사진 원본은 IndexedDB `trip` / store `photos`, key 는 `mission_id`, value 는 Blob.
- `Mission.photo` 에는 Blob 이 아니라 그 IndexedDB 키를 넣는다. 세션 JSON 이 커지면 localStorage 한도에 먼저 걸린다.
- 복원 시 세션 JSON 만 읽는다. 사진은 summary 화면에서 필요할 때 꺼낸다.

## 7. 튜닝 상수 위치

전부 `lib/config.ts` 에 모은다. PRD 의 오픈 이슈가 여기로 내려온다.

| 상수 | 관련 이슈 |
|---|---|
| `DART_SEARCH_RADIUS_M`, `DISTANCE_HALFLIFE_M`, `POI_CATEGORY_CODES`, `POI_COUNT_RADIUS_M` | O1 (밀도×거리 산식) |
| `VERIFY_THRESHOLD_M` | O2 (인증 임계 거리) |
| `SEARCH_RADIUS_M` | O5 (이동수단 가정) |
| `LLM_CANDIDATE_LIMIT`, `LLM_TIMEOUT_MS` | 토큰·지연 예산 |

값을 바꿀 일이 생기면 이 파일만 고친다. 호출부에 숫자를 직접 쓰지 않는다.
