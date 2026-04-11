
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
  'APCCL-embalaje': 'PDF/PI',
  'APC-embalaje': 'PDF/PI',
  'AC-embalaje': 'PDF/PI',
  'EQ': 'PDF/E',           // change folder later if needed
  'Disp-espec': 'PDF/DE',
}

const INVALID_VALUES = new Set(['prohibido', 'nan', '—', '', null, undefined])

const EMBALAJE_COLS = ['APCCL Emb', 'APC Emb', 'AC Emb']
let embalajesMap = null

async function loadEmbalajes() {
  if (embalajesMap) return embalajesMap
  const res = await fetch('embalajes_codigos.json')
  const arr = await res.json()
  embalajesMap = Object.fromEntries(arr.map(e => [String(e.instruccion), e]))
  return embalajesMap
}

async function fetchSubcode(type, code) {
  const prefix = code.split('-')[0]
  const folder = type === 'estados'
    ? `sub_vs/VE_subcodes_1_txt/${prefix}`
    : `sub_vs/VO_subcodes_txt/${prefix}`
  const res = await fetch(`${folder}/${code}.txt`)
  if (!res.ok) return { code, text: null }
  return { code, text: await res.text() }
}

async function buscarArchivos(instruccion, resultDiv) {
  const lookup = await loadEmbalajes()
  const entry = lookup[instruccion]
  if (!entry) return

  resultDiv.innerHTML = '<p class="text-muted small mt-2">Cargando...</p>'

  const [estadosResults, operadoresResults] = await Promise.all([
    Promise.all(entry.variaciones_estados.map(c => fetchSubcode('estados', c))),
    Promise.all(entry.variaciones_operadores.map(c => fetchSubcode('operadores', c)))
  ])

  const renderGroup = (results, title) => {
    if (results.length === 0) return ''
    return `
      <p class="fw-semibold mt-3 mb-1">${title}</p>
      ${results.map(r => r.text !== null ? `
        <div class="border rounded p-2 mb-2">
          <p class="fw-semibold small mb-1">${r.code}</p>
          <pre class="small text-muted mb-0" style="white-space:pre-wrap">${r.text.trim()}</pre>
        </div>
      ` : `
        <div class="border rounded p-2 mb-2 border-warning">
          <p class="small mb-0 text-warning">⚠️ No se encontró archivo para <strong>${r.code}</strong></p>
        </div>
      `).join('')}
    `
  }

  resultDiv.innerHTML = renderGroup(estadosResults, 'Variaciones Estados') +
                        renderGroup(operadoresResults, 'Variaciones Operadores')
}

async function showEmbalajes(row, container) {
  const lookup = await loadEmbalajes()
  const headers = [...container.querySelectorAll('thead th')].map(th => th.textContent.trim())
  const cells = [...row.querySelectorAll('td')]

  const codes = [...new Set(
    EMBALAJE_COLS
      .map(label => {
        const idx = headers.indexOf(label)
        return idx >= 0 ? cells[idx]?.textContent.trim() : null
      })
      .filter(v => v && v !== '—')
  )]

  const detail = document.getElementById('embalaje-detail')
  const results = codes.map(code => lookup[code]).filter(Boolean)

  if (results.length === 0) {
    detail.innerHTML = '<p class="text-center text-muted mt-3">No embalaje data found for this row.</p>'
    return
  }

  detail.innerHTML = results.map(r => `
    <div class="card mt-3 p-3">
      <h6 class="mb-3">Instrucción <strong>${r.instruccion}</strong></h6>
      <div class="row">
        <div class="col-md-6">
          <p class="fw-semibold mb-1">Variaciones Operadores</p>
          <p class="text-muted">${r.variaciones_operadores.join(', ')}</p>
        </div>
        <div class="col-md-6">
          <p class="fw-semibold mb-1">Variaciones Estados</p>
          <p class="text-muted">${r.variaciones_estados.join(', ')}</p>
        </div>
      </div>
      <div class="mt-2">
        <button class="btn btn-sm btn-outline-secondary" data-instruccion="${r.instruccion}">
          Buscar archivos
        </button>
        <div class="subcode-results"></div>
      </div>
    </div>
  `).join('')

  detail.querySelectorAll('button[data-instruccion]').forEach(btn => {
    const resultDiv = btn.nextElementSibling
    btn.addEventListener('click', () => {
      if (resultDiv.innerHTML && !resultDiv.innerHTML.includes('Cargando')) {
        resultDiv.innerHTML = ''
        return
      }
      buscarArchivos(btn.dataset.instruccion, resultDiv)
    })
  })
}

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

  const columns = Object.keys(rows[0]).slice(1)

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

  container.querySelector('tbody').addEventListener('click', e => {
    const row = e.target.closest('tr')
    if (!row) return
    const prev = container.querySelector('tr.selected')
    if (prev) prev.classList.remove('selected')
    if (prev !== row) {
      row.classList.add('selected')
      showEmbalajes(row, container)
    } else {
      document.getElementById('embalaje-detail').innerHTML = ''
    }
  })
}

let tablaOnu = null

async function loadTablaOnu() {
  if (tablaOnu) return tablaOnu
  const res = await fetch('tabla_onu.json')
  tablaOnu = await res.json()
  return tablaOnu
}

async function fetchRows(value) {
  const data = await loadTablaOnu()
  const rows = data.filter(row => String(row.onu) === String(value))
  renderTable(rows)
}

document.getElementById('numInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('searchBtn').click()
})

document.getElementById('searchBtn').addEventListener('click', () => {
  const value = document.getElementById('numInput').value

  if (!value) {
    alert('Please enter a number first.')
    return
  }

  fetchRows(value)
})