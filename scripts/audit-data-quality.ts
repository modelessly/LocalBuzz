import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { formatDataQualityAudit, runDataQualityAudit } from "../server/operations/audit";

const argument = (name: string) => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; };
const outputDir = resolve(argument("--output-dir") ?? "coverage");
const audit = runDataQualityAudit();
await mkdir(outputDir, { recursive: true });
const output = resolve(outputDir, "local-buzz.data-quality.json");
await writeFile(output, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
process.stdout.write(`${formatDataQualityAudit(audit)}\nMachine report: ${output}\n`);
if (!audit.passed) process.exitCode = 1;
