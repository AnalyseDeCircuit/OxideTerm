#!/bin/bash

################################################################################
# OxideTerm 仓库迁移脚本
#
# 功能：
# 1. 备份当前仓库
# 2. 断开旧远程仓库
# 3. 关联新远程仓库
# 4. 推送到新仓库（可选：保留历史或清理历史）
#
# 作者：OxideTerm Team
# 日期：2026-01-21
################################################################################

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

################################################################################
# 配置区域
################################################################################

# GitHub 用户名
GITHUB_USERNAME="AnalyseDeCircuit"

# 仓库名称
OLD_REPO_NAME="oxideterm"
NEW_REPO_NAME="oxideterm"

# 远程 URL
OLD_REMOTE="https://github.com/${GITHUB_USERNAME}/${OLD_REPO_NAME}.git"
NEW_REMOTE="https://github.com/${GITHUB_USERNAME}/${NEW_REPO_NAME}.git"

# 本地路径
LOCAL_REPO="/Users/dominical/Documents/OxideTerm"
BACKUP_BASE_DIR="/Users/dominical/Documents"

################################################################################
# 辅助函数
################################################################################

print_header() {
    echo ""
    echo "=========================================="
    echo "$1"
    echo "=========================================="
    echo ""
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

confirm() {
    read -p "$1 (y/N): " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]]
}

################################################################################
# 步骤 1：备份
################################################################################

backup_repo() {
    print_header "步骤 1/7: 备份当前仓库"

    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_DIR="${BACKUP_BASE_DIR}/OxideTerm-backup-${TIMESTAMP}"

    print_info "备份路径: $BACKUP_DIR"

    if [ -d "$BACKUP_DIR" ]; then
        print_warning "备份目录已存在，将在其名称后添加序号"
        BACKUP_DIR="${BACKUP_DIR}_2"
    fi

    print_info "正在复制..."
    cp -R "$LOCAL_REPO" "$BACKUP_DIR"

    print_success "备份完成！"
    print_info "备份位置: $BACKUP_DIR"
}

################################################################################
# 步骤 2：检查当前状态
################################################################################

check_status() {
    print_header "步骤 2/7: 检查当前状态"

    cd "$LOCAL_REPO"

    # 检查 git 仓库
    if [ ! -d ".git" ]; then
        print_error "不是一个 git 仓库！"
        exit 1
    fi

    # 检查未提交的更改
    if [ -n "$(git status --porcelain)" ]; then
        print_warning "检测到未提交的更改"
        git status --short

        if confirm "是否先提交这些更改？"; then
            print_info "添加所有更改..."
            git add .
            print_info "提交中..."
            git commit -m "WIP: Final commit before migration" || {
                print_warning "没有需要提交的更改（可能只是未跟踪的文件）"
            }
            print_success "已提交"
        else
            print_error "存在未提交的更改，操作取消"
            exit 1
        fi
    else
        print_success "工作目录干净"
    fi

    # 检查当前分支
    CURRENT_BRANCH=$(git branch --show-current)
    print_info "当前分支: $CURRENT_BRANCH"

    # 检查远程
    print_info "当前远程仓库:"
    git remote -v
}

################################################################################
# 步骤 3：选择迁移模式
################################################################################

select_mode() {
    print_header "步骤 3/7: 选择迁移模式"

    echo ""
    echo "请选择迁移模式："
    echo ""
    echo "  1) 保留完整 git 历史（推荐）"
    echo "     - 保留所有 commit 历史"
    echo "     - 包含 CC BY-NC 4.0 时代的 commit"
    echo "     - 在 README 中说明许可证变更"
    echo ""
    echo "  2) 清理历史，重新开始（最干净）"
    echo "     - 删除所有 git 历史"
    echo "     - 创建全新的初始 commit"
    echo "     - 版本号改为 v2.0.0"
    echo "     - ⚠️  不可逆！"
    echo ""

    read -p "请输入选择 (1 或 2): " -r mode_choice
    echo ""

    case $mode_choice in
        1)
            MIGRATION_MODE="preserve"
            print_success "模式: 保留完整历史"
            ;;
        2)
            MIGRATION_MODE="clean"
            print_warning "模式: 清理历史（不可逆）"

            # 二次确认
            print_error "⚠️  警告：这将删除所有 git 历史！"
            print_error "⚠️  所有 commit 历史将永久丢失！"
            echo ""

            if ! confirm "确定要继续吗？"; then
                print_error "操作取消"
                exit 1
            fi

            # 三次确认
            if ! confirm "最后确认：真的要删除所有历史吗？"; then
                print_error "操作取消"
                exit 1
            fi
            ;;
        *)
            print_error "无效选择"
            exit 1
            ;;
    esac
}

################################################################################
# 步骤 4：断开旧远程
################################################################################

remove_old_remote() {
    print_header "步骤 4/7: 断开旧远程仓库"

    cd "$LOCAL_REPO"

    # 检查是否有 origin
    if git remote get-url origin &>/dev/null; then
        CURRENT_ORIGIN=$(git remote get-url origin)
        print_info "当前远程: $CURRENT_ORIGIN"

        if confirm "是否移除当前远程仓库？"; then
            git remote remove origin
            print_success "已移除旧远程"
        else
            print_error "操作取消"
            exit 1
        fi
    else
        print_info "没有远程仓库需要移除"
    fi
}

################################################################################
# 步骤 5：创建新仓库（提示）
################################################################################

