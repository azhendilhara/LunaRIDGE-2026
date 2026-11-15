"""Printable geometry-only mission report. No NASA requests or new science model."""
from io import BytesIO
from datetime import datetime, timezone
import hashlib
import json
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.graphics.shapes import Drawing, Rect, Line, String
from app.services.mission_assessment import MissionEnvelope, assess, validate_envelope, ReportConsistencyError
from app.schemas.visibility import parse_utc_datetime

NAVY=colors.HexColor('#102737'); TEAL=colors.HexColor('#087f83'); PALE=colors.HexColor('#edf6f6')

def build_report(envelope: MissionEnvelope) -> bytes:
    req,result=validate_envelope(envelope)
    assessment=assess(envelope)
    if not assessment['exportable']:raise ReportConsistencyError(assessment['reason'])
    output=BytesIO(); styles=getSampleStyleSheet()
    styles.add(ParagraphStyle(name='ReportTitle',fontName='Helvetica-Bold',fontSize=23,leading=28,textColor=NAVY,spaceAfter=12))
    styles.add(ParagraphStyle(name='ReportSection',fontName='Helvetica-Bold',fontSize=13,leading=17,textColor=TEAL,spaceBefore=12,spaceAfter=8,keepWithNext=True))
    styles.add(ParagraphStyle(name='Copy',fontName='Helvetica',fontSize=9.3,leading=13,spaceAfter=7,textColor=NAVY))
    styles.add(ParagraphStyle(name='SmallCopy',parent=styles['Copy'],fontSize=8,leading=11))
    def p(text,style='Copy'):return Paragraph(escape(str(text)),styles[style])
    def table(rows,widths):
        data=[[p(cell,'SmallCopy') for cell in row] for row in rows]
        t=Table(data,colWidths=widths,repeatRows=1,hAlign='LEFT')
        t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),PALE),('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,0),0.8,TEAL),('LINEBELOW',(0,1),(-1,-1),0.35,colors.HexColor('#c8d9df')),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]))
        return t
    def timeline():
        d=Drawing(505,155); start=parse_utc_datetime(result.time_range.start_time); elapsed=result.time_range.elapsed_hours
        for name,summary,y,color in [('Earth',result.earth_comm,110,TEAL),('Sun',result.solar_power,58,colors.HexColor('#bc820c'))]:
            d.add(String(0,y+8,name,fontName='Helvetica-Bold',fontSize=10,fillColor=NAVY));x=55;w=438
            d.add(Rect(x,y,w,18,fillColor=colors.HexColor('#e1e6eb'),strokeColor=None))
            for win in summary.windows:
                left=(parse_utc_datetime(win.start_time)-start).total_seconds()/3600/elapsed*w
                width=win.duration_hours/elapsed*w
                d.add(Rect(x+max(0,left),y,max(0,min(width,w-left)),18,fillColor=color,strokeColor=None))
        for fraction in [0,.5,1]:
            x=55+438*fraction;d.add(Line(x,38,x,132,strokeColor=colors.HexColor('#748998'),strokeWidth=.4))
            hours=elapsed*fraction
            d.add(String(x,23,f'+{hours:.1f} h',fontSize=8,textAnchor='middle',fillColor=NAVY))
        d.add(String(55,6,'Timeline positions use the evaluated UTC interval; grey = center blocked.',fontSize=8,fillColor=NAVY))
        return d
    story=[p('LunaRIDGE | Mission planning report','ReportTitle'),p('Geometry-based planning analysis - not landing certification.'),p(f"{assessment['label']} | {assessment['profile']}",'ReportSection'),p(assessment['reason']),p('This assessment applies only to the editable geometric requirements below. It is not a probability of mission success, safety judgment, RF link prediction or electrical-energy estimate.')]
    site=result.site;t=result.time_range
    story += [p(f'Site: latitude {site.latitude:.5f} deg; east-positive longitude {site.longitude:.5f} deg. Ground {site.ground_elevation_m:.2f} m; mast {site.observer_height_m:g} m; total altitude {site.total_altitude_m:.2f} m.'),table([['UTC interval','Start','End'],['Requested',req.start_time,req.stop_time],['Evaluated',t.start_time,t.stop_time]],[74,215,216]),p(f'Evaluated duration: {t.elapsed_hours:.4f} h | {t.total_points} samples | step {req.step_size} | terrain search {req.horizon_max_distance_km:g} km | azimuth step {req.horizon_azimuth_step_deg:g} deg.'),p('Computed visibility','ReportSection')]
    metrics=[['Target-center geometry','Visible %','Visible h','Blocked h','Longest blocked h']]
    for name,s in [('Earth',result.earth_comm),('Sun',result.solar_power)]:metrics.append([name,f'{s.visibility_percentage:.2f}',f'{s.total_visible_hours:.4f}',f'{s.total_blocked_hours:.4f}',f'{s.longest_blackout_hours:.4f}'])
    story += [table(metrics,[145,65,85,85,125]),p('Configured requirements - PASS / FAIL','ReportSection')]
    rows=[['Requirement','Actual','Threshold','Result']]
    for r in assessment['requirements']:rows.append([r['title'],f"{r['actual']:.4f} {r['unit']}",f"{r['relation']} {r['threshold']:g} {r['unit']}",'PASS' if r['passed'] else 'FAIL'])
    story += [table(rows,[220,100,110,75]),p('Defaults are illustrative planning assumptions, not NASA recommendations. Minimum percentages and maximum blocked durations use inclusive comparisons. No composite score is used.','SmallCopy'),PageBreak()]
    story += [p('Visibility windows and timelines','ReportTitle'),p(f'Evaluated UTC: {t.start_time} to {t.stop_time}.'),timeline(),p('Earth visibility is a potential direct communication opportunity only. Sunlight availability is a potential solar charging opportunity only; neither an RF connection nor battery charging is calculated.')]
    for name,s in [('Earth',result.earth_comm),('Sun',result.solar_power)]:
        story.append(p(f'{name}: major target-center windows','ReportSection'))
        windows=sorted(sorted(s.windows,key=lambda w:w.duration_hours,reverse=True)[:6],key=lambda w:w.start_time)
        if not windows:story.append(p('No center-visible windows were calculated in the evaluated interval. This does not establish permanent shadow.'))
        else:
            rows=[['Window','Start UTC','End UTC','Hours']]+[[str(w.window_index),w.start_time,w.end_time,f'{w.duration_hours:.4f}'] for w in windows]
            story.append(table(rows,[45,185,185,90]))
        story.append(p(f'{s.window_count} windows total; at most six longest windows are listed, in chronological order. Whole disk visible {s.full_disk_visible_hours:.4f} h; partial limb {s.partial_limb_hours:.4f} h; whole disk blocked {s.fully_blocked_hours:.4f} h. Partial-limb time is not additional center-visible time.','SmallCopy'))
    story += [PageBreak(),p('Methods, assumptions and sources','ReportTitle'),p('Exact submitted settings','ReportSection')]
    settings_rows=[['Setting','Submitted value']]+[[key,str(value)] for key,value in req.model_dump().items()]
    story.append(table(settings_rows,[240,265]))
    story += [p('Assessment rule','ReportSection'),p('Favorable: all four requirements pass. Priority profiles: Conditional if both priority-target requirements pass but another requirement fails; Challenging if any priority-target requirement fails. Balanced: Conditional if exactly one target meets both requirements; Challenging if neither target does. Missing, stale or inconsistent data yield Insufficient Data and cannot be exported.'),p('Scientific limitations','ReportSection')]
    notes=[f'Terrain beyond {req.horizon_max_distance_km:g} km is unmodeled. Coverage checks apply to sampled terrain only; projection-space rays, 80 m radial sampling and containing-pixel elevations are approximations.', 'Linear crossing interpolation can miss short events between samples. Earth and Sun use target-center clearance against the terrain skyline. Fixed mean disk radii (Earth 0.95 deg; Sun 0.267 deg) and one-direction skyline are approximations, not disk-integrated illumination.', 'LOLA uses MOON_ME / DE421 surface coordinates; Horizons headers specify MEAN_ME and a 1737.4 km sphere, with DE441 dynamical ephemerides. No sub-meter terrain registration validation is claimed.', 'RF performance, electrical output, battery state, eclipse occultations, permanent shadow and landing safety are not calculated. Preset place names are illustrative, not certified landing locations.']
    if abs(site.latitude+87.87)<.01 and abs(((site.longitude+5.1+180)%360)-180)<.01:
        notes.append('Haworth sensitivity: the recorded Step 13 492-hour case produced 27.34% sunlight at 25 km, but 0% at 50 and 100 km. Earth visibility also varied. These are prior validation results, not new sensitivity calculations for this report.')
    for note in notes:story.append(p(note,'SmallCopy'))
    story += [p('NASA citations and reproducibility','ReportSection')]
    for text in ['NASA JPL Solar System Dynamics, Horizons: https://ssd.jpl.nasa.gov/horizons/ ; configuration and quantity 4: https://ssd.jpl.nasa.gov/horizons/manual.html', 'NASA LRO/LOLA, NASA GSFC Planetary Geodesy Data Archive: https://pgda.gsfc.nasa.gov/products/90 ; Barker et al. (2023), Planetary Science Journal 4, 183. Paper DOI: https://doi.org/10.3847/PSJ/acf3e1 ; data DOI: https://doi.org/10.60903/gsfcpgda-lola-spole', 'Terrain: LDEM_80S_80MPP_ADJ.TIF, 80 m cells, sphere radius 1737.4 km. Prototype SHA-256 pin (not a NASA signature): 82030dcbdd7c4bb0c7d858e9b4b293b9f2cda5a543ba31ec0f42784bd6beee5a']:
        story.append(p(text,'SmallCopy'))
    digest=hashlib.sha256(envelope.model_dump_json().encode()).hexdigest()
    story.append(p(f'Report generated UTC: {datetime.now(timezone.utc).isoformat()}. Submitted envelope SHA-256: {digest}. Consistency checks do not constitute a NASA authenticity signature.','SmallCopy'))
    def page(canvas,doc):
        canvas.saveState();canvas.setStrokeColor(TEAL);canvas.line(45,34,550,34);canvas.setFont('Helvetica',8);canvas.setFillColor(NAVY);canvas.drawString(45,22,'LunaRIDGE - geometry-based planning, not landing certification');canvas.drawRightString(550,22,f'Page {doc.page}');canvas.restoreState()
    doc=SimpleDocTemplate(output,pagesize=A4,leftMargin=45,rightMargin=45,topMargin=40,bottomMargin=48,title='LunaRIDGE geometry-based mission planning report',author='LunaRIDGE',pageCompression=1)
    doc.build(story,onFirstPage=page,onLaterPages=page)
    return output.getvalue()
