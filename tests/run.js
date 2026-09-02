/* Corredor de las suites de Mi Turno.  `npm test`
   ------------------------------------------------------------
   Cada suite corre en SU PROPIO proceso, a proposito: todas hacen
   `eval` de la app y mutan el estado global (CFG, BIZ, WORKOUTS…).
   Compartir proceso las contaminaria entre si y las volveria
   dependientes del orden, que es justo lo que no se quiere de una
   red de seguridad.

   Sin dependencias: `child_process` y nada mas. */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const DIR = __dirname;
const soloEstas = process.argv.slice(2);

const suites = fs.readdirSync(DIR)
  .filter(f => f.endsWith(".test.js"))
  .filter(f => !soloEstas.length || soloEstas.some(a => f.includes(a)))
  .sort();

if (!suites.length) {
  console.error(soloEstas.length
    ? "No hay suites que coincidan con: " + soloEstas.join(", ")
    : "No se encontro ninguna suite (*.test.js) en tests/.");
  process.exit(1);
}

let total = 0;
const fallaron = [];

for (const f of suites) {
  const r = spawnSync(process.execPath, [path.join(DIR, f)], { encoding: "utf8" });
  const salida = (r.stdout || "") + (r.stderr || "");
  const ok = (salida.match(/^ {2}ok {2}/gm) || []).length;
  total += ok;

  if (r.status === 0) {
    console.log("  PASA  " + f.padEnd(28) + String(ok).padStart(3) + " pruebas");
  } else {
    fallaron.push(f);
    console.log("  FALLA " + f.padEnd(28) + String(ok).padStart(3) + " pruebas antes de romperse");
    /* La primera falla es la que importa: se imprime completa. */
    console.log(salida.split("\n").map(l => "        " + l).join("\n"));
  }
}

console.log("\n" + "-".repeat(52));
if (fallaron.length) {
  console.log(total + " pruebas pasaron | " + fallaron.length + " suite(s) con fallo: " + fallaron.join(", "));
  process.exit(1);
}
console.log(total + " pruebas en " + suites.length + " suites — todas OK");
