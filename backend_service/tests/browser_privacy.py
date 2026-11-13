"""Compatibilidade: executa a QA atual de conta e da interface integrada."""
from pathlib import Path
from runpy import run_path

if __name__ == '__main__':
    root = Path(__file__).resolve().parents[2]
    run_path(str(root / 'frontend_spa/tests/browser_naturalista.py'), run_name='__main__')
