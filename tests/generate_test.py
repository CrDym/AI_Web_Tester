import os
import sys
import argparse

# 将 src 目录添加到 sys.path 中以便可以导入 ai_tester
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../src')))

from ai_tester import TestCaseGenerator
from dotenv import load_dotenv

def main():
    load_dotenv()
    
    # 使用 argparse 处理命令行参数
    parser = argparse.ArgumentParser(description="根据 PRD/需求文档自动生成测试代码")
    parser.add_argument(
        "--prd", 
        type=str, 
        help="PRD 文件路径 (例如: docs/requirements/login.md)。如果不提供，将使用内置的模拟需求。"
    )
    parser.add_argument(
        "--out", 
        type=str, 
        default="tests/test_generated_feature.py",
        help="生成的 Python 测试文件保存路径 (默认: tests/test_generated_feature.py)"
    )
    
    args = parser.parse_args()
    
    # 确定要读取的需求内容
    if args.prd:
        if not os.path.exists(args.prd):
            print(f"❌ 错误: 找不到 PRD 文件 '{args.prd}'")
            return
        with open(args.prd, "r", encoding="utf-8") as f:
            prd_content = f.read()
        print(f"📄 已成功加载外部 PRD 文件: {args.prd}")
    else:
        # 如果没有传入文件，使用内置的模拟 PRD
        prd_content = """
        # 功能描述: 电商网站的商品搜索功能
        
        ## 测试场景 1: 成功的搜索
        1. 打开测试网站: https://magento.softwaretestingboard.com/
        2. 在顶部的搜索框中输入关键字: "shirt"
        3. 按下回车键或点击搜索按钮
        4. 预期结果: 页面跳转到搜索结果页，且页面上展示了包含 "shirt" 的商品列表。
        """
        print("💡 未提供 --prd 参数，将使用内置的模拟需求进行生成演示。")
    
    generator = TestCaseGenerator(model_name="gpt-4o")
    output_path = os.path.abspath(args.out)
    
    print(f"\n正在分析需求描述，生成代码中...")
    
    # 调用生成引擎
    success = generator.generate_from_prd(prd_content, output_path)
    
    if success:
        print(f"\n🎉 自动生成测试脚本成功！")
        print(f"   保存路径: {output_path}")
        print(f"   执行命令: pytest {args.out} -s")
    else:
        print("\n❌ 生成失败。请查看日志。")

if __name__ == "__main__":
    main()
