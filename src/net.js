const base=import.meta.env?.VITE_API_URL||'';
const socketBase=import.meta.env?.VITE_WS_URL||'';
export async function api(path,options={}){const res=await fetch(`${base}${path}`,{...options,credentials:'include',headers:{'Content-Type':'application/json',...(options.headers||{})}});const data=await res.json().catch(()=>({error:'Respons server tidak valid.'}));if(!res.ok)throw new Error(data.error||`Server ${res.status}`);return data}
export function connectSocket(){const url=socketBase||`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`;return new WebSocket(url)}
