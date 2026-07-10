const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "sandbox.html"), "utf8");
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) throw new Error("Nao encontrei o <script> do sandbox.html");
new Function(m[1]);
console.log("sandbox.html script syntax: ok");
