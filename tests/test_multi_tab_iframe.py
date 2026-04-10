import pytest
from ai_tester import PlaywrightDriver, AITesterAgent, SmartAsserter

def test_multi_tab_and_iframe(page):
    driver = PlaywrightDriver(page)
    agent = AITesterAgent(driver, use_vision=True, temperature=0)

    import os
    # We will create a local HTML file that has an iframe and opens a new tab
    html_content = """
    <html>
    <body>
        <h1>Main Page</h1>
        <button onclick="window.open('iframe.html', '_blank')">Open New Tab</button>
        <iframe src="iframe.html" width="400" height="300" id="myframe"></iframe>
    </body>
    </html>
    """
    iframe_content = """
    <html>
    <body>
        <h2>Iframe Content</h2>
        <button id="iframe-btn" onclick="document.body.style.backgroundColor = 'green';">Click Me In Iframe</button>
        <div id="overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999;" class="cf-modal-wrap">
            <button class="cf-modal-close" onclick="document.getElementById('overlay').style.display='none'">Close</button>
        </div>
        <button onclick="document.getElementById('overlay').style.display='block'">Show Overlay</button>
    </body>
    </html>
    """
    try:
        with open("main.html", "w") as f: f.write(html_content)
        with open("iframe.html", "w") as f: f.write(iframe_content)

        page.goto(f"file://{os.path.abspath('main.html')}")

        # 1. Test clicking element inside iframe
        success = agent.step("Click the 'Click Me In Iframe' button and return done", max_steps=5)
        assert success

        # 2. Test overlay handling
        success = agent.step("Click 'Show Overlay', then immediately click 'Click Me In Iframe' (do not click Close explicitly), and return done", max_steps=5)
        assert success

        # 3. Test opening new tab
        success = agent.step("Click 'Open New Tab'. Once clicked, return done immediately in the next step.", max_steps=5)
        assert success

        # 4. In new tab, click 'Click Me In Iframe'
        success = agent.step("Click 'Click Me In Iframe' in the new tab and return done", max_steps=5)
        assert success
    finally:
        if os.path.exists("main.html"): os.remove("main.html")
        if os.path.exists("iframe.html"): os.remove("iframe.html")

