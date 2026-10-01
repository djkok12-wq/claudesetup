# KPC HR SYSTEM — Windows 설치·실행·종료 (SETUP_WINDOWS.bat / START.bat / STOP.bat 에서 호출)
param([ValidateSet('setup', 'start', 'stop')][string]$Mode = 'setup')
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Venv = Join-Path $Root '.venv'
$Pyw = Join-Path $Venv 'Scripts\pythonw.exe'
$Port = 8000
$Url = "http://localhost:$Port/"

function Test-Up {  # 서버는 DB 준비(시작 이벤트)가 끝난 뒤에 포트를 열므로 LISTEN 여부로 판단 (사내 프록시 영향 없음)
    return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}
function Stop-Server {
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}
function Start-Server {
    if (Test-Up) { Write-Host "이미 실행 중입니다: $Url"; return }
    if (-not (Test-Path $Pyw)) { throw "설치가 필요합니다. SETUP_WINDOWS.bat 을 먼저 실행하세요." }
    Start-Process -FilePath $Pyw -ArgumentList 'run.py' -WorkingDirectory $Root -WindowStyle Hidden
    for ($i = 0; $i -lt 60 -and -not (Test-Up); $i++) { Start-Sleep -Milliseconds 500 }
    if (Test-Up) { Write-Host "서버 실행 중: $Url" -ForegroundColor Green }
    else { Write-Host "서버가 응답하지 않습니다. 로그를 확인하세요: $Root\server.log" -ForegroundColor Red }
}
function Find-Python {
    $candidates = @(@('py', '-3'), @('python'), @("$env:LOCALAPPDATA\Programs\Python\Python312\python.exe"), @("$env:LOCALAPPDATA\Programs\Python\Python311\python.exe"))
    foreach ($c in $candidates) {
        try {
            $exe = $c[0]; $pre = @($c | Select-Object -Skip 1)
            $ok = & $exe @pre -c "import sys;print(sys.version_info>=(3,10))" 2>$null
            if ("$ok".Trim() -eq 'True') { return , $c }
        } catch { }
    }
    return $null
}

if ($Mode -eq 'stop') { Stop-Server; Write-Host '서버를 종료했습니다.'; return }
if ($Mode -eq 'start') { Start-Server; Start-Process $Url; return }

Write-Host "`n[1/5] Python 확인" -ForegroundColor Cyan
$py = Find-Python
if (-not $py) {
    Write-Host 'Python 3.10 이상이 없어 winget으로 설치합니다...'
    try { winget install -e --id Python.Python.3.12 --scope user --accept-package-agreements --accept-source-agreements } catch { }
    $py = Find-Python
    if (-not $py) { throw 'Python 설치에 실패했습니다. https://www.python.org/downloads/ 에서 설치("Add python.exe to PATH" 체크) 후 다시 실행하세요.' }
}
$pyExe = $py[0]; $pyPre = @($py | Select-Object -Skip 1)
Write-Host "  사용: $($py -join ' ')"

Write-Host '[2/5] 가상환경·패키지 설치' -ForegroundColor Cyan
Stop-Server
if (-not (Test-Path $Pyw)) { & $pyExe @pyPre -m venv $Venv }
& (Join-Path $Venv 'Scripts\python.exe') -m pip install --disable-pip-version-check -q -r (Join-Path $Root 'requirements.txt')
if ($LASTEXITCODE -ne 0) { throw '패키지 설치에 실패했습니다. 인터넷 연결(사내 프록시)을 확인하세요.' }

Write-Host '[3/5] 재부팅 후 자동 실행 등록 (시작프로그램)' -ForegroundColor Cyan
$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Startup')) 'KPC HR SYSTEM Server.lnk'))
$lnk.TargetPath = $Pyw; $lnk.Arguments = 'run.py'; $lnk.WorkingDirectory = $Root; $lnk.WindowStyle = 7
$lnk.Description = 'KPC HR SYSTEM 로컬 서버 (http://localhost:8000)'; $lnk.Save()

Write-Host '[4/5] 바탕화면 바로가기 생성' -ForegroundColor Cyan
Set-Content -Path (Join-Path ([Environment]::GetFolderPath('Desktop')) 'KPC HR SYSTEM.url') -Value "[InternetShortcut]`r`nURL=$Url" -Encoding ASCII

Write-Host '[5/5] 서버 실행' -ForegroundColor Cyan
Start-Server
Start-Process $Url
Write-Host "`n완료! 이제 재부팅해도 로그인하면 서버가 자동으로 켜집니다." -ForegroundColor Green
Write-Host '  - 접속: 바탕화면 "KPC HR SYSTEM" 아이콘 또는 http://localhost:8000'
Write-Host '  - 데모 계정: admin@kpc.demo / leader@kpc.demo / member@kpc.demo (비밀번호 demo1234!)'
Write-Host '  - 수동 실행/종료: START.bat / STOP.bat'
