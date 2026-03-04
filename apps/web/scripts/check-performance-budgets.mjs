import { gzipSync } from "node:zlib";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const nextDir = path.resolve(projectRoot, ".next");
const routeLocale = process.env.PERF_BUDGET_LOCALE ?? "en";

const budgets = {
  homeHtmlGzip: Number(process.env.PERF_BUDGET_HOME_HTML_GZIP_BYTES ?? "11500"),
  homeScriptCount: Number(process.env.PERF_BUDGET_HOME_SCRIPT_COUNT ?? "16"),
  localeInitialJsGzip: Number(
    process.env.PERF_BUDGET_LOCALE_INITIAL_JS_GZIP_BYTES ?? "275000",
  ),
  largestChunkGzip: Number(
    process.env.PERF_BUDGET_LARGEST_CHUNK_GZIP_BYTES ?? "80000",
  ),
};

function findLocaleHtmlFile(locale) {
  const candidates = [
    path.join(nextDir, "server", "app", `${locale}.html`),
    path.join(nextDir, "server", "app", locale, "index.html"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(
    `Unable to find prerendered HTML for locale "${locale}" in ${path.join(
      nextDir,
      "server",
      "app",
    )}`,
  );
}

function gzipSize(bytes) {
  return gzipSync(bytes).length;
}

function toNextAssetPath(scriptSrc) {
  if (!scriptSrc.startsWith("/_next/")) {
    return null;
  }
  return path.join(nextDir, scriptSrc.replace("/_next/", ""));
}

function collectLargestChunkGzip() {
  const chunkDir = path.join(nextDir, "static", "chunks");
  if (!existsSync(chunkDir)) {
    return { file: "", size: 0 };
  }
  let largest = { file: "", size: 0 };
  for (const fileName of readdirSync(chunkDir)) {
    if (!fileName.endsWith(".js")) {
      continue;
    }
    const fullPath = path.join(chunkDir, fileName);
    const size = gzipSize(readFileSync(fullPath));
    if (size > largest.size) {
      largest = { file: fileName, size };
    }
  }
  return largest;
}

function main() {
  if (!existsSync(nextDir)) {
    throw new Error(`Missing Next.js build directory at ${nextDir}. Run build first.`);
  }

  const htmlPath = findLocaleHtmlFile(routeLocale);
  const htmlBuffer = readFileSync(htmlPath);
  const html = htmlBuffer.toString("utf8");

  const scriptMatches = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)];
  const scriptSources = scriptMatches.map((match) => match[1]);
  const uniqueScriptSources = [...new Set(scriptSources)];

  let initialJsGzipTotal = 0;
  for (const scriptSrc of uniqueScriptSources) {
    const absoluteScriptPath = toNextAssetPath(scriptSrc);
    if (!absoluteScriptPath || !existsSync(absoluteScriptPath)) {
      continue;
    }
    initialJsGzipTotal += gzipSize(readFileSync(absoluteScriptPath));
  }

  const largestChunk = collectLargestChunkGzip();
  const metrics = {
    htmlGzip: gzipSize(htmlBuffer),
    scriptCount: scriptSources.length,
    localeInitialJsGzip: initialJsGzipTotal,
    largestChunkGzip: largestChunk.size,
  };

  const failures = [];
  if (metrics.htmlGzip > budgets.homeHtmlGzip) {
    failures.push(
      `Home HTML gzip ${metrics.htmlGzip} exceeds budget ${budgets.homeHtmlGzip}`,
    );
  }
  if (metrics.scriptCount > budgets.homeScriptCount) {
    failures.push(
      `Homepage script count ${metrics.scriptCount} exceeds budget ${budgets.homeScriptCount}`,
    );
  }
  if (metrics.localeInitialJsGzip > budgets.localeInitialJsGzip) {
    failures.push(
      `Locale initial JS gzip ${metrics.localeInitialJsGzip} exceeds budget ${budgets.localeInitialJsGzip}`,
    );
  }
  if (metrics.largestChunkGzip > budgets.largestChunkGzip) {
    failures.push(
      `Largest client chunk gzip ${metrics.largestChunkGzip} exceeds budget ${budgets.largestChunkGzip}`,
    );
  }

  const report = [
    `Locale HTML: ${path.relative(projectRoot, htmlPath)}`,
    `- html gzip: ${metrics.htmlGzip} bytes (budget ${budgets.homeHtmlGzip})`,
    `- script tags: ${metrics.scriptCount} (budget ${budgets.homeScriptCount})`,
    `- initial JS gzip: ${metrics.localeInitialJsGzip} bytes (budget ${budgets.localeInitialJsGzip})`,
    `- largest chunk gzip: ${metrics.largestChunkGzip} bytes (${largestChunk.file || "n/a"}, budget ${budgets.largestChunkGzip})`,
  ].join("\n");
  console.log(report);

  if (failures.length > 0) {
    console.error("\nPerformance budget check failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }
}

main();
