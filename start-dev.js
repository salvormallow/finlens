const { execSync } = require("child_process");
const path = require("path");

const projectDir = path.join(__dirname);
const port = process.argv.find((a) => a.startsWith("--port="))?.split("=")[1] || "3001";

process.chdir(projectDir);
execSync(`npx next dev --port ${port}`, { stdio: "inherit", cwd: projectDir });
