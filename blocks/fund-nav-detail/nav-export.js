import { loadScript } from '../../scripts/aem.js';

const libPath = (file) => `${window.hlx?.codeBasePath || ''}/scripts/thirdparty/${file}`;

async function loadJsPdf() {
  if (!window.jspdf) await loadScript(libPath('jspdf.umd.min.js'));
  if (!window.jspdf.jsPDF.API.autoTable) await loadScript(libPath('jspdf.plugin.autotable.min.js'));
  return window.jspdf.jsPDF;
}

async function loadSheetJs() {
  if (!window.XLSX) await loadScript(libPath('xlsx.mini.min.js'));
  return window.XLSX;
}

/**
 * @typedef {object} NavExport
 * @property {string} fileName  File name without extension
 * @property {string} title     Fund name
 * @property {string} code      Fund code
 * @property {string} rangeText e.g. "03.01.2026 - 17.08.2026"
 * @property {string[]} columns Table headers
 * @property {Array<[string, number]>} rows [date, nav]
 * @property {string} [disclaimer]
 * @property {string} [chartImage] PNG data URL of the chart
 */

/**
 * Builds and downloads a PDF with the fund details, chart and NAV table.
 * @param {NavExport} data
 */
export async function downloadPdf({
  fileName, title, code, rangeText, columns, rows, disclaimer, chartImage, chartRatio,
}) {
  const JsPDF = await loadJsPdf();
  const doc = new JsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  let y = 52;

  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(24, 29, 39);
  doc.text(title, margin, y);
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(83, 88, 98);
  doc.text(code, margin, y + 18);
  doc.text(rangeText, margin, y + 34);
  y += 52;

  if (chartImage) {
    const height = width * (chartRatio || 0.33);
    doc.addImage(chartImage, 'PNG', margin, y, width, height);
    y += height + 16;
  }

  doc.autoTable({
    startY: y,
    head: [columns],
    body: rows.map(([date, nav]) => [date, nav.toFixed(4)]),
    margin: { left: margin, right: margin },
    styles: { font: 'helvetica', fontSize: 9, textColor: [83, 88, 98] },
    headStyles: { fillColor: [233, 237, 242], textColor: [24, 29, 39], fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' } },
  });

  if (disclaimer) {
    let noteY = doc.lastAutoTable.finalY + 20;
    if (noteY > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      noteY = margin;
    }
    doc.setFontSize(8).setTextColor(83, 88, 98);
    doc.text(doc.splitTextToSize(disclaimer, width), margin, noteY);
  }

  doc.save(`${fileName}.pdf`);
}

/**
 * Builds and downloads an Excel (.xlsx) workbook with the NAV table.
 * @param {NavExport} data
 */
export async function downloadExcel({
  fileName, title, code, rangeText, columns, rows, disclaimer,
}) {
  const XLSX = await loadSheetJs();
  const header = [[title], [code], [rangeText], []];
  const sheet = XLSX.utils.aoa_to_sheet([...header, columns, ...rows]);
  rows.forEach((row, i) => {
    const cell = sheet[XLSX.utils.encode_cell({ r: header.length + 1 + i, c: 1 })];
    if (cell) cell.z = '0.0000';
  });
  if (disclaimer) XLSX.utils.sheet_add_aoa(sheet, [[], [disclaimer]], { origin: -1 });
  sheet['!cols'] = [{ wch: 16 }, { wch: 14 }];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'NAV');
  XLSX.writeFile(book, `${fileName}.xlsx`);
}
