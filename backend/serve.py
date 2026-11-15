"""One-worker launcher for local or Render use; never publishes anything."""
import os
from app.deployment import Settings,dem_path
from download_dem import download_dem,verify_dem

def main():
    Settings.load()
    strategy=os.environ.get('DEM_STRATEGY','existing')
    if strategy=='download':download_dem(dem_path())
    elif strategy=='existing':verify_dem(dem_path())
    else:raise ValueError('DEM_STRATEGY must be existing or download.')
    port=int(os.environ.get('PORT','8000'))
    if not 1<=port<=65535:raise ValueError('PORT must be 1–65535.')
    os.environ.setdefault('GDAL_CACHEMAX','64')
    import uvicorn
    uvicorn.run('main:app',host='0.0.0.0',port=port,workers=1,proxy_headers=False,limit_concurrency=32,backlog=64)

if __name__=='__main__':main()
