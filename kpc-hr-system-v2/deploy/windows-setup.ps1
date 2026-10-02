<#
  KPC HR SYSTEM — 윈도우 서버 운영 등록 스크립트
  관리자 권한 PowerShell 에서 실행:
      powershell -ExecutionPolicy Bypass -File deploy\windows-setup.ps1

  하는 일 (추가 비용 0원, 전부 로컬 작업)
    1. 운영용 환경 변수를 시스템 전역에 등록 (KPC_SECRET 은 없을 때만 새로 생성)
    2. 데이터 디렉터리 생성
    3. "시스템 시작 시 / 로그온 여부와 무관하게" 실행되는 작업 스케줄러 등록
    4. cloudflared 설치 여부 확인 후 다음 단계 안내

  airkpc.com · airkpc.cafe24.com 과는 무관한 이 PC 안의 작업만 한다.
#>
[CmdletBinding()]
param(
    [string]$DataDir  = 'C:\kpc-data',
    [string]$TaskName = 'KPC HR SYSTEM Server',
    [int]$Port        = 8000
)
$ErrorActionPreference = 'Stop'
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
        ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw '관리자 권한 PowerShell 에서 실행하세요.'
}

$Root = Split-Path -Parent $PSScriptRoot
$Pyw  = Join-Path $Root '.venv\Scripts\pythonw.exe'
if (-not (Test-Path $Pyw)) { throw "가상환경이 없습니다. 먼저 SETUP_WINDOWS.bat 을 실행하세요: $Pyw" }

Write-Host "`n[1/4] 환경 변수 등록" -ForegroundColor Cyan

# KPC_SECRET 은 세션 서명 키다. 바꾸면 전원 로그아웃되므로 "없을 때만" 만든다.
$secret = [Environment]::GetEnvironmentVariable('KPC_SECRET', 'Machine')
if ([string]::IsNullOrWhiteSpace($secret)) {
    $bytes = [byte[]]::new(32)
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $secret = -join ($bytes | ForEach-Object { $_.ToString('x2') })
    Write-Host '  KPC_SECRET 신규 생성' -ForegroundColor Green
} else {
    Write-Host '  KPC_SECRET 기존 값 유지 (덮어쓰면 전원 로그아웃되므로 보존)' -ForegroundColor Yellow
}

@{
    KPC_SECRET        = $secret        # 세션 쿠키 서명 키
    KPC_SECURE_COOKIE = '1'            # HTTPS 로만 쿠키 전송
    KPC_HOST          = '127.0.0.1'    # 외부 직접 노출 금지 — 터널/프록시만 접속
    KPC_PORT          = "$Port"
    KPC_DATA_DIR      = $DataDir       # SQLite DB 위치 = 백업 대상
    KPC_DOCS          = '0'            # /api/docs 비공개
    KPC_RELOAD        = '0'            # 자동 재시작은 개발 전용
}.GetEnumerator() | ForEach-Object {
    [Environment]::SetEnvironmentVariable($_.Key, $_.Value, 'Machine')
    $shown = if ($_.Key -eq 'KPC_SECRET') { '(숨김)' } else { $_.Value }
    Write-Host ("  {0,-18} = {1}" -f $_.Key, $shown)
}

Write-Host "`n[2/4] 데이터 디렉터리" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
Write-Host "  $DataDir"

Write-Host "`n[3/4] 작업 스케줄러 등록 (부팅 시 자동 실행)" -ForegroundColor Cyan
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
$action    = New-ScheduledTaskAction  -Execute $Pyw -Argument 'run.py' -WorkingDirectory $Root
$trigger   = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
                                          -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
                       -Principal $principal -Settings $settings | Out-Null
Start-ScheduledTask -TaskName $TaskName
Write-Host "  '$TaskName' 등록 후 시작" -ForegroundColor Green

Start-Sleep -Seconds 4
$up = [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
if ($up) { Write-Host "  127.0.0.1:$Port LISTEN 확인" -ForegroundColor Green }
else     { Write-Host "  아직 응답 없음 — $Root\server.log 확인" -ForegroundColor Yellow }

Write-Host "`n[4/4] 외부 연결(Cloudflare Tunnel)" -ForegroundColor Cyan
if (Get-Command cloudflared -ErrorAction SilentlyContinue) {
    Write-Host '  cloudflared 설치됨. 아래 순서로 진행하세요:' -ForegroundColor Green
} else {
    Write-Host '  cloudflared 미설치. 먼저 설치하세요:' -ForegroundColor Yellow
    Write-Host '    winget install --id Cloudflare.cloudflared'
}
@'
    cloudflared tunnel login
    cloudflared tunnel create kpc-hr
    cloudflared tunnel route dns kpc-hr systemkpc.com
    cloudflared tunnel route dns kpc-hr www.systemkpc.com
    # deploy\cloudflared-config.yml 을 config.yml 로 복사 후
    cloudflared service install
'@ | Write-Host

Write-Host "`n완료. 백엔드(app\*.py) 수정 후에는 아래로 재시작하세요:" -ForegroundColor Cyan
Write-Host "    Restart-ScheduledTask -TaskName '$TaskName'"
Write-Host "프론트엔드(web\*)는 저장만 하면 즉시 반영됩니다.`n"
