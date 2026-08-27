# 다트 트립 (데모)

지도에 다트를 던져 지역을 정하고, 한 번에 1~2곳씩만 추천받아 도착 사진으로 인증하면 다음 장소가 열리는 여행 앱.

기획은 `PRD_개발단계별.txt` / `PRD_기능모듈별.txt`, 설계는 `SDD.md`, 작업 규칙은 `CLAUDE.md`.

## 실행

```bash
npm install
npm run dev        # http://localhost:3001
npm test           # lib/domain 순수 함수 검증
npm run lint
npm run build
```

포트가 3001 로 고정돼 있다. Kakao JS SDK 는 콘솔에 등록된 도메인에서만 로드되므로, 포트를 바꾸면
[Kakao Developers](https://developers.kakao.com) → 내 애플리케이션 → 앱 설정 → 플랫폼 → Web 에
그 주소를 등록해야 한다. 등록되지 않은 주소에서는 SDK 가 401 을 돌려주고 지도가 뜨지 않는다.

## 환경 변수

`.env` 에 넣는다(`.gitignore` 의 `.env*` 로 제외된다). 형식은 `.env.local.example` 참고.

| 키 | 사용처 |
|---|---|
| `NEXT_PUBLIC_KAKAO_JS_KEY` | 브라우저. 지도 SDK. 도메인 제한을 걸어둔다 |
| `KAKAO_REST_API_KEY` | 서버 전용. `lib/clients/kakao.ts` |
| `OPENROUTER_API_KEY` | 서버 전용. `lib/clients/llm.ts` |
| `OPENROUTER_MODEL_PROD` | 추천에 쓰는 모델. **기본값** |
| `OPENROUTER_MODEL_DEMO` | 무료 라우팅. 응답이 17초쯤 걸려 타임아웃 폴백만 타므로 현재는 예비용 |

서버 전용 키는 API Route 안에서만 읽는다. `NEXT_PUBLIC_` 없는 변수는 클라이언트 번들에 들어가지 않는다.

## 구현 상태

M1~M7 구현 완료. 남은 것:

- 실기기(iOS/Android) 통합 테스트 — 카메라 촬영과 EXIF GPS 경로는 데스크톱에서 검증할 수 없다
- `lib/config.ts` 의 튜닝 상수 — PRD 오픈 이슈 O1·O2·O5 가 그대로 남아 있다
