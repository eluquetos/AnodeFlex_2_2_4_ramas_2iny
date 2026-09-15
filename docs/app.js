const nodes=[1,2,3,4];
const ids=["11","12","21","22","31","32","41","42"];
const state={fixed:null,nominal:null,op:null};
const $=id=>document.getElementById(id);
const n=id=>Number($(id).value);
const fmt=(value,digits=3)=>Number.isFinite(value)?value.toLocaleString("es-EC",{minimumFractionDigits:digits,maximumFractionDigits:digits}):"—";
const powerFmt=value=>Number.isFinite(value)?value.toFixed(2):"—";
const cableInputs=()=>({Rc1:n("rc1"),Rc2:n("rc2"),Rc3:n("rc3"),Rc4:n("rc4")});
const cableArgs=cables=>({Rc1:cables[1],Rc2:cables[2],Rc3:cables[3],Rc4:cables[4]});
const fixedInputs=()=>Object.fromEntries(ids.map(id=>[id,n("system-r-"+id)]));
const nodeText=voltages=>nodes.map(node=>`V${node} ${fmt(voltages[node],2)} V`).join(" · ");

function buildBranches(){
  const defaults={11:1.2,12:1,21:.9,22:.9,31:.8,32:.7,41:.6,42:.5};
  $("branch-cards").innerHTML=ids.map(id=>`
    <article class="panel branch tone-${id}" data-id="${id}">
      <div class="branch-head"><div><span>NODO ${id[0]}</span><h3>RAMA ${id}</h3></div><div class="amp" id="amp-${id}">— A</div></div>
      <div class="branch-inputs">
        <label><span class="input-title">Corriente</span><input id="target-${id}" type="number" min="0.001" step="0.01" value="${defaults[id]}"><em>A</em></label>
        <label><span class="input-title"><span>Reo${id}</span><strong id="reo-power-${id}">0.00 W</strong></span><input id="reo-${id}" type="number" min="0" max="10000" step="0.01" value="0"><em>Ω</em></label>
      </div>
      <div class="fixed-note"><span>Resistencia del Sistema R${id}</span><label class="fixed-control"><input id="system-r-${id}" aria-label="Resistencia del Sistema R${id}" type="number" min="0.01" step="0.01"><em>Ω</em></label></div>
    </article>`).join("");
}

function calibrationInput(){return {VA:n("nom-va"),VB:n("nom-vb"),...cableInputs(),currents:Object.fromEntries(ids.map(id=>[id,n("nom-i"+id)]))}}

function computeFixed(){
  const input=calibrationInput(),values=[input.VA,input.VB,input.Rc1,input.Rc2,input.Rc3,input.Rc4,...Object.values(input.currents)];
  if(!values.every(Number.isFinite)||input.VA<=0||input.VB<=0||[input.Rc1,input.Rc2,input.Rc3,input.Rc4].some(value=>value<0)||Object.values(input.currents).some(value=>value<=0)){
    showMessage("Revise los datos: VA, VB y las corrientes deben ser mayores que cero; Rc1 a Rc4 no pueden ser negativas.","error");return;
  }
  let result;
  try{result=AnodeflexModel.dimension(input)}
  catch(error){const side=error.side?` en el lado ${error.side}`:"";showMessage(error.message==="voltage-exhausted"?`Las caídas en los cables consumen la tensión disponible${side}. Reduzca corrientes o resistencias de cable, o aumente el voltaje.`:"No se pudo obtener un conjunto físico de resistencias.","error");return}
  state.fixed=result.fixed;state.nominal=result;
  ids.forEach(id=>{$("fixed-r"+id).textContent=fmt(result.fixed[id],2)+" Ω";$("system-r-"+id).value=result.fixed[id].toFixed(2);$("target-"+id).value=input.currents[id];setRheostat(id,0)});
  $("fixed-nodes").textContent=nodeText(result.voltages);$("live-va").value=input.VA;$("live-vb").value=input.VB;
  persist();showMessage("Resistencias calculadas para los lados A y B. Ya puede regular las ocho ramas.","success");solve();
}

function solve(){
  if(!state.fixed||!state.nominal)return;
  const fixed=fixedInputs();
  if(ids.some(id=>!Number.isFinite(fixed[id])||fixed[id]<=0)){showMessage("Las resistencias del sistema deben ser mayores que cero.","error");return}
  state.fixed=fixed;
  const rheostats=Object.fromEntries(ids.map(id=>[id,Math.max(0,n("reo-"+id)||0)]));
  try{state.op=AnodeflexModel.simulate({VA:n("live-va"),VB:n("live-vb"),...cableArgs(state.nominal.cables),fixed:state.fixed,rheostats});render();persist()}
  catch{showMessage("La simulación contiene un valor no válido.","error")}
}

