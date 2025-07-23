import fs from "node:fs";
import os from "node:os";

import archiver from "archiver";
import { program } from "commander";
import dotenv from "dotenv";
import * as pathe from "pathe";

import { confirmAction, executeCommand, log, showProgress } from "./utils.js";

// Mode Selection
program
  .name("deploy")
  .description("部署应用到远程服务器")
  .requiredOption("--mode <mode>", "部署模式 (test 或 production)", (value) => {
    if (!["test", "production"].includes(value)) {
      log('Error: Invalid mode. Use "test" or "production".', "red");
      process.exit(1);
    }
    return value;
  })
  .option("--skip-build", "跳过构建步骤，仅部署")
  .option("--no-backup", "不创建远程备份")
  .option("--force", "不进行确认，强制部署");

// parse arguments
program.parse();

const options = program.opts();
const mode = options.mode;
const skipBuild = options.skipBuild;
const createBackup = options.backup;
const force = options.force;

log(`准备${mode}环境部署...`, "green");

// 定义环境相关文件和路径
const scriptDir = import.meta.dirname;
const projectRoot = pathe.resolve(scriptDir, "..");
// distFolder 不可配置，与 mode 保持一致
const distFolder = mode;
// envFile 不可配置，固定格式为 .env.{mode}.local
const envFile = `.env.${mode}.local`;
const distPath = pathe.join(projectRoot, "dist", distFolder);
const zipFile = pathe.join(os.tmpdir(), `dist-${distFolder}.zip`);
const envFilePath = pathe.join(scriptDir, envFile);

log(`模式: ${mode}`, "yellow");
log(`环境文件: ${envFile}`, "yellow");
log(`构建目录: ${distPath}`, "yellow");

// 加载环境变量
if (!fs.existsSync(envFilePath)) {
  log(`错误: ${envFile} 文件在 deploy/ 目录中不存在!`, "red");
  process.exit(1);
}
dotenv.config({ path: envFilePath });

const { SERVER, REMOTE_DIR, BUILD_COMMAND } = process.env;

// 验证必要的环境变量
const validateEnv = () => {
  const missingVars = [];

  if (!SERVER) missingVars.push("SERVER");
  if (!REMOTE_DIR) missingVars.push("REMOTE_DIR");
  if (!BUILD_COMMAND) missingVars.push("BUILD_COMMAND");

  if (missingVars.length > 0) {
    log(
      `错误: ${envFile} 中缺少必要的环境变量: ${missingVars.join(", ")}`,
      "red"
    );
    process.exit(1);
  }
};

validateEnv();

// 压缩构建文件
const compressFiles = async () => {
  log("压缩构建文件...", "yellow");

  if (!fs.existsSync(distPath)) {
    log(`错误: 构建目录 ${distPath} 不存在!`, "red");
    process.exit(1);
  }

  if (fs.existsSync(zipFile)) {
    fs.unlinkSync(zipFile);
  }

  const output = fs.createWriteStream(zipFile);
  const archive = archiver("zip", {
    zlib: { level: 9 }, // 设置压缩级别
  });

  return new Promise((resolve, reject) => {
    output.on("close", () => {
      log(
        `压缩完成，总大小: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`,
        "green"
      );
      resolve();
    });

    archive.on("warning", (err) => {
      if (err.code === "ENOENT") {
        log(`压缩警告: ${err.message}`, "yellow");
      } else {
        reject(err);
      }
    });

    archive.on("error", (err) => {
      reject(err);
    });

    // 显示压缩进度
    let lastPercent = 0;
    archive.on("progress", (progress) => {
      if (progress.entries.total > 0) {
        const percent = Math.round(
          (progress.entries.processed / progress.entries.total) * 100
        );
        if (percent !== lastPercent && percent % 5 === 0) {
          showProgress(
            "压缩进度",
            progress.entries.processed,
            progress.entries.total
          );
          lastPercent = percent;
        }
      }
    });

    archive.pipe(output);
    archive.directory(distPath, false);
    archive.finalize();
  });
};

