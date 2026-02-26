import { marked } from 'marked'
import puppeteer from 'puppeteer'

const CSS_TEMPLATE = `
@page {
  size: A4;
  margin: 2.5cm 2cm;
  @bottom-center {
    content: counter(page);
    font-size: 10px;
    color: #666;
  }
}

* {
  box-sizing: border-box;
}

body {
  font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
  font-size: 11pt;
  line-height: 1.8;
  color: #1a1a1a;
  max-width: 100%;
  margin: 0;
  padding: 0;
}

/* Cover */
.cover {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100vh;
  text-align: center;
  page-break-after: always;
}

.cover h1 {
  font-size: 28pt;
  font-weight: 700;
  color: #1e3a5f;
  margin-bottom: 20px;
  line-height: 1.3;
}

.cover .date {
  font-size: 12pt;
  color: #666;
  margin-top: 10px;
}

.cover .divider {
  width: 60px;
  height: 3px;
  background: #1e3a5f;
  margin: 30px auto;
}

/* Headings */
h1 {
  font-size: 20pt;
  font-weight: 700;
  color: #1e3a5f;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  page-break-after: avoid;
}

h2 {
  font-size: 16pt;
  font-weight: 600;
  color: #2c5282;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  padding-bottom: 6px;
  border-bottom: 2px solid #e2e8f0;
  page-break-after: avoid;
}

h3 {
  font-size: 13pt;
  font-weight: 600;
  color: #2d3748;
  margin-top: 1.2em;
  margin-bottom: 0.4em;
}

/* Paragraphs */
p {
  margin: 0.6em 0;
  text-align: justify;
}

/* Blockquote */
blockquote {
  border-left: 4px solid #3182ce;
  padding-left: 16px;
  margin: 1em 0;
  color: #4a5568;
  font-style: italic;
}

/* Lists */
ul, ol {
  padding-left: 1.5em;
  margin: 0.5em 0;
}

li {
  margin-bottom: 0.3em;
}

/* Tables */
table {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
  font-size: 10pt;
}

th, td {
  border: 1px solid #e2e8f0;
  padding: 8px 12px;
  text-align: left;
}

th {
  background: #f7fafc;
  font-weight: 600;
  color: #2d3748;
}

tr:nth-child(even) {
  background: #fafafa;
}

/* Code */
code {
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 9pt;
  font-family: 'SF Mono', 'Fira Code', monospace;
}

pre {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 16px;
  overflow-x: auto;
  font-size: 9pt;
}

pre code {
  background: none;
  padding: 0;
}

/* Links */
a {
  color: #3182ce;
  text-decoration: none;
}

/* Strong */
strong {
  font-weight: 600;
  color: #1a202c;
}

/* HR */
hr {
  border: none;
  border-top: 1px solid #e2e8f0;
  margin: 2em 0;
}
`

function buildHtml(markdown: string, title: string): string {
  const bodyHtml = marked.parse(markdown, { async: false }) as string
  const now = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <style>${CSS_TEMPLATE}</style>
</head>
<body>
  <div class="cover">
    <h1>${escapeHtml(title)}</h1>
    <div class="divider"></div>
    <div class="date">${now}</div>
  </div>
  ${bodyHtml}
</body>
</html>`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function generatePDF(markdown: string, title: string): Promise<Buffer> {
  const html = buildHtml(markdown, title)

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '2.5cm', right: '2cm', bottom: '2.5cm', left: '2cm' },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `
        <div style="width: 100%; text-align: center; font-size: 9px; color: #999; padding: 0 2cm;">
          <span class="pageNumber"></span> / <span class="totalPages"></span>
        </div>
      `,
    })

    return Buffer.from(pdfBuffer)
  } finally {
    await browser.close()
  }
}
