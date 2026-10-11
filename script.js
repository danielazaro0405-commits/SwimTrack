
"use strict";

/* =========================================
   SWIMTRACK — JAVASCRIPT COMPLETO
   Guarda los datos en este navegador.
========================================= */

const STORAGE_KEY = "swimtrack-marks-v1";

const $ = (id) => document.getElementById(id);

const el = {
  markForm: $("markForm"),
  eventSelect: $("eventSelect"),
  timeInput: $("timeInput"),
  poolSelect: $("poolSelect"),
  kindSelect: $("kindSelect"),
  dateInput: $("dateInput"),
  markStatus: $("markStatus"),

  totalMarks: $("totalMarks"),
  totalEvents: $("totalEvents"),
  totalRecords: $("totalRecords"),

  filterEvent: $("filterEvent"),
  marksList: $("marksList"),

  chartEvent: $("chartEvent"),
  chartArea: $("chartArea"),

  aiForm: $("aiForm"),
  aiInput: $("aiInput"),
  aiMessages: $("aiMessages"),
  aiSend: $("aiSend"),
  aiStatus: $("aiStatus")
};

let marks = loadMarks();

/* ---------- FECHA INICIAL ---------- */

if (el.dateInput && !el.dateInput.value) {
  el.dateInput.value = new Date().toISOString().slice(0, 10);
}

/* ---------- TIEMPOS ---------- */

