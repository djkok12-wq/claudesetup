# systemkpc.com 배포 가이드

로컬에서 만든 KPC HR SYSTEM v2 를 `systemkpc.com` 주소로 서비스하기 위한 문서다.

전제 조건 두 가지:

- **추가 비용 0원** — 서버·호스팅을 새로 사지 않는다. DNS, HTTPS 인증서, Cloudflare Tunnel 모두 무료다.
  돈이 드는 선택지는 본문에 따로 표시했다.
- **airkpc.com / airkpc.cafe24.com 무영향** — 회사 홈페이지와 회사 메일에 영향을 주는 작업은 하지 않는다.

---

## 0. 실측 DNS 현황 (2026-10-02 조회)

| 호스트 | 네임서버 | A | MX | 상태 |
|---|---|---|---|---|
| airkpc.com | ns1/ns2.cafe24.com, .co.kr | 183.110.224.225 | **mail.bizboxa.com** | 정상 운영 중 |
| www.airkpc.com | 〃 | CNAME → airkpc.com | 〃 | 정상 |
| airkpc.cafe24.com | (카페24) | **183.111.138.162** | mw-002.cafe24.com | 정상 |
| system.airkpc.com | (카페24) | **183.111.138.162** | – | 과거 설정 잔재 |
| **systemkpc.com** | **없음** | **없음** | 없음 | **.com 레지스트리 NXDOMAIN** |
| 항공기부품.com / .org | 없음 | 없음 | 없음 | NXDOMAIN |

여기서 짚어야 할 사실이 세 가지다.

### (1) 183.111.138.162 는 systemkpc.com 전용 서버가 아니다

그 IP 는 **airkpc.cafe24.com 이 올라가 있는 카페24 공용 웹호스팅 서버**다.
`system.airkpc.com` 도 같은 IP 를 보고 있다. 즉 그 서버를 건드리는 작업은
**airkpc.cafe24.com 에 직접 영향을 준다.** 이번 작업에서 그 서버는 손대지 않는다.

그리고 카페24 웹호스팅은 PHP/Apache 상품이라 **Python(FastAPI) 프로세스를 띄울 수 없다.**
이 앱을 그 서버에 FTP 로 올리는 방법은 존재하지 않는다.
카페24 가상서버호스팅(VPS)으로 바꾸면 가능하지만 **월 과금이 발생**하므로 0원 조건에서 제외한다.

### (2) systemkpc.com 은 현재 전 세계 어디에서도 조회되지 않는다

`.com` 레지스트리(Verisign)에 직접 질의한 결과 **NXDOMAIN** 이다.
도메인 자체가 등록되어 있지 않거나, 등록 직후 반영 전이거나, 만료된 상태다.
카페24 "도메인 연결 관리"에 이름이 올라가 있는 것과 **실제 도메인 등록은 별개**다.

→ **이것부터 해결해야 그 다음 단계가 의미를 갖는다.** (1장 참고)

### (3) 회사 메일은 더존 비즈박스알파를 쓰고 있다

`airkpc.com` 의 MX 가 `mail.bizboxa.com`, SPF 가 `include:_spfblocka.bizboxa.com` 이다.
**airkpc.com 의 네임서버나 MX·TXT 레코드를 건드리면 회사 메일이 끊긴다.**
이번 작업에서 airkpc.com DNS 는 읽기만 하고 수정하지 않는다.

---

## 왜 이 작업이 airkpc 에 영향을 주지 않는가

`systemkpc.com` 과 `airkpc.com` 은 **서로 다른 도메인**이다. DNS 위임 체계가 루트부터 갈라져 있어서
한쪽 네임서버를 바꿔도 다른 쪽에는 전파 자체가 일어나지 않는다.
게다가 systemkpc.com 에는 지금 **레코드가 하나도 없어서 잃을 설정조차 없다.**

접점은 카페24 "도메인 연결 관리" 목록 한 곳뿐이다. 거기서 **systemkpc.com 행만** 다루고
`대표 도메인(항공기부품.com)` 과 `airkpc.cafe24.com` 행은 건드리지 않으면 된다.

---

## 1. 작업 순서

