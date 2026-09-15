(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.AnodeflexModel=api})(typeof globalThis!=="undefined"?globalThis:this,function(){
  const NODES=[1,2,3,4];
  const IDS=["11","12","21","22","31","32","41","42"];
  const SIDES={
    A:{voltage:"VA",near:1,far:2,rcNear:"Rc1",rcFar:"Rc2",ids:["11","12","21","22"]},
    B:{voltage:"VB",near:3,far:4,rcNear:"Rc3",rcFar:"Rc4",ids:["31","32","41","42"]}
  };
  const sum=values=>values.reduce((a,b)=>a+b,0);
  const parallel=values=>1/sum(values.map(value=>1/value));

  function finitePositive(value){return Number.isFinite(value)&&value>0}
  function validateSide(input,side,allowZeroVoltage=false){
    const data=SIDES[side],voltage=Number(input[data.voltage]),rcNear=Number(input[data.rcNear]),rcFar=Number(input[data.rcFar]);
    if((allowZeroVoltage?voltage<0:voltage<=0)||!Number.isFinite(voltage)||!Number.isFinite(rcNear)||rcNear<0||!Number.isFinite(rcFar)||rcFar<0)throw new Error("invalid-input");
    return {data,voltage,rcNear,rcFar};
  }

  function dimensionSide(input,side){
    const {data,voltage,rcNear,rcFar}=validateSide(input,side),currents=input.currents;
    if(data.ids.some(id=>!finitePositive(currents[id])))throw new Error("invalid-input");
    const nearIds=data.ids.slice(0,2),farIds=data.ids.slice(2),iFar=sum(farIds.map(id=>currents[id])),iTotal=iFar+sum(nearIds.map(id=>currents[id]));
    const vNear=voltage-iTotal*rcNear,vFar=vNear-iFar*rcFar;
    if(vNear<=0||vFar<=0){const error=new Error("voltage-exhausted");error.side=side;throw error}
    const fixed={};nearIds.forEach(id=>fixed[id]=vNear/currents[id]);farIds.forEach(id=>fixed[id]=vFar/currents[id]);
    return {voltage,voltages:{[data.near]:vNear,[data.far]:vFar},trunks:{[data.near]:iTotal,[data.far]:iFar},fixed,It:iTotal,cables:{[data.near]:rcNear,[data.far]:rcFar}};
  }

  function dimension(input){
    const a=dimensionSide(input,"A"),b=dimensionSide(input,"B");
    return {VA:a.voltage,VB:b.voltage,currents:{...input.currents},fixed:{...a.fixed,...b.fixed},voltages:{...a.voltages,...b.voltages},trunks:{...a.trunks,...b.trunks},cables:{...a.cables,...b.cables},sides:{A:a,B:b},It:a.It+b.It};
  }

  function simulateSide(input,side){
    const {data,voltage,rcNear,rcFar}=validateSide(input,side,true),nearIds=data.ids.slice(0,2),farIds=data.ids.slice(2);
    const branch=Object.fromEntries(data.ids.map(id=>[id,Number(input.fixed[id])+Math.max(0,Number(input.rheostats[id])||0)]));
    if(data.ids.some(id=>!finitePositive(branch[id])))throw new Error("invalid-resistance");
    const reqFar=parallel(farIds.map(id=>branch[id])),downstreamPath=rcFar+reqFar,reqNear=parallel([...nearIds.map(id=>branch[id]),downstreamPath]);
    const Rt=rcNear+reqNear,It=voltage/Rt,vNear=voltage-It*rcNear,iFar=vNear/downstreamPath,vFar=vNear-iFar*rcFar;
    const currents={},voltages={[data.near]:vNear,[data.far]:vFar},trunks={[data.near]:It,[data.far]:iFar};
    nearIds.forEach(id=>currents[id]=vNear/branch[id]);farIds.forEach(id=>currents[id]=vFar/branch[id]);
    const pCable=It**2*rcNear+iFar**2*rcFar,pBranches=sum(data.ids.map(id=>currents[id]**2*branch[id])),pSource=voltage*It;
    return {side,voltage,branch,currents,voltages,trunks,equivalents:{near:reqNear,far:reqFar},downstreamPath,Rt,It,pCable,pBranches,pSource,pError:pSource-pCable-pBranches};
  }

  function simulate(input){
    const a=simulateSide(input,"A"),b=simulateSide(input,"B");
    return {VA:a.voltage,VB:b.voltage,fixed:{...input.fixed},rheostats:{...input.rheostats},branch:{...a.branch,...b.branch},currents:{...a.currents,...b.currents},voltages:{...a.voltages,...b.voltages},trunks:{...a.trunks,...b.trunks},cables:{1:Number(input.Rc1),2:Number(input.Rc2),3:Number(input.Rc3),4:Number(input.Rc4)},sides:{A:a,B:b},It:a.It+b.It,pCable:a.pCable+b.pCable,pBranches:a.pBranches+b.pBranches,pSource:a.pSource+b.pSource,pError:a.pError+b.pError};
  }

  function adjustSide(input,side){
    const {data,voltage,rcNear,rcFar}=validateSide(input,side),nearIds=data.ids.slice(0,2),farIds=data.ids.slice(2),targets=input.targets;
    if(data.ids.some(id=>!finitePositive(targets[id])))throw new Error("invalid-target");
    const iFar=sum(farIds.map(id=>targets[id])),iTotal=iFar+sum(nearIds.map(id=>targets[id])),vNear=voltage-iTotal*rcNear,vFar=vNear-iFar*rcFar;
    if(vNear<=0||vFar<=0)return {side,feasible:false,reason:"voltage",voltages:{[data.near]:vNear,[data.far]:vFar},trunks:{[data.near]:iTotal,[data.far]:iFar}};
    const rheostats={};nearIds.forEach(id=>rheostats[id]=vNear/targets[id]-input.fixed[id]);farIds.forEach(id=>rheostats[id]=vFar/targets[id]-input.fixed[id]);
    const negative=data.ids.filter(id=>rheostats[id]<-1e-8),over=data.ids.filter(id=>rheostats[id]>input.maxReo+1e-8);
    return {side,feasible:negative.length===0&&over.length===0,voltages:{[data.near]:vNear,[data.far]:vFar},trunks:{[data.near]:iTotal,[data.far]:iFar},rheostats,negative,over};
  }

  function adjust(input){
    if(!finitePositive(input.maxReo))throw new Error("invalid-target");
    const a=adjustSide(input,"A"),b=adjustSide(input,"B");
    return {feasible:a.feasible&&b.feasible,reason:a.reason||b.reason,sides:{A:a,B:b},voltages:{...a.voltages,...b.voltages},trunks:{...a.trunks,...b.trunks},rheostats:{...(a.rheostats||{}),...(b.rheostats||{})},negative:[...(a.negative||[]),...(b.negative||[])],over:[...(a.over||[]),...(b.over||[])]};
  }

  return {NODES,IDS,SIDES,dimension,simulate,adjust};
});