// Acepta 32.85, 1:12.40 o 1:02:03.25.
function parseTime(value) {
  if (typeof value !== "string") return NaN;

  const text = value.trim().replace(",", ".");
  if (!text) return NaN;

  if (/^\d+(\.\d+)?$/.test(text)) {
    return Number(text);
  }

  const parts = text.split(":");

  if (
    parts.length < 2 ||
    parts.length > 3 ||
    parts.some(part => part.trim() === "")
  ) {
    return NaN;
  }

  const seconds = Number(parts[parts.length - 1]);
  const minutes = Number(parts[parts.length - 2]);
  const hours = parts.length === 3 ? Number(parts[0]) : 0;

  if (
    !Number.isFinite(seconds) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(hours) ||
    seconds < 0 ||
    seconds >= 60 ||
    minutes < 0 ||
    (parts.length === 3 && minutes >= 60) ||
    hours < 0
  ) {
    return NaN;
  }

  return hours * 3600 + minutes * 60 + seconds;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;

  const secText = remaining.toFixed(2).padStart(5, "0");

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${secText}`;
  }

  if (minutes > 0) {
    return `${minutes}:${secText}`;
  }

  return remaining.toFixed(2);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function showStatus(element, message, isError = false) {
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error", isError);
}

/* ---------- ALMACENAMIENTO ---------- */

function loadMarks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

    if (!Array.isArray(saved)) return [];

    return saved
      .filter(mark =>
        mark &&
        typeof mark.event === "string" &&
        Number.isFinite(Number(mark.seconds)) &&
        Number(mark.seconds) > 0
      )
      .map(mark => ({
        id: String(mark.id || makeId()),
        event: mark.event,
        seconds: Number(mark.seconds),
        pool: mark.pool === "50 m" ? "50 m" : "25 m",
        kind: String(mark.kind || "Entrenamiento"),
        date: /^\d{4}-\d{2}-\d{2}$/.test(mark.date || "")
          ? mark.date
          : new Date().toISOString().slice(0, 10)
      }));
  } catch (error) {
    console.error("No se pudieron cargar las marcas:", error);
    return [];
  }
}

function saveMarks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(marks));
    return true;
  } catch (error) {
    console.error("No se pudieron guardar las marcas:", error);
    showStatus(
      el.markStatus,
      "No se han podido guardar los datos en el navegador.",
      true
    );
    return false;
  }
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ---------- RÉCORDS PERSONALES ---------- */

function getPersonalBest(event, pool) {
  return marks
    .filter(mark => mark.event === event && mark.pool === pool)
    .reduce((best, mark) => {
      if (!best || mark.seconds < best.seconds) return mark;
      return best;
    }, null);
}

function isPersonalBest(mark) {
  const best = getPersonalBest(mark.event, mark.pool);
  return Boolean(best && best.id === mark.id);
}

function getBestRecordsCount() {
  const groups = new Set(
    marks.map(mark => `${mark.event}||${mark.pool}`)
  );

  let count = 0;

  groups.forEach(group => {
    const [event, pool] = group.split("||");
    if (getPersonalBest(event, pool)) count++;
  });

  return count;
}

/* ---------- ORDEN Y ESTILOS ---------- */

function sortedMarks(list = marks) {
  return [...list].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);

    if (dateCompare !== 0) return dateCompare;

    return a.seconds - b.seconds;
  });
}

function getStroke(event) {
  const name = event.toLowerCase();

  if (name.includes("mariposa")) return "Mariposa";
  if (name.includes("espalda")) return "Espalda";
  if (name.includes("braza")) return "Braza";
  if (name.includes("estilos")) return "Estilos";
  if (name.includes("crol")) return "Crol";

  return "Otros";
}

function getUniqueEvents() {
  return [...new Set(marks.map(mark => mark.event))]
    .sort((a, b) => a.localeCompare(b, "es"));
}

/* ---------- ESTADÍSTICAS PRINCIPALES ---------- */

function renderSummary() {
  if (el.totalMarks) {
    el.totalMarks.textContent = marks.length;
  }

  if (el.totalEvents) {
    el.totalEvents.textContent = getUniqueEvents().length;
  }

  if (el.totalRecords) {
    el.totalRecords.textContent = getBestRecordsCount();
  }
}

function populateSelect(select, options, firstLabel) {
  if (!select) return;

  const currentValue = select.value;

  select.innerHTML = "";

  const first = document.createElement("option");
  first.value = "all";
  first.textContent = firstLabel;
  select.appendChild(first);

  options.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });

  if ([...select.options].some(option => option.value === currentValue)) {
    select.value = currentValue;
  }
}

function refreshSelectors() {
  const events = getUniqueEvents();

  if (el.filterEvent) {
    populateSelect(el.filterEvent, events, "Todas las pruebas");
  }

  if (el.chartEvent) {
    const previous = el.chartEvent.value;

    el.chartEvent.innerHTML = "";

    if (!events.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Guarda una marca para empezar";
      el.chartEvent.appendChild(option);
    } else {
      events.forEach(event => {
        const option = document.createElement("option");
        option.value = event;
        option.textContent = event;
        el.chartEvent.appendChild(option);
      });

      if (events.includes(previous)) {
        el.chartEvent.value = previous;
      }
    }
  }
}

/* ---------- LISTA DE MARCAS ---------- */

function renderMarks() {
  if (!el.marksList) return;

  const selectedEvent = el.filterEvent?.value || "all";

  const filtered = sortedMarks(marks.filter(mark =>
    selectedEvent === "all" || mark.event === selectedEvent
  )).reverse();

  if (!filtered.length) {
    el.marksList.innerHTML = `
      <p class="empty-state">
        Todavía no hay marcas aquí. Registra tu primer tiempo.
      </p>
    `;
    return;
  }

  el.marksList.innerHTML = filtered.map(mark => {
    const best = isPersonalBest(mark);

    return `
      <article class="mark-item">
        <div class="mark-main">
          <div class="mark-title">
            ${escapeHTML(mark.event)}
            ${best ? '<span class="pb-badge">RÉCORD PERSONAL</span>' : ""}
          </div>
          <div class="mark-meta">
            ${escapeHTML(mark.date)} ·
            ${escapeHTML(mark.pool)} ·
            ${escapeHTML(mark.kind)}
          </div>
        </div>
        <div class="mark-result">
          <strong>${formatTime(mark.seconds)}</strong>
          <button
            type="button"
            class="delete-button"
            data-delete="${escapeHTML(mark.id)}"
            aria-label="Eliminar marca"
            title="Eliminar marca"
          >×</button>
        </div>
      </article>
    `;
  }).join("");
}

/* ---------- GRÁFICA SVG ---------- */

function renderChart() {
  if (!el.chartArea) return;

  const event = el.chartEvent?.value || "";
  const data = sortedMarks(marks.filter(mark => mark.event === event));

  if (!event || !data.length) {
    el.chartArea.innerHTML = `
      <p class="empty-state">
        Cuando registres marcas de esta prueba, aparecerá tu evolución.
      </p>
    `;
    return;
  }

  const width = 720;
  const height = 300;
  const left = 58;
  const right = 24;
  const top = 24;
  const bottom = 48;

  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  const values = data.map(mark => mark.seconds);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(maxValue - minValue, 1);

  const padding = range * 0.15;
  const low = Math.max(0, minValue - padding);
  const high = maxValue + padding;
  const totalRange = Math.max(high - low, 1);

  const x = index => data.length === 1
    ? left + plotWidth / 2
    : left + (index / (data.length - 1)) * plotWidth;

  const y = seconds =>
    top + ((high - seconds) / totalRange) * plotHeight;

  const grid = Array.from({ length: 5 }, (_, index) => {
    const value = low + (totalRange * index / 4);
    const yy = top + plotHeight - (plotHeight * index / 4);

    return `
      <line
        x1="${left}" y1="${yy}"
        x2="${width - right}" y2="${yy}"
        stroke="#22344a" stroke-dasharray="4 5"
      />
      <text
        x="${left - 8}" y="${yy + 4}"
        text-anchor="end" fill="#8fa4bb" font-size="11"
      >${value.toFixed(1)}</text>
    `;
  }).join("");

  const line = data.map((mark, index) =>
    `${index === 0 ? "M" : "L"} ${x(index)} ${y(mark.seconds)}`
  ).join(" ");

  const points = data.map((mark, index) => {
    const color = mark.pool === "25 m" ? "#28dbc7" : "#a78bfa";

    return `
      <circle
        cx="${x(index)}"
        cy="${y(mark.seconds)}"
        r="5"
        fill="${color}"
        stroke="#101d2e"
        stroke-width="2"
      >
        <title>${escapeHTML(mark.date)} · ${formatTime(mark.seconds)} · ${escapeHTML(mark.pool)}</title>
      </circle>
    `;
  }).join("");

  const labels = data.map((mark, index) => {
    if (
      data.length > 8 &&
      index !== 0 &&
      index !== data.length - 1 &&
      index % Math.ceil(data.length / 6) !== 0
    ) return "";

    return `
      <text
        x="${x(index)}"
        y="${height - 18}"
        text-anchor="middle"
        fill="#8fa4bb"
        font-size="10"
      >${escapeHTML(mark.date.slice(5))}</text>
    `;
  }).join("");

  el.chartArea.innerHTML = `
    <div class="chart-svg-wrap">
      <svg
        viewBox="0 0 ${width} ${height}"
        role="img"
        aria-label="Gráfica de evolución de ${escapeHTML(event)}"
        style="width:100%;height:auto;display:block"
      >
        ${grid}
        <path
          d="${line}"
          fill="none"
          stroke="#28dbc7"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        ${points}
        ${labels}
      </svg>
    </div>
    <p class="chart-note">
      ${data.length} marcas registradas ·
      Mejor tiempo: ${formatTime(minValue)}
    </p>
  `;
}

/* ---------- ESTADÍSTICAS AVANZADAS ---------- */

function ensureAdvancedSection() {
  if (document.getElementById("advancedStats")) return;

  const chartSection = document.getElementById("chartSection");
  if (!chartSection) return;

  const section = document.createElement("section");
  section.className = "panel";
  section.id = "advancedStats";

  section.innerHTML = `
    <div class="section-heading">
      <div>
        <span class="eyebrow">DATOS DE RENDIMIENTO</span>
        <h2>Estadísticas avanzadas</h2>
        <p class="section-description">
          Descubre cómo evolucionan tus tiempos.
        </p>
      </div>
      <span class="heading-icon">⌁</span>
    </div>

    <div class="form-grid advanced-filters">
      <label class="field">
        <span>Prueba</span>
        <select id="advancedEvent">
          <option value="all">Todas las pruebas</option>
        </select>
      </label>

      <label class="field">
        <span>Piscina</span>
        <select id="advancedPool">
          <option value="all">Todas</option>
          <option value="25 m">25 m</option>
          <option value="50 m">50 m</option>
        </select>
      </label>
    </div>

    <div class="stats-grid advanced-grid">
      <article class="stat-card">
        <span class="stat-label">MEJORA ENTRE MARCAS</span>
        <strong id="advancedImprovement">—</strong>
        <span class="stat-foot">Primera frente a última</span>
      </article>

      <article class="stat-card">
        <span class="stat-label">DIFERENCIA DE TIEMPO</span>
        <strong id="advancedDifference">—</strong>
        <span class="stat-foot">En segundos</span>
      </article>

      <article class="stat-card">
        <span class="stat-label">MEJOR MARCA</span>
        <strong id="advancedBest">—</strong>
        <span class="stat-foot">Según los filtros</span>
      </article>
    </div>

    <div class="advanced-subsection">
      <h3>Récords por prueba y piscina</h3>
      <div id="recordsByEvent" class="marks-list"></div>
    </div>

    <div class="advanced-subsection">
      <h3>Marcas por estilo</h3>
      <div id="strokeBreakdown" class="stroke-breakdown"></div>
    </div>

    <p class="chart-note">
      La mejora se calcula comparando la marca más antigua con la más reciente
      de la selección. Solo compara pruebas y piscinas equivalentes para
      interpretar el resultado correctamente.
    </p>
  `;

  chartSection.insertAdjacentElement("afterend", section);
}

function renderAdvancedStats() {
  const section = document.getElementById("advancedStats");
  if (!section) return;

  const eventFilter = $("advancedEvent")?.value || "all";
  const poolFilter = $("advancedPool")?.value || "all";

  const filtered = sortedMarks(marks.filter(mark =>
    (eventFilter === "all" || mark.event === eventFilter) &&
    (poolFilter === "all" || mark.pool === poolFilter)
  ));

  const first = filtered[0];
  const latest = filtered[filtered.length - 1];

  let improvement = null;
  let difference = null;

  // La mejora solo se calcula para la misma prueba y piscina.
  if (
    first &&
    latest &&
    first.event === latest.event &&
    first.pool === latest.pool &&
    first.id !== latest.id
  ) {
    difference = first.seconds - latest.seconds;
    improvement = first.seconds > 0
      ? (difference / first.seconds) * 100
      : null;
  }

  const improvementEl = $("advancedImprovement");
  const differenceEl = $("advancedDifference");
  const bestEl = $("advancedBest");

  if (improvementEl) {
    improvementEl.textContent = improvement === null
      ? "—"
      : `${improvement >= 0 ? "+" : ""}${improvement.toFixed(2)}%`;

    if (improvement !== null) {
      improvementEl.title = improvement >= 0
        ? "Has mejorado respecto a la primera marca."
        : "La última marca ha sido más lenta que la primera.";
    }
  }

  if (differenceEl) {
    differenceEl.textContent = difference === null
      ? "—"
      : `${difference > 0 ? "+" : ""}${difference.toFixed(2)} s`;

    if (difference !== null) {
      differenceEl.title = difference > 0
        ? "Has reducido el tiempo."
        : difference < 0
          ? "La última marca ha sido más lenta."
          : "Mismo tiempo.";
    }
  }

  if (bestEl) {
    bestEl.textContent = filtered.length
      ? formatTime(Math.min(...filtered.map(mark => mark.seconds)))
      : "—";
  }

  renderRecordsByEvent(eventFilter, poolFilter);
  renderStrokeBreakdown(filtered);
}

function renderRecordsByEvent(eventFilter, poolFilter) {
  const container = $("recordsByEvent");
  if (!container) return;

  const events = getUniqueEvents().filter(event =>
    eventFilter === "all" || event === eventFilter
  );

  const rows = [];

  events.forEach(event => {
    ["25 m", "50 m"].forEach(pool => {
      if (poolFilter !== "all" && pool !== poolFilter) return;

      const best = getPersonalBest(event, pool);
      if (!best) return;

      rows.push(`
        <article class="mark-item">
          <div class="mark-main">
            <div class="mark-title">${escapeHTML(event)}</div>
            <div class="mark-meta">${escapeHTML(pool)}</div>
          </div>
          <div class="mark-result">
            <strong>${formatTime(best.seconds)}</strong>
          </div>
        </article>
      `);
    });
  });

  container.innerHTML = rows.length
    ? rows.join("")
    : '<p class="empty-state">Aún no hay récords con estos filtros.</p>';
}

function renderStrokeBreakdown(filtered) {
  const container = $("strokeBreakdown");
  if (!container) return;

  if (!filtered.length) {
    container.innerHTML =
      '<p class="empty-state">Guarda marcas para ver el análisis por estilo.</p>';
    return;
  }

  const groups = {};

  filtered.forEach(mark => {
    const stroke = getStroke(mark.event);

    if (!groups[stroke]) {
      groups[stroke] = { count: 0, events: new Set(), best: Infinity };
    }

    groups[stroke].count++;
    groups[stroke].events.add(mark.event);
    groups[stroke].best = Math.min(groups[stroke].best, mark.seconds);
  });

  const maxCount = Math.max(...Object.values(groups).map(group => group.count));

  container.innerHTML = Object.entries(groups)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([stroke, data]) => {
      const percent = (data.count / maxCount) * 100;

      return `
        <div class="stroke-row">
          <div class="stroke-row-heading">
            <strong>${escapeHTML(stroke)}</strong>
            <span>${data.count} marcas · ${data.events.size} pruebas</span>
          </div>
          <div class="stroke-bar-track">
            <div class="stroke-bar" style="width:${percent}%"></div>
          </div>
          <div class="stroke-row-foot">
            Mejor tiempo registrado: ${formatTime(data.best)}
          </div>
        </div>
      `;
    }).join("");
}

function refreshAdvancedSelectors() {
  const select = $("advancedEvent");
  if (!select) return;

  const previous = select.value;

  select.innerHTML = '<option value="all">Todas las pruebas</option>';

  getUniqueEvents().forEach(event => {
    const option = document.createElement("option");
    option.value = event;
    option.textContent = event;
    select.appendChild(option);
  });

  if ([...select.options].some(option => option.value === previous)) {
    select.value = previous;
  }
}

/* ---------- SWIMAI LOCAL ---------- */

function addAIMessage(message, role = "assistant") {
  if (!el.aiMessages) return;

  const div = document.createElement("div");
  div.className = `ai-message ${role}`;
  div.textContent = message;

  el.aiMessages.appendChild(div);
  el.aiMessages.scrollTop = el.aiMessages.scrollHeight;
}

function getAIResponse(question) {
  const q = question.toLowerCase();
  const allEvents = getUniqueEvents();

  if (!marks.length) {
    return "Todavía no tienes marcas guardadas. Registra un tiempo y podré ayudarte a analizar tus resultados.";
  }

  if (
    q.includes("cuántas marcas") ||
    q.includes("cuantas marcas") ||
    q.includes("mis marcas") ||
    q.includes("cuántos tiempos") ||
    q.includes("cuantos tiempos")
  ) {
    return `Tienes ${marks.length} marcas guardadas, repartidas entre ${allEvents.length} pruebas diferentes.`;
  }

  if (
    q.includes("récord") ||
    q.includes("record") ||
    q.includes("mejor tiempo") ||
    q.includes("mejor marca")
  ) {
    const bests = [];

    allEvents.forEach(event => {
      ["25 m", "50 m"].forEach(pool => {
        const best = getPersonalBest(event, pool);
        if (best) {
          bests.push(
            `${event} (${pool}): ${formatTime(best.seconds)}`
          );
        }
      });
    });

    if (q.includes("mariposa") || q.includes("crol") ||
        q.includes("braza") || q.includes("espalda")) {
      const filtered = bests.filter(item =>
        item.toLowerCase().includes(
          q.includes("mariposa") ? "mariposa" :
          q.includes("crol") ? "crol" :
          q.includes("braza") ? "braza" : "espalda"
        )
      );

      return filtered.length
        ? `Tus mejores tiempos son:\n${filtered.join("\n")}`
        : "No encuentro récords para ese estilo.";
    }

    return `Estos son tus récords personales:\n${bests.join("\n")}`;
  }

  if (
    q.includes("evolución") ||
    q.includes("evolucion") ||
    q.includes("he mejorado") ||
    q.includes("progreso")
  ) {
    const event = allEvents.find(item => q.includes(item.toLowerCase()));

    if (!event) {
      return "Para analizar tu evolución, dime la prueba concreta, por ejemplo: «Analiza mi evolución en 50 m mariposa».";
    }

    const pool = q.includes("50 m") && !q.includes("25 m")
      ? "50 m"
      : q.includes("25 m")
        ? "25 m"
        : null;

    const data = sortedMarks(marks.filter(mark =>
      mark.event === event && (!pool || mark.pool === pool)
    ));

    if (data.length < 2) {
      return `Necesitas al menos dos marcas de ${event}${pool ? ` en piscina de ${pool}` : ""} para comparar tu evolución.`;
    }

    const first = data[0];
    const latest = data[data.length - 1];

    if (first.pool !== latest.pool) {
      return "Tus marcas más antigua y más reciente son de piscinas distintas. Para una comparación justa, analiza las marcas de 25 m y 50 m por separado.";
    }

    const diff = first.seconds - latest.seconds;
    const percent = (diff / first.seconds) * 100;

    return `En ${event} (${first.pool}), pasaste de ${formatTime(first.seconds)} el ${first.date} a ${formatTime(latest.seconds)} el ${latest.date}. La diferencia es de ${diff.toFixed(2)} segundos (${percent.toFixed(2)}%). Un porcentaje positivo significa que has bajado tu tiempo.`;
  }

  if (
    q.includes("convert") ||
    q.includes("piscina corta") ||
    q.includes("piscina larga") ||
    q.includes("25 a 50") ||
    q.includes("50 a 25")
  ) {
    return "Las conversiones entre piscina de 25 m y 50 m son aproximadas: influyen los virajes, las salidas, la técnica y la prueba. No existe una conversión universal fiable para todas las personas. Dime tu prueba, tu tiempo y la piscina para comentar una estimación con cautela.";
  }

  if (
    q.includes("entrenamiento") ||
    q.includes("entrenar") ||
    q.includes("series") ||
    q.includes("sesión") ||
    q.includes("sesion")
  ) {
    return "Puedo ayudarte a estructurar una sesión según tu prueba y objetivo. Por ejemplo, combina calentamiento, técnica, series específicas a intensidad controlada y vuelta a la calma. Ajusta el volumen a tu entrenador y evita hacer todas las series al máximo. ¿Qué prueba estás preparando y qué objetivo tienes?";
  }

  if (
    q.includes("ritmo") ||
    q.includes("paso") ||
    q.includes("100 metros") ||
    q.includes("100 m")
  ) {
    return "Para calcular el ritmo medio, divide el tiempo total entre la distancia y multiplícalo por 100. Por ejemplo, 1:10 en 100 m equivale a 70 segundos por cada 100 m. Si me das tu distancia y tiempo, te lo calculo.";
  }

  if (
    q.includes("hola") ||
    q.includes("buenas") ||
    q.includes("qué puedes") ||
    q.includes("que puedes")
  ) {
    return "¡Hola! Puedo consultar tus marcas y récords, analizar tu evolución, calcular ritmos y orientarte con entrenamientos generales. También puedo explicar las limitaciones de las conversiones entre piscinas.";
  }

  return "Puedo ayudarte con tus marcas, récords personales, evolución, ritmos y dudas generales de entrenamiento. Prueba a preguntarme «¿Cuál es mi récord de 50 m mariposa?» o «Analiza mi evolución en 100 m crol».";
}

/* ---------- ACTUALIZAR TODA LA APP ---------- */

function renderAll() {
  renderSummary();
  refreshSelectors();
  renderMarks();
  renderChart();
  refreshAdvancedSelectors();
  renderAdvancedStats();
}

/* ---------- EVENTOS ---------- */

if (el.markForm) {
  el.markForm.addEventListener("submit", event => {
    event.preventDefault();

    const eventName = el.eventSelect?.value;
    const rawTime = el.timeInput?.value || "";
    const seconds = parseTime(rawTime);
    const pool = el.poolSelect?.value;
    const kind = el.kindSelect?.value;
    const date = el.dateInput?.value;

    if (!eventName || !Number.isFinite(seconds) || seconds <= 0) {
      showStatus(
        el.markStatus,
        "Introduce un tiempo válido, por ejemplo 32.85 o 1:12.40.",
        true
      );
      return;
    }

    if (!date) {
      showStatus(el.markStatus, "Selecciona la fecha de la marca.", true);
      return;
    }

    const mark = {
      id: makeId(),
      event: eventName,
      seconds,
      pool: pool === "50 m" ? "50 m" : "25 m",
      kind: kind || "Entrenamiento",
      date
    };

    marks.push(mark);

    if (!saveMarks()) {
      marks = marks.filter(item => item.id !== mark.id);
      return;
    }

    renderAll();

    el.timeInput.value = "";
    showStatus(
      el.markStatus,
      isPersonalBest(mark)
        ? "¡Marca guardada! Es tu récord personal en esa piscina."
        : "Marca guardada correctamente."
    );
  });
}

if (el.filterEvent) {
  el.filterEvent.addEventListener("change", renderMarks);
}

if (el.chartEvent) {
  el.chartEvent.addEventListener("change", renderChart);
}

if (el.marksList) {
  el.marksList.addEventListener("click", event => {
    const button = event.target.closest("[data-delete]");
    if (!button) return;

    const id = button.dataset.delete;
    const mark = marks.find(item => item.id === id);

    if (!mark) return;

    const confirmed = window.confirm(
      `¿Quieres borrar la marca de ${mark.event} (${formatTime(mark.seconds)})?`
    );

    if (!confirmed) return;

    const previousMarks = marks;
    marks = marks.filter(item => item.id !== id);

    if (!saveMarks()) {
      marks = previousMarks;
      return;
    }

    renderAll();
    showStatus(el.markStatus, "Marca eliminada.");
  });
}

document.addEventListener("change", event => {
  if (
    event.target.id === "advancedEvent" ||
    event.target.id === "advancedPool"
  ) {
    renderAdvancedStats();
  }
});

if (el.aiForm) {
  el.aiForm.addEventListener("submit", event => {
    event.preventDefault();

    const question = el.aiInput?.value.trim();
    if (!question) return;

    addAIMessage(question, "user");
    el.aiInput.value = "";

    showStatus(el.aiStatus, "SwimAI está preparando una respuesta…");

    // Respuesta local: no usa una API ni necesita clave.
    const response = getAIResponse(question);
    addAIMessage(response, "assistant");

    showStatus(el.aiStatus, "Asistente local disponible.");
  });
}

/* ---------- ESTILOS COMPLEMENTARIOS ---------- */

function addAdvancedStyles() {
  if (document.getElementById("swimtrack-advanced-styles")) return;

  const style = document.createElement("style");
  style.id = "swimtrack-advanced-styles";

  style.textContent = `
    .pb-badge {
      display: inline-block;
      margin-left: 8px;
      padding: 3px 7px;
      border-radius: 6px;
      background: rgba(40, 219, 199, .13);
      color: #28dbc7;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: .04em;
      vertical-align: middle;
    }

    .mark-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 15px 0;
      border-bottom: 1px solid #22344a;
    }

    .mark-item:last-child {
      border-bottom: 0;
    }

    .mark-main {
      min-width: 0;
    }

    .mark-title {
      font-weight: 700;
      color: #f0f6fc;
      overflow-wrap: anywhere;
    }

    .mark-meta,
    .stroke-row-foot {
      margin-top: 5px;
      color: #8fa4bb;
      font-size: 12px;
    }

    .mark-result {
      display: flex;
      align-items: center;
      gap: 12px;
      white-space: nowrap;
    }

    .mark-result strong {
      font-size: 17px;
      color: #28dbc7;
      font-variant-numeric: tabular-nums;
    }

    .delete-button {
      width: 30px;
      height: 30px;
      border: 1px solid #34465b;
      border-radius: 8px;
      color: #ff8585;
      background: transparent;
      cursor: pointer;
      font-size: 20px;
    }

    .delete-button:hover {
      background: rgba(255, 133, 133, .1);
    }

    .advanced-subsection {
      margin-top: 26px;
    }

    .advanced-subsection h3 {
      margin: 0 0 12px;
      color: #f0f6fc;
      font-size: 16px;
    }

    .stroke-breakdown {
      display: grid;
      gap: 18px;
    }

    .stroke-row-heading {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      font-size: 13px;
    }

    .stroke-row-heading span {
      color: #8fa4bb;
    }

    .stroke-bar-track {
      margin-top: 8px;
      height: 8px;
      border-radius: 999px;
      overflow: hidden;
      background: #22344a;
    }

    .stroke-bar {
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #28dbc7, #a78bfa);
      min-width: 3px;
    }

    .empty-state {
      color: #8fa4bb;
      line-height: 1.6;
    }

    .form-status.error {
      color: #ff8585;
    }

    @media (max-width: 600px) {
      .mark-item {
        align-items: flex-start;
      }

      .mark-result {
        gap: 6px;
      }

      .mark-result strong {
        font-size: 14px;
      }

      .pb-badge {
        margin: 5px 0 0;
      }
    }
  `;

  document.head.appendChild(style);
}

/* ---------- INICIO ---------- */

ensureAdvancedSection();
addAdvancedStyles();
renderAll();

if (el.aiStatus) {
  showStatus(el.aiStatus, "Asistente local disponible.");
}


