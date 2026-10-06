import {expect,it} from 'vitest';
import {buildTrackViewModel} from './track-model';
it('keeps persistent measured events strictly above 140 with original points',()=>{
 const points=[140,141,156].map((speedKph,i)=>({id:`p${i}`,speedKph,coordinates:[37+i/100,55] as const,timestamp:`2026-09-23T10:0${i}:00Z`,address:'Москва'}));
 const model=buildTrackViewModel({vehicleId:'v',date:'2026-09-23',points,events:[]});
 expect(model.events.map(e=>e.speedKph)).toEqual([141,156]);
 expect(model.events[0].coordinates).toEqual(points[1].coordinates);
 expect(model.eventGroups).toHaveLength(2);
});
