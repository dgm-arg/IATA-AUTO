import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://scakbheehumidaqkssxp.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjYWtiaGVlaHVtaWRhcWtzc3hwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NTY3MzEsImV4cCI6MjA4OTEzMjczMX0.URekPbhlh21jWwclgszTOn0DLeJE2Km0jSajuLIgfi0'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const HEADER_LABELS = {
  'rev-sym': 'Rev-Sym',
  'iata-req': 'IATA-Req',
  'onu': 'ONU',
  'Nombre apropiado de envío/Descripción': 'Nombre',
  'Clase o Div. (Peligros sec.)': 'Clase',
  'Etiqueta(s) de peligro': 'Etiqueta',
  'Grp. De emb.': 'Grp Emb',
  'EQ': 'EQ',
  'APCCL-embalaje': 'APCCL Emb',
  'APCCL-neta-máx-bulto': 'APCCL Neta',
  'APC-embalaje': 'APC Emb',
  'APC-neta-máx-bulto': 'APC Neta',
  'AC-embalaje': 'AC Emb',
  'AC-neta-máx-bulto': 'AC Neta',
  'Disp-espec': 'Disp Espec',
  'CRE': 'CRE',
  'ingles': 'Inglés'
}

// Set the folder path for each column that should have PDF links
const PDF_PATHS = {
  'APCCL-embalaje': 'pdfs',
  'APC-embalaje': 'pdfs',
  'AC-embalaje': 'pdfs',
  'EQ': 'pdfs',           // change folder later if needed
  'Disp-espec': 'DE',
}

const INVALID_VALUES = new Set(['prohibido', 'nan', '—', '', null, undefined])

function isInvalid(val) {
  if (val === null || val === undefined) return true
  return INVALID_VALUES.has(String(val).toLowerCase().trim())
}

function renderCell(col, val) {
  if (val === null || val === undefined) return '—'

  const folder = PDF_PATHS[col]
  if (folder && !isInvalid(val)) {
    return `<a href="${folder}/${encodeURIComponent(val)}.pdf" target="_blank">${val}</a>`
  }

  return val
}

function renderTable(rows) {
  const container = document.getElementById('results')

  if (!rows || rows.length === 0) {
    container.innerHTML = '<p class="text-center text-muted">No results found.</p>'
    return
  }

  const columns = Object.keys(rows[0]).slice(2)

  const headers = columns.map(col => {
    const label = HEADER_LABELS[col] || col
    return `<th class="text-nowrap">${label}</th>`
  }).join('')

  const bodyRows = rows.map(row => {
    const cells = columns.map(col => {
      const val = row[col] ?? null
      return `<td>${renderCell(col, val)}</td>`
    }).join('')
    return `<tr>${cells}</tr>`
  }).join('')

  container.innerHTML = `
    <div class="table-responsive">
      <table class="table table-bordered table-striped table-hover align-middle">
        <thead class="table-dark">
          <tr>${headers}</tr>
        </thead>
        <tbody>
          ${bodyRows}
        </tbody>
      </table>
    </div>
  `
}

async function fetchRows(value) {
  const { data, error } = await supabase
    .from('onu2')
    .select('*')
    .eq('onu', String(value))

  if (error) {
    console.error('Error fetching data:', error.message)
    document.getElementById('results').innerHTML = `<p class="text-center text-danger">Error: ${error.message}</p>`
    return
  }

  renderTable(data)
}

document.getElementById('searchBtn').addEventListener('click', () => {
  const value = document.getElementById('numInput').value

  if (!value) {
    alert('Please enter a number first.')
    return
  }

  fetchRows(value)
})