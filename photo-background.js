// Sample a small image and favor its most common mid-tone color.
export function backgroundFromPixels(pixels) {
  const bins=new Map();
  for(let i=0;i<pixels.length;i+=4) {
    const [r,g,b,alpha]=pixels.slice(i,i+4);
    if(alpha<128)continue;
    const brightness=(r+g+b)/3;
    if(brightness<24||brightness>232)continue;
    const key=[r,g,b].map(channel=>Math.floor(channel/48)).join(',');
    const bin=bins.get(key)||{count:0,r:0,g:0,b:0};
    bin.count++;bin.r+=r;bin.g+=g;bin.b+=b;bins.set(key,bin);
  }
  const dominant=[...bins.values()].sort((a,b)=>b.count-a.count)[0];
  if(!dominant)return null;
  // Retain the hue at very low brightness, with a small floor near black.
  const color=['r','g','b'].map(channel=>Math.round(6+.12*dominant[channel]/dominant.count));
  return `rgb(${color.join(', ')})`;
}

const colors=new Map();
export function photoBackground(url) {
  if(!url)return Promise.resolve(null);
  if(colors.has(url))return colors.get(url);
  const task=(async()=>{
    let source,localUrl;
    try {
      // Read saved photos directly so older offline downloads work as well.
      if('caches' in globalThis)for(const name of await caches.keys()) {
        if(!name.startsWith('glauco-trip-'))continue;
        const response=await(await caches.open(name)).match(url);
        if(response){localUrl=URL.createObjectURL(await response.blob());break;}
      }
      source=await new Promise((resolve,reject)=>{
        const img=new Image();img.crossOrigin='anonymous';
        img.onload=()=>resolve(img);img.onerror=reject;img.src=localUrl||url;
      });
      const canvas=document.createElement('canvas');canvas.width=canvas.height=32;
      const context=canvas.getContext('2d',{willReadFrequently:true});
      context.drawImage(source,0,0,32,32);
      return backgroundFromPixels(context.getImageData(0,0,32,32).data);
    }catch{return null;}finally{if(localUrl)URL.revokeObjectURL(localUrl);}
  })();
  colors.set(url,task);
  task.then(color=>{if(!color)colors.delete(url);});
  return task;
}
