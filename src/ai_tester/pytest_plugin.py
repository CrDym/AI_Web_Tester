import sys
import os
import json
import pytest
import time
import shutil
import html
from datetime import datetime
from . import run_context

# ================= 简洁美观的自定义 HTML 测试报告 =================
test_results = []

def _get_run_root() -> str:
    return os.path.join(os.getcwd(), "logs", "runs")


def _cleanup_old_runs(run_root: str, keep: int = 3) -> None:
    try:
        if not os.path.isdir(run_root):
            return
        run_dirs = []
        for name in os.listdir(run_root):
            p = os.path.join(run_root, name)
            if os.path.isdir(p):
                run_dirs.append(p)
        run_dirs.sort(key=os.path.getmtime, reverse=True)
        for p in run_dirs[keep:]:
            shutil.rmtree(p, ignore_errors=True)
    except Exception:
        return


def pytest_sessionstart(session):
    run_root = _get_run_root()
    os.makedirs(run_root, exist_ok=True)
    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir = os.path.join(run_root, run_id)
    os.makedirs(run_dir, exist_ok=True)
    os.environ["AI_TESTER_RUN_DIR"] = run_dir
    _cleanup_old_runs(run_root, keep=3)
    try:
        from .logger import setup_logger
        setup_logger()
    except Exception:
        pass
    
    # 尝试清理非 runs 目录下的旧日志文件（当执行 pytest 收集或初始化阶段可能产生的）
    try:
        import glob
        log_dir = os.path.join(os.getcwd(), "logs")
        log_files = glob.glob(os.path.join(log_dir, "ai_tester_*.log"))
        log_files.sort(key=os.path.getmtime)
        if len(log_files) > 3:
            files_to_delete = log_files[:-3]
            for f in files_to_delete:
                os.remove(f)
    except Exception:
        pass

@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    report = outcome.get_result()
    
    # 将 report 挂载到 item 上，方便 fixture 读取测试结果
    setattr(item, "rep_" + report.when, report)
    
    if report.when == "call":
        nodeid = getattr(item, "nodeid", item.name)
        totals = run_context.get_token_totals(nodeid)
        events = run_context.get_events(nodeid)
        steps_html = ""
        last_debug_screenshot = None
        
        if events:
            step_rows = ""
            for e in events:
                ts = datetime.fromtimestamp(e.get("ts", 0)).strftime("%H:%M:%S")
                kind = html.escape(str(e.get("kind", "")))
                msg = html.escape(str(e.get("message", "")))
                if kind == "debug_screenshot":
                    # 记录最后一个视觉带框截图
                    last_debug_screenshot = str(e.get("message", ""))
                    
                usage = e.get("token_usage") or {}
                tokens = ""
                if usage:
                    tokens = f"P:{usage.get('prompt_tokens', 0)} C:{usage.get('completion_tokens', 0)} T:{usage.get('total_tokens', 0)}"
                step_rows += f"""
                <tr class="border-t">
                    <td class="py-2 pr-4 align-top text-gray-500 text-xs">{ts}</td>
                    <td class="py-2 pr-4 align-top text-gray-700 text-xs">{kind}</td>
                    <td class="py-2 pr-4 align-top text-gray-800 text-sm break-all">{msg}</td>
                    <td class="py-2 align-top text-gray-500 text-xs whitespace-nowrap">{tokens}</td>
                </tr>
                """
            steps_html = f"""
            <details class="mt-4">
                <summary class="cursor-pointer text-sm text-gray-700 font-semibold">查看步骤与 Token 消耗</summary>
                <div class="mt-3 overflow-x-auto">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="text-xs text-gray-500">
                                <th class="pb-2 pr-4 font-semibold">时间</th>
                                <th class="pb-2 pr-4 font-semibold">类型</th>
                                <th class="pb-2 pr-4 font-semibold">步骤</th>
                                <th class="pb-2 font-semibold">Token</th>
                            </tr>
                        </thead>
                        <tbody>
                            {step_rows}
                        </tbody>
                    </table>
                </div>
            </details>
            """

        # 收集每个测试用例的结果
        test_results.append({
            "name": item.name,
            "nodeid": nodeid,
            "status": report.outcome,
            "duration": f"{report.duration:.2f}s",
            "doc": item.obj.__doc__.strip() if item.obj.__doc__ else "无描述信息",
            "error": str(report.longrepr) if report.failed else None,
            "token_total": totals.get("total_tokens", 0),
            "token_prompt": totals.get("prompt_tokens", 0),
            "token_completion": totals.get("completion_tokens", 0),
            "steps_html": steps_html,
            "last_debug_screenshot": last_debug_screenshot
        })

