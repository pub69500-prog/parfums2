import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT=process.cwd();
const DATA=path.join(ROOT,"data");
const OUT=path.join(DATA,"products.json");
const ZARA_DB=path.join(DATA,"zara-fragrantica.json");
const CORR=path.join(DATA,"correspondences.json");
const COLLAB=path.join(DATA,"collaborations.json");
const HISTORY=path.join(DATA,"history");
const LATTAFA_URL="https://lattafa.com/product-category/perfumes/";

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clean=(s="")=>String(s).replace(/\u00a0/g," ").replace(/\s+/g," ").trim();

function key(s=""){
  return clean(s).toLocaleLowerCase("fr").normalize("NFD").replace(/\p{Diacritic}/gu,"")
    .replace(/\b(zara|lattafa|perfumes?|eau de parfum|eau de toilette|parfum|edp|edt|elixir)\b/gi," ")
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:ml|fl\.?\s*oz\.?)\b/gi," ")
    .replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
}
function concentration(name=""){
  const n=name.toUpperCase();
  if(/\bELIXIR\b/.test(n))return"Elixir";
  if(/\bEAU DE PARFUM\b|\bEDP\b/.test(n))return"Eau de Parfum";
  if(/\bEAU DE TOILETTE\b|\bEDT\b/.test(n))return"Eau de Toilette";
  if(/\bPARFUM\b/.test(n))return"Parfum";
  return"";
}
function volume(name=""){
  const m=name.match(/\b(\d+(?:[.,]\d+)?)\s*ML\b/i);
  return m?`${m[1].replace(",",".")} ml`:"";
}

