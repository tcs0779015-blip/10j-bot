const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

async function generateNotesPDF({ subject, time, date, notesMarkdown, pdfPath }) {
  const tmpMd = pdfPath.replace('.pdf', '_content.txt');
  fs.writeFileSync(tmpMd, notesMarkdown, 'utf8');
  
  const scriptPath = path.join(__dirname, 'make_pdf.py');
  
  // Use 'python3' specifically
  execSync(`python3 "${scriptPath}" "${subject}" "${time}" "${date}" "${tmpMd}" "${pdfPath}"`, {
    timeout: 30000,
  });

  if (fs.existsSync(tmpMd)) fs.unlinkSync(tmpMd);
}

module.exports = { generateNotesPDF };
