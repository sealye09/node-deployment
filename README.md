# node-deployment

## 简介

本项目为一键部署脚本，支持将本地构建产物自动上传并部署到远程服务器，支持备份、自动清理、环境区分等功能。适用于 Node.js 前端/后端项目的自动化部署。

---

## 依赖环境

- Node.js 18+
- ssh、scp、unzip（本地需安装并配置好环境变量）
- 远程服务器需支持 ssh 登录

---

## 快速开始

1. **安装依赖**

   ```bash
   pnpm install
   # 或
   npm install
   ```

2. **配置环境变量**

   - 复制 `.env.template.local` 为 `.env.test.local`、`.env.production.local` 或 `.env.local`，并根据实际环境填写变量。

     ```bash
     cp .env.template.local .env.test.local
     cp .env.template.local .env.production.local
     ```

   - 主要变量说明：

     | 变量名        | 说明                                                      |
     | ------------- | --------------------------------------------------------- |
     | SERVER        | 远程服务器 SSH 连接信息（如 user@host 或 user@ip）        |
     | REMOTE_DIR    | 远程部署目录（绝对路径，需有写权限）                      |
     | BUILD_COMMAND | 本地构建命令（如 `npm run build`、`pnpm run build:prod`） |
     | DIST_PATH     | 构建产物目录（相对项目根目录，通常为 dist 或 build）      |
     | BACKUP_COUNT  | 远程备份保留数量（1-100，超出自动删除最旧备份）           |

   - 详细变量说明见 `.env.template.local` 文件注释。

3. **执行部署**

   ```bash
   pnpm deploy --mode test
   # 或
   node index.js --mode production
   ```

   可选参数：

   - `--mode <mode>` 指定部署环境（test 或 production）
   - `--skip-build` 跳过本地构建步骤，仅部署
   - `--no-backup` 不创建远程备份
   - `--force` 跳过所有确认，强制执行

---

## 主要特性

- 支持多环境部署（test/production）
- 自动本地构建、压缩、上传、远程解压
- 远程备份与备份数量自动清理
- 环境变量安全校验
- 详细日志与进度提示

---

## 注意事项

- 远程目录需提前创建并赋予写权限
- 推荐使用权限受限的 Linux 用户进行部署，避免使用 root
- 本地需安装 ssh、scp、unzip 等命令行工具
- 所有环境变量均为必填项，否则部署会报错

---

## 参考

- `.env.template.local` 文件内含详细变量说明与使用建议
- 如需自定义构建产物目录，修改 `DIST_PATH`
- 备份文件将存放于 `$REMOTE_DIR/__backups__` 目录下
