"""Download and verify the pinned NASA LOLA DEM; see docs/DATA_SOURCES.md."""
import argparse
import hashlib
from pathlib import Path
import os
import tempfile
import math
from app.deployment import dem_path
import requests
import rasterio

URL = 'https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF'
DEST_PATH = dem_path()
EXPECTED_SIZE = 189158392
# Fingerprint of the preserved prototype dataset, not a publisher-signed checksum.
EXPECTED_SHA256 = '82030dcbdd7c4bb0c7d858e9b4b293b9f2cda5a543ba31ec0f42784bd6beee5a'

def verify_dem(path=None):
    path = Path(path or DEST_PATH)
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    if digest.hexdigest() != EXPECTED_SHA256:
        raise ValueError('DEM SHA-256 mismatch. Do not accept or overwrite the pinned baseline without review.')
    if path.stat().st_size != EXPECTED_SIZE:
        raise ValueError('DEM byte count mismatch.')
    with rasterio.open(path) as ds:
        if ds.shape != (7600, 7600) or ds.count != 1 or ds.res != (80.0, 80.0):
            raise ValueError('DEM shape, band count, or resolution mismatch.')
        if ds.crs is None or ds.bounds != (-304000, -304000, 304000, 304000):
            raise ValueError('DEM CRS or bounds mismatch.')
        crs=ds.crs.to_dict()
        if ds.driver!='GTiff' or ds.dtypes!=('float32',) or ds.nodata is None or not math.isnan(ds.nodata) or crs.get('proj')!='stere' or crs.get('lat_0')!=-90 or crs.get('lat_ts')!=-90 or crs.get('R')!=1737400 or crs.get('units')!='m':
            raise ValueError('DEM dtype, NoData, or lunar polar projection mismatch.')
        ds.read(1, window=rasterio.windows.Window(3799, 3799, 2, 2))
    return digest.hexdigest()

def download_dem(path=None):
    destination=Path(path or DEST_PATH)
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        verify_dem(destination)
        print('Existing DEM verified by SHA-256 and raster metadata.')
        return
    with tempfile.NamedTemporaryFile(dir=destination.parent,prefix=destination.name+'.',suffix='.part',delete=False) as stream:partial=Path(stream.name)
    try:
        with requests.get(URL, stream=True, timeout=60) as response:
            response.raise_for_status();size=0
            with partial.open('wb') as output:
                for chunk in response.iter_content(chunk_size=1024 * 1024):
                    size+=len(chunk)
                    if size>EXPECTED_SIZE:raise ValueError('DEM download exceeds pinned byte size.')
                    output.write(chunk)
        verify_dem(partial)
        os.replace(partial, destination)
    finally:
        partial.unlink(missing_ok=True)
    print(f'Verified NASA LOLA DEM saved to {destination.name}')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify-only', action='store_true')
    args = parser.parse_args()
    if args.verify_only:
        print(verify_dem())
    else:
        download_dem()
