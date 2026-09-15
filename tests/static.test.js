const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"../docs"),html=fs.readFileSync(path.join(root,"index.html"),"utf8"),app=fs.readFileSync(path.join(root,"app.js"),"utf8");
for(const file of ["styles.css","model.js","app.js","manifest.webmanifest","favicon.svg","icon-192.svg","icon-512.svg","sw.js"])assert.ok(fs.existsSync(path.join(root,file)),`${file} ausente`);
for(const id of ["nom-va","nom-vb","live-va","live-vb","rc1","rc2","rc3","rc4","calculate-fixed","assist"])assert.ok(html.includes(`id="${id}"`),`${id} ausente`);
for(const id of ["nom-va","nom-vb","live-va","live-vb","rc1","rc2","rc3","rc4",...modelIds().map(id=>"nom-i"+id)])assert.match(html,new RegExp(`id="${id}"[^>]*step="0\\.01"`),`${id} debe variar en centésimas`);
for(const id of modelIds())assert.ok(html.includes(`id="nom-i${id}"`));
assert.ok(html.includes("MEDICIONES DE CAMPO A"));assert.ok(html.includes("MEDICIONES DE CAMPO B"));assert.ok(!html.includes("<svg"));assert.ok(!html.includes('type="range"'));
assert.ok(app.includes('id="system-r-${id}"'));assert.ok(app.includes('id="reo-power-${id}"'));assert.ok(app.includes("o.currents[id]**2*o.rheostats[id]"));assert.ok(!app.includes("Corriente objetivo"));assert.ok(!app.includes("Potencia del reóstato"));
const manifest=JSON.parse(fs.readFileSync(path.join(root,"manifest.webmanifest"),"utf8"));assert.equal(manifest.display,"standalone");assert.equal(manifest.short_name,"ANODEFLEX 2INY");
console.log("Pruebas de la aplicación estática ANODEFLEX 2 + 2: correctas");
function modelIds(){return ["11","12","21","22","31","32","41","42"]}