async function scrapeLattafa(){
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({
    locale:"en-US",viewport:{width:1440,height:1200},
    userAgent:"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36"
  });
  const page=await context.newPage();
  const all=[],seen=new Set();

  try{
    for(let n=1;n<=100;n++){
      const url=n===1?LATTAFA_URL:`${LATTAFA_URL}page/${n}/`;
      console.log(`Lattafa page ${n}: ${url}`);
      await page.goto(url,{waitUntil:"domcontentloaded",timeout:90000});
      await page.waitForTimeout(800);

      const rows=await page.evaluate(()=>{
        const abs=h=>{try{return new URL(h,location.href).href}catch{return h||""}};
        const out=[];
        const cards=[...document.querySelectorAll("li.product,.products .product,[class*='product-small']")];
        for(const card of cards){
          const a=card.querySelector('a[href*="/product/"]')||card.querySelector("a");
          if(!a)continue;
          const href=abs(a.getAttribute("href"));
          if(!/\/product\//.test(href))continue;
          const name=(card.querySelector("h2,h3,.woocommerce-loop-product__title,.product-title")?.textContent||
            a.getAttribute("aria-label")||a.textContent||"").replace(/\s+/g," ").trim();
          if(!name||name.length>180)continue;
          if(/\b(air freshener|deodorant|body spray|gift set|discovery set|room spray|bakhoor|incense)\b/i.test(name))continue;
          const text=(card.innerText||"").replace(/\s+/g," ").trim();
          const price=text.match(/(?:AED|د\.إ)\s*[\d,.]+|[\d,.]+\s*(?:AED|د\.إ)/i)?.[0]||"";
          const img=card.querySelector("img");
          const slug=href.match(/\/product\/([^/?#]+)/)?.[1]||href;
          out.push({
            id:`lattafa:${slug}`,house:"Lattafa",gender:"À classer",name,price,url:href,
            image:img?.currentSrc||img?.src||img?.getAttribute("data-src")||"",
            available:!/out of stock|sold out/i.test(text),
            catalogSource:"Lattafa officiel"
          });
        }
        return out;
      });

      const unique=rows.filter(p=>{
        if(seen.has(p.id))return false;
        seen.add(p.id);return true;
      });
      all.push(...unique);
      console.log(` -> ${unique.length} nouveaux produits`);
      if(!rows.length)break;
      const hasNext=await page.locator("a.next,a.next.page-numbers").count();
      if(!hasNext)break;
      await sleep(400);
    }
  }finally{
    await browser.close();
  }
  return all;
}

async function main(){
  await fs.mkdir(DATA,{recursive:true});
  await fs.mkdir(HISTORY,{recursive:true});

  const zaraRegistry=JSON.parse(await fs.readFile(ZARA_DB,"utf8"));
  const correspondences=JSON.parse(await fs.readFile(CORR,"utf8"));
  const collaborations=JSON.parse(await fs.readFile(COLLAB,"utf8"));

  let previous={products:[],disappeared:[]};
  try{previous=JSON.parse(await fs.readFile(OUT,"utf8"));}catch{}

  const zaraProducts=(zaraRegistry.products||[]).map(p=>({...p}));
  console.log(`Zara local Fragrantica : ${zaraProducts.length} références`);

  const lattafaProducts=await scrapeLattafa();
  console.log(`Lattafa officiel : ${lattafaProducts.length} références`);

  if(!zaraProducts.length)throw new Error("data/zara-fragrantica.json est vide.");
  if(!lattafaProducts.length)throw new Error("Aucun Lattafa détecté.");

  const byId=new Map();
  for(const p of [...zaraProducts,...lattafaProducts])byId.set(p.id,p);
  const unique=[...byId.values()];

  const previousById=new Map((previous.products||[]).map(x=>[x.id,x]));
  const previousIds=new Set(previousById.keys());
  const now=new Date().toISOString();

  const products=unique.map(p=>{
    const k=key(p.name);
    const hit=correspondences.find(x=>x.house===p.house&&(k.includes(key(x.product))||key(x.product).includes(k)));
    const collaboration=p.house==="Zara"
      ? collaborations.find(x=>k.includes(key(x.product))||key(x.product).includes(k))
      : null;
    const old=previousById.get(p.id);

    return {
      ...p,
      concentration:concentration(p.name),
      volume:volume(p.name),
      isNew:!previousIds.has(p.id),
      firstSeenAt:old?.firstSeenAt||now,
      collaboration:collaboration?{
        collaborator:collaboration.collaborator,
        collaboratorBrand:collaboration.collaboratorBrand,
        type:collaboration.type,status:collaboration.status,
        family:collaboration.family||"",officialNotes:collaboration.officialNotes||[],
        source:collaboration.source||"",verifiedAt:collaboration.verifiedAt||""
      }:null,
      inspiration:hit?{
        brand:hit.brand,name:hit.inspiration,confidence:hit.confidence,
        family:hit.family||"",sources:hit.sources||[],note:hit.note||"",
        consensus:hit.consensus||"",notes:hit.notes||null,
        fragranticaVerified:!!hit.fragranticaVerified
      }:null
    };
  });

  const currentIds=new Set(products.map(x=>x.id));
  const newlyDisappeared=(previous.products||[])
    .filter(x=>!currentIds.has(x.id))
    .map(x=>({...x,disappearedAt:now}));
  const dm=new Map();
  for(const x of [...(previous.disappeared||[]),...newlyDisappeared])dm.set(x.id,x);
  for(const x of products)dm.delete(x.id);
  const disappeared=[...dm.values()];

  const stats={
    total:products.length,
    zara:products.filter(x=>x.house==="Zara").length,
    lattafa:products.filter(x=>x.house==="Lattafa").length,
    men:products.filter(x=>x.gender==="Homme").length,
    women:products.filter(x=>x.gender==="Femme").length,
    unisex:products.filter(x=>x.gender==="Unisexe").length,
    new:products.filter(x=>x.isNew).length,
    disappeared:disappeared.length,
    matched:products.filter(x=>x.inspiration).length,
    highConfidence:products.filter(x=>x.inspiration?.confidence==="forte").length,
    officialCollaborations:products.filter(x=>x.collaboration).length,
    zaraFragranticaReportedTotal:zaraRegistry.fragranticaReportedCount||null,
    zaraLocalRegistry:zaraProducts.length
  };

  if(previous.updatedAt){
    await fs.writeFile(path.join(HISTORY,`${previous.updatedAt.slice(0,10)}.json`),
      JSON.stringify(previous,null,2)+"\n");
  }

  await fs.writeFile(OUT,JSON.stringify({
    updatedAt:now,
    stats,
    sources:[
      "https://www.fragrantica.com/designers/Zara.html",
      "https://lattafa.com/product-category/perfumes/"
    ],
    products,disappeared
  },null,2)+"\n");

  console.log("Mise à jour terminée :",stats);
}
main().catch(e=>{console.error(e);process.exit(1);});
