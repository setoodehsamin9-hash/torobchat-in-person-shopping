import {describe,expect,it} from 'vitest';
import {layoutMapLabels,type MapLabelPoint} from '@/components/map-label-layout';

function rectangles(points:MapLabelPoint[],viewport={width:600,height:400}){
 return layoutMapLabels(points,viewport).map(label=>{const point=points.find(point=>point.id===label.id)!;return {id:label.id,left:point.x-56+label.offsetX,top:point.y-42+label.offsetY,right:point.x+56+label.offsetX,bottom:point.y-6+label.offsetY};});
}
function expectSeparate(rects:ReturnType<typeof rectangles>){
 for(let index=0;index<rects.length;index++)for(let next=index+1;next<rects.length;next++){
  const a=rects[index],b=rects[next];
  expect(a.right+8<=b.left||b.right+8<=a.left||a.bottom+8<=b.top||b.bottom+8<=a.top,`${a.id} and ${b.id} have separate clickable labels`).toBe(true);
 }
}

describe('map price label layout',()=>{
 it('separates all five shops at identical coordinates without changing the source points',()=>{
  const points=Array.from({length:5},(_,index)=>({id:`shop${index}`,x:300,y:200}));
  const before=structuredClone(points);const rects=rectangles(points);
  expectSeparate(rects);expect(points).toEqual(before);
  for(const rect of rects){expect(rect.top).toBeGreaterThanOrEqual(8);expect(rect.bottom).toBeLessThanOrEqual(392);}
 });
 it('separates neighboring shop labels even when shop coordinates differ',()=>{
  expectSeparate(rectangles([{id:'one',x:300,y:200},{id:'two',x:306,y:204},{id:'three',x:265,y:210}]));
 });
 it('keeps labels within the map near its top left corner',()=>{
  const rects=rectangles([{id:'one',x:5,y:5},{id:'two',x:8,y:7}],{width:390,height:290});
  expectSeparate(rects);for(const rect of rects){expect(rect.left).toBeGreaterThanOrEqual(8);expect(rect.top).toBeGreaterThanOrEqual(8);expect(rect.right).toBeLessThanOrEqual(382);expect(rect.bottom).toBeLessThanOrEqual(282);}
 });
 it('retains the original anchor for isolated labels',()=>{
  expect(layoutMapLabels([{id:'one',x:150,y:100},{id:'two',x:450,y:300}],{width:600,height:400})).toEqual([{id:'one',offsetX:0,offsetY:0},{id:'two',offsetX:0,offsetY:0}]);
 });
});
