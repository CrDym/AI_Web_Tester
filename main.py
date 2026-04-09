import argparse
import os
import sys
import subprocess

# 确保能找到 src 目录下的包
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'src')))

from ai_tester import TestCaseGenerator
from dotenv import load_dotenv

def main():
    """
    AI Web Tester 框架主入口
    """
    load_dotenv()
    
    parser = argparse.ArgumentParser(
        description="🤖 AI Web Tester 命令行工具",
        formatter_class=argparse.RawTextHelpFormatter
    )
    
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    # ==========================================
    # 命令 1: run (执行测试用例)
    # ==========================================
    run_parser = subparsers.add_parser(
        "run", 
        help="运行自动化测试用例并生成 HTML 报告"
    )
    run_parser.add_argument(
        "test_path", 
        nargs="?", 
        default="examples/", 
        help="要运行的测试文件或目录路径 (默认: examples/)"
    )
    run_parser.add_argument(
        "--headless", 
        action="store_true", 
        help="以无头模式(不显示浏览器界面)运行测试"
    )
    
    # ==========================================
    # 命令 2: generate (生成测试代码)
    # ==========================================
    gen_parser = subparsers.add_parser(
        "generate", 
        help="通过需求文档(PRD)或自然语言描述自动生成 Python 测试代码"
    )
    gen_parser.add_argument(
        "--prd", 
        type=str, 
        help="PRD 需求文件路径 (例如: docs/requirements/login.md)"
    )
    gen_parser.add_argument(
        "--text",
        type=str,
        help="自然语言测试描述 (例如: '打开百度，搜索 AI，预期结果是包含人工智能')"
    )
    gen_parser.add_argument(
        "--out", 
        type=str, 
        required=True,
        help="生成的 Python 测试文件保存路径 (例如: tests/test_my_feature.py)"
    )
    gen_parser.add_argument(
        "--model", 
        type=str, 
        default="gpt-4o",
        help="使用的大语言模型名称 (默认: gpt-4o)"
    )

    args = parser.parse_args()

    # ==========================================
    # 处理 'run' 命令
    # ==========================================
    if args.command == "run":
        print(f"🚀 正在启动 AI 驱动自动化测试: {args.test_path}")
        
        pytest_args = ["pytest", args.test_path, "-s"]
        
        # 兼容无头模式配置
        # 注意: pytest-playwright 默认 headless=True, 我们在 conftest 中需要配合修改，或者直接通过 CLI 传参
        # 这里我们通过环境变量将用户的期望传递给测试脚本
        if args.headless:
            os.environ["PLAYWRIGHT_HEADLESS"] = "1"
            print("👁️  已开启 Headless (无头) 模式")
        else:
            os.environ["PLAYWRIGHT_HEADLESS"] = "0"
            print("👁️  已开启 UI 可视化模式")
            
        try:
            subprocess.run(pytest_args, check=True)
        except subprocess.CalledProcessError:
            print("\n❌ 测试执行完成，部分用例失败，请查看生成的 HTML 报告。")
        except FileNotFoundError:
            print("❌ 找不到 pytest 命令，请确保已安装依赖: pip install pytest")

    # ==========================================
    # 处理 'generate' 命令
    # ==========================================
    elif args.command == "generate":
        if not args.text and not args.prd:
            print("❌ 错误: 必须提供 --text 或 --prd 参数之一来描述需求。")
            return
            
        if args.text:
            prd_content = args.text
            print(f"💬 已接收自然语言测试描述: '{args.text}'")
        else:
            if not os.path.exists(args.prd):
                print(f"❌ 错误: 找不到 PRD 文件 '{args.prd}'")
                return
            with open(args.prd, "r", encoding="utf-8") as f:
                prd_content = f.read()
            print(f"📄 已成功加载外部 PRD 文件: {args.prd}")
            
        generator = TestCaseGenerator(model_name=args.model)
        output_path = os.path.abspath(args.out)
        
        print(f"\n⚙️  正在调用大模型 ({args.model}) 分析需求并生成代码中...")
        success = generator.generate_from_prd(prd_content, output_path)
        
        if success:
            print(f"\n🎉 自动生成测试脚本成功！")
            print(f"   保存路径: {output_path}")
            print(f"   运行命令: python main.py run {args.out}")
        else:
            print("\n❌ 生成失败。请查看日志。")

    # ==========================================
    # 未输入命令时显示帮助
    # ==========================================
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
