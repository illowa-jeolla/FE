# 수정 및 검증 보고서

대상: `Codex/illowa-jeolla-FE` / 2026-09-18

## 수정 파일

| 파일 | 변경 내용 |
|---|---|
| [feature-pages.css](/Users/ddd/Documents/Codex/illowa-jeolla-FE/--main/travel-workation/feature-pages.css) | 추천 입력 그룹의 상단 여백을 데스크톱 32px/모바일 20px 추가. 순위별 핑크 4단계 색상. 지도 모바일/태블릿 grid 행 충돌 보완. |
| [react-app/src/api/jobs.js](/Users/ddd/Documents/Codex/illowa-jeolla-FE/--main/travel-workation/react-app/src/api/jobs.js) | 실제 백엔드 계약에 맞춰 찜 취소를 DELETE /api/v1/jobs/favorites/{favoriteId}에 연결. 찜 요청의 완료 후 재사용 캐시를 0ms로 제한. POST 본문과 인증 처리 유지. |
| [react-app/src/hooks/useJobFavorites.js](/Users/ddd/Documents/Codex/illowa-jeolla-FE/--main/travel-workation/react-app/src/hooks/useJobFavorites.js) | 새 공통 찜 상태. 전체 페이지 조회, source+externalId 중복 방지, 즉시 상태 반영, 요청 잠금, 실패 복구, 지연 응답 무시, 계정별 상태 분리, 포커스 복귀 시 갱신. |
| [react-app/src/pages/JunnamJobDetailPage.jsx](/Users/ddd/Documents/Codex/illowa-jeolla-FE/--main/travel-workation/react-app/src/pages/JunnamJobDetailPage.jsx) | 찜하기/찜취소 문구와 하트 아이콘 토글. 기존 로그인 검사 및 저장 payload 유지. 저장 목록을 기준으로 초기 찜 상태 복원. |
| [react-app/src/pages/MyPage.jsx](/Users/ddd/Documents/Codex/illowa-jeolla-FE/--main/travel-workation/react-app/src/pages/MyPage.jsx) | 상세와 공유하는 찜 목록 및 개수 사용. 찜취소 버튼 추가. 기본 프로필과 로딩·오류·빈 상태에 캐릭터 적용. |
| [react-app/src/data/jeonnam.js](/Users/ddd/Documents/Codex/illowa-jeolla-FE/--main/travel-workation/react-app/src/data/jeonnam.js) | 전남 22개 시군 이름 정규화와 근무지 기반 지역 판별 함수. 전북·광주·불명확한 위치 제외. |
| [react-app/src/components/RegionIllustrationMap.jsx](/Users/ddd/Documents/Codex/illowa-jeolla-FE/--main/travel-workation/react-app/src/components/RegionIllustrationMap.jsx) | 전북/광주 도형 제거. 전남을 기준으로 viewBox 높이와 위치 조정. 기존 선택·확대·이동·초기화 이벤트 유지. |
| [react-app/src/pages/MapPage.jsx](/Users/ddd/Documents/Codex/illowa-jeolla-FE/--main/travel-workation/react-app/src/pages/MapPage.jsx) | 지역 선택지와 최초/추가 로딩 일자리의 전남 필터. 제외 지역 URL 정리. 필터로 한 페이지가 비어도 더보기 유지. 지도·로딩·빈 결과·오류 캐릭터 적용. |
| [react-app/src/components/BrandCharacter.jsx](/Users/ddd/Documents/Codex/illowa-jeolla-FE/--main/travel-workation/react-app/src/components/BrandCharacter.jsx) | 첨부 원본 이미지의 필요한 영역을 SVG viewBox/clipPath로 표시하는 공통 캐릭터. 역할별 고정 포즈와 장식용 접근성 처리. |
| [react-app/public/brand/character-sheet.png](/Users/ddd/Documents/Codex/illowa-jeolla-FE/--main/travel-workation/react-app/public/brand/character-sheet.png) | 사용자가 제공한 캐릭터 원본을 복사. 재생성·변형 없이 공통 이미지로 사용. |
| [react-app/src/styles/brand.css](/Users/ddd/Documents/Codex/illowa-jeolla-FE/--main/travel-workation/react-app/src/styles/brand.css) | 캐릭터 크기와 위치, 1.2초 로딩 애니메이션, 모션 감소 설정, 모바일 크기 및 찜 목록 버튼 배치. |
| [react-app/src/components/UI.jsx](/Users/ddd/Documents/Codex/illowa-jeolla-FE/--main/travel-workation/react-app/src/components/UI.jsx) | 공통 Status/EmptyCard에 로딩·오류·빈 상태 캐릭터 적용. 기존 상태 문구 유지. |
| [react-app/src/pages/AuthPage.jsx](/Users/ddd/Documents/Codex/illowa-jeolla-FE/--main/travel-workation/react-app/src/pages/AuthPage.jsx) | 메인 로고 옆 환영 캐릭터만 추가. 로그인·회원가입·OAuth·토큰 관련 함수는 변경하지 않음. |
| [react-app/src/pages/FirstVisitOnboarding.jsx](/Users/ddd/Documents/Codex/illowa-jeolla-FE/--main/travel-workation/react-app/src/pages/FirstVisitOnboarding.jsx) | 여행/머무름/일하기 소개 단계에 캐릭터 추가. 원래 문구·진행·건너뛰기·재생 로직 유지. |
| [react-app/src/pages/HomePage.jsx](/Users/ddd/Documents/Codex/illowa-jeolla-FE/--main/travel-workation/react-app/src/pages/HomePage.jsx) | 기능 카드의 장식 아이콘과 지도 일러스트를 역할별 캐릭터로 교체. 카드 문구와 링크 유지. |
| [react-app/src/pages/RecommendPage.jsx](/Users/ddd/Documents/Codex/illowa-jeolla-FE/--main/travel-workation/react-app/src/pages/RecommendPage.jsx) | 지역·숙소·출발/도착 장소 검색의 로딩 아이콘만 캐릭터로 교체. |
| [react-app/src/pages/LocalFitPage.jsx](/Users/ddd/Documents/Codex/illowa-jeolla-FE/--main/travel-workation/react-app/src/pages/LocalFitPage.jsx) | 분석 중 모달의 스피너를 로딩 캐릭터로 교체. 순위 선택/재선택/완료 데이터 로직 유지. |
| [react-app/src/pages/TravelGuidePage.jsx](/Users/ddd/Documents/Codex/illowa-jeolla-FE/--main/travel-workation/react-app/src/pages/TravelGuidePage.jsx) | 여행 가이드 생성/로딩 화면의 기존 장식 원형 아이콘을 로딩 캐릭터로 교체. |
| [react-app/src/main.jsx](/Users/ddd/Documents/Codex/illowa-jeolla-FE/--main/travel-workation/react-app/src/main.jsx) | 캐릭터 전용 스타일시트 로드. |
| [react-app/index.html](/Users/ddd/Documents/Codex/illowa-jeolla-FE/--main/travel-workation/react-app/index.html) | 기존 메인 캐릭터 로고를 favicon/apple-touch-icon으로 지정. |
| [react-app/tests/favorites-and-regions.test.mjs](/Users/ddd/Documents/Codex/illowa-jeolla-FE/--main/travel-workation/react-app/tests/favorites-and-regions.test.mjs) | 찜 토글·중복 클릭·실패 복구·페이지네이션·지연 응답·계정 변경·지역 필터·API 계약 자동 테스트 11개. |

