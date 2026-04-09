import os
import sys

# 将 src 目录添加到 sys.path 中以便可以导入 ai_tester
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../src')))

from ai_tester import TestCaseGenerator
from dotenv import load_dotenv

def main():
    load_dotenv()
    
    # 模拟一份简单的产品需求文档 (PRD) 或自然语言描述
    sample_prd = """
    # 功能描述: 电商网站的商品搜索功能
    
    ## 测试场景 1: 成功的搜索
    1. 打开测试网站: https://magento.softwaretestingboard.com/
    2. 在顶部的搜索框中输入关键字: "shirt"
    3. 按下回车键或点击搜索按钮
    4. 预期结果: 页面跳转到搜索结果页，且页面上展示了包含 "shirt" 的商品列表。
    """
    
    generator = TestCaseGenerator(model_name="gpt-4o")
    output_path = os.path.join(os.path.dirname(__file__), "test_generated_search.py")
    
    print(f"正在读取需求描述:\n{sample_prd}")
    
    # 调用生成引擎
    success = generator.generate_from_prd(sample_prd, output_path)
    
    if success:
        print(f"\n🎉 自动生成测试脚本成功！您可以运行 `pytest {output_path} -s` 来执行它。")
    else:
        print("\n❌ 生成失败。")

if __name__ == "__main__":
    main()