def pytest_sessionfinish(session, exitstatus):
    """在测试结束后生成美观的 HTML 报告"""
    # 统计数据
    total = len(test_results)
    passed = sum(1 for r in test_results if r["status"] == "passed")
    failed = sum(1 for r in test_results if r["status"] == "failed")
    skipped = total - passed - failed
    
    # 渲染 HTML 内容
    rows_html = ""
    run_dir = os.environ.get("AI_TESTER_RUN_DIR", "")
    
    for r in test_results:
        status_color = "green" if r["status"] == "passed" else ("red" if r["status"] == "failed" else "gray")
        status_text = r["status"].upper()
        
        error_html = f"<div class='error-log'>{r['error'][:500]}...</div>" if r["error"] else ""
        token_html = f"<div class='text-xs text-gray-500 mt-2'>Token: 总计 {r.get('token_total', 0)} (P {r.get('token_prompt', 0)} / C {r.get('token_completion', 0)})</div>"
        
        # 失败时尝试附上带红框的最后一次视觉截图
        screenshot_html = ""
        if r["status"] == "failed":
            debug_shot = r.get("last_debug_screenshot")
            fail_shot = os.path.join(run_dir, "failure_screenshots", f"{r['name']}_failed.png")
            
            shots = []
            if debug_shot and os.path.exists(debug_shot):
                try:
                    rel_debug = os.path.relpath(debug_shot, run_dir)
                    shots.append(f"""
                    <div class="flex-1">
                        <div class="text-sm text-gray-600 mb-1">🤖 AI 最后分析视角 (带标注):</div>
                        <a href="{rel_debug}" target="_blank">
                            <img src="{rel_debug}" class="border border-red-300 rounded max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity" alt="Debug Screenshot" />
                        </a>
                    </div>
                    """)
                except Exception:
                    pass
                    
            if fail_shot and os.path.exists(fail_shot):
                try:
                    rel_fail = os.path.relpath(fail_shot, run_dir)
                    shots.append(f"""
                    <div class="flex-1">
                        <div class="text-sm text-gray-600 mb-1">💥 最终失败瞬间截图:</div>
                        <a href="{rel_fail}" target="_blank">
                            <img src="{rel_fail}" class="border border-red-300 rounded max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity" alt="Failure Screenshot" />
                        </a>
                    </div>
                    """)
                except Exception:
                    pass
            
            if shots:
                screenshot_html = f"""
                <div class="mt-4 flex gap-4 overflow-x-auto bg-gray-50 p-4 rounded border border-gray-200">
                    {"".join(shots)}
                </div>
                """

        rows_html += f"""
        <div class="card border-l-4 border-{status_color}-500 shadow-sm p-4 mb-4 bg-white rounded">
            <div class="flex justify-between items-center">
                <div>
                    <h3 class="text-lg font-bold text-gray-800">{r['name']}</h3>
                    <p class="text-gray-500 text-sm mt-1">{r['doc']}</p>
                    {token_html}
                </div>
                <div class="text-right">
                    <span class="inline-block px-3 py-1 text-sm font-semibold rounded-full bg-{status_color}-100 text-{status_color}-800">
                        {status_text}
                    </span>
                    <div class="text-xs text-gray-400 mt-2">耗时: {r['duration']}</div>
                </div>
            </div>
            {error_html}
            {screenshot_html}
            {r.get('steps_html', '')}
        </div>
        """

    html_content = f"""
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AI 自动化测试报告</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
            body {{ background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }}
            .error-log {{ background: #fef2f2; color: #b91c1c; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px; margin-top: 10px; overflow-x: auto; }}
        </style>
    </head>
    <body class="p-8">
        <div class="max-w-4xl mx-auto">
            <h1 class="text-3xl font-extrabold text-gray-900 mb-2">🚀 AI 驱动 Web 自动化测试报告</h1>
            <p class="text-gray-500 mb-8">生成时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}</p>
            
            <!-- 统计面板 -->
            <div class="grid grid-cols-4 gap-4 mb-8">
                <div class="bg-white p-4 rounded shadow-sm border-t-4 border-blue-500 text-center">
                    <div class="text-gray-500 text-sm">总用例数</div>
                    <div class="text-2xl font-bold text-gray-800">{total}</div>
                </div>
                <div class="bg-white p-4 rounded shadow-sm border-t-4 border-green-500 text-center">
                    <div class="text-gray-500 text-sm">通过</div>
                    <div class="text-2xl font-bold text-green-600">{passed}</div>
                </div>
                <div class="bg-white p-4 rounded shadow-sm border-t-4 border-red-500 text-center">
                    <div class="text-gray-500 text-sm">失败</div>
                    <div class="text-2xl font-bold text-red-600">{failed}</div>
                </div>
                <div class="bg-white p-4 rounded shadow-sm border-t-4 border-gray-400 text-center">
                    <div class="text-gray-500 text-sm">跳过</div>
                    <div class="text-2xl font-bold text-gray-600">{skipped}</div>
                </div>
            </div>

            <!-- 测试用例列表 -->
            <h2 class="text-xl font-bold text-gray-800 mb-4">用例执行详情</h2>
            {rows_html}
        </div>
    </body>
    </html>
    """
    
    run_dir = os.environ.get("AI_TESTER_RUN_DIR")
    if run_dir:
        report_path = os.path.join(run_dir, "test_report.html")
        with open(report_path, "w", encoding="utf-8") as f:
            f.write(html_content)
        print(f"\n📊 测试报告已生成: file://{os.path.abspath(report_path)}")
        try:
            record_dir = os.environ.get("AI_TESTER_RUN_HISTORY_DIR")
            if record_dir:
                os.makedirs(record_dir, exist_ok=True)
                summary = {"tests": [], "totals": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}}
                for r in test_results:
                    nodeid = r.get("nodeid") or r.get("name")
                    totals = run_context.get_token_totals(nodeid)
                    events = run_context.get_events(nodeid)
                    llm_events = []
                    for e in events:
                        usage = e.get("token_usage")
                        if not usage:
                            continue
                        llm_events.append({
                            "ts": e.get("ts"),
                            "kind": e.get("kind"),
                            "message": e.get("message"),
                            "token_usage": usage,
                            "extra": e.get("extra"),
                        })
                    summary["tests"].append({
                        "name": r.get("name"),
                        "nodeid": nodeid,
                        "token_usage": totals,
                        "llm_events": llm_events,
                    })
                    summary["totals"]["prompt_tokens"] += int(totals.get("prompt_tokens", 0) or 0)
                    summary["totals"]["completion_tokens"] += int(totals.get("completion_tokens", 0) or 0)
                    summary["totals"]["total_tokens"] += int(totals.get("total_tokens", 0) or 0)
                out_path = os.path.join(record_dir, "token_usage.json")
                with open(out_path, "w", encoding="utf-8") as f:
                    json.dump(summary, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
    else:
        report_dir = os.path.join(os.getcwd(), "docs")
        os.makedirs(report_dir, exist_ok=True)
        report_path = os.path.join(report_dir, "test_report.html")
        with open(report_path, "w", encoding="utf-8") as f:
            f.write(html_content)
        print(f"\n📊 测试报告已生成: file://{os.path.abspath(report_path)}")
