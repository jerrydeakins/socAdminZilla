import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const pkg = path.join(root, "package");
const zip = path.join(root, "socAdminZilla-1.0.1-refactor-test.zip");

// Чистим предыдущий пакет
fs.rmSync(pkg, { recursive: true, force: true });
fs.rmSync(zip, { force: true });

// Создаём структуру
fs.mkdirSync(path.join(pkg, "content"), { recursive: true });

// Копируем файлы расширения
fs.copyFileSync(
  path.join(root, "manifest.json"),
  path.join(pkg, "manifest.json")
);

fs.copyFileSync(
  path.join(root, "background.js"),
  path.join(pkg, "background.js")
);

fs.copyFileSync(
  path.join(root, "content", "vk.js"),
  path.join(pkg, "content", "vk.js")
);

// Создаём ZIP через PowerShell
execFileSync(
  "powershell.exe",
  [
    "-NoProfile",
    "-Command",
    `Compress-Archive -Path '${pkg}\\*' -DestinationPath '${zip}'`
  ],
  { stdio: "inherit" }
);

console.log("");
console.log("Package created:");
console.log(zip);
