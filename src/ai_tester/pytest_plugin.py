import sys
import os
import pytest
import time
from datetime import datetime

# ================= 简洁美观的自定义 HTML 测试报告 =================
test_results = []

@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    report = outcome.get_result()
    if report.when == "call":
        # 收集每个测试用例的结果
        test_results.append({
            "name": item.name,
            "status": report.outcome,
            "duration": f"{report.duration:.2f}s",
            "doc": item.obj.__doc__.strip() if item.obj.__doc__ else "无描述信息",
            "error": str(report.longrepr) if report.failed else None
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
    for r in test_results:
        status_color = "green" if r["status"] == "passed" else ("red" if r["status"] == "failed" else "gray")
        status_text = r["status"].upper()
        
        error_html = f"<div class='error-log'>{r['error'][:200]}...</div>" if r["error"] else ""
        
        rows_html += f"""
        <div class="card border-l-4 border-{status_color}-500 shadow-sm p-4 mb-4 bg-white rounded">
            <div class="flex justify-between items-center">
                <div>
                    <h3 class="text-lg font-bold text-gray-800">{r['name']}</h3>
                    <p class="text-gray-500 text-sm mt-1">{r['doc']}</p>
                </div>
                <div class="text-right">
                    <span class="inline-block px-3 py-1 text-sm font-semibold rounded-full bg-{status_color}-100 text-{status_color}-800">
                        {status_text}
                    </span>
                    <div class="text-xs text-gray-400 mt-2">耗时: {r['duration']}</div>
                </div>
            </div>
            {error_html}
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
    
    # 确保 docs 目录存在
    report_dir = os.path.join(os.getcwd(), "docs")
    os.makedirs(report_dir, exist_ok=True)
    
    report_path = os.path.join(report_dir, "test_report.html")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    
    print(f"\n📊 简洁美观的测试报告已生成: file://{os.path.abspath(report_path)}")