function render(){
  const o=state.op,tolerance=Math.max(.01,n("tolerance")||2);let allWithin=true;
  $("live-va-out").textContent=fmt(o.VA,2)+" V";$("live-vb-out").textContent=fmt(o.VB,2)+" V";$("head-current").textContent=fmt(o.It)+" A";$("health-dot").className="health-dot ok";
  ids.forEach(id=>{const target=n("target-"+id),pct=target>0?100*(o.currents[id]-target)/target:NaN,within=Number.isFinite(pct)&&Math.abs(pct)<=tolerance;allWithin&&=within;$("amp-"+id).textContent=fmt(o.currents[id])+" A";$("reo-power-"+id).textContent=powerFmt(o.currents[id]**2*o.rheostats[id])+" W"});
  $("health-label").textContent=allWithin?"Objetivos cumplidos":"Simulación válida";$("res-it").textContent=fmt(o.It)+" A";$("res-ia").textContent=fmt(o.sides.A.It)+" A";$("res-ib").textContent=fmt(o.sides.B.It)+" A";
  $("res-i2").textContent=fmt(o.trunks[2])+" A";$("res-i4").textContent=fmt(o.trunks[4])+" A";nodes.forEach(node=>$("res-dv"+node).textContent=fmt(o.trunks[node]*o.cables[node],3)+" V");
  $("res-ps").textContent=fmt(o.pSource,2)+" W";$("res-pe").textContent=fmt(o.pError,6)+" W";
  $("results-body").innerHTML=ids.map(id=>{const target=n("target-"+id),pct=target>0?100*(o.currents[id]-target)/target:NaN,power=o.currents[id]**2*o.branch[id];return `<tr><td>I${id}</td><td>${fmt(o.currents[id])} A</td><td>${fmt(target)} A</td><td class="${Math.abs(pct)<=tolerance?"status-ok":"status-warn"}">${Number.isFinite(pct)?fmt(pct,2)+" %":"—"}</td><td>${fmt(state.fixed[id],2)} Ω</td><td>${fmt(o.rheostats[id])} Ω</td><td>${fmt(power,2)} W</td></tr>`}).join("");
  const errors={
    "KCL nodo 1":o.trunks[1]-o.currents[11]-o.currents[12]-o.trunks[2],"KCL nodo 2":o.trunks[2]-o.currents[21]-o.currents[22],
    "KCL nodo 3":o.trunks[3]-o.currents[31]-o.currents[32]-o.trunks[4],"KCL nodo 4":o.trunks[4]-o.currents[41]-o.currents[42],
    "KVL VA–nodo 1":o.VA-o.voltages[1]-o.trunks[1]*o.cables[1],"KVL nodo 1–2":o.voltages[1]-o.voltages[2]-o.trunks[2]*o.cables[2],
    "KVL VB–nodo 3":o.VB-o.voltages[3]-o.trunks[3]*o.cables[3],"KVL nodo 3–4":o.voltages[3]-o.voltages[4]-o.trunks[4]*o.cables[4],"Balance de potencia":o.pError
  };
  $("checks").innerHTML=Object.entries(errors).map(([label,value])=>`<p><span>${label}</span><b>${fmt(value,8)}</b></p>`).join("");
}

function setRheostat(id,value){$("reo-"+id).value=Math.round(Math.max(0,value)*1000)/1000}
function assistedAdjustment(){
  if(!state.fixed){showMessage("Calibre primero las resistencias del sistema.","error");return}
  const targets=Object.fromEntries(ids.map(id=>[id,n("target-"+id)])),maxReo=n("reo-max"),input={VA:n("live-va"),VB:n("live-vb"),...cableArgs(state.nominal.cables),fixed:state.fixed,targets,maxReo};
  if(!Object.values(targets).every(value=>Number.isFinite(value)&&value>0)||!Number.isFinite(maxReo)||maxReo<=0){showMessage("Las ocho corrientes y el reóstato máximo deben ser mayores que cero.","error");return}
  let result;try{result=AnodeflexModel.adjust(input)}catch{showMessage("No se pudo calcular el ajuste con los datos ingresados.","error");return}
  if(result.reason==="voltage"){const failed=Object.values(result.sides).filter(side=>side.reason==="voltage").map(side=>side.side).join(" y ");showMessage(`La tensión disponible no alcanza en el lado ${failed}.`,"error");return}
  if(!result.feasible){const parts=[];if(result.negative.length)parts.push("Ramas "+result.negative.join(", ")+": requieren reducir la resistencia del sistema o aumentar la tensión");if(result.over.length)parts.push("Ramas "+result.over.join(", ")+": superan el máximo de "+fmt(maxReo,2)+" Ω");showMessage("Ajuste no alcanzable. "+parts.join(". ")+".","error");return}
  ids.forEach(id=>setRheostat(id,result.rheostats[id]));solve();showMessage("Ajuste calculado. "+nodeText(result.voltages)+".","success");
}

