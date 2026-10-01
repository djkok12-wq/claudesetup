"""로컬 실행: python run.py  →  http://localhost:8000  (KPC_PORT, KPC_HOST 환경변수로 변경)"""
import os
import sys
from pathlib import Path

import uvicorn

if sys.stdout is None:  # pythonw(창 없이 자동 시작)에는 콘솔이 없으므로 로그를 파일로 남긴다
    sys.stdout = sys.stderr = open(Path(__file__).with_name("server.log"), "a", encoding="utf-8", buffering=1)

if __name__ == "__main__":
    uvicorn.run("app.main:app", host=os.environ.get("KPC_HOST", "127.0.0.1"), port=int(os.environ.get("KPC_PORT", "8000")),
                reload=os.environ.get("KPC_RELOAD") == "1")
