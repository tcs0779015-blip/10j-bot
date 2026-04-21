import sys
import markdown2
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.enums import TA_LEFT

def generate_pdf(subject, time, date, notes_text, output_path):
    try:
        # 1. Setup PDF Template
        doc = SimpleDocTemplate(output_path, pagesize=A4, rightMargin=50, leftMargin=50, topMargin=50, bottomMargin=50)
        styles = getSampleStyleSheet()
        
        # 2. Define Custom Styles
        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Heading1'],
            fontSize=18,
            spaceAfter=14,
            textColor="#1A5276"
        )
        
        body_style = ParagraphStyle(
            'BodyStyle',
            parent=styles['Normal'],
            fontSize=11,
            leading=14,
            alignment=TA_LEFT,
            spaceAfter=10
        )

        # 3. Convert Gemini's Markdown to simple HTML that ReportLab understands
        # We use 'extras' to handle things like tables or lists better
        html_content = markdown2.markdown(notes_text, extras=["break-on-newline"])
        
        # 4. Build the Document Story
        story = []
        
        # Header Section
        story.append(Paragraph(f"Class 10J Notes: {subject}", title_style))
        story.append(Paragraph(f"<b>Date:</b> {date} | <b>Time:</b> {time} (IST)", styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Body Section (The AI Notes)
        # We split by double newline to ensure Paragraph doesn't choke on massive strings
        for part in html_content.split('\n\n'):
            if part.strip():
                # ReportLab Paragraphs can parse basic HTML tags like <b>, <i>, <u>, and <br/>
                # markdown2 provides these automatically from Gemini's Markdown
                p = Paragraph(part.strip(), body_style)
                story.append(p)
        
        # 5. Generate the file
        doc.build(story)
        print(f"Successfully generated PDF: {output_path}")

    except Exception as e:
        print(f"Python PDF Error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    # Ensure all arguments are received from bot.js
    if len(sys.argv) >= 6:
        # sys.argv[0] is the script name
        # [1] subject, [2] time, [3] date, [4] notes_markdown, [5] output_path
        generate_pdf(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
    else:
        print("Missing arguments for PDF generation")
        sys.exit(1)
