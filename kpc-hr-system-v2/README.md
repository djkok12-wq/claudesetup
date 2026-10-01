# KPC HR SYSTEM v2 — 엔터프라이즈 성과평가 플랫폼

`manual.html`(성과평가 매뉴얼)의 규칙을 그대로 구현하고, 화면과 구조는 처음부터 새로 만든 버전입니다.
FastAPI + SQLite 백엔드에 빌드 과정이 없는 ES Module 프론트엔드를 붙였고, 외부 라이브러리는 `web/vendor`에 넣어 두어 CDN 없이(사내망·오프라인에서도) 동작합니다.

## 1. 빠른 시작 (Windows · 원클릭 설치)

1. 받은 `kpc-hr-system-v2.zip`을 우클릭 → **속성 → 차단 해제** 체크 → 확인 (인터넷에서 받은 파일 경고 방지)
2. `C:\Users\USER\Desktop\.claude` 폴더에 압축을 풉니다 → `C:\Users\USER\Desktop\.claude\kpc-hr-system-v2\`
3. 그 안의 **`SETUP_WINDOWS.bat`** 을 더블클릭합니다 (“Windows의 PC 보호” 창이 뜨면 *추가 정보 → 실행*).
   - Python 3.10+ 확인(없으면 winget으로 자동 설치) → 가상환경·패키지 설치
   - **시작프로그램 등록** → 재부팅 후 로그인하면 서버가 창 없이 자동 실행
   - 바탕화면에 **KPC HR SYSTEM** 바로가기 생성 → 브라우저로 http://localhost:8000 열림

| 파일 | 용도 |
|---|---|
| `SETUP_WINDOWS.bat` | 최초 설치·업데이트 후 재설치 (여러 번 실행해도 안전) |
| `START.bat` | 서버 수동 실행 + 브라우저 열기 |
| `STOP.bat` | 서버 종료 |
| `server.log` | 자동 실행 시 서버 로그 (문제 생기면 확인) |

자동 실행을 끄려면 `Win+R` → `shell:startup` → `KPC HR SYSTEM Server` 바로가기를 지우면 됩니다. 데이터는 `data\kpc_hr.db`에 저장되어 재부팅 후에도 그대로 남습니다.

수동으로 실행하고 싶다면 다음과 같이 합니다.

```powershell
cd C:\Users\USER\Desktop\.claude\kpc-hr-system-v2
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

| 역할 | 로그인(이메일) | 비밀번호 | 첫 화면 |
|---|---|---|---|
| 관리자(HR) | admin@kpc.demo | demo1234! | `/app/admin` |
| 평가자(팀장) | leader@kpc.demo | demo1234! | `/app/review` |
| 2차 평가자(본부장) | director@kpc.demo | demo1234! | `/app/review` |
| 피평가자(대리) | member@kpc.demo | demo1234! | `/app/me` |

- 로그인 화면의 데모 버튼을 누르면 바로 들어갈 수 있습니다. 다른 구성원은 사번(`KPC0005` 등)과 같은 비밀번호로 로그인합니다.
- 데이터를 처음 상태로 되돌리려면 `python -m app.seed`를 실행하거나, 관리자 화면 **UI 스튜디오 → 브랜드·시스템 → 데모 데이터 초기화**를 누릅니다.

## 2. 페이지 구성 (역할별 분리)

| 경로 | 대상 | 주요 화면 |
|---|---|---|
| `/login` | 전체 | Three.js 3D 조직 네트워크 씬, 데모 계정 원클릭 로그인, 로그인 5회 실패 시 잠금 |
| `/app/me` | 피평가자 | 홈 대시보드, 목표 설정(SMART 실시간 점검·가중치 링·드래그 정렬), 실적·자기평가(자동 저장), 다면평가 작성, 결과(3D 플립 공개·산정 근거), 칭찬 |
| `/app/review` | 평가자 | 홈, 목표 승인(승인·수정 요청·반려), 평가 리뷰(1차 작성 워크스페이스 + 실시간 산정, 2차 검토·±10 조정, 재작성 요청), 팀 분포 |
| `/app/admin` | 관리자 | 성과 홈(조치 필요 카드), 평가 주기·단계 전환·규칙·항목, 평가 관계 드래그 보드, 조직·KPI 트리, 다면평가 관리, 조정·확정 등급 보드, 집계현황, 사용자·계정 일괄 발급, 재작성 요청, **UI 스튜디오**, 공지, 감사 로그 |
| `/manual` | 전체(공개) | 인터랙티브 매뉴얼: 역할 필터, 검색, 점수 시뮬레이터, 인쇄·PDF |

평가자이면서 피평가자인 사용자는 상단의 `피평가자 | 평가자 | 관리자` 버튼으로 화면을 오갑니다. `Ctrl+K`로 빠른 이동, 해·달 아이콘으로 다크 모드를 전환합니다.

## 3. 드래그앤드롭 UI 구성

