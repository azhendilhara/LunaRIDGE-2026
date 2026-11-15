import hashlib,json,importlib.util
from pathlib import Path
import pytest
from app.schemas.visibility import AnalysisRequest,AnalysisResponse
from app.services.mission_assessment import MissionEnvelope,AssessmentSettings,assess
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'frontend/public/examples'
CATALOG=json.loads((OUT/'catalog.json').read_text())
@pytest.mark.parametrize('example',CATALOG['items'],ids=lambda item:item['id'])
def test_examples_bind_exact_evidence_without_altering_science(example):
    source=ROOT/example['source']['path'];raw=source.read_bytes()
    assert hashlib.sha256(raw).hexdigest()==example['source']['sha256']
    manifest=json.loads((ROOT/'docs/validation-step13/manifest.json').read_text())
    assert example['source']['dem_sha256']==manifest['dem_sha256']
    payload=(OUT/(example['id']+'.json')).read_bytes()
    assert hashlib.sha256(payload).hexdigest()==example['source']['response_sha256']
    original=AnalysisResponse.model_validate_json(raw);result=AnalysisResponse.model_validate_json(payload)
    assert result.model_dump(exclude={'submitted_scenario'})==original.model_dump(exclude={'submitted_scenario'})
    req=AnalysisRequest(**example['scenario'])
    assert result.submitted_scenario==req
    actual=assess(MissionEnvelope(scenario=req,draft_scenario=req,result=result,settings=AssessmentSettings(**example['settings'])))
    assert actual==example['assessment'] and actual['exportable']
    assert 'not a certified landing site' in example['source']['validation_scope']

def test_catalog_rebuild_is_offline_deterministic_and_preserves_archive(tmp_path,monkeypatch):
    import requests
    monkeypatch.setattr(requests,'get',lambda *a,**k:pytest.fail('Catalog generation must not request NASA or new datasets'))
    spec=importlib.util.spec_from_file_location('example_builder',ROOT/'scripts/build_example_catalog.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    monkeypatch.setattr(module,'OUT',tmp_path)
    before={p:hashlib.sha256(p.read_bytes()).hexdigest() for p in (ROOT/'docs/validation-step13').glob('*') if p.is_file()}
    assert module.build()==CATALOG
    for p in OUT.glob('*.json'):assert (tmp_path/p.name).read_bytes()==p.read_bytes()
    assert all(hashlib.sha256(p.read_bytes()).hexdigest()==digest for p,digest in before.items())

def test_checksum_bound_public_examples_disable_git_line_ending_conversion():
    import shutil,subprocess
    if not shutil.which('git'):pytest.skip('Git attribute check requires Git')
    paths=[p.relative_to(ROOT).as_posix() for p in OUT.glob('*.json')]
    result=subprocess.run(['git','check-attr','text','--',*paths],cwd=ROOT,capture_output=True,text=True,check=True)
    assert len(result.stdout.splitlines())==4
    assert all(line.endswith(': text: unset') for line in result.stdout.splitlines())
