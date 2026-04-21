import sys
import markdown2
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

def generate_pdf(subject, time, date, notes_text, output_path):
    doc = SimpleDocTemplate(output_path, pagesize=A4)
    styles = getSampleStyleSheet()
    
    # Custom Styles
    title_style = ParagraphStyle('TitleStyle', parent=styles['Heading1'], spaceAfter=12)
    meta_style = ParagraphStyle('MetaStyle', parent=styles['Normal'], spaceAfter=10, textColor="#555555")
    
    # Convert Markdown to HTML for ReportLab
    html_notes = markdown2.markdown(notes_text)
    
    story = [
        Paragraph(f"Class Notes: {subject}", title_style),
        Paragraph(f"Date: {date} | Time: {time} (IST)", meta_style),
        Spacer(1, 12),
        Paragraph(html_notes, styles['Normal'])
    ]
    
    doc.build(story)

if __name__ == "__main__":
    # Ensure all 5 arguments are passed from Node.js
    if len(sys.argv) >= 6:
        generate_pdf(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
    else:
        print("Error: Missing arguments")
        sys.exit(1)
