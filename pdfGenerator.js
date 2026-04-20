const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function generateNotesPDF({ subject, time, date, notesMarkdown, pdfPath }) {
  // Write markdown to temp file
  const tmpMd = pdfPath.replace('.pdf', '_content.txt');
  fs.writeFileSync(tmpMd, notesMarkdown, 'utf8');

  const scriptPath = path.join(__dirname, 'make_pdf.py');

  // Call Python script
  execSync(`python3 "${scriptPath}" "${subject}" "${time}" "${date}" "${tmpMd}" "${pdfPath}"`, {
    timeout: 30000,
  });

  fs.unlinkSync(tmpMd);
}

module.exports = { generateNotesPDF };
