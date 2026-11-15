"""Read-only release inventory. Git metadata stays in ignored tmp/, never root .git."""
from pathlib import Path
import hashlib,json,re,subprocess
ROOT=Path(__file__).resolve().parents[1]
TMP=ROOT/'tmp';TMP.mkdir(exist_ok=True)
GIT=TMP/'release-audit.git'
if not GIT.exists():subprocess.run(['git','init','--bare',str(GIT)],check=True,capture_output=True)
def git(*args,input=None):
    return subprocess.run(['git',f'--git-dir={GIT}',f'--work-tree={ROOT}',*args],cwd=ROOT,input=input,text=True,capture_output=True,check=True).stdout
files=git('ls-files','--others','--exclude-standard').splitlines()
manifest=json.loads((ROOT/'docs/validation-step13/manifest.json').read_text())
bad_evidence=[name for name,digest in manifest['files'].items() if hashlib.sha256((ROOT/'docs/validation-step13'/name).read_bytes()).hexdigest()!=digest]
secret=re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[A-Z0-9]{16})\b')
personal=re.compile(r'[A-Za-z]:[\\/](?:Users[\\/][^\\/\s"\']+|111111111111)[\\/]')
secrets=[];paths=[];large=[]
for name in files:
    path=ROOT/name
    if path.stat().st_size>10*1024*1024:large.append({'file':name,'bytes':path.stat().st_size})
    if path.suffix.lower() not in ('.py','.ts','.tsx','.json','.md','.txt','.toml','.yaml','.yml','.html','.css','.sh','.ps1','.mjs','.example','.lock'):continue
    try:lines=path.read_text(encoding='utf-8').splitlines()
    except UnicodeError:continue
    for number,line in enumerate(lines,1):
        if secret.search(line) and name!='scripts/release_audit.py':secrets.append({'file':name,'line':number})
        if personal.search(line):paths.append({'file':name,'line':number})
checks=['backend/.venv/anything','frontend/node_modules/anything','.env','backend/.env','backend/.env.example','frontend/.env.example','data/lunar_dem/LDEM_80S_80MPP_ADJ.TIF','checkpoints/step16a-before.zip','tmp/report.pdf','frontend/dist/index.html','frontend/src/assets/hero.png','docs/validation-step13/manifest.json','docs/validation-step13/baseline.json']
ignored=subprocess.run(['git',f'--git-dir={GIT}',f'--work-tree={ROOT}','check-ignore','--no-index','--stdin','-z'],cwd=ROOT,input=('\0'.join(checks)+'\0').encode(),capture_output=True,check=True).stdout.decode().split('\0')
report={'git_initialized_at_root':(ROOT/'.git').exists(),'candidate_count':len(files),'candidates':files,'step13_files_checked':len(manifest['files']),'step13_mismatches':bad_evidence,'secret_pattern_matches':secrets,'absolute_personal_path_references':paths,'files_over_10MiB':large,'ignore_checks':{name:name in ignored for name in checks},'limitations':'Pattern scan is not exhaustive; historical absolute paths are reviewed, not automatically erased. No files staged.'}
(TMP/'step16a-release-audit.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items() if k not in ('candidates','absolute_personal_path_references')}|{'absolute_path_reference_count':len(paths)},indent=2))
expected_ignored=set(checks)-{'backend/.env.example','frontend/.env.example','docs/validation-step13/manifest.json','docs/validation-step13/baseline.json'}
if secrets or large or bad_evidence or any((name in ignored)!=(name in expected_ignored) for name in checks):raise SystemExit(1)