이 보고서 자체: `WORK_REPORT.md`. 작업 시작 전에 존재하던 `styles.css`, `auth.css`, `SiteLayout.jsx`, 메인 로고 PNG 등의 변경은 보존했으며 이번 작업에서 추가 수정하지 않았다. `AuthPage.jsx`, `FirstVisitOnboarding.jsx`는 기존 수정본 위에 이미지 마크업만 추가했다.

## 검증 결과

| 항목 | 결과 |
|---|---|
| 실제 찜 등록 → 취소 → 재등록 | 통과. 로그인된 localhost 화면과 실제 백엔드에서 확인. |
| 상세 ↔ 마이페이지 동기화 | 통과. 새로고침 없이 목록·개수 갱신, 상세 재방문 상태 복원, 마이페이지 취소 확인. |
| 테스트 데이터 정리 | 테스트에 사용한 공고의 찜을 취소해 작업 전 저장 목록으로 복구. 원래 찜은 유지. |
| 중복/실패/지연/페이지네이션 | 자동 테스트 통과. 느린 요청 중 반복 클릭은 한 요청, 실패 시 복구, 늦은 GET이 새 상태를 덮지 않음, 20개 이후 저장 항목 조회. |
| 추천 입력 영역 | 데스크톱 32px/모바일 20px 상단 여백 확인. 제목·설명·배경·추천 버튼 디자인 유지. |
| 기존 추천 입력 | 모바일 지역 선택, 날짜 구간 선택/적용, 테마/동행 선택 확인. |
| 전남 지도 | 22개 시군 확인. 전북 및 광주 도형 없음. 화순 선택·공고 연결·확대·초기화 확인. |
| 전북 검색/선택지 | 전주 입력 시 선택지 없음, 전남 22개+전체만 표시, 제목 검색 빈 결과 확인. 제외 지역 직접 URL도 전체 전남 보기로 정리. |
| 반응형 | 1440×900 데스크톱, 375×812 모바일에서 주요 화면 확인. 812×375 가로 화면의 지도/추천도 가로 넘침 없음. |
| 순위 모달 | 4가지 배경색·동일 카드 크기 확인. 4개 선택, 다시 선택, 역순 재선택, 완료 후 요약 반영 확인. |
| 캐릭터 | 로그인 웹/모바일, 홈 카드, 지도 안내, 검색 빈 결과, 마이페이지 프로필 표시 확인. 역할별 공통 포즈 적용. |
| 로그인/인증 | 기존 세션으로 찜·목록 API 정상 수행. 별도 탭에서 로그인 UI 확인. OAuth 신규 로그인 자체는 재실행하지 않음. 인증/토큰/세션 모듈 변경 없음. |
| 빌드 / diff | 프로덕션 빌드 및 git diff --check 통과. |

