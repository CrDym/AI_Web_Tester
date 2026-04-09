# AI Web Tester 进阶开发计划 (Todo List)

这个文档记录了框架从“基础骨架”迈向“企业级生产环境”所需的关键能力升级。我们将按优先级分阶段实施以下特性。

## 🎯 阶段一：核心交互与视觉能力增强 (High Priority)

当前框架仅依赖 DOM 文本树，面对复杂 UI（如 Canvas、悬浮菜单、动态拖拽）时能力受限。本阶段致力于让 AI 真正“看懂”并能操作一切网页元素。

- [ ] **支持多模态视觉 (Vision Support)**
  - 在 `driver.py` 中新增 `capture_screenshot(base64=True)` 方法。
  - 在 `agent.py` 和 `asserter.py` 中引入支持图片输入的 Prompt 模板。
  - 允许用户在调用时传入参数 `use_vision=True`，让 `gpt-4o` 或 `claude-3.5-sonnet` 结合 DOM 树与页面截图进行综合决策。
- [ ] **扩展底层交互动作 (Complex Actions)**
  - 在 `driver.py` 和 `extract_elements.js` 中增加对更复杂组件的解析与操作支持。
  - 新增动作：`hover` (鼠标悬停触发下拉)。
  - 新增动作：`select_option` (原生的 `<select>` 下拉框选择)。
  - 新增动作：`drag_and_drop` (拖拽交互，需大模型输出起始与目标坐标/ID)。
  - 新增动作：`press_key` (模拟键盘按键，如 `Enter`, `Tab`, `Escape`)。

## 🚀 阶段二：降本增效与性能优化 (Medium Priority)

大模型的 API 调用既慢又贵，在 CI/CD 流水线中跑成百上千个用例时，我们需要极大地优化自愈引擎的成本和整体执行速度。

- [ ] **构建本地元素快照缓存 (Local Healer Cache)**
  - 在 `PlaywrightDriver` 成功执行传统定位器操作时，将该元素的 DOM 片段和 XPath 存入本地 JSON/SQLite 缓存中。
  - 触发 `SelfHealer` 时，**先不调用大模型**。
  - 编写一个基于字符串相似度（如 LCS 最长公共子序列）的算法，在当前页面的 DOM 中寻找与历史快照最相似的元素。
  - 只有在相似度算法匹配失败时，才 fallback 到昂贵的 LLM 调用。
- [ ] **重构为异步架构 (Asyncio Support)**
  - 将底层从 `playwright.sync_api` 迁移至 `playwright.async_api`。
  - 让大模型的 HTTP 请求 (`llm.ainvoke()`) 与浏览器的动作完全异步化，大幅提升并发测试执行速度。

## 📊 阶段三：工程化与测试生态集成 (Low Priority)

为了让 QA 团队更顺滑地接入，我们需要兼容现有的成熟测试生态规范。

- [ ] **支持数据驱动测试 (Data-Driven Generation)**
  - 优化 `TestCaseGenerator` (PRD 生成器)。
  - 当需求文档中包含多组测试数据时，自动生成带有 `@pytest.mark.parametrize` 装饰器的数据驱动测试代码。
- [ ] **深度集成 Allure 报告 (Allure Integration)**
  - 编写新的 Pytest 插件，挂载到 Allure 的生命周期中。
  - 在生成的 Allure 报告的每个 Test Step 中，作为附件 (Attachments) 自动附上：
    - 大模型的完整 Prompt 和 JSON 响应。
    - 当前页面的截图。
    - 该步骤消耗的 Token 数量和耗时统计。

## 🔮 远期规划：产品化探索 (Future)

- [ ] **零代码录制插件 (Chrome Extension Recorder)**
  - 开发一个基于 Chrome 扩展程序的录制器。
  - 用户在浏览器上正常操作业务流程，插件抓取操作轨迹，并调用 LLM 将其自动“翻译”为 `agent.step("自然语言意图")` 的 Python 脚本。
