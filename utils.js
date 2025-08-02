import { execSync } from "node:child_process";
import process from "node:process";
import readline from "node:readline";

export const log = (message, color = "reset") => {
  const colors = {
    reset: "\x1B[0m",
    green: "\x1B[32m",
    yellow: "\x1B[33m",
    red: "\x1B[31m",
    cyan: "\x1B[36m",
    blue: "\x1B[34m",
    magenta: "\x1B[35m",
  };
  console.log(`${colors[color]}${message}${colors.reset}`);
};

export const executeCommand = (command, options = {}) => {
  try {
    log(`执行命令: ${command}`, "blue");
    execSync(command, { stdio: "inherit", ...options });
    return { success: true };
  } catch (error) {
    log(`命令执行失败: ${command}`, "red");
    log(error.message, "red");
    return { success: false, error };
  }
};

export const confirmAction = async (message, defaultValue = null) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const _value = defaultValue ? defaultValue.toLowerCase() : null;
  const defaultText =
    _value === "y" ? "(Y/n)" : _value === "n" ? "(y/N)" : "(y/n)";

  return new Promise((resolve) => {
    rl.question(`${message} ${defaultText}: `, (answer) => {
      rl.close();
      if (answer.trim() === "" && defaultValue) {
        resolve(defaultValue.toLowerCase() === "y");
      } else {
        resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
      }
    });
  });
};

export const showProgress = (message, current, total) => {
  const percent = Math.round((current / total) * 100);
  const progressBar =
    "█".repeat(Math.floor(percent / 2)) +
    "░".repeat(50 - Math.floor(percent / 2));
  process.stdout.write(
    `\r${message}: ${progressBar} ${percent}% (${current}/${total})`
  );
  if (current === total) {
    process.stdout.write("\n");
  }
};

// 安全验证函数
export const validateInput = (value, type) => {
  if (!value || typeof value !== "string") return false;

  switch (type) {
    case "server":
      // 验证服务器地址格式
      return (
        /^[\w.-]+@[\w.-]+\.[a-z]{2,}$/i.test(value) ||
        /^[\w.-]+@\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value) ||
        /^[\w.-]+$/.test(value)
      );
    case "path":
      // 验证路径安全性，防止路径遍历
      return (
        !value.includes("..") &&
        !value.includes("~") &&
        !value.startsWith("/etc") &&
        !value.startsWith("/root") &&
        !value.startsWith("/var/log") &&
        !value.includes(";") &&
        !value.includes("|") &&
        !value.includes("&") &&
        !value.includes("`") &&
        !value.includes("$(")
      );
    case "number": {
      // 验证数字
      const num = Number.parseInt(value);
      return !Number.isNaN(num) && num > 0 && num <= 100;
    }
    default:
      return true;
  }
};

// 转义 shell 参数
export const escapeShellArg = (arg) => {
  if (!arg) return '""';
  return `"${arg.replace(/"/g, '\\"')}"`;
};
