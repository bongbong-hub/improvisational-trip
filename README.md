# GMG (가면가) — 데모

남한 지도의 경기·서울에 다트를 던지거나 전국 아무 곳이나 직접 골라 지역을 정하고, 한 번에 1~2곳씩만 추천받아 도착 사진으로 인증하면 다음 장소가 열리는 여행 앱.

기획은 `PRD_개발단계별.txt` / `PRD_기능모듈별.txt`, 설계는 `SDD.md`, 작업 규칙은 `CLAUDE.md`.

## 실행

```bash
npm install
npm run dev        # http://localhost:3001
npm test           # lib/domain 순수 함수 검증
npm run lint
npm run build
```

개발 서버만 3001 로 고정해 두었다. `npm start` 는 호스팅이 주는 `PORT` 를 따른다.
지도는 외부 SDK 가 아니라 직접 그리므로 도메인 등록이 필요 없다.

## 환경 변수

`.env` 에 넣는다(`.gitignore` 의 `.env*` 로 제외된다). 형식은 `.env.local.example` 참고.

| 키 | 사용처 |
|---|---|
| `KAKAO_REST_API_KEY` | `lib/clients/kakao.ts` |
| `OPENROUTER_API_KEY` | `lib/clients/llm.ts` |
| `OPENROUTER_MODEL_PROD` | 추천에 쓰는 모델. **기본값** |
| `OPENROUTER_MODEL_DEMO` | 무료 라우팅. 응답이 17초쯤 걸려 타임아웃 폴백만 타므로 현재는 예비용 |

넷 다 서버 전용이다. `NEXT_PUBLIC_` 접두사를 붙이면 클라이언트 번들에 실려 유출된다.

## 배포

**GitHub Pages 로는 배포할 수 없다.** 정적 파일만 서빙하는데 이 앱은 `/api/regions`,
`/api/recommend`, `/api/geocode` 가 서버에서 돌아야 하고 거기서 키를 쓴다. 정적으로 내보내려면
키를 브라우저로 옮겨야 하는데 저장소가 공개라 그대로 노출된다.

Next.js 를 그대로 받는 곳에 올린다. Vercel 기준:

1. https://vercel.com 에 GitHub 계정으로 로그인
2. **Add New → Project** → 이 저장소 **Import**
3. 프레임워크는 Next.js 로 자동 인식된다. 빌드 설정은 건드릴 것이 없다
4. **Environment Variables** 에 위 표의 네 개를 등록 (Production·Preview 양쪽)
5. **Deploy**

이후 `main` 에 push 할 때마다 자동으로 다시 배포된다.

Cloudflare Pages·Netlify 도 되지만 Next.js 어댑터 설정이 따로 필요하다.
Node 를 그대로 돌리는 곳(Railway 등)이라면 `npm run build` 후 `npm start` 면 된다 —
포트는 호스팅이 주는 `PORT` 를 따른다.

## 구현 상태

M1~M7 구현 완료. 남은 것:

- 실기기(iOS/Android) 통합 테스트 — 카메라 촬영 경로는 데스크톱에서 검증할 수 없다
- 남한 외곽선은 손으로 찍은 근사치다. 정밀한 경계가 필요하면 GeoJSON 을 받아 다시 뽑는다
- 현재 위치 기준 거리(PRD 4-7) — Geolocation 권한이 필요해 실기기 단계로 미뤘다. `SDD.md` 7장 참고
- `lib/config.ts` 의 튜닝 상수 — PRD 오픈 이슈 O1·O2·O5 가 그대로 남아 있다
