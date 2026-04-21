const { spawn } = require('child_process');
const path = require('path');

function generateNotesPDF({ subject, time, date, notesMarkdown, pdfPath }) {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python3', [
      path.join(__dirname, 'make_pdf.py'),
      subject,
      time,
      date,
      notesMarkdown,
      pdfPath
    ]);

    let errorOutput = "";
    pythonProcess.stderr.on('data', (data) => { errorOutput += data.toString(); });

    pythonProcess.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Python Error (Code ${code}): ${errorOutput.slice(0, 50)}`));
    });
  });
}

module.exports = { generateNotesPDF };
