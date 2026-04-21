#!/usr/bin/env python3
import sys
import re
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER

SUBJECT_COLORS = {
    'SST':          colors.HexColor('#E74C3C'),
    'Math':         colors.HexColor('#3498DB'),
    'IT':           colors.HexColor('#2ECC71'),
    'Biology':      colors.HexColor('#27AE60'),
    'Chemistry':    colors.HexColor('#9B59B6'),
    'Physics':      colors.HexColor('#F39C12'),
    'English':      colors.HexColor('#1ABC9C'),
    'Islamic/M.Sc': colors.HexColor('#E67E22'),
    '2nd Language': colors.HexColor('#EC407A'),
    'Reading':      colors.HexColor('#00BCD4'),
    'HPE':          colors.HexColor('#FF5722'),
}

def get_color(subject):
    for key, val in SUBJECT_COLORS.items():
        if key.lower() in subject.lower():
            return val
    return colors.HexColor('#5865F2')

def parse_markdown(md_text, styles, accent_color):
    flowables = []
    lines = md_text.split('\n')

    bullet_style = ParagraphStyle('Bullet', parent=styles['Normal'], fontSize=10.5, leading=16, leftIndent=20, spaceAfter=3, fontName='Helvetica')
    sub_bullet_style = ParagraphStyle('SubBullet', parent=styles['Normal'], fontSize=10, leading=15, leftIndent=40, spaceAfter=2, fontName='Helvetica')
    body_style = ParagraphStyle('Body', parent=styles['Normal'], fontSize=10.5, leading=16, spaceAfter=4, fontName='Helvetica')
    h1_style = ParagraphStyle('H1', parent=styles['Heading1'], fontSize=14, leading=20, spaceBefore=14, spaceAfter=4, textColor=accent_color, fontName='Helvetica-Bold')
    h2_style = ParagraphStyle('H2', parent=styles['Heading2'], fontSize=12, leading=18, spaceBefore=10, spaceAfter=3, textColor=accent_color, fontName='Helvetica-Bold')
    h3_style = ParagraphStyle('H3', parent=styles['Heading3'], fontSize=11, leading=16, spaceBefore=8, spaceAfter=2, fontName='Helvetica-Bold')

    def clean(text):
        text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
        text = re.sub(r'\*(.+?)\*', r'<i>\1</i>', text)
        text = re.sub(r'`(.+?)`', r'<font name="Courier">\1</font>', text)
        return text

    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        if not line.strip():
            flowables.append(Spacer(1, 6))
            i += 1
            continue
        if line.startswith('# '):
            flowables.append(Paragraph(clean(line[2:]), h1_style))
            flowables.append(HRFlowable(width='100%', thickness=1, color=accent_color, spaceAfter=4))
        elif line.startswith('## '):
            flowables.append(Paragraph(clean(line[3:]), h2_style))
        elif line.startswith('### '):
            flowables.append(Paragraph(clean(line[4:]), h3_style))
        elif line.startswith('    - ') or line.startswith('  - '):
            text = line.lstrip(' ').lstrip('-').strip()
            flowables.append(Paragraph(f'&#9702;  {clean(text)}', sub_bullet_style))
        elif line.startswith('- ') or line.startswith('* '):
            flowables.append(Paragraph(f'&#8226;  {clean(line[2:].strip())}', bullet_style))
        elif re.match(r'^\d+\.\s+', line):
            m = re.match(r'^(\d+)\.\s+(.*)', line)
            flowables.append(Paragraph(f'<b>{m.group(1)}.</b>  {clean(m.group(2))}', bullet_style))
        elif line.strip() in ('---', '***', '___'):
            flowables.append(HRFlowable(width='100%', thickness=0.5, color=colors.lightgrey, spaceBefore=6, spaceAfter=6))
        else:
            flowables.append(Paragraph(clean(line), body_style))
        i += 1

    return flowables

def make_pdf(subject, time_str, date_str, content_file, output_path):
    with open(content_file, 'r', encoding='utf-8') as f:
        notes_md = f.read()

    accent = get_color(subject)
    doc = SimpleDocTemplate(output_path, pagesize=A4, leftMargin=2*cm, rightMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    story = []

    header_style = ParagraphStyle('Header', fontSize=22, leading=28, textColor=colors.white, fontName='Helvetica-Bold', alignment=TA_LEFT)
    sub_header_style = ParagraphStyle('SubHeader', fontSize=10, leading=14, textColor=colors.HexColor('#EEEEEE'), fontName='Helvetica', alignment=TA_LEFT)

    header_table = Table(
        [[Paragraph(subject.upper(), header_style), Paragraph(f'{time_str}<br/>{date_str}<br/>Class 10J • New Indian Model School', sub_header_style)]],
        colWidths=['50%', '50%'],
    )
    header_table.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,-1), accent),
        ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING',   (0,0), (-1,-1), 16),
        ('RIGHTPADDING',  (0,0), (-1,-1), 16),
        ('TOPPADDING',    (0,0), (-1,-1), 14),
        ('BOTTOMPADDING', (0,0), (-1,-1), 14),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 18))
    story.extend(parse_markdown(notes_md, styles, accent))
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width='100%', thickness=0.5, color=colors.lightgrey))
    story.append(Spacer(1, 6))
    story.append(Paragraph('Generated by Class 10J Bot • Transcribed by AssemblyAI • Notes by Gemini AI', ParagraphStyle('Footer', fontSize=8, textColor=colors.grey, fontName='Helvetica', alignment=TA_CENTER)))

    doc.build(story)
    print(f'PDF generated: {output_path}')

if __name__ == '__main__':
    make_pdf(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
