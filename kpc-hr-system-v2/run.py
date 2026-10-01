"""로컬 실행: python run.py  →  http://localhost:8000  (KPC_PORT, KPC_HOST 환경변수로 변경)"""
import os

import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host=os.environ.get("KPC_HOST", "127.0.0.1"), port=int(os.environ.get("KPC_PORT", "8000")),
                reload=os.environ.get("KPC_RELOAD") == "1")
