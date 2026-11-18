#!/usr/bin/env python3
"""src/ 의 조각들을 단일 index.html 로 묶는다.  사용: python3 simulator/build.py"""
from pathlib import Path

SRC = Path(__file__).parent / "src"
OUT = Path(__file__).parent / "index.html"

shell = (SRC / "shell.html").read_text(encoding="utf-8")
css = (SRC / "style.css").read_text(encoding="utf-8")
js = "\n".join((SRC / f).read_text(encoding="utf-8") for f in ["data.js", "textures.js", "scene.js", "ui.js"])
OUT.write_text(shell.replace("/*__CSS__*/", css).replace("/*__JS__*/", js), encoding="utf-8")
print(f"built {OUT} ({OUT.stat().st_size/1024:.0f} KB)")
