/**
 * Fix UTF-8 mojibake (smart punctuation & symbols saved with wrong encoding).
 * Run: node scripts/fix-mojibake.mjs
 */
import fs from "fs"
import path from "path"

const ROOT = path.resolve(import.meta.dirname, "..")

/** Longer / more specific sequences first if any could prefix another */
const REPLACEMENTS = [
  ["\u00E2\u20AC\u201D", "\u2014"], // — em dash (e.g. â€")
  ["\u00E2\u20AC\u201C", "\u2013"], // – en dash (e.g. â€œ)
  ["\u00E2\u201D\u20AC", "\u2500"], // ─ light horizontal (comment separators â"€)
  ["\u00E2\u20AC\u00A6", "\u2026"], // … ellipsis (…)
  ["\u00E2\u20AC\u00A2", "\u2022"], // • bullet (•)
  ["\u00E2\u20AC\u2122", "\u2019"], // ' apostrophe (’)
  ["\u00E2\u0153\u201C", "\u2713"], // ✓ check (âœ")
  ["\u00E2\u0153\u2022", "\u2715"], // ✕ (toast dismiss ✕)
  ["\u00E2\u02DC\u2026", "\u2605"], // ★ star (★)
  ["\u00E2\u2020\u0090", "\u2190"], // ← (←)
  ["\u00E2\u2020\u2019", "\u2192"], // → (→)
  ["\u00E2\u2020\u2018", "\u2191"], // ↑
  ["\u00E2\u2020\u201C", "\u2193"], // ↓
  ["\u00E2\u2013\u00BE", "\u25BE"], // ▾
  ["\u00E2\u2020\u00B3", "\u21B3"], // ↳
  ["\u00E2\u2022\u0090", "\u2550"], // ═ double horizontal (═)
  ["\u00C2\u00A9", "\u00A9"], // © (©)
]

function fixRegisterComments(s) {
  return s.replace(/\/\/ Ã¢[^\n]*\n/g, (line) => {
    const labels = [
      "Types",
      "Password strength",
      "Stepper",
      "Card shell",
      "Input",
      "Upload zone",
      "Camera modal",
      "Main RegisterUI",
      "field helpers",
      "validation per step",
      "OCR call",
      "submit",
      "last step index for this flow",
    ]
    const found = labels.find((l) => line.includes(l))
    return found ? `// ${found}\n` : "//\n"
  })
}

function fixContent(s, relPath) {
  let out = s
  for (const [bad, good] of REPLACEMENTS) {
    if (out.includes(bad)) out = out.split(bad).join(good)
  }
  if (relPath.replace(/\\/g, "/").endsWith("register/register-ui.tsx")) out = fixRegisterComments(out)
  return out
}

function walk(dir, acc) {
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, acc)
    else if (/\.(tsx|ts|css|mjs|jsx|js)$/.test(name) && !name.endsWith(".d.ts")) acc.push(p)
  }
}

const files = []
walk(ROOT, files)

let changed = 0
for (const file of files) {
  const raw = fs.readFileSync(file, "utf8")
  const rel = path.relative(ROOT, file)
  const next = fixContent(raw, rel)
  if (next !== raw) {
    fs.writeFileSync(file, next, "utf8")
    changed++
    console.log("fixed:", rel)
  }
}
console.log("Done. Files changed:", changed)