function persist(){localStorage.setItem("anodeflex-2-2-4-2iny-fixed",JSON.stringify({fixed:state.fixed,stateNominal:state.nominal}))}
function caseData(){return {format:"anodeflex-2-2-4-case",version:1,createdAt:new Date().toISOString(),calibration:{VA:state.nominal.VA,VB:state.nominal.VB,cables:state.nominal.cables,currents:state.nominal.currents,fixed:state.fixed},operation:{VA:n("live-va"),VB:n("live-vb"),targets:Object.fromEntries(ids.map(id=>[id,n("target-"+id)])),rheostats:Object.fromEntries(ids.map(id=>[id,n("reo-"+id)])),rheostatMax:n("reo-max"),tolerancePercent:n("tolerance")},results:state.op}}
function saveCase(){if(!state.op)return;const blob=new Blob([JSON.stringify(caseData(),null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download="anodeflex-2-2-4-ramas-2iny-"+new Date().toISOString().slice(0,10)+".json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function loadCase(file){
  const reader=new FileReader();reader.onload=()=>{try{
    const data=JSON.parse(reader.result);if(data.format!=="anodeflex-2-2-4-case"||!data.calibration?.fixed||!data.calibration?.cables||!data.operation)throw new Error();
    const calibration=AnodeflexModel.dimension({VA:data.calibration.VA,VB:data.calibration.VB,...cableArgs(data.calibration.cables),currents:data.calibration.currents});state.fixed=data.calibration.fixed;state.nominal=calibration;
    $("nom-va").value=calibration.VA;$("nom-vb").value=calibration.VB;nodes.forEach(node=>$("rc"+node).value=calibration.cables[node]);
    ids.forEach(id=>{$("nom-i"+id).value=calibration.currents[id];$("fixed-r"+id).textContent=fmt(state.fixed[id],2)+" Ω";$("system-r-"+id).value=Number(state.fixed[id]).toFixed(2);$("target-"+id).value=data.operation.targets[id];setRheostat(id,data.operation.rheostats[id])});
    $("fixed-nodes").textContent=nodeText(calibration.voltages);$("live-va").value=data.operation.VA;$("live-vb").value=data.operation.VB;$("reo-max").value=data.operation.rheostatMax||100;$("tolerance").value=data.operation.tolerancePercent||2;persist();solve();showMessage("Caso importado y recalculado correctamente.","success");
  }catch{showMessage("El archivo no corresponde a un caso ANODEFLEX 2 + 2 válido.","error")}};reader.readAsText(file);
}

function showMessage(text,type){const element=$("message");element.textContent=text;element.className="message show "+type}
function wireEvents(){
  $("calculate-fixed").addEventListener("click",computeFixed);["live-va","live-vb"].forEach(id=>$(id).addEventListener("input",solve));
  ids.forEach(id=>{$("reo-"+id).addEventListener("input",solve);$("target-"+id).addEventListener("input",solve);$("system-r-"+id).addEventListener("input",solve)});
  $("reset-rheostats").addEventListener("click",()=>{ids.forEach(id=>setRheostat(id,0));solve()});$("assist").addEventListener("click",assistedAdjustment);$("tolerance").addEventListener("input",solve);$("save-case").addEventListener("click",saveCase);$("load-case").addEventListener("click",()=>$("case-file").click());$("case-file").addEventListener("change",event=>{if(event.target.files[0])loadCase(event.target.files[0]);event.target.value=""});$("print-report").addEventListener("click",()=>window.print());
}
function restore(){try{const saved=JSON.parse(localStorage.getItem("anodeflex-2-2-4-2iny-fixed")||localStorage.getItem("anodeflex-2-2-4-fixed"));if(saved?.fixed&&saved?.stateNominal){state.fixed=saved.fixed;state.nominal=saved.stateNominal;ids.forEach(id=>{$("fixed-r"+id).textContent=fmt(state.fixed[id],2)+" Ω";$("system-r-"+id).value=Number(state.fixed[id]).toFixed(2)});$("fixed-nodes").textContent=nodeText(state.nominal.voltages);$("live-va").value=state.nominal.VA;$("live-vb").value=state.nominal.VB;persist();solve();return}}catch{}computeFixed()}

let installPrompt=null;window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();installPrompt=event;$("install-app").hidden=false});$("install-app").addEventListener("click",async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("install-app").hidden=true});
buildBranches();wireEvents();restore();if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js"));