### STEP 0 — systemkpc.com 등록 상태 확인 (선행, 필수)

등록기관 콘솔에서 systemkpc.com 이 **실제로 등록·결제 완료 상태인지** 확인한다.
카페24 화면에 "타기관 / 기관이전"으로 표시돼 있으므로 구입처는 카페24가 아니다.

확인 방법: 아무 PC 에서

```
nslookup -type=ns systemkpc.com
```

네임서버가 나오면 등록된 것이다. `NXDOMAIN` 이면 아직 등록이 안 된 것이므로 먼저 등록한다.
(도메인 등록·갱신 자체는 유료다. 이미 결제했다면 추가 비용은 없다.)

### STEP 1 — 카페24: systemkpc.com 연결만 해제 (선택)

systemkpc.com 을 우리 서버로 돌릴 것이므로 카페24 웹호스팅과의 연결은 필요 없다.
`쇼핑몰/호스팅 관리 → 도메인 연결 관리`에서:

- **systemkpc.com 행만** 선택 → `연결삭제`
- ⛔ `항공기부품.com [대표]` 행과 `airkpc.cafe24.com` 행은 **선택하지 않는다.**
  대표 도메인을 삭제하면 연결 구성 전체가 흔들린다.

굳이 안 해도 된다. systemkpc.com 의 네임서버를 Cloudflare 로 옮기면 카페24 쪽 연결은 자동으로 무효가 된다.
깔끔하게 정리하고 싶을 때만 한다.

### STEP 2 — systemkpc.com 네임서버를 Cloudflare 로 변경

1. Cloudflare 무료 계정 생성 → `Add a site` → `systemkpc.com` → **Free 플랜** 선택
2. Cloudflare 가 알려주는 네임서버 2개를 **systemkpc.com 을 구입한 등록기관 콘솔**에서 설정
3. 전파 확인: `nslookup -type=ns systemkpc.com`

> ✅ systemkpc.com 에는 기존 A·MX·TXT 가 없으므로 옮길 레코드가 없다.
> ⛔ **airkpc.com 의 네임서버는 ns1/ns2.cafe24.com 그대로 둔다.** 절대 건드리지 않는다.
> 💰 네임서버 변경은 무료다. 도메인 이전(transfer)이 아니므로 이전 비용도 발생하지 않는다.

### STEP 3 — 서버에 앱 등록

윈도우 서버라면 관리자 PowerShell 에서:

```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows-setup.ps1
```

운영용 환경 변수 등록(`KPC_SECRET` 은 없을 때만 생성), 데이터 디렉터리 생성,
부팅 시 자동 실행되는 작업 스케줄러 등록까지 한 번에 처리한다.

리눅스 서버라면 `deploy/kpc-hr.service` 와 `deploy/kpc-hr.env.example` 을 쓴다.

```bash
sudo useradd -r -s /usr/sbin/nologin kpc
sudo mkdir -p /var/lib/kpc && sudo chown kpc:kpc /var/lib/kpc
cd /srv/kpc-hr-system-v2 && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
sudo cp deploy/kpc-hr.service /etc/systemd/system/
sudo cp deploy/kpc-hr.env.example /etc/kpc-hr.env && sudo chmod 600 /etc/kpc-hr.env   # 값 채우기
sudo systemctl daemon-reload && sudo systemctl enable --now kpc-hr
```

### STEP 4 — 외부 연결: Cloudflare Tunnel (권장)

`deploy/cloudflared-config.yml` 참고.

```
cloudflared tunnel login
cloudflared tunnel create kpc-hr
cloudflared tunnel route dns kpc-hr systemkpc.com
cloudflared tunnel route dns kpc-hr www.systemkpc.com
cloudflared service install
```

이 방식의 장점:

| 항목 | 효과 |
|---|---|
| 비용 | 0원 (Cloudflare Free + Tunnel) |
| 고정 IP | 불필요 — 유동 IP 사무실 회선에서도 동작 |
| 포트 개방 | 불필요 — 공유기·방화벽 인바운드 설정 없음 |
| HTTPS | 자동 발급·갱신 |
| 보안 | 서버 공인 IP 가 외부에 노출되지 않음 |