prompt_create_repo() {
    print_header "步骤 5/7: 创建新 GitHub 仓库"

    echo ""
    echo "请在 GitHub 上创建新仓库："
    echo ""
    echo "  仓库链接: https://github.com/new"
    echo ""
    echo "  配置："
    echo "    - Repository name: $NEW_REPO_NAME"
    echo "    - Description: OxideTerm - Modern SSH Terminal Client"
    echo "    - Public: ✅"
    echo "    - ⚠️  不勾选 'Add a README file'"
    echo "    - ⚠️  不勾选 'Add .gitignore'"
    echo "    - ⚠️  不勾选 'Choose a license'"
    echo ""

    if confirm "是否已在 GitHub 创建新仓库？"; then
        print_success "继续..."
    else
        print_info "请先创建仓库，然后重新运行此脚本"
        exit 1
    fi
}

################################################################################
# 步骤 6：关联新远程并推送
################################################################################

push_to_new_repo() {
    print_header "步骤 6/7: 推送到新仓库"

    cd "$LOCAL_REPO"

    # 添加新远程
    print_info "添加新远程仓库: $NEW_REMOTE"
    git remote add origin "$NEW_REMOTE"
    print_success "已添加新远程"

    # 验证远程
    print_info "验证远程配置:"
    git remote -v

    echo ""

    # 根据模式推送
    if [ "$MIGRATION_MODE" = "preserve" ]; then
        print_info "推送模式: 保留历史"
        print_info "推送中（可能需要几分钟）..."

        # 确保在 main 分支
        git branch -M main

        # 推送所有分支和标签
        git push -u origin main --tags || {
            print_error "推送失败！"
            print_info "可能的原因："
            print_info "  1. 新仓库未创建"
            print_info "  2. 仓库名称错误"
            print_info "  3. 网络问题"
            exit 1
        }

        print_success "推送完成！"

    else
        print_info "推送模式: 清理历史"

        # 删除 .git 目录
        print_warning "删除 git 历史..."
        rm -rf .git

        # 重新初始化
        print_info "重新初始化 git 仓库..."
        git init

        # 添加所有文件
        print_info "添加文件..."
        git add .

        # 创建初始 commit
        print_info "创建初始 commit..."
        git commit -m "Initial release v2.0.0 under PolyForm Noncommercial 1.0.0

OxideTerm - Modern SSH Terminal Client

Features:
- SSH connection pool with multiplexing
- Local terminal integration (PTY)
- Dynamic session tree for jump hosts
- SFTP with resume support
- Port forwarding (Local/Remote/Dynamic)
- Cross-platform (macOS/Windows/Linux)

License: PolyForm Noncommercial 1.0.0
"

        # 重命名分支
        git branch -M main

        # 推送
        print_info "推送到新仓库..."
        git push -u origin main --force || {
            print_error "推送失败！"
            exit 1
        }

        # 创建标签
        print_info "创建版本标签..."
        git tag -a v2.0.0 -m "Release v2.0.0 - Clean start under PolyForm NC 1.0.0

This is a fresh start of the OxideTerm project with:
- Clean git history
- PolyForm Noncommercial 1.0.0 license
- Version 2.0.0 to signify the new beginning
"

        git push origin v2.0.0

        print_success "推送完成！"
        print_success "新版本: v2.0.0"
    fi
}

################################################################################
# 步骤 7：验证
################################################################################

verify_migration() {
    print_header "步骤 7/7: 验证迁移"

    cd "$LOCAL_REPO"

    print_info "验证远程配置:"
    git remote -v

    echo ""
    print_info "验证分支跟踪:"
    git branch -vv

    echo ""
    print_info "验证最近的 commit:"
    git log --oneline -3

    echo ""
    print_info "验证标签:"
    git tag -l | tail -5

    echo ""
    print_success "验证完成！"
}

################################################################################
# 完成提示
################################################################################

print_completion() {
    print_header "迁移完成！"

    echo ""
    print_success "OxideTerm 仓库迁移成功！"
    echo ""

    echo "📊 迁移信息:"
    echo "   旧仓库: $OLD_REMOTE"
    echo "   新仓库: $NEW_REMOTE"
    echo "   模式: $MIGRATION_MODE"
    echo "   备份: $BACKUP_DIR"
    echo ""

    echo "🎯 下一步操作:"
    echo ""
    echo "   1. 访问新仓库验证:"
    echo "      $NEW_REMOTE"
    echo ""
    echo "   2. 更新 README.md 添加说明"
    echo ""
    echo "   3. 在旧仓库添加迁移公告:"
    echo "      - 编辑 README.md"
    echo "      - 说明已迁移到新仓库"
    echo "      - 设为 Private (Settings → Danger Zone)"
    echo ""

    if [ "$MIGRATION_MODE" = "clean" ]; then
        echo "   4. 更新版本号至 v2.0.0:"
        echo "      - package.json"
        echo "      - src-tauri/Cargo.toml"
        echo "      - tauri.conf.json"
        echo ""
    fi

    echo "📖 参考资料:"
    echo "   - PolyForm Noncommercial: https://polyformproject.org/licenses/noncommercial/1.0.0/"
    echo ""

    print_success "祝您使用愉快！⚡"
}

################################################################################
# 主流程
################################################################################

main() {
    clear

    echo ""
    echo "⚡ OxideTerm 仓库迁移脚本 ⚡"
    echo ""
    echo "GitHub 用户: $GITHUB_USERNAME"
    echo "新仓库名: $NEW_REPO_NAME"
    echo ""

    if ! confirm "确定要开始迁移吗？"; then
        print_info "操作取消"
        exit 0
    fi

    # 执行迁移步骤
    backup_repo
    check_status
    select_mode
    remove_old_remote
    prompt_create_repo
    push_to_new_repo
    verify_migration
    print_completion

    echo ""
    print_info "按任意键退出..."
    read -n 1
}

# 运行主流程
main
