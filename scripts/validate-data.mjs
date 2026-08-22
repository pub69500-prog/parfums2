import fs from "node:fs/promises";
const p=JSON.parse(await fs.readFile("data/products.json","utf8"));
if(!p.updatedAt)throw new Error("updatedAt manquant");
if(!Array.isArray(p.products)||!p.products.length)throw new Error("catalogue vide");
const ids=p.products.map(x=>x.id);
if(new Set(ids).size!==ids.length)throw new Error("IDs dupliqués");
if(!p.products.some(x=>x.house==="Zara"))throw new Error("Zara absent");
if(!p.products.some(x=>x.house==="Lattafa"))throw new Error("Lattafa absent");
console.log(`Validation OK: ${p.products.length} produits, Zara ${p.stats.zara}, Lattafa ${p.stats.lattafa}.`);