**대안 (고정 IP + 80/443 개방이 가능한 경우)**
Cloudflare 없이 `deploy/Caddyfile`(또는 `deploy/nginx-systemkpc.com.conf`)로
직접 리버스 프록시를 세우고 systemkpc.com A 레코드를 서버 IP 로 지정해도 된다. 이것도 0원이다.

**쓰면 안 되는 선택** — Render·Railway 등 무료 PaaS 는 유휴 시 프로세스가 내려가고
영속 디스크가 없어 **SQLite 데이터가 사라진다.** 인사평가 데이터에는 쓸 수 없다.

---

## 2. 이 앱의 구조상 제약

| 구성 | 내용 |
|---|---|
| 백엔드 | FastAPI + uvicorn (Python 3.10+) — 상시 실행 프로세스 필요 |
| DB | SQLite 파일 (`$KPC_DATA_DIR/kpc_hr.db`, WAL 모드) |
| 프론트엔드 | 빌드 없는 ES Module. `web/` 를 FastAPI 가 그대로 서빙 |
| 외부 라이브러리 | `web/vendor/` 에 동봉 (CDN 불필요) |

- 모든 자원 경로가 `/static/...`, `/app/...`, `/api/...` **절대 경로**다.
  `airkpc.com/hr/` 같은 **하위 경로에 끼워 넣으면 깨진다.** 도메인 루트여야 한다.
- `app/main.py` 가 `X-Frame-Options: DENY` 와 CSP `frame-ancestors 'none'` 을 붙인다.
  **airkpc.com 페이지 안에 iframe 으로는 표시되지 않는다.**
  홈페이지에서는 새 창 링크(`target="_blank" rel="noopener"`)로 연결한다.
  iframe 이 꼭 필요하면 `app/main.py` 의 `CSP` 와 `X-Frame-Options` 를 수정해야 하는데,
  HR 화면이라 클릭재킹 위험이 생긴다. 권장하지 않는다.

---

## 3. 프론트엔드 · 백엔드 수정 위치와 반영 방식

**프론트엔드는 저장하면 즉시 반영, 백엔드는 서버를 재시작해야 반영된다.**

`StaticFiles` 와 `FileResponse` 는 요청마다 디스크를 읽지만,
`app/*.py` 는 프로세스가 시작할 때 한 번만 import 되기 때문이다.

| 바꾸고 싶은 것 | 고칠 파일 | 반영 방법 |
|---|---|---|
| 색·여백·폰트·다크모드 | `web/css/app.css` | 저장 → 브라우저 강력 새로고침(Ctrl+Shift+R) |
| 페이지 골격·로그인 화면 | `web/login.html`, `me.html`, `review.html`, `admin.html`, `manual.html` | 저장 → 새로고침 |
| 공통 유틸·라우터·모달·차트 | `web/js/core.js` | 저장 → 새로고침 |
| 피평가자 화면 동작 | `web/js/me.js` | 저장 → 새로고침 |
| 평가자 화면 동작 | `web/js/review.js` | 저장 → 새로고침 |
| 관리자 화면 동작 | `web/js/admin.js`, `studio.js` | 저장 → 새로고침 |
| 위젯 카탈로그·평가 입력 UI | `web/js/catalog.js`, `evalkit.js` | 저장 → 새로고침 |
| 로그인·세션·페이지 라우팅·공통 API | `app/main.py` | **서버 재시작** |
| 피평가자 API | `app/routes_me.py` | **서버 재시작** |
| 평가자 API | `app/routes_review.py` | **서버 재시작** |
| 관리자 API | `app/routes_admin.py` | **서버 재시작** |
| 점수 산정 규칙·환산표 | `app/scoring.py` | **서버 재시작** |
| 세션 토큰·권한·알림·감사로그 | `app/core.py` | **서버 재시작** |
| DB 스키마·기본 가중치/등급 기준 | `app/db.py` | **서버 재시작 + 수동 ALTER** (아래 주의 2) |
| 데모 데이터 | `app/seed.py` | DB 가 비어 있을 때만 적용 |
| **회사명·컬러·위젯 배치·메뉴 순서·공지** | 코드 수정 불필요 — 관리자 화면 **UI 스튜디오** | **즉시 반영** (DB 저장) |