## 확인된 기존 문제와 제한

- 기존 찜 취소 함수는 실제 서버의 favoriteId 계약과 다른 경로를 사용하고 있었다. [JobFavoriteController](https://github.com/illowa-jeolla/BE/blob/develop/src/main/java/com/example/travel/domain/job/controller/JobFavoriteController.java)를 확인하고 실제 서버에서 취소 성공을 검증해 수정했다. 백엔드 API를 변경하거나 새로 만들지 않았다.
- 기존 지도 CSS의 고정 grid-row 때문에 모바일에 3개의 좁은 열이 생겼다. 모바일은 세로 배치, 태블릿은 목록을 다음 행에 놓도록 보완했다.
- 현재 환경은 카카오 지도 JavaScript 키가 설정되지 않아 일자리 상세의 카카오 지도와 장소 검색의 전체 성공 흐름을 검증할 수 없다. 기존 안내 및 카카오맵 외부 링크는 유지했다.
- 빌드에 기존 이미지 경로 2개(/assets/jeonnam-workation-hero.png, /assets/jeolla-region-map.png)의 런타임 해석 경고와 500kB 초과 JS 청크 경고가 남는다. 이번 수정 범위에서 번들/자산 구조를 재편하지 않았다.
- 캐릭터는 원본 이미지에서 영역을 잘라 표시하는 방식이며 별도 AI 생성본을 사용하지 않았다. 실제 관광지/공고/사용자 사진과 입력·닫기·검색·OAuth 같은 기능 식별 아이콘은 유지했다.
- 배포·커밋은 수행하지 않았다. 기존 개발 서버에서 변경이 반영되어 있다.

## 테스트 재실행

프로젝트의 `--main/travel-workation/react-app`에서 실행:

```sh
node --experimental-vm-modules --test tests/favorites-and-regions.test.mjs
npm run build
```

자동 테스트 11개 통과. VM Modules의 experimental 경고는 테스트용 Node VM 실행 옵션에서 발생한다.
