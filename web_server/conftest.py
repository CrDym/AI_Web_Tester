import sys
from pathlib import Path

# 保证 CI/任意 cwd 下 `import web_server.xxx` 可用（项目根在 web_server 的上级）
_project_root = Path(__file__).resolve().parents[1]
for _p in (str(_project_root), str(_project_root / "web_server")):
    if _p not in sys.path:
        sys.path.insert(0, _p)
