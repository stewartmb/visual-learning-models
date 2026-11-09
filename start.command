#!/bin/zsh
set -e
cd "${0:A:h}"
if [[ ! -x .venv/bin/python ]]; then
  python3 -m venv .venv
  .venv/bin/python -m pip install -r requirements.txt
fi
exec .venv/bin/python -c 'import runpy, threading, webbrowser; threading.Timer(1.0, lambda: webbrowser.open("http://127.0.0.1:5123")).start(); runpy.run_path("app.py", run_name="__main__")'
