import assert from 'node:assert/strict';
import { LiveFaceAdvisor, measurementsDiffer, scoreFaceArchetypes, suggestFrames } from '../src/utils/faceFitAdvisor';
import { SUNGLASSES_CATALOG } from '../src/data/catalog';
import type { FaceMeasurements } from '../src/types';
function sample(jaw: number): FaceMeasurements {
 const ratios={heightToWidth:1.2,jawToCheek:jaw,foreheadToCheek:.83,foreheadToJaw:.83/jaw,chinToJaw:.48};
 return {...ratios,...scoreFaceArchetypes(ratios),samples:1,measuredAt:0};
}
// Find adjacent sides of a classification boundary, below the old change gate.
let pair: [FaceMeasurements,FaceMeasurements] | undefined;
for(let jaw=.75;jaw<.9;jaw+=.001) {
 const a=sample(jaw),b=sample(jaw+.01);
 if(a.shape!==b.shape && !measurementsDiffer(a,b)) {pair=[a,b];break;}
}
assert(pair,'No nearby classification-boundary fixture found');
const [a,b]=pair;
const live=new LiveFaceAdvisor();live.reset(1000);
let time=1000;
let state: ReturnType<LiveFaceAdvisor['update']>;
const scan=(m:FaceMeasurements)=>{
 for(let i=0;i<12;i++) {time+=160;state=live.update({...m,measuredAt:time},true,time);}
 assert.equal(state!.measurement?.shape,m.shape,'Live advisor retained another wearer');
 return suggestFrames(state!.measurement!,SUNGLASSES_CATALOG);
};
// No dropout, manual reset, or big proportion change between these users.
const first=scan(a),second=scan(b),returned=scan(a);
assert.notEqual(first.shape,second.shape);
assert.notDeepEqual(first.frames.map(f=>f.product.id),second.frames.map(f=>f.product.id),'Recommendations did not refresh');
assert.deepEqual(returned.frames.map(f=>f.product.id),first.frames.map(f=>f.product.id),'Returning user got second user recommendations');
const duplicate=live.update({...a,measuredAt:time},true,time);
assert.equal(duplicate.measurement?.measuredAt,time,'Duplicate changed result timestamp');
assert.equal(live.update({...a,measuredAt:time},true,time+1000).measurement,null,'Frozen camera retained stale result');
scan(b);
assert.equal(live.update(undefined,true,time+160).measurement,null,'Non-frontal/invalid measurements retained result');
scan(a);
assert.equal(live.update({...a,measuredAt:time},false,time).measurement,null,'Face loss retained result');
live.reset(time);
assert.equal(live.update({...b,measuredAt:time},true,time).measurement,null,'Restart accepted pre-scan sample');
time+=160;
assert.equal(live.update({...a,measuredAt:time},true,time).measurement,null,'Restart skipped fresh scan');
console.log(`PASS continuous ${a.shape} -> ${b.shape} -> ${a.shape} below old thresholds; frame recommendations restored; stale/invalid/dropout/restart cleared`);
