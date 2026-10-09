/* ONE TAKE GAME #007: 競文字 / Keimoji
   No packages, network, runtime horse-name construction, or persisted state.
   The actual runner is the vertical series of individually upright glyphs,
   rotated as ONE rigid object to align its first character with its heading.
*/
(() => {
  'use strict';
  const N = 8;
  const W = 420, H = 410;
  const CX = 210, CY = 207, RX = 140, RY = 104, LANE_GAP = 8.3;
  const WORD_LENGTH = 104; // fixed, independent of original or damaged length
  let START_PROGRESS, FINISH_PROGRESS; // derived from name nose and lap length
  const TWO_PI = Math.PI * 2;
  const TAU_START = -Math.PI / 2;
  const STYLES = ['逃げ', '先行', '差し', '追込'];
  const STAT_KEYS = ['SPEED', 'ACCEL', 'STAMINA', 'TOUGHNESS', 'BALANCE'];
  const COLORS = ['#fffffa','#f9f9f9','#ffd2bf','#daecff','#ffef9b','#d4ffe4','#ffe2c7','#ffe2f0'];
  const $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const average = arr => arr.reduce((a,b) => a+b, 0) / arr.length;
  function hashName(s) {
    let h = 2166136261;
    for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h,16777619); }
    return h >>> 0;
  }
  function rngFor(seed) {
    let a = seed >>> 0;
    return function() {
      a += 0x6D2B79F5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffled(xs, rng=Math.random) {
    const res = xs.slice();
    for (let i=res.length-1;i>0;i--) {
      const j = Math.floor(rng()*(i+1));
      [res[i],res[j]] = [res[j],res[i]];
    }
    return res;
  }

  // Arc-length look-up: equal normalized progress means equal lap distance;
  // the selection of an inside/outside line never grants a timing bonus.
  const table=[0];
  let totalLength=0;
  for(let i=1;i<=1440;i++) {
    const a=TAU_START + (i-1)*TWO_PI/1440;
    const b=TAU_START + i*TWO_PI/1440;
    const xa=RX*Math.cos(a),ya=RY*Math.sin(a);
    const xb=RX*Math.cos(b),yb=RY*Math.sin(b);
    totalLength += Math.hypot(xb-xa,yb-ya);
    table.push(totalLength);
  }
  START_PROGRESS = -(WORD_LENGTH*.46)/totalLength;
  FINISH_PROGRESS = START_PROGRESS+1;
  function angleForProgress(u) {
    u=((u%1)+1)%1;
    const distance=u*totalLength;
    let lo=0,hi=table.length-1;
    while(lo<hi){const mid=(lo+hi)>>1;if(table[mid]<distance)lo=mid+1;else hi=mid;}
    const low=Math.max(0,lo-1);
    const between=(distance-table[low])/Math.max(.0000001,table[lo]-table[low]);
    return TAU_START+TWO_PI*(low+between)/1440;
  }
  function pose(r) {
    const a=angleForProgress(r.progress);
    const offset=(r.lane-3.5)*LANE_GAP;
    const rx=RX+offset,ry=RY+offset;
    const dx=-rx*Math.sin(a),dy=ry*Math.cos(a);
    return {x:CX+rx*Math.cos(a),y:CY+ry*Math.sin(a),rotation:Math.atan2(dx,-dy),fx:dx/Math.hypot(dx,dy),fy:dy/Math.hypot(dx,dy)};
  }
  const analysisCanvas=document.createElement('canvas');
  analysisCanvas.width=44;analysisCanvas.height=44;
  const analysisCtx=analysisCanvas.getContext('2d',{willReadFrequently:true});
  const statCache=new Map();
  function analyzeHorse(name) {
    if(statCache.has(name))return statCache.get(name);
    let pixels=0,sumX=0,edges=0,bl=0,br=0,bboxW=0;
    for(const ch of name){
      analysisCtx.clearRect(0,0,44,44);
      analysisCtx.fillStyle='#000';
      analysisCtx.font='900 30px system-ui, sans-serif';
      analysisCtx.textAlign='center';analysisCtx.textBaseline='middle';
      analysisCtx.fillText(ch,22,22);
      const data=analysisCtx.getImageData(0,0,44,44).data;
      let minX=44,maxX=0;
      for(let y=5;y<39;y++)for(let x=5;x<39;x++){
        const at=(y*44+x)*4;
        const alpha=data[at+3]/255;
        pixels+=alpha;sumX+=x*alpha;
        if(x<22)bl+=alpha;else br+=alpha;
        if(alpha>.3){minX=Math.min(minX,x);maxX=Math.max(maxX,x);}
        if(x<38&&y<38) edges+=Math.abs(data[at+3]-data[at+7])/255+Math.abs(data[at+3]-data[at+176])/255;
      }
      bboxW+=maxX>=minX?(maxX-minX+1)/34:.6;
    }
    const count=name.length;
    const density=pixels/(count*34*34);
    const complexity=edges/(count*34*34);
    const centroid=sumX/(pixels||1);
    const symmetry=1-Math.abs(bl-br)/(pixels||1);
    const width=bboxW/count;
    const rnd=rngFor(hashName(name));
    const jitter=()=> (rnd()-.5)*.31;
    const vals={
      SPEED:clamp(.50 + (0.21-density)*.78 +(width-.68)*.28 + jitter(), .14,.86),
      ACCEL:clamp(.50 + (complexity-.23)*1.05 -(width-.68)*.2 + jitter(), .14,.86),
      STAMINA:clamp(.50 + (density-.21)*.8+(symmetry-.85)*.27+jitter(), .14,.86),
      TOUGHNESS:clamp(.50 + (density-.21)*1.32+(complexity-.23)*.43+jitter(), .14,.86),
      BALANCE:clamp(.50 + (symmetry-.85)*.92-Math.abs(centroid-22)*.021+jitter(), .14,.86)
    };
    const style=STYLES[hashName(name+'style')%4];
    const result={name,vals,style,ranks:Object.fromEntries(STAT_KEYS.map(k=>[k,rank(vals[k])]))};
    statCache.set(name,result);
    return result;
  }
  function rank(v){return v>=.69?'A':v>=.57?'B':v>=.44?'C':v>=.31?'D':'E';}

  function makeLineup(random=Math.random) {
    const chosen=new Set();
    while(chosen.size<N) chosen.add(HORSE_NAMES[Math.floor(random()*HORSE_NAMES.length)]);
    const names=[...chosen];
    const playerSlot=Math.floor(random()*N);
    const result=names.map((name,slot)=>({name,slot:slot+1,player:slot===playerSlot,profile:analyzeHorse(name)}));
    return result;
  }
  function createRace(lineup,seed=Date.now()) {
    const random=rngFor(seed>>>0);
    const lanes=shuffled([0,1,2,3,4,5,6,7],random);
    const runners=lineup.map((entry,i)=>{
      const profile=entry.profile||analyzeHorse(entry.name);
      const base=.0342 + (profile.vals.SPEED-.5)*.012 + (random()-.5)*.0022;
      const initial=START_PROGRESS-random()*.0009;
      return {
        id:i,slot:entry.slot,name:entry.name,remaining:entry.name,profile,player:entry.player,
        lane:lanes[i],targetLane:lanes[i],laneVelocity:0,
        progress:initial,initialProgress:initial,
        base,velocity:base*(.92+random()*.06),
        stamina:clamp(.91+random()*.09+(profile.vals.STAMINA-.5)*.1,0,1),health:1,
        burst:0,boostFx:0,boostCount:0,boostCooldown:random()*1.5,
        aiPeriod:0,collisionCooldown:0,railCooldown:0,attack:random()*.06,
        chaos:0,chaosTimer:1+random()*1.5,
        finishTime:null,weakHits:0,strongHits:0,lost:0,leadCount:0,
        startLane:lanes[i],style:profile.style,wordSize:WORD_LENGTH,
        risk:random(),impactAt:-999
      };
    });
    return {runners,random,elapsed:0,completed:false,results:[],events:[],particles:[],
      broadcast:'各馬ゲートイン完了。',broadcastAt:0,nextNormal:4.3,
      lastRanks:[],rankChanges:0,leaderChanges:0,passes:0,contacts:0,
      lastLeader:null,focus:random(),seed};
  }
  function raceOrder(world) {
    return [...world.runners].sort((a,b)=>{
      if(a.finishTime!==null&&b.finishTime!==null) return a.finishTime-b.finishTime;
      if(a.finishTime!==null)return -1;
      if(b.finishTime!==null)return 1;
      return b.progress-a.progress;
    });
  }
  function speak(world,text,quiet=false){
    world.broadcast=text;world.broadcastAt=world.elapsed;
    if(!quiet&&$('commentary-text'))$('commentary-text').textContent=text;
  }
  function boost(world,r,quiet=false) {
    if(r.finishTime!==null)return false;
    r.boostCount++;
    const energy=r.stamina;
    r.stamina=Math.max(0,r.stamina-(.034+(1-r.profile.vals.STAMINA)*.003));
    const strength=energy>.035?clamp(energy/.16,0,1):0;
    r.burst=clamp(r.burst+.125*strength,0,.36);
    r.velocity+=r.base*.048*strength;
    r.boostFx=strength>0?1:0;
    if(!quiet&&r.player)speak(world,strength>0?'プレイヤー馬に鞭が入った！':'スタミナ切れ！鞭が効かない！');
    return true;
  }
  function styleFactor(style,phase){
    const ease=(x,a,b)=>clamp((x-a)/(b-a),0,1);
    const late=ease(phase,.62,.92),mid=ease(phase,.21,.40);
    switch(style){
      case '逃げ': return lerp(1.075,.997,mid)-.053*late;
      case '先行':return lerp(1.035,1.012,mid)+.023*late;
      case '差し':return lerp(.965,1.000,mid)+.137*late;
      default:return lerp(.925,.990,mid)+.275*late;
    }
  }
  function cpuBoostDecision(world,r,dt,phase,quiet) {
    r.boostCooldown-=dt;
    if(r.boostCooldown>0||r.stamina<.10)return;
    const competitors=world.runners.filter(x=>x!==r&&x.finishTime===null);
    const near=competitors.some(x=>Math.abs(x.progress-r.progress)<.06);
    let propensity=.1;
    if(r.style==='逃げ')propensity=phase<.46?.66:phase>.83?.21:.17;
    else if(r.style==='先行')propensity=phase>.45&&phase<.88?.60:.27;
    else if(r.style==='差し')propensity=phase>.58?.87:.07;
    else propensity=phase>.73?1.0:.035;
    if(near)propensity+=.1;
    if(world.random()<propensity){boost(world,r,true);r.boostCooldown=2.0+world.random()*3.4;}
    else r.boostCooldown=.45+world.random()*.9;
  }
  function steer(world,r,dt,phase) {
    r.aiPeriod-=dt;
    if(r.aiPeriod<=0){
      r.aiPeriod=.55+world.random()*.65;
      let best=r.targetLane, bestScore=-Infinity;
      for(let lane=0;lane<8;lane++){
        let score= -Math.abs(lane-r.lane)*.10;
        // A modest style preference, not a lane-dependent racing-speed bonus.
        if(r.style==='逃げ')score+=(3.5-lane)*.018;
        if(r.style==='先行')score+= (3-Math.abs(lane-3))*.024;
        if((r.style==='差し'||r.style==='追込')&&phase>.64)score+=lane*.055;
        for(const other of world.runners){
          if(other===r||other.finishTime!==null)continue;
          const ahead=other.progress-r.progress;
          if(ahead>-.012&&ahead<.075){
            const laneDist=Math.abs(other.lane-lane);
            if(laneDist<1.4){
              const crowd=(1.4-laneDist)/1.4;
              score-=crowd*(ahead>0?.55:.23)*(1-ahead/.12);
            }
          }
        }
        score+=(world.random()-.5)*.065;
        if(score>bestScore){bestScore=score;best=lane;}
      }
      r.targetLane=best;
    }
    const penalty=r.health<.40?.58: r.health<.68?.82:1;
    const step=dt*(.95+r.profile.vals.BALANCE*1.2)*penalty;
    const previous=r.lane;
    r.lane+=clamp(r.targetLane-r.lane,-step,step);
    r.lane=clamp(r.lane,0,7);
    r.laneVelocity=(r.lane-previous)/Math.max(.001,dt);
  }
  function breakLetters(world,r,oldRemaining,quiet) {
    const shouldLose=Math.min(r.name.length-1,Math.floor((1-r.health)*r.name.length+1e-9));
    const oldCount=r.lost;
    if(shouldLose<=oldCount)return;
    r.lost=shouldLose;
    r.remaining=r.name.slice(0,r.name.length-shouldLose);
    if(!quiet){
      const p=pose(r), len=WORD_LENGTH;
      for(let i=oldCount;i<shouldLose;i++){
        const detached=r.name[r.name.length-1-i];
        const t=world.random()*TWO_PI;
        world.particles.push({ch:detached,x:p.x-p.fx*len*.37,y:p.y-p.fy*len*.37,
          vx:Math.cos(t)*(14+world.random()*24),vy:Math.sin(t)*(14+world.random()*24),life:1.05,rotation:t,color:COLORS[r.slot-1]});
      }
      speak(world,r.remaining.length===1?`${r.name}、残り一文字！大破！`:`激しい接触！${r.name}、文字が欠けた！`);
    }
  }
  function damage(world,r,amount,quiet) {
    if(r.finishTime!==null)return;
    const old=r.remaining;
    r.health=clamp(r.health-amount,0,1);
    r.velocity*=.94;
    breakLetters(world,r,old,quiet);
  }
  function collisionStep(world,dt,quiet) {
    const runners=world.runners;
    for(let i=0;i<N;i++){
      const a=runners[i];if(a.finishTime!==null)continue;
      for(let j=i+1;j<N;j++){
        const b=runners[j];if(b.finishTime!==null)continue;
        const gap=Math.abs(a.progress-b.progress);
        const laneDist=Math.abs(a.lane-b.lane);
        if(gap>.057||laneDist>1.75)continue;
        if(gap<.051&&laneDist<1.55&&world.random()<dt*1.2){
          // Broad overlap is harmless. Only close, high-energy or crossing
          // encounters can chip a name; no hard blocking or stuck state.
          a.weakHits++;b.weakHits++;
          a.velocity*=.997;b.velocity*=.997;
          const sign=a.lane<=b.lane?-1:1;
          a.targetLane=clamp(Math.round(a.lane+sign),0,7);
          b.targetLane=clamp(Math.round(b.lane-sign),0,7);
          const relative=Math.abs(a.velocity-b.velocity)/Math.max(a.base,b.base);
          const crossing=Math.abs(a.laneVelocity-b.laneVelocity);
          const energetic=(relative>.028 || crossing>.22 || a.burst>.05 || b.burst>.05 || (a.velocity+b.velocity)>.066);
          if(energetic&&world.elapsed-a.impactAt>1.95&&world.elapsed-b.impactAt>1.95){
            if(world.random()<.75){
              a.impactAt=world.elapsed;b.impactAt=world.elapsed;
              const scale=.85+world.random()*.45;
              damage(world,a,(.044+(1-a.profile.vals.TOUGHNESS)*.020)*scale,quiet);
              damage(world,b,(.044+(1-b.profile.vals.TOUGHNESS)*.020)*scale,quiet);
              a.strongHits++;b.strongHits++;world.contacts++;
              if(!quiet){
                const p=pose(a);world.particles.push({spark:true,x:p.x,y:p.y,life:.45});
                if(a.remaining===a.name&&b.remaining===b.name)speak(world,`${a.name}と${b.name}が激しく接触！`);
              }
            }
          }
        }
      }
      // Only forceful rail-side swerves sometimes cause extra damage.
      if((a.lane<.09||a.lane>6.91)&&Math.abs(a.laneVelocity)>.65&&a.velocity>.034 &&world.elapsed-a.railCooldown>4.4&&world.random()<dt*.22){
        a.railCooldown=world.elapsed;damage(world,a,.065+world.random()*.060,quiet);
        a.strongHits++;world.contacts++;
        if(!quiet){const p=pose(a);world.particles.push({spark:true,x:p.x,y:p.y,life:.4});}
      }
    }
  }
  function stepRace(world,dt=.05,quiet=true) {
    if(world.completed)return;
    dt=clamp(dt,.001,.15);
    world.elapsed+=dt;
    for(const r of world.runners){
      if(r.finishTime!==null)continue;
      const phase=clamp((r.progress-START_PROGRESS),0,1);
      if(!r.player)cpuBoostDecision(world,r,dt,phase,quiet);
      steer(world,r,dt,phase);
      r.chaosTimer-=dt;
      if(r.chaosTimer<=0){
        r.chaosTimer=.75+world.random()*1.6;
        r.chaos=clamp(r.chaos*.3+(world.random()-.5)*.08,-.08,.08);
      }
      const style=styleFactor(r.style,phase);
      const stamFactor=.66+.34*Math.sqrt(r.stamina);
      const loss=1-r.health;
      const damageSpeed=loss<.36?1:loss<.73?1-(loss-.36)*.37:.77-Math.min(.16,(loss-.73)*.6);
      const damageAccel=loss<.17?1+loss*.10:loss<.42?1.022:loss<.73?.96:.63;
      const desired=r.base*style*stamFactor*damageSpeed*(1+r.chaos+r.burst);
      const response=1.5+r.profile.vals.ACCEL*2.8;
      r.velocity+= (desired-r.velocity)*Math.min(1,dt*response*damageAccel);
      r.velocity=clamp(r.velocity,.0095,.0525);
      r.progress+=r.velocity*dt;
      r.stamina=clamp(r.stamina+dt*(.00175+(r.profile.vals.STAMINA-.5)*.0006)-dt*Math.max(0,style-1.02)*.006,0,1);
      r.burst*=Math.exp(-dt*2.1);
      r.boostFx=Math.max(0,r.boostFx-dt*2.3);
      if(r.progress>=FINISH_PROGRESS){
        const over=r.progress-FINISH_PROGRESS;
        r.finishTime=world.elapsed-over/Math.max(.01,r.velocity);
        r.progress=FINISH_PROGRESS;
        world.results.push(r);
        if(!quiet){
          if(world.results.length===1)speak(world,`${r.name}、先頭でゴールイン！`);
          else if(r.player)speak(world,`プレイヤー馬 ${r.name}、ゴール！`);
        }
      }
    }
    collisionStep(world,dt,quiet);
    if(world.elapsed-world.lastSample>=.55 || world.lastSample===undefined){
      const ranks=raceOrder(world).map(r=>r.id);
      if(world.lastRanks.length){
        for(let i=0;i<N;i++)if(ranks[i]!==world.lastRanks[i])world.rankChanges++;
        if(ranks[0]!==world.lastRanks[0]){
          world.leaderChanges++;
          if(!quiet&&world.elapsed-world.broadcastAt>.6){const lead=world.runners[ranks[0]];speak(world,`${lead.name}、先頭へ！`);}
        }
      }
      world.lastRanks=ranks;
      world.lastSample=world.elapsed;
    }
    if(!quiet){
      world.particles.forEach(p=>{p.life-=dt;if(!p.spark){p.x+=p.vx*dt;p.y+=p.vy*dt;}});
      world.particles=world.particles.filter(p=>p.life>0);
      const leader=raceOrder(world)[0];const phase=leader.progress-START_PROGRESS;
      if(world.elapsed>=world.nextNormal&&world.elapsed-world.broadcastAt>2.3){
        world.nextNormal=world.elapsed+4.3+world.random()*1.6;
        if(phase>.90){
          const top=raceOrder(world);
          const tight=top[1]&&(top[0].progress-top[1].progress)<.02;
          speak(world,tight?'並んだ！どちらだ！ゴールは目前！':'最後の直線！各馬が一斉に追い出す！');
        } else if(phase>.70)speak(world,'最終コーナー！後方勢が一気に動いた！');
        else if(phase>.42){
          const next=raceOrder(world)[Math.floor(world.random()*4)];
          speak(world,`外から${next.name}がじわじわ伸びてきた！`);
        } else speak(world,`${leader.name}が先団を引っ張っています！`);
      }
    }
    if(world.results.length===N){
      world.results.sort((a,b)=>a.finishTime-b.finishTime);
      world.completed=true;
    }
  }

  // Canvas 2D renderer. The canvas has twice its logical resolution, which
  // keeps small mobile glyphs crisper without introducing external fonts.
  const canvas=$('race-canvas');
  const ctx=canvas.getContext('2d');
  ctx.setTransform(2,0,0,2,0,0);
  function ellipse(x,y,rx,ry){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TWO_PI);}
  function drawGrass(){
    ctx.fillStyle='#1d5435';ctx.fillRect(0,0,W,H);
    for(let i=0;i<12;i++){
      ctx.fillStyle=i%2?'#225c39':'#235b3a';
      ctx.fillRect(0,i*40-30,W,22);
    }
    for(let i=0;i<80;i++){
      const x=(i*127.3)%W,y=(i*69.4)%H;
      ctx.fillStyle=i%2?'#b4d79519':'#f7e5ad12';ctx.fillRect(x,y,1.4,2.5);
    }
  }
  function drawTrack(world,gate){
    drawGrass();
    ellipse(CX,CY,191,155);ctx.fillStyle='#3e6947';ctx.fill();
    ellipse(CX,CY,184,149);ctx.fillStyle='#638b5b';ctx.fill();
    ellipse(CX,CY,176,142);ctx.fillStyle='#64985d';ctx.fill();
    ellipse(CX,CY,91,57);ctx.fillStyle='#1e5936';ctx.fill();
    ellipse(CX,CY,93,59);ctx.lineWidth=3;ctx.strokeStyle='#fcf3d2';ctx.stroke();
    ellipse(CX,CY,184,149);ctx.lineWidth=3;ctx.strokeStyle='#fcf3d2';ctx.stroke();
    ellipse(CX,CY,188,153);ctx.lineWidth=1;ctx.strokeStyle='#d9c9a5';ctx.stroke();
    for(let lane=0;lane<7;lane++){
      const off=(lane-3)*LANE_GAP;
      ellipse(CX,CY,120+off,84+off);
      ctx.strokeStyle='#dce8bd30';ctx.lineWidth=.7;
      ctx.setLineDash([6,10]);ctx.stroke();ctx.setLineDash([]);
    }
    // Turf logo is INSIDE the empty infield, never attached to a runner.
    ctx.textAlign='center';ctx.fillStyle='#c8d6a87c';ctx.font='bold 15px Georgia, serif';ctx.fillText('KEIMOJI',CX,CY-2);
    ctx.font='bold 9px system-ui,sans-serif';ctx.fillText('TURF • 1 LAP',CX,CY+15);
    // The start and finish are one radial line at the TOP of the oval.
    for(let y=59;y<151;y+=6){
      ctx.fillStyle=(Math.floor(y/6)%2)?'#fcf7dd':'#1b3128';
      ctx.fillRect(CX-5,y,5,6);
      ctx.fillStyle=(Math.floor(y/6)%2)?'#1b3128':'#fcf7dd';
      ctx.fillRect(CX,y,5,6);
    }
    ctx.fillStyle='#fff0c7';ctx.font='bold 8px system-ui,sans-serif';
    ctx.fillText('FINISH',CX+31,67);
    if(gate){
      for(let i=0;i<8;i++){
        const off=(i-3.5)*LANE_GAP;
        ctx.save();ctx.translate(CX,CY-(RY+off));
        ctx.strokeStyle='#f5deaf';ctx.lineWidth=1.7;
        ctx.strokeRect(-6,-4,11,8);
        ctx.restore();
      }
    }
    // Trackside posts / spectators rendered as abstract dots (no horse sprites).
    for(let i=0;i<27;i++){
      const a=i*TWO_PI/27;
      ctx.beginPath();ctx.arc(CX+199*Math.cos(a),CY+163*Math.sin(a),1.7,0,TWO_PI);
      ctx.fillStyle=i%2?'#d0ddbd':'#c5b78b';ctx.fill();
    }
  }
  function drawRunner(r){
    const p=pose(r),count=r.remaining.length;
    const gap=WORD_LENGTH/Math.max(count,5);
    const font=clamp(gap*1.06,7.8,15.2);
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rotation);
    if(r.player){
      ctx.strokeStyle='#ffe199';ctx.lineWidth=1;ctx.setLineDash([3,3]);
      ctx.beginPath();ctx.ellipse(0,0,11,WORD_LENGTH*.55,0,0,TWO_PI);ctx.stroke();ctx.setLineDash([]);
    }
    if(r.boostFx>0){
      ctx.strokeStyle=`rgba(255,224,140,${r.boostFx*.75})`;ctx.lineWidth=1.8;
      for(let q=-1;q<=1;q+=2){ctx.beginPath();ctx.moveTo(q*11,WORD_LENGTH*.48);ctx.lineTo(q*15,WORD_LENGTH*(.72+.20*r.boostFx));ctx.stroke();}
    }
    ctx.fillStyle=COLORS[r.slot-1];ctx.strokeStyle='#0c1e1b';ctx.lineWidth=1.8;
    ctx.lineJoin='round';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font=`900 ${font.toFixed(1)}px system-ui,"Yu Gothic",Meiryo,sans-serif`;
    const stretch=1+r.boostFx*.13;
    ctx.scale(1,stretch);
    for(let i=0;i<count;i++){
      const y=(-WORD_LENGTH*.5 + gap*(i+.5));
      // Individual glyphs remain upright in LOCAL coordinates; the whole
      // runner rotates ONCE as a rigid vertical stack with its leading glyph forward.
      ctx.strokeText(r.remaining[i],0,y);
      ctx.fillText(r.remaining[i],0,y);
    }
    if(r.boostFx>.65){ctx.fillStyle='#ffeab4';ctx.font='900 15px system-ui,sans-serif';ctx.fillText('!',10,-WORD_LENGTH*.70);}
    ctx.restore();
  }
  function drawParticles(world){
    for(const p of world.particles){
      ctx.save();ctx.translate(p.x,p.y);
      if(p.spark){
        ctx.globalAlpha=clamp(p.life/.45,0,1);ctx.strokeStyle='#ffe7ab';ctx.lineWidth=2;
        for(let a=0;a<6;a++){ctx.rotate(TWO_PI/6);ctx.beginPath();ctx.moveTo(3,0);ctx.lineTo(9,0);ctx.stroke();}
      }else{
        ctx.globalAlpha=clamp(p.life*1.2,0,1);ctx.rotate(p.rotation+(1-p.life)*2);
        ctx.font='900 13px system-ui,sans-serif';ctx.strokeStyle='#142319';ctx.lineWidth=2;
        ctx.textAlign='center';ctx.strokeText(p.ch,0,0);ctx.fillStyle=p.color;ctx.fillText(p.ch,0,0);
      }
      ctx.restore();
    }
  }
  function draw(world,gate=false){
    ctx.clearRect(0,0,W,H);drawTrack(world,gate);
    const behind=[...world.runners].sort((a,b)=>a.player?1:b.player?-1:a.lane-b.lane);
    for(const r of behind)drawRunner(r);
    drawParticles(world);
  }

  let lineup=makeLineup(),world=null,state='entry',frameId=0,lastTime=0,gateDuration=1.50,gateProgress=0;
  function setScreen(which){
    state=which;
    $('entry-screen').classList.toggle('hidden',which!=='entry');
    $('race-screen').classList.toggle('hidden',which!=='race');
    $('result-screen').classList.toggle('hidden',which!=='result');
  }
  function drawEntry(){
    const cards=$('entry-list');cards.replaceChildren();
    for(const entry of lineup){
      const el=document.createElement('article');el.className='entry-card'+(entry.player?' yours':'');
      const badge=document.createElement('div');badge.className=`gate-badge gate-${entry.slot}`;badge.textContent=String(entry.slot);
      const content=document.createElement('div');
      const nm=document.createElement('div');nm.className='entry-name';nm.textContent=entry.name;
      const meta=document.createElement('div');meta.className='horse-meta';meta.textContent=`${entry.player?'あなたの馬':'CPU'} ・ ${entry.profile.style}`;
      const ranks=document.createElement('div');ranks.className='rank-strip';
      for(const k of STAT_KEYS){const tag=document.createElement('span');tag.textContent=k+' ';const v=document.createElement('b');v.textContent=entry.profile.ranks[k];tag.append(v);ranks.append(tag);}
      content.append(nm,meta,ranks);el.append(badge,content);cards.append(el);
    }
    const player=lineup.find(e=>e.player);
    $('pick-name').textContent=player.name;
    $('pick-summary').textContent=`脚質：${player.profile.style}　能力：${STAT_KEYS.map(k=>player.profile.ranks[k]).join(' / ')}`;
  }
  function randomizePlayer(){
    const player=lineup.find(e=>e.player);
    const excludes=new Set(lineup.map(e=>e.name));
    let name;
    do {name=HORSE_NAMES[Math.floor(Math.random()*HORSE_NAMES.length)];}while(excludes.has(name));
    player.name=name;player.profile=analyzeHorse(name);drawEntry();
  }
  function newLineup(){
    cancelAnimationFrame(frameId);world=null;lineup=makeLineup();setScreen('entry');drawEntry();window.scrollTo(0,0);
  }
  function updateMeters(){
    if(!world)return;
    const me=world.runners.find(r=>r.player);
    $('stamina-fill').style.width=(me.stamina*100).toFixed(2)+'%';
    $('health-fill').style.width=(me.health*100).toFixed(2)+'%';
  }
  function start(){
    world=createRace(lineup,(Math.random()*0xFFFFFFFF)>>>0);
    gateProgress=0;lastTime=0;setScreen('race');
    $('whip-button').disabled=true;
    $('gate-overlay').classList.remove('hidden');$('gate-overlay').textContent='各馬ゲートイン完了';
    $('race-phase').textContent='GATE IN';$('commentary-text').textContent='各馬ゲートイン完了。';
    updateMeters();draw(world,true);window.scrollTo(0,0);
    frameId=requestAnimationFrame(tick);
  }
  function showResults(){
    setScreen('result');$('whip-button').disabled=true;
    const player=world.results.find(r=>r.player);
    const position=world.results.indexOf(player)+1;
    $('result-headline').textContent=position===1?'優勝！':'確定着順';
    $('result-screen').classList.toggle('champion',position===1);
    $('result-message').textContent=position===1?'文字の頂点へ。あなたの馬が1着でゴール！':`あなたの馬は${position}着。文字たちの激走が終わりました。`;
    const list=$('result-list');list.replaceChildren();
    world.results.forEach((r,index)=>{
      const card=document.createElement('article');card.className='result-row'+(r.player?' player':'');
      const pos=document.createElement('div');pos.className='placement';pos.textContent=index+1;
      const badge=document.createElement('div');badge.className=`gate-badge gate-${r.slot}`;badge.textContent=r.slot;
      const detail=document.createElement('div');
      const name=document.createElement('div');name.className='result-name';name.textContent=`元：${r.name}`;
      if(r.player){const label=document.createElement('span');label.className='player-pill';label.textContent='あなた';name.append(label);}
      const remaining=document.createElement('div');remaining.className='result-remaining';remaining.append('最終：');
      const rem=document.createElement('b');rem.textContent=r.remaining;remaining.append(rem);
      const meters=document.createElement('div');meters.className='result-meters';
      const stm=document.createElement('div');stm.className='result-meter';stm.title='スタミナ';
      const stmInner=document.createElement('i');stmInner.style.width=(r.stamina*100)+'%';stm.append(stmInner);
      const hp=document.createElement('div');hp.className='result-meter health';hp.title='耐久力';
      const hpInner=document.createElement('i');hpInner.style.width=(r.health*100)+'%';hp.append(hpInner);
      meters.append(stm,hp);detail.append(name,remaining,meters);card.append(pos,badge,detail);list.append(card);
    });
    window.scrollTo(0,0);
  }
  let accumulator=0;
  function tick(timestamp){
    if(state!=='race')return;
    const delta=lastTime?clamp((timestamp-lastTime)/1000,0,.10):0;
    lastTime=timestamp;
    if(gateProgress<gateDuration){
      gateProgress+=delta;
      if(gateProgress>=gateDuration){
        $('gate-overlay').textContent='スタートしました！';
        $('race-phase').textContent='RACING';
        $('whip-button').disabled=false;
        speak(world,'スタートしました！');
        setTimeout(()=>{if(state==='race')$('gate-overlay').classList.add('hidden');},850);
      }
    } else {
      accumulator=Math.min(.18,accumulator+delta);
      while(accumulator>=.05){stepRace(world,.05,false);accumulator-=.05;}
      if(world.completed){draw(world);updateMeters();showResults();return;}
    }
    draw(world,gateProgress<gateDuration);
    updateMeters();frameId=requestAnimationFrame(tick);
  }
  $('random-button').addEventListener('click',randomizePlayer);
  $('start-button').addEventListener('click',start);
  $('whip-button').addEventListener('click',()=>{
    if(state!=='race'||gateProgress<gateDuration||!world||world.completed)return;
    boost(world,world.runners.find(r=>r.player),false);updateMeters();
    const button=$('whip-button');button.classList.add('pressed');
    setTimeout(()=>button.classList.remove('pressed'),90);
  });
  $('again-button').addEventListener('click',newLineup);
  $('reselect-button').addEventListener('click',newLineup);
  // Pure simulation hooks are exposed ONLY to facilitate automated QA.
  // A simulation uses the SAME stepRace(), collision and AI as live play.
  function simulate(seed=123,whipMode='none',forcedLineup=null){
    const r=rngFor(seed>>>0);
    const entries=forcedLineup||makeLineup(r);
    const world=createRace(entries,seed*2654435761);
    let step=0,boostAttempts=0,playerEverEmpty=false;
    while(!world.completed&&world.elapsed<58){
      const p=world.runners.find(x=>x.player),f=p.progress-START_PROGRESS;
      if(whipMode==='timed'&&step%22===0&&f>.68&&f<.94){boost(world,p,true);boostAttempts++;}
      if(whipMode==='spam'&&step%3===0){boost(world,p,true);boostAttempts++;}
      if(p.stamina<.02)playerEverEmpty=true;
      stepRace(world,.05,true);step++;
    }
    const result=world.completed?world.results:raceOrder(world);
    const startingOrder=[...world.runners].sort((a,b)=>b.initialProgress-a.initialProgress);
    const runner=result.map(x=>({name:x.name,slot:x.slot,style:x.style,chars:x.name.length,startRank:startingOrder.indexOf(x)+1,
      damage:1-x.health,remaining:x.remaining.length,finish:x.finishTime,startLane:x.startLane,
      player:x.player,strongHits:x.strongHits,stamina:x.stamina}));
    return {completed:world.completed,time:world.elapsed,first:result[0].name,
      winnerStyle:result[0].style,winnerLane:result[0].startLane,
      playerRank:result.findIndex(x=>x.player)+1,runner,
      rankChanges:world.rankChanges,leaderChanges:world.leaderChanges,
      strongContacts:world.contacts,boostAttempts,playerEverEmpty};
  }
  window.KeimojiQA=Object.freeze({simulate,makeLineup,analyzeHorse,pose,angleForProgress,createRace,stepRace,
    names:HORSE_NAMES, trackLength:totalLength, wordLength:WORD_LENGTH, startProgress:START_PROGRESS,
    getWorld:()=>world,getState:()=>state,paint:()=>{if(world)draw(world,false);},
    applyTestDamage:(runner,amount)=>{if(world)damage(world,runner,amount,true);},
    renderTest:(progress,lane=3)=>{const p=pose({progress,lane});return p;}
  });
  drawEntry();
})();
