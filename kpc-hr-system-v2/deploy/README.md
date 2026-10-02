# system.airkpc.com 배포 가이드

로컬에서 만든 KPC HR SYSTEM v2 를 `http://system.airkpc.com/` 주소로 쓰기 위한 문서다.
전제 조건 두 가지를 먼저 명시한다.

- **추가 비용 0원** — 서버를 새로 사지 않는다. DNS 레코드 추가, HTTPS 인증서(Let's Encrypt),
  리버스 프록시(Caddy·Nginx) 모두 무료다. 돈이 드는 선택지는 본문에 따로 표시했다.
- **airkpc.com 무영향** — 서브도메인 레코드 1개만 추가하고, 네임서버·기존 A/MX/TXT 레코드와
  기존 웹서버 설정 파일은 건드리지 않는다.

---

## 0. 시작 전 반드시 확인할 것 (제일 중요)

`system.airkpc.com` 은 **이미 DNS 에 등록되어 있다.**

| 호스트 | 현재 IP |
|---|---|
| airkpc.com / www.airkpc.com | 183.110.224.225 |
| **system.airkpc.com** | **183.111.138.162** (다른 서버) |

즉 서브도메인이 비어 있는 상태가 아니라, 이미 어딘가를 가리키고 있다.
이 레코드를 그냥 바꾸면 **지금 그 주소로 돌아가는 서비스가 끊긴다.**

착수 전에 이것부터 확인한다.

1. 183.111.138.162 가 무엇인가 — 우리 회사 서버인가, 기존 그룹웨어/다른 시스템인가, 아니면
   예전에 쓰다 방치된 레코드인가.
2. 그 서버를 그대로 재사용할 것인가(= DNS 는 손대지 않고 서버 안에만 올린다),
   아니면 레코드를 새 서버로 옮길 것인가.
3. 재사용한다면 그 서버에서 **Python 3.10+ 프로세스를 상시 띄울 수 있는가** (아래 1장 참고).

→ 1번이 확인되기 전에는 DNS 레코드를 수정하지 않는다. 필요하면 `hr.airkpc.com` 같은
새 서브도메인을 쓰는 쪽이 안전하다.

---

## 1. 이 앱의 성격 — 정적 사이트가 아니다

| 구성 | 내용 |
|---|---|
| 백엔드 | FastAPI + uvicorn (Python 3.10+) — **상시 실행되는 프로세스가 필요** |
| DB | SQLite 파일 (`$KPC_DATA_DIR/kpc_hr.db`, WAL 모드) |
| 프론트엔드 | 빌드 없는 ES Module. `web/` 폴더를 FastAPI 가 그대로 서빙 |
| 외부 라이브러리 | `web/vendor/` 에 동봉 (CDN 불필요, 오프라인 동작) |

여기서 나오는 결론이 두 개다.

- **FTP 로 HTML 올리는 일반 웹호스팅(PHP/Apache 상품)에는 올라가지 않는다.**
  Python 프로세스를 띄울 수 없기 때문이다. 필요한 것은 리눅스 VM·사내 서버·윈도우 서버
  같은 "프로세스를 돌릴 수 있는 환경"이다.
  (호스팅 업체에서 가상서버/VPS 상품으로 바꾸는 것은 **비용이 발생**하므로 0원 조건에 맞지 않는다.)
- 모든 자원 경로가 `/static/...`, `/app/...`, `/api/...` 로 **절대 경로**다.
  그래서 `airkpc.com/hr/` 처럼 **하위 경로에 끼워 넣으면 깨진다.**
  반드시 `system.airkpc.com` 처럼 **서브도메인 루트**에 올려야 한다.

### 기존 홈페이지 안에 iframe 으로 넣는 것은 불가능하다

`app/main.py` 가 모든 응답에 `X-Frame-Options: DENY` 와 CSP `frame-ancestors 'none'` 을 붙인다.
따라서 airkpc.com 페이지 안에 `<iframe src="https://system.airkpc.com">` 으로는 표시되지 않는다.
홈페이지에서는 **새 창으로 여는 링크**(`target="_blank" rel="noopener"`)로 연결한다.
굳이 iframe 이 필요하면 `app/main.py` 의 `CSP` 문자열과 `X-Frame-Options` 를 수정해야 하는데,
HR 데이터 화면이라 클릭재킹 위험이 생긴다. 권장하지 않는다.

---

## 2. "등록"은 세 군데서 따로 한다

서버에 파일만 올려두면 동작하지 않는다. 아래 3단계가 모두 필요하다.

| 단계 | 어디서 | 무엇을 | 비용 |
|---|---|---|---|
| ① DNS | airkpc.com **도메인/DNS 관리 업체 콘솔** (가비아·후이즈·카페24 등) | `system` A 레코드 → 서버 공인 IP | 무료 |
| ② 웹서버 | 서버의 **리버스 프록시** (Caddy 또는 Nginx) | `system.airkpc.com` 가상호스트 1개 추가 + HTTPS | 무료 |
| ③ 앱 | 서버의 **서비스 등록** (systemd / 윈도우 작업 스케줄러) | uvicorn 상시 실행·자동 재시작 | 무료 |

①은 도메인 업체 웹콘솔에서, ②③은 서버에 SSH/원격 접속해서 한다. 서로 다른 곳이다.

### ① DNS — 서브도메인 1줄만 추가

도메인 관리 콘솔의 **DNS 레코드 관리**에서:

```
호스트(이름)   타입    값                TTL
system        A      <서버 공인 IP>      300
```

- `@`(airkpc.com), `www`, `MX`, `TXT`(SPF/DKIM) 레코드는 **읽기만 하고 수정하지 않는다.**
- **네임서버(NS)는 절대 바꾸지 않는다.** 네임서버 이전이 기존 도메인을 망가뜨리는 가장 흔한 원인이다.
- 반영까지 TTL 만큼(보통 5분~1시간) 걸린다. 확인: `nslookup system.airkpc.com`

### ② 리버스 프록시 — 기존 설정 파일을 수정하지 말고 "파일을 추가"한다

- Caddy: `deploy/Caddyfile` 내용을 기존 Caddyfile 에 **블록으로 추가** (인증서 자동 발급)
- Nginx: `deploy/nginx-system.airkpc.com.conf` 를 `/etc/nginx/sites-available/` 에
  **새 파일로** 넣고 `sites-enabled` 에 링크 → `sudo nginx -t && sudo systemctl reload nginx`
  → 인증서는 `sudo certbot --nginx -d system.airkpc.com`

`server_name` / 사이트 주소가 `system.airkpc.com` 인 블록만 추가하므로 airkpc.com 설정은 그대로다.
`nginx -t` 로 문법 검사를 통과한 뒤 reload 하면 기존 사이트는 무중단으로 유지된다.

### ③ 앱 프로세스 등록

**리눅스**

```bash
sudo useradd -r -s /usr/sbin/nologin kpc
sudo mkdir -p /srv /var/lib/kpc && sudo chown kpc:kpc /var/lib/kpc
# 코드 배치 후
cd /srv/kpc-hr-system-v2 && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
sudo cp deploy/kpc-hr.service /etc/systemd/system/
sudo cp deploy/kpc-hr.env.example /etc/kpc-hr.env && sudo chmod 600 /etc/kpc-hr.env   # 값 채우기
sudo systemctl daemon-reload && sudo systemctl enable --now kpc-hr
```

**윈도우 서버** (현재 로컬 환경과 동일한 방식)

`SETUP_WINDOWS.bat` 이 "로그인 시 자동 실행"으로 등록한다. 서버라면 **로그인 없이도 떠야** 하므로
작업 스케줄러에서 `시스템 시작 시` + `사용자 로그온 여부와 상관없이 실행`으로 바꾼다.
그리고 `.venv\Scripts\pythonw.exe run.py` 를 돌리기 전에 시스템 환경 변수로
`KPC_SECRET`, `KPC_SECURE_COOKIE=1`, `KPC_HOST=127.0.0.1`, `KPC_DATA_DIR`, `KPC_DOCS=0` 을 설정한다.
리버스 프록시는 같은 PC 에 Caddy(윈도우 바이너리)를 올리는 게 가장 간단하다.

---

## 3. 비용 0원으로 가능한 조합

### 3-A. 고정 공인 IP + 포트 개방이 있는 경우 (가장 단순, 권장)

사내/기존 서버가 고정 IP 를 갖고 80·443 인바운드가 열려 있다면 그대로 2장의 ①②③만 하면 끝이다.
추가 비용 없음.

### 3-B. 유동 IP 거나 고정 IP 를 못 받는 경우 — DDNS + CNAME

국내 사무실 회선은 IP 가 바뀌는 경우가 많다. 이때도 0원으로 된다.

1. DuckDNS 같은 무료 DDNS 에 호스트(예: `kpc-hr.duckdns.org`)를 만들고,
   서버에 갱신 스크립트를 스케줄 등록한다.
2. DNS 콘솔에 **A 대신 CNAME** 을 넣는다.

```
system   CNAME   kpc-hr.duckdns.org.
```

CNAME 도 서브도메인에만 걸리므로 airkpc.com 에는 영향이 없다.
HTTPS 는 Caddy 가 Let's Encrypt 로 자동 발급한다(80 포트 필요).

### 3-C. 포트를 전혀 열 수 없는 경우 — Cloudflare Tunnel

`deploy/cloudflared-config.yml` 참고. 소프트웨어 비용은 0원이지만
**airkpc.com 네임서버를 Cloudflare 로 옮겨야 한다.** 이건 "기존 도메인 무영향" 조건과 충돌하므로
(이관 중 MX·TXT 누락 시 홈페이지·메일 장애) 마지막 수단으로만 고려한다.
서브도메인만 붙이는 CNAME 부분 설정은 Cloudflare 유료 플랜이라 0원 조건에 맞지 않는다.

### 피해야 할 선택

무료 PaaS(Render·Railway 무료 티어 등)는 ⓐ 유휴 시 프로세스가 내려가고 ⓑ 영속 디스크가 없어
**SQLite 데이터가 날아간다.** 인사평가 데이터에는 쓸 수 없다.

### 솔직한 조언 하나

이 시스템에는 사번·이름·평가등급·평가의견이 들어간다. 공개 인터넷에 열어두면
개인정보 유출 리스크와 책임이 같이 생긴다. 0원이라는 조건을 지키면서도 리스크를 줄이려면:

- 사내망·VPN 에서만 접근 가능하게 두고 외부 공개는 하지 않는다(가장 안전, 추가 비용 0원), 또는
- 공개는 하되 리버스 프록시에서 **회사 IP 대역만 허용**한다 (`deploy/Caddyfile` 하단 주석 참고).
- `data/` 디렉터리를 매일 백업한다: `sqlite3 /var/lib/kpc/kpc_hr.db ".backup /backup/kpc-$(date +%F).db"`
  (WAL 모드라 파일 복사보다 `.backup` 명령이 안전하다.)

---

## 4. 프론트엔드 · 백엔드 수정 위치와 반영 방식

**핵심: 프론트엔드는 저장하면 즉시 반영된다. 백엔드는 서버를 재시작해야 반영된다.**

`app.mount("/static", StaticFiles(directory=WEB))` 가 요청마다 디스크에서 파일을 읽고,
HTML 도 `FileResponse` 로 그때그때 읽는다. 반면 `app/*.py` 는 프로세스가 시작할 때 한 번만 import 된다.

| 바꾸고 싶은 것 | 고칠 파일 | 반영 방법 |
|---|---|---|
| 색·여백·폰트·다크모드 | `web/css/app.css` | 저장 → 브라우저 **강력 새로고침**(Ctrl+Shift+R) |
| 페이지 골격·메타·로그인 화면 | `web/login.html`, `me.html`, `review.html`, `admin.html`, `manual.html` | 저장 → 새로고침 |
| 공통 유틸·라우터·모달·차트 | `web/js/core.js` | 저장 → 새로고침 |
| 피평가자 화면 동작 | `web/js/me.js` | 저장 → 새로고침 |
| 평가자 화면 동작 | `web/js/review.js` | 저장 → 새로고침 |
| 관리자 화면 동작 | `web/js/admin.js`, `studio.js` | 저장 → 새로고침 |
| 위젯 카탈로그·평가 입력 UI | `web/js/catalog.js`, `evalkit.js` | 저장 → 새로고침 |
| 매뉴얼 페이지 | `web/manual.html`, `web/js/manual.js` | 저장 → 새로고침 |
| 로그인·세션·페이지 라우팅·공통 API | `app/main.py` | **서버 재시작** |
| 피평가자 API(목표·자기평가·다면) | `app/routes_me.py` | **서버 재시작** |
| 평가자 API(승인·1차·2차·조정) | `app/routes_review.py` | **서버 재시작** |
| 관리자 API(주기·조직·확정·계정) | `app/routes_admin.py` | **서버 재시작** |
| 점수 산정 규칙·환산표 | `app/scoring.py` | **서버 재시작** |
| 세션 토큰·권한·알림·감사로그 | `app/core.py` | **서버 재시작** |
| DB 스키마·기본 가중치/등급 기준 | `app/db.py` | **서버 재시작** + 아래 주의 참고 |
| 데모 데이터 | `app/seed.py` | DB 가 비어 있을 때만 적용 |
| **회사명·로고컬러·위젯 배치·메뉴 순서·공지** | 코드 수정 불필요 — 관리자 화면 **UI 스튜디오** | **즉시 반영** (DB 에 저장) |

재시작 명령:

```bash
sudo systemctl restart kpc-hr      # 리눅스
# 윈도우: STOP.bat 실행 → START.bat 실행
```

### 주의사항 4가지

1. **브라우저 캐시** — JS/CSS 에 버전 해시가 없다. 사용자에게는 Ctrl+Shift+R 을 안내하거나,
   HTML 의 `<link>`/`<script>` 경로 뒤에 `?v=2` 처럼 값을 바꿔가며 붙인다.
   CDN·Cloudflare 를 앞에 두는 구성이면 캐시 퍼지도 필요하다.
2. **DB 스키마 변경은 자동 반영되지 않는다** — `app/db.py` 의 SQL 은 전부
   `CREATE TABLE IF NOT EXISTS` 다. 이미 만들어진 테이블에 컬럼을 추가해도 기존 DB 에는 반영되지 않으므로
   `ALTER TABLE ... ADD COLUMN ...` 을 직접 실행해야 한다.
3. **`KPC_RELOAD=1` 은 운영에 쓰지 않는다** — 코드 변경 시 자동 재시작되지만 작업 중인 요청이 끊긴다. 개발 전용이다.
4. **`KPC_SECRET` 을 바꾸면 전원 로그아웃된다** — 세션 쿠키 서명 키다. 한 번 정하면 고정한다.

### 서버에서 직접 고치지 말고 git 으로 배포하는 편이 안전하다

서버에서 파일을 직접 편집하면 다음 배포 때 덮어써지고, 무엇을 고쳤는지 추적이 안 된다. 권장 흐름:

```bash
# 로컬에서 수정 → 커밋 → push
# 서버에서
cd /srv/kpc-hr-system-v2
git pull
sudo systemctl restart kpc-hr      # 프론트만 고쳤으면 이 줄은 생략 가능
```

`data/` 는 `.gitignore` 에 들어 있어 git pull 로 DB 가 덮어써지지 않는다.

---

## 5. 배포 후 점검 목록

- [ ] `nslookup system.airkpc.com` 이 새 서버 IP 를 돌려준다
- [ ] `https://system.airkpc.com/login` 이 열리고 자물쇠(인증서)가 정상이다
- [ ] **`https://airkpc.com` 과 `https://www.airkpc.com` 이 이전과 동일하게 열린다**
- [ ] 회사 메일 송수신이 정상이다 (MX 레코드 무사 확인)
- [ ] `https://system.airkpc.com/api/docs` 가 404 다 (`KPC_DOCS=0`)
- [ ] 로그인 → 로그아웃 → 재로그인이 되고, 쿠키에 `Secure` 플래그가 있다 (`KPC_SECURE_COOKIE=1`)
- [ ] 서버를 재부팅해도 앱이 자동으로 다시 떠 있다
- [ ] 관리자 → UI 스튜디오 → 브랜드·시스템에서 **데모 모드를 껐다**
- [ ] 데모 계정(`admin@kpc.demo` 등)을 실제 인력 데이터로 교체했다
- [ ] `KPC_DATA_DIR` 백업이 스케줄에 등록돼 있다
