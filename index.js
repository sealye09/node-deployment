import fs from "node:fs";
import os from "node:os";

import archiver from "archiver";
import { execSync } from "child_process";
import { program } from "commander";
import dotenv from "dotenv";
import * as pathe from "pathe";

const log = (message, color = "reset") => {
  const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    cyan: "\x1b[36m",
  };
  console.log(`${colors[color]}${message}${colors.reset}`);
};

// 1. Mode Selection
program
  .name("deploy")
  .description("部署应用到远程服务器")
  .requiredOption("--mode <mode>", "部署模式 (test 或 production)", (value) => {
    if (!["test", "production"].includes(value)) {
      log('Error: Invalid mode. Use "test" or "production".', "red");
      process.exit(1);
    }
    return value;
  });

program.parse();
const options = program.opts();
const mode = options.mode;

log(`Starting ${mode} deployment...`, "green");

// 2. Environment Check
log("Checking Node.js environment...", "yellow");
const nodeVersion = process.version;
log(`Current Node version: ${nodeVersion}`, "cyan");
if (!nodeVersion.startsWith("v22")) {
  log("Error: Node.js v22 is required!", "red");
  process.exit(1);
}

// 定义环境相关文件和路径
const scriptDir = __dirname;
const projectRoot = pathe.resolve(scriptDir, "..");
// distFolder 不可配置，与 mode 保持一致
const distFolder = mode;
// envFile 不可配置，固定格式为 .env.{mode}.local
const envFile = `.env.${mode}.local`;
const distPath = pathe.join(projectRoot, "dist", distFolder);
const zipFile = pathe.join(os.tmpdir(), `dist-${distFolder}.zip`);
const envFilePath = pathe.join(scriptDir, envFile);

log(`Mode: ${mode}`, "yellow");
log(`Environment File: ${envFile}`, "yellow");
log(`Dist Path: ${distPath}`, "yellow");

// 加载环境变量
if (!fs.existsSync(envFilePath)) {
  log(`Error: ${envFile} file not found in deploy/ directory!`, "red");
  process.exit(1);
}
dotenv.config({ pathe: envFilePath });

// 从环境文件中读取 buildCommand，如果未配置则使用默认值
const buildCommand = process.env.BUILD_COMMAND || `npm run build:${mode}`;
log(`Build Command: ${buildCommand}`, "yellow");

const { SERVER, REMOTE_DIR } = process.env;

if (!SERVER || !REMOTE_DIR) {
  log(`Error: SERVER or REMOTE_DIR not set in ${envFile}!`, "red");
  process.exit(1);
}

const executeCommand = (command, options = {}) => {
  try {
    execSync(command, { stdio: "inherit", ...options });
  } catch (error) {
    log(`Error executing command: ${command}`, "red");
    log(error.message, "red");
    process.exit(1);
  }
};

// 3. Build
log(`Building ${mode} environment...`, "green");
executeCommand(buildCommand, { cwd: projectRoot });

// 5. Compress
const compressFiles = async () => {
  log("Compressing build files...", "yellow");
  if (fs.existsSync(zipFile)) {
    fs.unlinkSync(zipFile);
  }
  const output = fs.createWriteStream(zipFile);
  const archive = archiver("zip", {
    zlib: { level: 9 }, // Sets the compression level.
  });

  return new Promise((resolve, reject) => {
    output.on("close", () => {
      log(`Compression completed successfully. ${archive.pointer()} total bytes`, "green");
      resolve();
    });

    archive.on("warning", (err) => {
      if (err.code === "ENOENT") {
        log(`Warning during compression: ${err.message}`, "yellow");
      } else {
        reject(err);
      }
    });

    archive.on("error", (err) => {
      reject(err);
    });

    archive.pipe(output);
    archive.directory(distPath, false);
    archive.finalize();
  });
};

const deploy = async () => {
  try {
    await compressFiles();

    const remoteDirNormalized = REMOTE_DIR.replace(/\\/g, "/");
    const remoteZipPath = `${remoteDirNormalized}/dist.zip`;

    // 7. Remote Execution
    log("Preparing remote directory...", "yellow");
    executeCommand(`ssh ${SERVER} "mkdir -p ${remoteDirNormalized}"`);

    // Create backup before cleaning
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = `${remoteDirNormalized}_backup_${timestamp}`;
    log("正在备份当前部署内容...", "yellow");
    executeCommand(
      `ssh ${SERVER} "if [ -d ${remoteDirNormalized} ] && [ $(ls -A ${remoteDirNormalized} 2>/dev/null) ]; then mkdir -p ${backupDir} && cp -R ${remoteDirNormalized}/* ${backupDir}/; fi"`,
    );
    log(`备份已创建于: ${backupDir}`, "green");

    log("正在清理远程目录...", "yellow");
    executeCommand(`ssh ${SERVER} "rm -rf ${remoteDirNormalized}/*"`);

    log("Uploading compressed files...", "yellow");
    executeCommand(`scp "${zipFile}" "${SERVER}:${remoteZipPath}"`);

    log("Extracting files on remote server...", "yellow");
    const remoteCommands = `
            cd ${remoteDirNormalized} &&
            unzip -o dist.zip &&
            rm dist.zip &&
            chmod -R 755 .
        `;
    executeCommand(`ssh ${SERVER} "${remoteCommands.replace(/\s+/g, " ")} "`);

    // 8. Cleanup
    log("Cleaning up local temporary files...", "yellow");
    fs.unlinkSync(zipFile);

    log("Deployment completed!", "green");
  } catch (error) {
    log(`Deployment failed: ${error.message}`, "red");
    process.exit(1);
  }
};

deploy();