const deploy = async () => {
  try {
    // 构建步骤
    if (!skipBuild) {
      log(`构建${mode}环境...`, "green");
      const buildResult = executeCommand(BUILD_COMMAND, { cwd: projectRoot });
      if (!buildResult.success) {
        log("构建失败，中止部署", "red");
        process.exit(1);
      }
    } else {
      log("跳过构建步骤...", "yellow");
    }

    // 检查构建目录是否存在
    if (!fs.existsSync(distPath)) {
      log(`错误: 构建目录 ${distPath} 不存在!`, "red");
      log("请先构建项目或检查构建路径", "red");
      process.exit(1);
    }

    // 确认部署
    if (!force) {
      log("部署详情:", "cyan");
      log(`- 模式: ${mode}`, "cyan");
      log(`- 服务器: ${SERVER}`, "cyan");
      log(`- 远程目录: ${REMOTE_DIR}`, "cyan");
      log(`- 备份: ${createBackup ? "是" : "否"}`, "cyan");

      const confirmed = await confirmAction("确认要进行部署吗?", "y");
      if (!confirmed) {
        log("部署已取消", "yellow");
        process.exit(0);
      }
    }

    // 压缩文件
    await compressFiles();

    const remoteDirNormalized = REMOTE_DIR.replace(/\\/g, "/");
    const remoteZipPath = `${remoteDirNormalized}/dist.zip`;

    // 准备远程目录
    log("准备远程目录...", "yellow");
    executeCommand(`ssh ${SERVER} "mkdir -p ${remoteDirNormalized}"`);

    // 创建备份
    if (createBackup) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupFileName = `backup_${timestamp}.zip`;
      const backupFilePath = `${remoteDirNormalized}/${backupFileName}`;

      log("准备创建备份...", "yellow");
      // 上传文件
      log("上传压缩文件到远程服务器...", "yellow");
      executeCommand(`scp "${zipFile}" "${SERVER}:${remoteZipPath}"`);

      // 重命名为备份文件
      log("重命名为备份文件...", "yellow");
      executeCommand(
        `ssh ${SERVER} "cd ${remoteDirNormalized} && cp dist.zip ${backupFileName}"`
      );

      // 限制备份文件数量为10个，删除最旧的备份文件
      log("检查并清理多余的备份文件...", "yellow");
      executeCommand(
        `ssh ${SERVER} "cd ${remoteDirNormalized} && ls -1t backup_*.zip 2>/dev/null | awk 'NR>10 {print}' | xargs -r rm -f"`
      );

      log(`备份已创建于远程服务器: ${backupFilePath}`, "green");
    } else {
      log("跳过备份步骤...", "yellow");
      // 直接上传文件
      log("上传压缩文件到远程服务器...", "yellow");
      executeCommand(`scp "${zipFile}" "${SERVER}:${remoteZipPath}"`);
    }

    // 清理远程目录（保留备份文件）
    log("正在清理远程目录...", "yellow");
    executeCommand(
      `ssh ${SERVER} "find ${remoteDirNormalized} -type f -not -name 'backup_*.zip' -not -name 'dist.zip' -delete && find ${remoteDirNormalized} -type d -empty -delete"`
    );

    // 在远程服务器解压文件
    log("在远程服务器解压文件...", "yellow");
    const remoteCommands = [
      `cd ${remoteDirNormalized}`,
      `unzip -o dist.zip`,
      `rm dist.zip`,
      `chmod -R 755 .`,
    ];
    executeCommand(`ssh ${SERVER} "${remoteCommands.join(" && ")}"`);

    // 清理本地临时文件
    log("清理本地临时文件...", "yellow");
    if (fs.existsSync(zipFile)) {
      fs.unlinkSync(zipFile);
    }

    log("部署完成!", "green");
  } catch (error) {
    log(`部署失败: ${error.message}`, "red");
    process.exit(1);
  }
};

deploy();