재시작:

```powershell
Restart-ScheduledTask -TaskName 'KPC HR SYSTEM Server'   # 윈도우
```
```bash
sudo systemctl restart kpc-hr                            # 리눅스
```

### 주의 4가지

1. **브라우저 캐시** — JS/CSS 에 버전 해시가 없다. Ctrl+Shift+R 을 안내하거나
   HTML 의 `<link>`/`<script>` 뒤에 `?v=2` 처럼 값을 바꿔 붙인다.
   Cloudflare 를 앞에 두면 대시보드에서 **캐시 퍼지**도 필요하다.
2. **DB 스키마 변경은 자동 반영되지 않는다** — `app/db.py` 의 SQL 이 전부
   `CREATE TABLE IF NOT EXISTS` 다. 기존 DB 에 컬럼을 추가하려면
   `ALTER TABLE ... ADD COLUMN ...` 을 직접 실행해야 한다.
3. **`KPC_RELOAD=1` 은 운영에 쓰지 않는다** — 작업 중인 요청이 끊긴다. 개발 전용이다.
4. **`KPC_SECRET` 을 바꾸면 전원 로그아웃된다** — 한 번 정하면 고정한다.
   `windows-setup.ps1` 은 기존 값이 있으면 보존한다.

### 서버에서 직접 고치지 말고 git 으로 배포한다

```bash
# 로컬에서 수정 → 커밋 → push, 서버에서:
cd /srv/kpc-hr-system-v2
git pull
sudo systemctl restart kpc-hr      # 프론트만 고쳤으면 생략 가능
```

`data/` 는 `.gitignore` 에 있어 `git pull` 로 DB 가 덮어써지지 않는다.

---

## 4. 보안 — 솔직한 권고

이 시스템에는 사번·이름·평가등급·평가의견이 들어간다. 공개 인터넷에 그냥 열어두면
개인정보 유출 리스크를 함께 지게 된다. 0원 조건을 지키면서 리스크를 줄이는 방법:

- **Cloudflare Access** (Free 플랜 포함, 50명까지 무료) 로 systemkpc.com 앞단에
  이메일 OTP·SSO 인증을 걸어 사내 인원만 통과시킨다. 가장 현실적인 선택이다.
- 또는 리버스 프록시에서 회사 IP 대역만 허용한다 (`deploy/Caddyfile` 하단 주석 참고).
- 백업: `sqlite3 <DB> ".backup /backup/kpc-$(date +%F).db"`
  (WAL 모드라 파일 복사보다 `.backup` 명령이 안전하다.) 매일 스케줄에 등록한다.

---

## 5. 배포 후 점검 목록

**새 시스템**
- [ ] `nslookup systemkpc.com` 이 응답한다
- [ ] `https://systemkpc.com/login` 이 열리고 인증서가 정상이다
- [ ] `https://systemkpc.com/api/docs` 가 404 다 (`KPC_DOCS=0`)
- [ ] 로그인 → 로그아웃 → 재로그인이 되고 쿠키에 `Secure` 플래그가 있다
- [ ] 서버를 재부팅해도 앱과 터널이 자동으로 다시 떠 있다
- [ ] 관리자 → UI 스튜디오에서 **데모 모드를 껐다**
- [ ] 데모 계정(`admin@kpc.demo` 등)을 실제 인력 데이터로 교체했다
- [ ] `KPC_DATA_DIR` 백업이 스케줄에 등록돼 있다

**기존 서비스 (작업 전후로 동일해야 함)**
- [ ] `https://airkpc.com`, `https://www.airkpc.com` 이 이전과 똑같이 열린다
- [ ] `https://airkpc.cafe24.com` 이 정상이다
- [ ] `nslookup -type=ns airkpc.com` → ns1/ns2.cafe24.com 그대로다
- [ ] `nslookup -type=mx airkpc.com` → mail.bizboxa.com 그대로다
- [ ] **회사 메일 송수신이 정상이다**
- [ ] 카페24 도메인 연결 관리에서 `항공기부품.com [대표]` 와 `airkpc.cafe24.com` 이 그대로다
