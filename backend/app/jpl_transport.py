"""Bounded exact-request HTTP cache; scientific parameters/parsing remain in HorizonsService."""
import json,threading,time
from email.utils import parsedate_to_datetime
from datetime import datetime,timezone
from collections import OrderedDict
import requests

class JplTransport:
    def __init__(self,user_agent,ttl=300,entries=16,max_bytes=2000000,clock=time.monotonic):
        self.user_agent=user_agent;self.ttl=ttl;self.entries=entries;self.max_bytes=max_bytes;self.clock=clock
        self.cache=OrderedDict();self.lock=threading.Lock();self.blocked_until=0
    def get(self,url,params,timeout):
        if url!='https://ssd.jpl.nasa.gov/api/horizons.api':raise ValueError('Only the fixed NASA Horizons endpoint is allowed.')
        key=json.dumps(params,sort_keys=True,separators=(',',':'))
        with self.lock:
            cached=self.cache.pop(key,None)
            if cached and self.clock()-cached[0]<self.ttl:
                self.cache[key]=cached;return self._response(cached[1],cached[2])
            from app.services.horizons_service import HorizonsAPIError
            if self.clock()<self.blocked_until:raise HorizonsAPIError('NASA Horizons requested a cooldown. Try again later; no new NASA request was sent.',status_code=503)
            response=requests.get(url,params=params,timeout=timeout,headers={'User-Agent':self.user_agent})
            if response.status_code==429:
                retry=response.headers.get('Retry-After','60')
                try:delay=float(retry)
                except ValueError:
                    try:delay=(parsedate_to_datetime(retry)-datetime.now(timezone.utc)).total_seconds()
                    except (ValueError,TypeError):delay=60
                # Honor publisher cooldowns up to one day, with a 60-second minimum.
                self.blocked_until=self.clock()+max(60,min(delay,86400))
            if response.status_code==200:
                try:
                    payload=response.json();valid=isinstance(payload,dict) and 'error' not in payload and bool(payload.get('result'))
                except ValueError:raise HorizonsAPIError('NASA Horizons returned malformed JSON.',status_code=502)
                if not isinstance(payload,dict):raise HorizonsAPIError('NASA Horizons returned an unexpected JSON structure.',status_code=502)
                if valid:
                    # Live API signature verified in Step 16A. Fail closed on an unreviewed format.
                    signature=payload.get('signature')
                    if not isinstance(signature,dict) or signature.get('version')!='1.2':raise HorizonsAPIError('NASA Horizons API response version changed or is missing. Parser compatibility must be reviewed before analysis resumes.',status_code=502)
                    if len(response.content)<=self.max_bytes:
                        self.cache[key]=(self.clock(),response.content,dict(response.headers))
                        while len(self.cache)>self.entries:self.cache.popitem(last=False)
            return response
    @staticmethod
    def _response(content,headers):
        response=requests.Response();response.status_code=200;response._content=content;response.headers.update(headers);response.encoding='utf-8';return response
