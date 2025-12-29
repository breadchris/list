import { useState, useCallback } from "react";
import { transform } from "sucrase";
import type { TsxVersion } from "@/components/code/types";

export function useTsxVersions() {
  const [versions, setVersions] = useState<TsxVersion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  // Transpile TSX to JavaScript for rendering
  const transpileTsx = useCallback((tsxCode: string): { js: string; error?: string } => {
    try {
      // Transform TSX to JS
      const result = transform(tsxCode, {
        transforms: ["typescript", "jsx"],
        jsxRuntime: "automatic",
        production: true,
      });

      // Wrap in ESM format for the iframe
      // Look for named Component export first, then fall back to default or first component
      const exportedNames = getExportedNames(tsxCode);
      const hasComponentExport = exportedNames.includes("Component");

      const wrappedCode = `
import React from "https://esm.sh/react@18";
import { jsx, jsxs, Fragment } from "https://esm.sh/react@18/jsx-runtime";

${result.code}

// Export Component (named export) or fall back to default/first function
${hasComponentExport
  ? "export default Component;"
  : `const _exports = { ${exportedNames.join(", ")} };
export default _exports.default || _exports[Object.keys(_exports).find(k => typeof _exports[k] === 'function')] || (() => React.createElement('div', null, 'No component found'));`}
`;

      return { js: wrappedCode };
    } catch (error) {
      console.error("Transpilation error:", error);
      return {
        js: "",
        error: error instanceof Error ? error.message : "Transpilation failed",
      };
    }
  }, []);

  // Add a new version
  const addVersion = useCallback(
    (version: Omit<TsxVersion, "compiled_js"> & { compiled_js?: string }) => {
      // Transpile if not already done
      let compiledJs = version.compiled_js;
      let error = version.error;

      if (!compiledJs) {
        const result = transpileTsx(version.tsx_code);
        compiledJs = result.js;
        error = result.error;
      }

      const newVersion: TsxVersion = {
        ...version,
        compiled_js: compiledJs,
        error,
      };

      setVersions((prev) => {
        const updated = [...prev, newVersion];
        setSelectedIndex(updated.length - 1); // Auto-select newest
        return updated;
      });
    },
    [transpileTsx]
  );

  // Select a version by index
  const selectVersion = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  // Get the currently selected version
  const selectedVersion = versions[selectedIndex] ?? null;

  // Clear all versions
  const clearVersions = useCallback(() => {
    setVersions([]);
    setSelectedIndex(-1);
  }, []);

  return {
    versions,
    selectedIndex,
    selectedVersion,
    addVersion,
    selectVersion,
    clearVersions,
  };
}

// Helper to extract exported names from TSX code
function getExportedNames(code: string): string[] {
  const names: string[] = [];

  // Match export default
  if (/export\s+default\s+/.test(code)) {
    names.push("default");
  }

  // Match named exports: export function Name, export const Name
  const namedExportRegex = /export\s+(?:function|const|let|var|class)\s+(\w+)/g;
  let match;
  while ((match = namedExportRegex.exec(code)) !== null) {
    names.push(match[1]);
  }

  // Match export { Name }
  const bracketExportRegex = /export\s+\{\s*([^}]+)\s*\}/g;
  while ((match = bracketExportRegex.exec(code)) !== null) {
    const exports = match[1].split(",").map((s) => s.trim().split(" ")[0]);
    names.push(...exports);
  }

  // If no exports found, look for function components
  if (names.length === 0) {
    const componentRegex = /(?:function|const)\s+([A-Z]\w*)\s*(?:=|[(<])/g;
    while ((match = componentRegex.exec(code)) !== null) {
      names.push(match[1]);
    }
  }

  return names;
}
