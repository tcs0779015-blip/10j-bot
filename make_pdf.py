import sys
import markdown2
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

def generate_pdf(subject, time, date, notes_text, output_path):
    try:
        doc = SimpleDocTemplate(output_path, pagesize=A4)
        styles = getSampleStyleSheet()
        
        # Custom Style for notes
        title_style = styles['Heading1']
        body_style = styles['Normal']
        
        # Convert markdown to simple HTML for ReportLab
        html_notes = markdown2.markdown(notes_text)
        
        content = [
            Paragraph(f"<b>Subject:</b> {subject}", title_style),
            Paragraph(f"<b>Date:</b> {date} | <b>Time:</b> {time} (IST)", body_style),
            Spacer(1, 12),
            Paragraph(html_notes, body_style)
        ]
        
        doc.build(content)
    except Exception as e:
        print(f"Python PDF Error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    # Expecting 5 args: script_name, subject, time, date, notes, output_path
    if len(sys.argv) >= 6:
        generate_pdf(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
