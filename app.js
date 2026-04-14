
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

const INVALID_VALUES = new Set(['prohibido', 'no restringido', 'nan', '—', '', null, undefined])

const EMBALAJE_COLS = ['APCCL Emb', 'APC Emb', 'AC Emb']
let embalajesMap = null

async function loadEmbalajes() {
  if (embalajesMap) return embalajesMap
  const res = await fetch('embalajes_codigos.json')
  const arr = await res.json()
  embalajesMap = Object.fromEntries(arr.map(e => [String(e.instruccion), e]))
  return embalajesMap
}

let columnasEmbMap = null

async function loadColumnasEmbalaje() {
  if (columnasEmbMap) return columnasEmbMap
  const res = await fetch('columnas_embalaje.json')
  columnasEmbMap = await res.json()
  return columnasEmbMap
}

let embalajeTablaClaudeMap = null

async function loadEmbalajeTablaClaude() {
  if (embalajeTablaClaudeMap) return embalajeTablaClaudeMap
  const res = await fetch('embalajes_tabla_claude.json')
  const data = await res.json()
  embalajeTablaClaudeMap = Object.fromEntries(
    data.instrucciones_embalaje.map(e => [String(e.codigo), e])
  )
  return embalajeTablaClaudeMap
}

let codigosPIMap = null

async function loadCodigosPI() {
  if (codigosPIMap) return codigosPIMap
  const res = await fetch('codigos_tablas-PI.json')
  const data = await res.json()
  codigosPIMap = {}
  for (const items of Object.values(data.embalajes_ONU)) {
    for (const item of items) {
      codigosPIMap[item.codigo] = item.descripcion
    }
  }
  return codigosPIMap
}

let embalajeLineasMap = null

async function loadEmbalajeLineas() {
  if (embalajeLineasMap) return embalajeLineasMap
  const res = await fetch('embalajes_lineas.json')
  embalajeLineasMap = await res.json()
  return embalajeLineasMap
}

let instruccionesMap = null

async function loadInstrucciones() {
  if (instruccionesMap) return instruccionesMap
  const res = await fetch('instrucciones_embalaje.json')
  instruccionesMap = await res.json()
  return instruccionesMap
}



function renderInstrucciones(items, onuValue) {
  if (!items || items.length === 0) return ''

  const filtered = items.filter(item => {
    if (!item.un) return true
    const onuNum = parseInt(onuValue, 10)
    return item.un.some(u => parseInt(u, 10) === onuNum)
  })

  if (filtered.length === 0) return ''

  const lines = filtered.map(item => {
    const texto = Array.isArray(item.texto) ? item.texto.join('<br>') : item.texto
    return `<p class="small text-muted mb-1">${texto}</p>`
  })

  return `<div class="mt-2">${lines.join('')}</div>`
}