- **UI 스튜디오(관리자)**: 피평가자·평가자·관리자 홈의 위젯을 팔레트에서 캔버스로 끌어 놓고, 옮기고, 크기를 바꾼 뒤 게시합니다. 사이드 메뉴의 순서·이름·노출과 브랜드(회사명·컬러·로그인 문구·3D 모션)도 여기서 바꿉니다.
- **개인 대시보드 편집(사용자)**: 홈의 `대시보드 편집`으로 나만의 배치를 저장합니다. 관리자가 개인화를 막을 수 있습니다.
- **평가 관계 보드**: 피평가자 카드를 다른 1차 평가자 레인으로 끌어 놓으면 수동 지정됩니다.
- **조정·확정 보드**: 카드를 다른 등급 열로 끌어 놓으면 필요한 조정 점수가 계산되고, 사유를 받아 등록합니다(±10 이내).

## 4. 매뉴얼 규칙 → 구현 위치

| 매뉴얼 규칙 | 구현 |
|---|---|
| 3영역 100점, 팀원 40/40/20 · 직책자 50/30/20 | `app/scoring.py: compute()` |
| 달성률 환산표(110↑100 … 80미만 60), 상한 150%, 수기 점수 우선 | `scoring.convert / goal_score` |
| 역량·자기개발·조직관리 = 평균 × 20 | `scoring.item_area` |
| 조정 1회 ±10, 사유 5자↑, 누적, 0~100 클립 | `routes_review.adjust`, `scoring.compute` |
| 등급 S95·A85·B75·C65·D, 배분 가이드 10/20/40/20/10 | `db.DEFAULT_CFG` (주기별 수정 가능) |
| 1차=소속 조직장, 2차=상위 조직장, 본인·순환 지정 거부 | `core.auto_evaluators / check_relation` |
| 직책자 판정(대표이사·본부장·그룹장·부서장·팀장·섹션장) + 수동 스킴 | `core.assign_relations` |
| 목표 가중치 100% 제출, 반려·수정 요청 사유 5자↑ | `routes_me.submit_goals`, `routes_review.act_goal` |
| 자기평가 20자↑, 1차 종합 의견 10자↑, 제출 후 수정 불가 | `routes_me.save_self`, `routes_review.save_first` |
| 다면평가 동료 3·하급자 3 자동 배정, 익명 요약, 제출 후 수정 불가 | `core.assign_peers`, `routes_me.peer_summary` |
| 확정 시 규칙 스냅샷, 이후 재작성 요청으로만 수정 | `core.snapshot`, `routes_admin.confirm / handle_rewrite` |
| 소속 변경 시 1차 제출 전이면 평가자 자동 재계산 | `routes_admin.edit_user` |
| 계정 일괄 발급(기존·퇴직 제외) → 임시 비밀번호 CSV | `routes_admin.issue_accounts` |

## 5. 검증

```bash
python -m app.scoring        # 점수 산정 규칙 자체 점검
python tests/test_api.py     # 로그인·권한·검증·산정·확정·익명성·계정 발급 엔드투엔드
```

## 6. 실제 도메인에 배포하기

1. 서버(리눅스 VM 등)에 코드를 올리고 아래 환경 변수를 설정합니다.

   | 변수 | 값 | 설명 |
   |---|---|---|
   | `KPC_SECRET` | 32자 이상 임의 문자열 | 세션 서명 키 (미설정 시 `data/.secret` 자동 생성) |
   | `KPC_SECURE_COOKIE` | `1` | HTTPS에서만 쿠키 전송 |
   | `KPC_HOST` / `KPC_PORT` | `127.0.0.1` / `8000` | 리버스 프록시 뒤에서 실행 |
   | `KPC_DATA_DIR` | `/var/lib/kpc` | DB 저장 위치 (백업 대상) |
   | `KPC_DOCS` | `0` | API 문서(`/api/docs`) 비공개 |

2. Nginx 또는 Caddy로 HTTPS 리버스 프록시를 둡니다. Caddy는 인증서를 자동으로 발급합니다.

   ```
   hr.your-domain.com {
       reverse_proxy 127.0.0.1:8000
   }
   ```

3. Docker를 쓴다면 이렇게 실행합니다.

   ```bash
   docker build -t kpc-hr .
   docker run -d -p 8000:8000 -v kpc-data:/data -e KPC_SECRET=... -e KPC_SECURE_COOKIE=1 kpc-hr
   ```

4. 실제 운영 전에는 **UI 스튜디오 → 브랜드·시스템**에서 `데모 모드`를 끕니다. 데모 버튼과 초기화 기능이 사라집니다. 그다음 사용자·권한 화면에서 실제 인력 데이터로 교체합니다.

## 7. 보안 기본값

PBKDF2-SHA256(20만 회) 비밀번호 해시, HMAC 서명 세션 쿠키(HttpOnly·SameSite=Lax, 비밀번호를 바꾸면 기존 세션 무효화), 로그인 5회 실패 시 5분 잠금, 모든 SQL 파라미터 바인딩, 출력 자동 이스케이프 템플릿, CSP·X-Frame-Options·nosniff 헤더, CSV 수식 주입 방지, 감사 로그가 기본으로 들어가 있습니다.

## 8. 확장할 때 바꿀 곳

- 서버를 여러 대로 늘리면 SQLite를 PostgreSQL로, 로그인 잠금을 Redis로 옮깁니다(`app/db.py`, `app/main.py`의 `_fails`).
- 사내 SSO(SAML·OIDC)는 `app/main.py`의 로그인 라우트에 붙입니다.
- 메일·메신저 알림은 `core.notify()` 한 곳에 연결하면 됩니다.
