export function BrandMark({busy=false}:{busy?:boolean}){
  return <picture className="chat-mark"><source media="(prefers-reduced-motion: reduce)" srcSet="/brand/torob-radish.png"/><img src={busy?'/brand/torob-radish.gif':'/brand/torob-radish.png'} width={76} height={76} alt="" aria-hidden="true" decoding="async"/></picture>;
}