async function fetchSubcode(type, code) {
  const prefix = code.split('-')[0]
  const folder = type === 'estados'
    ? `sub_Vs/VE_subcodes_1_txt/${prefix}`
    : `sub_Vs/VO_subcodes_txt/${prefix}`
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

function groupHeaders(encabezados) {
  const groups = []
  for (const h of encabezados) {
    const base = h.replace(/_\d+$/, '')
    if (groups.length > 0 && groups[groups.length - 1].name === base) {
      groups[groups.length - 1].count++
    } else {
      groups.push({ name: base, count: 1 })
    }
  }
  return groups
}

function renderTablas(tablas, codigosPI, onuValue) {
  if (!tablas || tablas.length === 0) return ''

  const onuNum = parseInt(onuValue, 10)

  return tablas.map(tabla => {
    const specRow = tabla.filas.find(f => f.Tipo === 'Spec.')
    const descRow = tabla.filas.find(f => f.Tipo === 'Desc.')

    if (specRow) {
      // Tables with Spec row: show codes with descriptions
      const rawValues = tabla.encabezados
        .filter(h => h !== 'Tipo')
        .map(h => specRow[h])
        .filter(v => v && v !== '—')

      if (rawValues.length === 0) return ''

      const lines = []
      for (const val of rawValues) {
        const tokens = val.split(/\s+/)
        const isCode = tokens.every(t => /^\d/.test(t))
        if (isCode) {
          for (const c of tokens) {
            const desc = codigosPI[c]
            lines.push(desc ? `${c}: ${desc}` : c)
          }
        } else {
          lines.push(val)
        }
      }

      return `
        <div class="mt-2">
          <p class="fw-semibold small mb-1">${tabla.titulo}</p>
          <p class="small text-muted mb-0">${lines.join('<br>')}</p>
        </div>
      `
    }

    // All other tables: render as HTML table, filter by ONU if table has UN column
    const visibleCols = tabla.encabezados.filter(h => h !== 'Tipo')
    const unCol = tabla.encabezados.find(h => /n[uú]mero|UN|No\./i.test(h) && h !== 'Tipo')

    let filas = tabla.filas
    if (unCol && onuValue) {
      const filtered = tabla.filas.filter(fila => {
        const cellVal = String(fila[unCol] || '')
        const nums = cellVal.match(/\d{4}/g) || []
        return nums.some(n => parseInt(n, 10) === onuNum)
      })
      if (filtered.length > 0) filas = filtered
    }

    if (filas.length === 0) return ''

    const groups = groupHeaders(visibleCols)
    const headerRow = groups.map(g =>
      `<th colspan="${g.count}" class="text-center">${g.name}</th>`
    ).join('')
    const bodyRows = filas.map(fila => {
      const cells = visibleCols.map(h =>
        `<td>${fila[h] ?? '—'}</td>`
      ).join('')
      return `<tr>${cells}</tr>`
    }).join('')

    return `
      <div class="mt-2">
        <p class="fw-semibold small mb-1">${tabla.titulo}</p>
        <div class="table-responsive">
          <table class="table table-bordered table-sm small mb-0">
            <thead class="table-light"><tr>${headerRow}</tr></thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </div>
      </div>
    `
  }).join('')
}

async function showEmbalajes(row, container) {
  const [lookup, tablaClaude, codigosPI, lineas, instrucciones, columnasEmb] = await Promise.all([loadEmbalajes(), loadEmbalajeTablaClaude(), loadCodigosPI(), loadEmbalajeLineas(), loadInstrucciones(), loadColumnasEmbalaje()])
  const headers = [...container.querySelectorAll('thead th')].map(th => th.textContent.trim())
  const cells = [...row.querySelectorAll('td')]
  const onuValue = document.getElementById('numInput').value

  // Get class images from the Clase column
  const claseIdx = headers.indexOf('Clase')
  const claseRaw = claseIdx >= 0 ? cells[claseIdx]?.textContent.trim() : ''
  const claseImgFiles = parseClaseImages(claseRaw)
  const etiquetaImgs = claseImgFiles.map(file =>
    `<img src="Etiquetas/${file}" alt="${file}" title="${file}" style="height:140px;margin-right:8px;">`
  ).join('')

  const codeEntries = []
  for (const label of EMBALAJE_COLS) {
    const idx = headers.indexOf(label)
    const code = idx >= 0 ? cells[idx]?.textContent.trim() : null
    if (code && code !== '—') {
      codeEntries.push({ code, origin: label })
    }
  }

  const detail = document.getElementById('embalaje-detail')
  const results = codeEntries.map(e => {
    const data = lookup[e.code]
    return data ? { ...data, origin: e.origin } : null
  }).filter(Boolean)

  if (results.length === 0) {
    detail.innerHTML = '<p class="text-center text-muted mt-3">No embalaje data found for this row.</p>'
    return
  }

  detail.innerHTML = results.map(r => {
    const tcEntry = tablaClaude[String(r.instruccion)]
    const lineaText = lineas[String(r.instruccion)]
    const lineaHtml = lineaText && lineaText !== '-'
      ? `<p class="fw-bold mt-3 mb-2" style="font-size:1.1rem">${lineaText}</p>`
      : ''
    const instrHtml = renderInstrucciones(instrucciones[String(r.instruccion)], onuValue)
    const tablasHtml = tcEntry ? renderTablas(tcEntry.tablas, codigosPI, onuValue) : ''

    return `
    <div class="card mt-3 p-3">
      <h6 class="mb-3">Instrucción <strong>${r.instruccion}</strong></h6>
      <div class="row">
        <div class="col-md-6">
          <p class="fw-semibold mb-1">Variaciones Estados</p>
          <p class="text-muted">${r.variaciones_estados.join(', ')}</p>
        </div>
        <div class="col-md-6">
          <p class="fw-semibold mb-1">Variaciones Operadores</p>
          <p class="text-muted">${r.variaciones_operadores.join(', ')}</p>
        </div>
      </div>
      <div class="mt-2">
        <button class="btn btn-sm btn-outline-secondary" data-instruccion="${r.instruccion}">
          Buscar archivos
        </button>
        <div class="subcode-results"></div>
      </div>
      <h5 class="fw-bold mt-3 mb-2" style="text-transform:uppercase;">${columnasEmb[r.origin] || r.origin}</h5>
      <div class="mb-2 d-flex align-items-center flex-wrap">${etiquetaImgs}${r.origin === 'APCCL Emb' ? '<img src="Etiquetas/Y.png" alt="Carga Limitada" style="height:140px;margin-right:8px;">' : ''}${r.origin === 'AC Emb' ? '<img src="Etiquetas/cargounicamente.png" alt="Cargo Aircraft Only" style="height:140px;margin-right:8px;">' : ''}</div>
      ${lineaHtml}
      ${instrHtml}
      ${tablasHtml}
    </div>
  `}).join('')

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

function parseClaseImages(claseRaw) {
  if (!claseRaw || claseRaw === 'nan') return []
  // Extract all class numbers: "2.3 (2.1, 8)" -> ["2.3", "2.1", "8"]
  const nums = claseRaw.match(/\d+(\.\d+)?[A-Z]*/g) || []
  // Map to image filenames, strip letter suffixes for image lookup
  const imgs = []
  const seen = new Set()
  for (const n of nums) {
    const base = n.replace(/[A-Z]+$/, '')
    if (seen.has(base)) continue
    seen.add(base)
    // For class 1.x, use the division number (1.1, 1.2, etc.)
    // For class 7, use 7.1.png
    let file
    if (base.startsWith('1.')) {
      const div = base.substring(0, 3)
      file = div + '.png'
    } else {
      file = base + '.png'
    }
    imgs.push(file)
  }
  return imgs
}

function renderCell(col, val) {
  if (val === null || val === undefined || val === '') return '—'

  const folder = PDF_PATHS[col]
  if (folder && !isInvalid(val)) {
    const parts = String(val).split('\n').map(v => v.trim()).filter(Boolean)
    return parts.map(v =>
      isInvalid(v) ? v : `<a href="${folder}/${encodeURIComponent(v)}.pdf" target="_blank">${v}</a>`
    ).join(' ')
  }

  return val
}

function renderTable(rows) {
  const container = document.getElementById('results')

  if (!rows || rows.length === 0) {
    container.innerHTML = '<p class="text-center text-muted">No results found.</p>'
    document.getElementById('embalaje-detail').innerHTML = ''
    return
  }

  document.getElementById('embalaje-detail').innerHTML = ''
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
  const raw = document.getElementById('numInput').value

  if (!raw) {
    alert('Please enter a number first.')
    return
  }

  const value = String(parseInt(raw, 10))
  fetchRows(value)
})

