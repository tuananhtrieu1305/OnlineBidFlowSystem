/** Refresh visible read views; never attach this to an editable form. */
export function watchAuctionUpdates(refresh:()=>void){
 const visible=()=>{if(document.visibilityState==='visible')refresh();};
 const timer=window.setInterval(visible,10_000);
 window.addEventListener('focus',visible);
 document.addEventListener('visibilitychange',visible);
 return()=>{
  window.clearInterval(timer);
  window.removeEventListener('focus',visible);
  document.removeEventListener('visibilitychange',visible);
 };
}
