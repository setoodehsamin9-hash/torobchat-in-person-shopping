export type MapLabelPoint={id:string;x:number;y:number};
export type MapLabelOffset={id:string;offsetX:number;offsetY:number};
type Rect={left:number;top:number;right:number;bottom:number};

/** Move only screen labels; geographic shop coordinates never change. */
export function layoutMapLabels(points:MapLabelPoint[],viewport:{width:number;height:number}):MapLabelOffset[]{
 const placed:Rect[]=[];
 const gap=8,width=112,height=36,anchorY=42;
 const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(value,max));
 return points.map(point=>{
  const left=clamp(point.x-width/2,gap,viewport.width-width-gap);
  const naturalTop=point.y-anchorY;
  const baseTop=clamp(naturalTop,gap,viewport.height-height-gap);
  const candidates=[baseTop,...placed.flatMap(rect=>[rect.bottom+gap,rect.top-height-gap])].sort((a,b)=>Math.abs(a-naturalTop)-Math.abs(b-naturalTop));
  const fits=(top:number)=>top>=gap&&top+height<=viewport.height-gap&&placed.every(rect=>left+width+gap<=rect.left||rect.right+gap<=left||top+height+gap<=rect.top||rect.bottom+gap<=top);
  // Five 112×36 labels fit in the supported map height (at least 240px).
  // On larger legacy lists, prefer a non-overlapping label over hiding a shop.
  const top=candidates.find(fits)??Math.max(baseTop,...placed.map(rect=>rect.bottom+gap));
  placed.push({left,top,right:left+width,bottom:top+height});
  return {id:point.id,offsetX:left-(point.x-width/2),offsetY:top-naturalTop};
 });
}
