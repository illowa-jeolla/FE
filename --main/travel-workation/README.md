# 일로와전라 관광·일자리 서비스

전라도 관광 일자리 추천 서비스입니다. 사용자 화면은 React와 React Router로 구성하고, Node.js 서버가 API와 SQLite 데이터를 제공합니다.

## 실행

Node.js 24 이상에서 아래 명령을 실행하면 프론트엔드와 DB 서버가 함께 시작됩니다.

```text
node server.js
```

OpenAI 연동을 사용하려면 프로젝트의 `.env.example`을 `.env`로 복사한 뒤 새로 발급한 키를 `OPENAI_API_KEY`에 설정하세요. 키는 브라우저 코드나 Git에 포함되지 않습니다.

React 앱을 빌드한 뒤 브라우저에서 `http://localhost:8080`을 열면 `/app/`으로 이동합니다.

## React 프론트 개발

기존 Express API를 실행한 상태에서 별도 터미널로 React 개발 서버를 실행합니다.

```bash
cd react-app
pnpm install
pnpm dev
```

React 전체 화면은 `http://localhost:5173/app/`에서 확인합니다. `/api`와 `/assets` 요청은 Vite가 `http://localhost:8080`으로 전달합니다.

프로덕션 빌드는 `react-dist`에 생성되며 기존 Node 서버의 `http://localhost:8080/app/`에서 제공됩니다.

```bash
cd react-app
pnpm build
```

팀 로그인 API를 사용할 때는 `react-app/.env.example`을 `.env`로 복사하고 `VITE_AUTH_API_ORIGIN`을 설정한 뒤 `VITE_AUTH_API_ENABLED=true`로 변경합니다.

## Vercel 배포

Vercel에서 저장소를 연결한 뒤 Root Directory를 `--main/travel-workation`으로 지정합니다. 환경변수에는 최소한 아래 값을 등록합니다.

```text
VITE_KAKAO_MAP_JAVASCRIPT_KEY=카카오 JavaScript 키
VITE_API_BASE_URL=https://백엔드-배포-주소
```

로그인 API를 활성화할 때는 `VITE_AUTH_API_ENABLED=true`, `VITE_AUTH_API_ORIGIN`, `VITE_AUTH_API_BASE_PATH=/api/v1`도 등록합니다. 발급된 Vercel 도메인은 카카오 Developers의 JavaScript SDK 도메인과 백엔드 CORS 허용 목록에 추가합니다.

## 파일

- `react-app/src/App.jsx`: 전체 React 라우트
- `react-app/src/pages`: 홈, 인증, 검색, 여행 추천, 지도·일자리, AI 매칭, 커뮤니티, 게더링, 마이페이지
- `react-app/src/components`: 공통 헤더, 카드, 상태, 모달 UI
- `react-app/src/api`: API 요청과 인증 헤더 처리
- `react-app/src/styles/app.css`: 데스크톱 및 모바일 반응형 스타일
- `server.js`: 정적 파일, 인증, 관광지, 지역 분석, 일자리 API와 SQLite DB
- `assets/jeonnam-workation-hero.png`: 전남 워케이션 메인 이미지

기존 HTML/CSS/JavaScript 파일은 전환 비교와 데이터 확인을 위해 남겨두었으며 기본 사용자 화면에는 사용하지 않습니다.

## 주요 동작

- 달력에서 출발일과 도착일을 선택하면 `당일`, `1주`, `1개월` 검색 기준으로 자동 변환
- `지도에서 찾기`를 누르면 별도 지도 페이지로 이동
- 전라도 지도에서 지역을 누르면 해당 지역의 DB 일자리를 즉시 조회
- 선택 조건을 백엔드 API 쿼리로 전달
- DB 조회 결과만 일자리 카드로 표시
- DB 검색량을 기준으로 인기 관광지 표시
- 테마, 교통, 동행 유형 체크박스로 DB 관광지를 추천하고 최대 2회 재추천
- DB에 등록된 방문자, 검색량, 평균 체류 기간과 실제 일자리 수 표시
- 다녀온 여행을 네 가지 지표로 기록하고 로컬 핏 점수를 100점으로 환산
- 행사·축제·팝업 단기 일자리를 우선 조회하고 없으면 일반 공고 표시
- 지역별 최근 24시간 여행 게시글, 사진, 댓글 제공
- 즉석 게더링 생성과 정원 내 참여 제공
- DB의 지역 수, 일자리 수, 평균 평점을 메인 화면에 표시
- 회원 비밀번호는 scrypt 해시로 저장

## 백엔드 API 규격

프론트엔드는 다음 API를 호출합니다.

```text
GET /api/stats
GET /api/destinations/trending?limit=6
POST /api/destinations/recommend
GET /api/regions/analysis?region=여수
POST /api/courses/recommend
GET, POST /api/local-fit
GET /api/jobs/recommend?source=local-fit
GET /api/jobs/recommend?source=region&region=여수
GET, POST /api/posts
GET, POST /api/posts/:id/comments
GET, POST /api/gatherings
POST /api/gatherings/:id/join
POST /api/auth/register
POST /api/auth/login
GET /api/search?q=여수
```

```text
GET /api/jobs?region=여수&duration=당일&workType=원격%20근무&time=오전
```

응답은 배열 또는 `jobs`, `content` 배열을 포함하는 객체를 지원합니다.

```json
[
  {
    "id": 1,
    "category": "관광 콘텐츠",
    "title": "공고 제목",
    "companyName": "회사명",
    "workType": "원격 근무",
    "workTime": "오전",
    "duration": "당일",
    "location": "여수시",
    "pay": "급여 정보",
    "detailUrl": "/jobs/1",
    "rating": 4.5
  }
]
```

맞춤 코스 요청 본문 예시는 다음과 같습니다.

```json
{
  "region": "여수",
  "duration": "당일",
  "interest": "바다",
  "transport": "대중교통"
}
```

DB 파일은 최초 실행 시 `data/workation.db`에 생성됩니다. 관광지와 일자리 샘플 데이터는 자동으로 만들지 않습니다. 등록된 데이터가 없으면 화면에도 `등록된 데이터 없음`으로 표시됩니다. 사용자 기록, 게시글, 댓글, 게더링은 로그인 토큰과 사용자 ID를 기준으로 DB에 저장됩니다.
