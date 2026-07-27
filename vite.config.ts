import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { readFileSync, writeFileSync, copyFileSync, existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isExtension = process.env.BUILD_TARGET === "extension";

// Plugin: after build, inline shared chunks into content.js and background.js
// so they're fully self-contained (Chrome content scripts can't load dynamic imports)
function inlineExtensionChunks(): Plugin {
  return {
    name: "inline-extension-chunks",
    enforce: "post",
    closeBundle() {
      const distDir = path.resolve(__dirname, "dist");

      for (const entry of ["content.js", "background.js"]) {
        const filePath = path.join(distDir, entry);
        if (!existsSync(filePath)) continue;

        let code = readFileSync(filePath, "utf-8");

        // Collect all chunk imports (minified or not: import{a,b as c}from"./chunks/x.js")
        const chunkImportRegex = /import\s*\{[^}]+\}\s*from\s*["']\.\/chunks\/[^"']+["'];?/g;

        let inlined = code;
        let chunkCode = "";

        const chunksToLoad = new Set<string>();
        let match: RegExpExecArray | null;
        while ((match = chunkImportRegex.exec(code)) !== null) {
          const src = match[0].match(/from\s*["']([^"']+)["']/)?.[1];
          if (src) chunksToLoad.add(src);
        }

        for (const src of chunksToLoad) {
          const chunkPath = path.join(distDir, src);
          if (existsSync(chunkPath)) {
            let chunk = readFileSync(chunkPath, "utf-8");

            // Parse chunk's export bindings: export{q as D,L as S,...}
            // → map binding name → actual function name
            const exportMatch = chunk.match(/export\s*\{([^}]+)\}/);
            const exportBindings: Record<string, string> = {};
            if (exportMatch) {
              exportMatch[1].split(",").forEach((part) => {
                const tokens = part.trim().split(/\s+as\s+/);
                if (tokens.length === 2) exportBindings[tokens[1]] = tokens[0];
                else if (tokens.length === 1) exportBindings[tokens[0]] = tokens[0];
              });
            }

            // Parse entry's import bindings: import{c,h as i,b as o,...}
            const importMatch = code.match(/import\s*\{([^}]+)\}\s*from\s*["']\.\/chunks\/[^"']+["']/);
            const aliases: string[] = [];
            if (importMatch) {
              importMatch[1].split(",").forEach((part) => {
                const tokens = part.trim().split(/\s+as\s+/);
                const bindingName = tokens[0]; // the export binding name (e.g. "s", "c", "h")
                const localName = tokens.length === 2 ? tokens[1] : tokens[0];
                const actualFn = exportBindings[bindingName];
                if (actualFn && localName !== actualFn) {
                  aliases.push(`var ${localName}=${actualFn};`);
                }
              });
            }

            // Strip ESM syntax from chunk
            chunk = chunk.replace(/export\s*\{[^}]*\}\s*;?/g, "");
            chunk = chunk.replace(/^import\s*\{[^}]+\}\s*from\s*["'][^"']+["'];?\s*/gm, "");

            chunkCode += chunk + "\n" + aliases.join("") + "\n";
          }
          // Remove the import line by finding the from"./chunks/..." part
          const searchStr = 'from"' + src;
          const importStart = inlined.indexOf(searchStr);
          if (importStart > 0) {
            // walk backwards to find 'import{'
            let lineStart = importStart;
            while (lineStart > 0 && inlined[lineStart - 1] !== '\n') lineStart--;
            // walk forward to find end of import (after the semicolon or quote)
            let lineEnd = importStart;
            while (lineEnd < inlined.length && inlined[lineEnd] !== ';' && inlined[lineEnd] !== '\n') lineEnd++;
            if (lineEnd < inlined.length && inlined[lineEnd] === ';') lineEnd++;
            inlined = inlined.slice(0, lineStart) + inlined.slice(lineEnd);
          }
        }

        if (chunksToLoad.size > 0) {
          inlined = chunkCode + inlined;
          writeFileSync(filePath, inlined.trim(), "utf-8");
          console.log(`  ✓ inlined ${chunksToLoad.size} chunk(s) into ${entry}`);
        }
      }

      // Copy manifest.json from public/
      const manifestSrc = path.resolve(__dirname, "public", "manifest.json");
      const manifestDst = path.join(distDir, "manifest.json");
      if (existsSync(manifestSrc)) {
        copyFileSync(manifestSrc, manifestDst);
        console.log("  ✓ copied manifest.json");
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), ...(isExtension ? [] : [viteSingleFile()]), ...(isExtension ? [inlineExtensionChunks()] : [])],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  ...(isExtension
    ? {
        base: "./",
        build: {
          rollupOptions: {
            input: {
              popup: path.resolve(__dirname, "popup.html"),
              background: path.resolve(__dirname, "src/background.ts"),
              content: path.resolve(__dirname, "src/content.ts"),
            },
            output: {
              entryFileNames: "[name].js",
              chunkFileNames: "chunks/[name].[hash].js",
              assetFileNames: "assets/[name].[ext]",
            },
          },
          outDir: "dist",
          emptyOutDir: true,
          sourcemap: false,
          cssCodeSplit: false,
        },
      }
    : {}),
});
