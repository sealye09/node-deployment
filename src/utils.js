import { execSync } from "node:child_process";
import readline from "node:readline";

export const log = (message, color = "reset") => {
  const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    cyan: "\x1b[36m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
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
