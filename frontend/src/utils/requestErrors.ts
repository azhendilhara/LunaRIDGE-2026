export function describeApiFailure(status:number,detail:string,retryAfter:string|null,serviceLabel=''):string {
 let wait='';
 if(retryAfter){const numeric=Number(retryAfter),seconds=Number.isFinite(numeric)?numeric:Math.ceil((Date.parse(retryAfter)-Date.now())/1000);if(Number.isFinite(seconds)&&seconds>=0)wait=` Retry after ${Math.max(1,seconds)} seconds.`;}
 const upstream=/NASA.*Horizons|NASA JPL|upstream/i.test(detail+' '+serviceLabel);
 if(upstream)return `NASA ephemeris service unavailable.${wait} Your scenario is preserved; no new NASA result is available. ${detail}`;
 if(/coverage|NoData|LOLA|\bDEM\b|outside.*raster/i.test(detail+' '+serviceLabel))return `Terrain data unavailable or incomplete. Missing coverage is unknown, not zero visibility. Review the site or terrain radius. ${detail}`;
 if(status===429)return `Request limit reached.${wait} Please wait, then retry once. ${detail}`;
 if(status===503)return `Scientific engine busy or starting.${wait} Your inputs are preserved; retry manually.${/busy|compute slot/i.test(detail)?'':` ${detail}`}`;
 return `Scientific request could not finish (${status}). ${detail}`;
}
