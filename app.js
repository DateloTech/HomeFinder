/* HomeFinder Monterrey — Vue 3 CDN app */
(() => {
  const { createApp, reactive, computed, ref, watch, nextTick, onMounted } = Vue;

  const STORAGE_KEY = "homefinder_v1";
  const BACKUP_KEY = "homefinder_backups_v1";
  const SYNC_META_KEY = "homefinder_sync_meta_v1";
  const GIST_FILENAME = "homefinder.json";

  const PROPERTY_STATES = [
    "Por revisar", "Interesante", "Contacto pendiente", "Contactado",
    "Cita solicitada", "Cita confirmada", "Visitada", "Favorita", "Descartada",
  ];
  const APPT_STATES = ["Por solicitar", "Solicitada", "Confirmada", "Reprogramada", "Realizada", "Cancelada"];
  const DIM_LABELS = {
    precio: "Precio y costo total",
    seguridad: "Seguridad percibida de la zona",
    cercania: "Cercanía al trabajo",
    calidad: "Calidad y estado de la vivienda",
    servicios: "Servicios cercanos",
    entretenimiento: "Entretenimiento y estilo de vida",
  };
  const AMENITY_KEYS = [
    { key: "alberca", label: "Alberca" },
    { key: "gimnasio", label: "Gimnasio" },
    { key: "asadores", label: "Área de asadores" },
    { key: "tenis", label: "Cancha de tenis" },
    { key: "basquet", label: "Cancha de básquetbol" },
    { key: "futbol", label: "Cancha de fútbol" },
    { key: "perros", label: "Área para perros" },
    { key: "salon", label: "Salón de usos múltiples" },
    { key: "jardines", label: "Jardines comunes" },
    { key: "juegos", label: "Juegos infantiles" },
  ];
  const DEFAULT_REQS = [
    "Identificación oficial", "Comprobante de ingresos", "Recibos de nómina",
    "Estados de cuenta", "Comprobante de domicilio", "Referencias personales",
    "Referencias laborales", "Aval o fiador", "Obligado solidario",
    "Póliza jurídica", "Investigación crediticia", "Depósito en garantía",
    "Primer mes de renta", "Firma del contrato",
  ];
  const PLACE_CATS = [
    { key: "supermercado", label: "Supermercado", type: "supermarket", basic: true },
    { key: "farmacia", label: "Farmacia", type: "pharmacy", basic: true },
    { key: "hospital", label: "Hospital", type: "hospital", basic: true },
    { key: "banco", label: "Banco", type: "bank", basic: false },
    { key: "parque", label: "Parque", type: "park", basic: false },
    { key: "restaurante", label: "Restaurante", type: "restaurant", basic: false },
    { key: "gimnasio", label: "Gimnasio", type: "gym", basic: false },
    { key: "plaza", label: "Plaza / centro comercial", type: "shopping_mall", basic: false },
    { key: "entretenimiento", label: "Entretenimiento", type: "movie_theater", basic: false },
  ];
  const PERSONAS = ["Atziri", "Brandon"];

  const uid = () => crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

  function emptyVistos() {
    return { Atziri: null, Brandon: null };
  }

  function emptyScores() {
    return { precio: null, seguridad: null, cercania: null, calidad: null, servicios: null, entretenimiento: null };
  }
  function defaultReqs() {
    return DEFAULT_REQS.map((nombre) => ({
      id: uid(), nombre, estado: "no_solicitado", costo: null, fechaLimite: "", notas: "", custom: false,
    }));
  }
  function formatDireccionMX(p) {
    if (!p) return "";
    const streetParts = [];
    if (p.calle) {
      let line = String(p.calle).trim();
      if (p.numeroExt) line += " " + String(p.numeroExt).trim();
      if (p.numeroInt) line += " Int. " + String(p.numeroInt).trim();
      streetParts.push(line);
    }
    if (p.colonia) streetParts.push("Col. " + String(p.colonia).trim());
    if (p.municipio) streetParts.push(String(p.municipio).trim());
    const estado = String(p.estadoMx || "Nuevo León").trim() || "Nuevo León";
    streetParts.push(estado === "Nuevo León" ? "N.L." : estado);
    if (p.cp) streetParts.push("C.P. " + String(p.cp).trim());
    streetParts.push("México");
    const composed = streetParts.filter(Boolean).join(", ");
    if (composed && composed !== "N.L., México" && composed !== "Nuevo León, México") return composed;
    return String(p.direccion || "").trim();
  }
  function syncDireccionFromMx(p) {
    if (!p) return;
    const composed = formatDireccionMX(p);
    if (p.calle || p.colonia || p.municipio || p.cp) p.direccion = composed;
  }
  function newProperty(partial = {}) {
    return {
      id: uid(),
      alias: "",
      calle: "", numeroExt: "", numeroInt: "",
      colonia: "", municipio: "", estadoMx: "Nuevo León", cp: "",
      direccion: "", enlace: "", lat: null, lng: null,
      coloniaBounds: null,
      fotos: [], observaciones: "",
      costos: { renta: null, mantenimiento: null, serviciosIncluidos: "", otrosMensuales: null, deposito: null, otrosIniciales: null },
      fisicas: { recamaras: null, banos: null, mediosBanos: null, estacionamiento: null, m2Const: null, m2Terreno: null, plantas: null, conservacion: "", disponibilidad: "" },
      amueblado: "pc",
      espacios: { jardin: "pc", terraza: "pc", balcon: "pc" },
      amenidades: { tieneComunes: "pc", items: {}, otras: "", notas: "" },
      perros: { acepta: "pc", restricciones: "", depositoExtra: null, reglas: "" },
      requisitos: { items: defaultReqs(), duracionContrato: "", condiciones: "" },
      trasladoTrabajo: null,
      servicios: {},
      travelCache: {},
      estado: "Por revisar",
      descarte: null,
      favorita: false,
      advisorId: "",
      zona: null,
      registradoPor: "",
      vistos: emptyVistos(),
      comentarios: [],
      evaluacion: {
        pre: { scores: emptyScores(), ventajas: "", desventajas: "", notas: "" },
        post: { scores: emptyScores(), ventajas: "", desventajas: "", notas: "" },
      },
      createdAt: new Date().toISOString(),
      ...partial,
    };
  }
  function newAdvisor(partial = {}) {
    return {
      id: uid(), nombre: "", inmobiliaria: "", telefono: "", whatsapp: "",
      ultimoContacto: "", proximoSeguimiento: "", notas: "", bitacora: [],
      registradoPor: "",
      ...partial,
    };
  }
  function newAppt(partial = {}) {
    return {
      id: uid(), propertyId: "", advisorId: "", fecha: "", hora: "10:00",
      duracion: 45, estado: "Por solicitar", notas: "",
      ...partial,
    };
  }
  function defaultConfig() {
    return {
      dias: [
        { fecha: "2026-11-21", label: "Sábado", desde: "09:00", hasta: "20:00" },
        { fecha: "2026-11-22", label: "Domingo", desde: "09:00", hasta: "20:00" },
        { fecha: "2026-11-23", label: "Lunes", desde: "15:00", hasta: "20:00" },
        { fecha: "2026-11-24", label: "Martes", desde: "09:00", hasta: "16:45" },
      ],
      duracionDefault: 45,
      margen: 15,
      presupuesto: null,
      ponderaciones: { precio: 20, seguridad: 20, cercania: 20, calidad: 15, servicios: 15, entretenimiento: 10 },
      trabajo: {
        nombre: "Rectoría del Tecnológico de Monterrey, Campus Monterrey",
        lat: 25.6515, lng: -100.2895,
      },
      githubToken: "",
      gistId: "",
      mapsKey: "",
      openaiKey: "",
      openaiModel: "gpt-4o-mini",
      apiUsage: { geocoding: 0, routes: 0, places: 0 },
      personaActiva: "Brandon",
      cloudinaryCloud: "",
      cloudinaryPreset: "",
      placeCatsCustom: [],
    };
  }
  const AI_CHAT_MAX = 10;
  const AI_MSG_LIVE_MAX = 50;
  const AI_MSG_KEEP = 12;
  const AI_MSG_MAX_CHARS = 4000;
  const AI_WELCOME = { role: "system", content: "Pregúntame sobre tus propiedades, citas o asesores." };

  function emptyAiChats() {
    return { activeId: "", chats: [] };
  }
  function clipAiText(content, max = AI_MSG_MAX_CHARS) {
    const s = String(content ?? "");
    return s.length > max ? s.slice(0, max) : s;
  }
  function normalizeAiMessage(m) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) return null;
    return { role: m.role, content: clipAiText(m.content) };
  }
  function normalizeAiChat(c) {
    if (!c || typeof c !== "object") return null;
    return {
      id: c.id || uid(),
      title: clipAiText(c.title || "Nueva conversación", 60) || "Nueva conversación",
      updatedAt: c.updatedAt || new Date().toISOString(),
      summary: clipAiText(c.summary || "", 8000),
      messages: Array.isArray(c.messages) ? c.messages.map(normalizeAiMessage).filter(Boolean) : [],
    };
  }
  function normalizeAiChats(raw) {
    const base = emptyAiChats();
    if (!raw || typeof raw !== "object") return base;
    let chats = (Array.isArray(raw.chats) ? raw.chats : []).map(normalizeAiChat).filter(Boolean);
    chats.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    if (chats.length > AI_CHAT_MAX) chats = chats.slice(0, AI_CHAT_MAX);
    let activeId = raw.activeId || "";
    if (activeId && !chats.some((c) => c.id === activeId)) activeId = chats[0]?.id || "";
    return { activeId, chats };
  }

  function emptyData() {
    return {
      rev: 1,
      updatedAt: new Date().toISOString(),
      properties: [],
      advisors: [],
      appointments: [],
      aiChats: emptyAiChats(),
      dayPlans: {},
      config: defaultConfig(),
    };
  }

  /* ---------- Persistence ---------- */
  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyData();
      const parsed = JSON.parse(raw);
      return migrate(parsed);
    } catch {
      return emptyData();
    }
  }
  const PHOTO_FUENTES = ["anuncio", "manual", "captura", "subida"];
  function normalizePhoto(f) {
    if (!f) return null;
    if (typeof f === "string") {
      return { id: uid(), url: f, thumb: f, fuente: "manual", addedAt: new Date().toISOString() };
    }
    const url = f.url || f.thumb || "";
    if (!url) return null;
    return {
      id: f.id || uid(),
      url,
      thumb: f.thumb || url,
      fuente: PHOTO_FUENTES.includes(f.fuente) ? f.fuente : "manual",
      addedAt: f.addedAt || new Date().toISOString(),
    };
  }
  function fotoFuenteLabel(fuente) {
    return ({ anuncio: "anuncio", manual: "manual", captura: "captura", subida: "subida" })[fuente] || "manual";
  }
  function fotoFuenteBadge(fuente) {
    if (fuente === "anuncio") return "badge-accent";
    if (fuente === "captura") return "badge-warn";
    if (fuente === "subida") return "badge-ok";
    return "badge-info";
  }
  function normalizeServicioItem(s) {
    if (!s || typeof s !== "object") return null;
    const lat = s.lat != null ? Number(s.lat) : null;
    const lng = s.lng != null ? Number(s.lng) : null;
    const min = s.min != null ? Number(s.min) : (s.durationMin != null ? Number(s.durationMin) : null);
    let km = s.km != null ? Number(s.km) : null;
    if (km == null && s.distanciaKm != null) km = Number(s.distanciaKm);
    return {
      id: s.id || uid(),
      nombre: String(s.nombre || "Sin nombre"),
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      min: Number.isFinite(min) ? min : null,
      km: Number.isFinite(km) ? km : null,
      fuente: s.fuente === "manual" ? "manual" : "places",
      measuredAt: s.measuredAt || s.fecha || "",
    };
  }
  function normalizeServiciosMap(raw) {
    const out = {};
    if (!raw || typeof raw !== "object") return out;
    for (const [key, val] of Object.entries(raw)) {
      if (Array.isArray(val)) {
        out[key] = val.map(normalizeServicioItem).filter(Boolean).slice(0, 3);
      } else if (val && typeof val === "object") {
        // Formato viejo: un solo objeto por categoría
        const one = normalizeServicioItem(val);
        out[key] = one ? [one] : [];
      }
    }
    return out;
  }
  function normalizePlaceCatCustom(c) {
    if (!c || typeof c !== "object") return null;
    const label = String(c.label || "").trim();
    const query = String(c.query || c.label || "").trim();
    if (!label || !query) return null;
    return { id: c.id || uid(), label, query };
  }
  function normalizeColoniaBounds(b) {
    if (!b || typeof b !== "object") return null;
    const north = Number(b.north), south = Number(b.south), east = Number(b.east), west = Number(b.west);
    if (![north, south, east, west].every(Number.isFinite)) return null;
    return { north, south, east, west };
  }
  function normalizeProperty(p) {
    if (!p || typeof p !== "object") return p;
    if (!p.registradoPor) p.registradoPor = "";
    if (p.calle == null) p.calle = "";
    if (p.numeroExt == null) p.numeroExt = "";
    if (p.numeroInt == null) p.numeroInt = "";
    if (p.municipio == null) p.municipio = "";
    if (p.estadoMx == null || p.estadoMx === "") p.estadoMx = "Nuevo León";
    if (p.cp == null) p.cp = "";
    if (!p.calle && p.direccion && !String(p.direccion).startsWith("Col.")) {
      // Datos viejos: conservar direccion libre; no forzar parseo
    }
    p.coloniaBounds = normalizeColoniaBounds(p.coloniaBounds);
    if (!p.vistos || typeof p.vistos !== "object") p.vistos = emptyVistos();
    if (p.vistos.Atziri === undefined) p.vistos.Atziri = null;
    if (p.vistos.Brandon === undefined) p.vistos.Brandon = null;
    if (!Array.isArray(p.comentarios)) p.comentarios = [];
    if (!Array.isArray(p.fotos)) p.fotos = [];
    else p.fotos = p.fotos.map(normalizePhoto).filter(Boolean);
    p.servicios = normalizeServiciosMap(p.servicios);
    return p;
  }
  function normalizeAdvisor(a) {
    if (!a || typeof a !== "object") return a;
    if (!a.registradoPor) a.registradoPor = "";
    return a;
  }
  function migrate(d) {
    const base = emptyData();
    const properties = (Array.isArray(d.properties) ? d.properties : []).map(normalizeProperty);
    const advisors = (Array.isArray(d.advisors) ? d.advisors : []).map(normalizeAdvisor);
    return {
      ...base,
      ...d,
      config: {
        ...base.config,
        ...(d.config || {}),
        ponderaciones: { ...base.config.ponderaciones, ...(d.config?.ponderaciones || {}) },
        trabajo: { ...base.config.trabajo, ...(d.config?.trabajo || {}) },
        apiUsage: { ...base.config.apiUsage, ...(d.config?.apiUsage || {}) },
        personaActiva: PERSONAS.includes(d.config?.personaActiva) ? d.config.personaActiva : "Brandon",
        placeCatsCustom: Array.isArray(d.config?.placeCatsCustom)
          ? d.config.placeCatsCustom.map(normalizePlaceCatCustom).filter(Boolean)
          : [],
      },
      properties,
      advisors,
      appointments: Array.isArray(d.appointments) ? d.appointments : [],
      aiChats: normalizeAiChats(d.aiChats),
      dayPlans: d.dayPlans && typeof d.dayPlans === "object" && !Array.isArray(d.dayPlans) ? d.dayPlans : {},
    };
  }
  function loadSyncMeta() {
    try { return JSON.parse(localStorage.getItem(SYNC_META_KEY) || "{}"); }
    catch { return {}; }
  }
  function saveSyncMeta(m) { localStorage.setItem(SYNC_META_KEY, JSON.stringify(m)); }
  function loadBackups() {
    try { return JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]"); }
    catch { return []; }
  }
  function pushBackup(data, label) {
    const list = loadBackups();
    list.unshift({ at: new Date().toLocaleString("es-MX"), label, data: JSON.parse(JSON.stringify(data)) });
    localStorage.setItem(BACKUP_KEY, JSON.stringify(list.slice(0, 5)));
    return list.slice(0, 5);
  }

  /* ---------- Helpers ---------- */
  function money(n) {
    if (n == null || n === "" || Number.isNaN(Number(n))) return "—";
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Number(n));
  }
  function totalMensual(p) {
    const c = p?.costos || {};
    return (Number(c.renta) || 0) + (Number(c.mantenimiento) || 0) + (Number(c.otrosMensuales) || 0);
  }
  function desembolsoInicial(p) {
    const c = p?.costos || {};
    return (Number(c.deposito) || 0) + (Number(c.otrosIniciales) || 0) + (Number(c.renta) || 0);
  }
  function reqCosts(p) {
    return (p?.requisitos?.items || []).reduce((s, r) => s + (Number(r.costo) || 0), 0);
  }
  function amuebladoLabel(v) {
    return ({ sin: "Sin amueblar", semi: "Semiamueblada", full: "Amueblada", pc: "Amueblado ?" })[v] || "Amueblado ?";
  }
  function descarteLabel(m) {
    return ({ mascotas: "Mascotas", precio: "Precio", ubicacion: "Ubicación", decision: "Decisión", otro: "Otro" })[m] || "Descartada";
  }
  function haversineKm(a, b) {
    if (!a || !b || a.lat == null || b.lat == null) return null;
    const R = 6371, toR = (d) => d * Math.PI / 180;
    const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }
  function timeToMin(t) {
    if (!t) return 0;
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  }
  function minToTime(m) {
    const h = Math.floor(m / 60), mm = m % 60;
    return String(h).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
  }
  function formatDay(fecha) {
    if (!fecha) return "";
    const d = new Date(fecha + "T12:00:00");
    return d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "short" });
  }
  function formatDayShort(fecha) {
    if (!fecha) return "";
    const d = new Date(fecha + "T12:00:00");
    return d.toLocaleDateString("es-MX", { weekday: "short", day: "numeric" });
  }

  /* ---------- Score ---------- */
  function scoreEval(p, kind, ponderaciones) {
    const scores = p?.evaluacion?.[kind]?.scores || {};
    const w = ponderaciones || {};
    let num = 0, den = 0, filled = 0, total = Object.keys(DIM_LABELS).length;
    for (const key of Object.keys(DIM_LABELS)) {
      const s = scores[key];
      const weight = Number(w[key]) || 0;
      if (s != null && s !== "") {
        filled++;
        num += Number(s) * weight;
        den += weight;
      }
    }
    return {
      score: den > 0 ? num / den : null,
      pct: Math.round((filled / total) * 100),
    };
  }

  /* ---------- Zones ---------- */
  function assignZones(properties) {
    const withCoords = properties.filter((p) => p.lat != null && p.lng != null && p.estado !== "Descartada");
    const zones = [];
    const ZONE_KM = 3;
    for (const p of withCoords) {
      let found = null;
      for (const z of zones) {
        const dist = haversineKm(p, z.center);
        if (dist != null && dist <= ZONE_KM) { found = z; break; }
      }
      if (found) {
        found.ids.push(p.id);
        const n = found.ids.length;
        found.center.lat = (found.center.lat * (n - 1) + p.lat) / n;
        found.center.lng = (found.center.lng * (n - 1) + p.lng) / n;
      } else {
        zones.push({ id: "Z" + (zones.length + 1), center: { lat: p.lat, lng: p.lng }, ids: [p.id] });
      }
    }
    return zones;
  }

  /* ---------- Vue App ---------- */
  createApp({
    setup() {
      const data = reactive(loadLocal());
      const syncMeta = reactive({ knownRev: loadSyncMeta().knownRev ?? null, pending: !!loadSyncMeta().pending, lastSyncAt: loadSyncMeta().lastSyncAt || null });
      const backups = ref(loadBackups());
      const view = ref("home");
      const toasts = ref([]);
      const mapsReady = ref(false);
      const mapsBusy = ref(false);
      const mapsLoading = ref(false);
      let mapsScriptPromise = null;
      let propMap = null, propMarker = null, propColoniaRect = null, dayMap = null, dayMarkers = [];

      const sync = reactive({ level: "ok", label: "Guardado local", detail: "" });
      const conflict = ref(null);
      let syncTimer = null;
      let retryTimer = null;
      let retryAttempt = 0;
      let polling = false;

      const navItems = [
        { id: "home", label: "Inicio", icon: "ph-house" },
        { id: "properties", label: "Propiedades", icon: "ph-buildings" },
        { id: "agenda", label: "Agenda", icon: "ph-calendar" },
        { id: "ranking", label: "Ranking", icon: "ph-trophy" },
        { id: "advisors", label: "Asesores", icon: "ph-users" },
      ];

      const modals = reactive({ quickAdd: false, pasteAd: false, discard: false, appt: false, advisor: false, property: false });
      const quickForm = reactive({
        alias: "", calle: "", numeroExt: "", numeroInt: "",
        colonia: "", municipio: "", estadoMx: "Nuevo León", cp: "",
        renta: null, enlace: "", registradoPor: "Brandon",
      });
      const pasteText = ref("");
      const extractForm = ref(null);
      const discardForm = reactive({ propertyId: null, motivo: "decision", nota: "" });
      const apptForm = reactive(newAppt());
      const advisorForm = reactive(newAdvisor());
      const advisorAssignTarget = ref(null); // "property" | "appt" | null
      const editingProp = ref(null);
      const propTab = ref("resumen");
      const propTabs = [
        { id: "resumen", label: "Resumen" }, { id: "costos", label: "Costos" },
        { id: "espacios", label: "Espacios" }, { id: "mascotas", label: "Mascotas" },
        { id: "requisitos", label: "Requisitos" }, { id: "ubicacion", label: "Ubicación" },
        { id: "eval", label: "Evaluación" }, { id: "citas", label: "Citas" },
      ];
      const photoUrl = ref("");
      const photoBusy = ref(false);
      const galleryAddOpen = ref(false);
      const lightbox = reactive({ open: false, propertyId: null, index: 0 });
      const photoMode = reactive({
        propertyId: null,
        cropBars: true,
      });
      const uploadProgress = reactive({ active: false, current: 0, total: 0, label: "" });
      const captureInputEl = ref(null);
      const uploadInputEl = ref(null);
      const newReqName = ref("");
      const openReqs = reactive({});
      const manualTravel = reactive({ min: null, km: null });
      const propFilter = reactive({ q: "", estado: "", perros: "", registradoPor: "", pendienteVer: "" });
      const commentForm = reactive({ autor: "Brandon", texto: "" });
      const agendaDay = ref(data.config.dias[0]?.fecha || "2026-11-21");
      const agendaMode = ref("day");
      const plannerBusy = ref(false);
      const plannerResult = computed(() => data.dayPlans?.[agendaDay.value] || null);
      const rankOnlyEligible = ref(true);
      const rankColSort = reactive({ key: "score", dir: "desc" });
      const rankFilters = reactive({
        alias: "", colonia: "", estado: "",
        totalMin: null, totalMax: null,
        preMin: null, preMax: null,
        postMin: null, postMax: null,
        tecMin: null, tecMax: null,
      });
      const RANK_FILTER_COLS = {
        alias: { label: "Propiedad", type: "text" },
        colonia: { label: "Colonia", type: "text" },
        total: { label: "Total / mes", type: "range", minKey: "totalMin", maxKey: "totalMax" },
        pre: { label: "Prelim.", type: "range", minKey: "preMin", maxKey: "preMax" },
        post: { label: "Presenc.", type: "range", minKey: "postMin", maxKey: "postMax" },
        tec: { label: "Al Tec (min)", type: "range", minKey: "tecMin", maxKey: "tecMax" },
        estado: { label: "Estado", type: "estado" },
      };
      const rankFilterModal = reactive({ open: false, col: "" });
      const rankFilterDraft = reactive({ text: "", min: null, max: null, estado: "" });
      function toggleRankSort(key) {
        if (rankColSort.key === key) {
          rankColSort.dir = rankColSort.dir === "asc" ? "desc" : "asc";
        } else {
          rankColSort.key = key;
          rankColSort.dir = (key === "pre" || key === "post" || key === "score") ? "desc" : "asc";
        }
      }
      function rankSortMark(key) {
        if (rankColSort.key !== key) return "";
        return rankColSort.dir === "asc" ? " ↑" : " ↓";
      }
      function inRankRange(val, min, max) {
        if (val == null || Number.isNaN(Number(val))) {
          return (min == null || min === "") && (max == null || max === "");
        }
        const n = Number(val);
        if (min != null && min !== "" && !Number.isNaN(Number(min)) && n < Number(min)) return false;
        if (max != null && max !== "" && !Number.isNaN(Number(max)) && n > Number(max)) return false;
        return true;
      }
      function rankFilterActive(col) {
        const meta = RANK_FILTER_COLS[col];
        if (!meta) return false;
        if (meta.type === "text") return !!String(rankFilters[col] || "").trim();
        if (meta.type === "estado") return !!rankFilters.estado;
        if (meta.type === "range") {
          const min = rankFilters[meta.minKey], max = rankFilters[meta.maxKey];
          return (min != null && min !== "") || (max != null && max !== "");
        }
        return false;
      }
      function openRankFilter(col, ev) {
        ev?.stopPropagation?.();
        const meta = RANK_FILTER_COLS[col];
        if (!meta) return;
        rankFilterModal.col = col;
        if (meta.type === "text") {
          Object.assign(rankFilterDraft, { text: rankFilters[col] || "", min: null, max: null, estado: "" });
        } else if (meta.type === "estado") {
          Object.assign(rankFilterDraft, { text: "", min: null, max: null, estado: rankFilters.estado || "" });
        } else {
          Object.assign(rankFilterDraft, {
            text: "", estado: "",
            min: rankFilters[meta.minKey] ?? null,
            max: rankFilters[meta.maxKey] ?? null,
          });
        }
        rankFilterModal.open = true;
      }
      function closeRankFilter() { rankFilterModal.open = false; }
      function applyRankFilter() {
        const col = rankFilterModal.col;
        const meta = RANK_FILTER_COLS[col];
        if (!meta) { rankFilterModal.open = false; return; }
        if (meta.type === "text") rankFilters[col] = String(rankFilterDraft.text || "").trim();
        else if (meta.type === "estado") rankFilters.estado = rankFilterDraft.estado || "";
        else {
          rankFilters[meta.minKey] = rankFilterDraft.min === "" ? null : rankFilterDraft.min;
          rankFilters[meta.maxKey] = rankFilterDraft.max === "" ? null : rankFilterDraft.max;
        }
        rankFilterModal.open = false;
      }
      function clearRankFilterCol(col, ev) {
        ev?.stopPropagation?.();
        const key = col || rankFilterModal.col;
        const meta = RANK_FILTER_COLS[key];
        if (!meta) return;
        if (meta.type === "text") rankFilters[key] = "";
        else if (meta.type === "estado") rankFilters.estado = "";
        else {
          rankFilters[meta.minKey] = null;
          rankFilters[meta.maxKey] = null;
        }
        if (!col || key === rankFilterModal.col) {
          Object.assign(rankFilterDraft, { text: "", min: null, max: null, estado: "" });
          rankFilterModal.open = false;
        }
      }
      function clearAllRankFilters() {
        Object.assign(rankFilters, {
          alias: "", colonia: "", estado: "",
          totalMin: null, totalMax: null,
          preMin: null, preMax: null,
          postMin: null, postMax: null,
          tecMin: null, tecMax: null,
        });
        Object.assign(rankFilterDraft, { text: "", min: null, max: null, estado: "" });
        rankFilterModal.open = false;
      }
      const rankAnyFilterActive = computed(() =>
        Object.keys(RANK_FILTER_COLS).some((col) => rankFilterActive(col))
      );
      const rankFilterModalTitle = computed(() => {
        const meta = RANK_FILTER_COLS[rankFilterModal.col];
        return meta ? ("Filtrar: " + meta.label) : "Filtrar";
      });
      const rankFilterModalType = computed(() => RANK_FILTER_COLS[rankFilterModal.col]?.type || "text");
      const compareIds = ref([]);
      const showCompare = ref(false);
      const secs = reactive({ persona: true, dias: true, weights: false, sync: true, maps: false, cloudinary: true, ai: false, backup: false });
      const propMapEl = ref(null);
      const propTabsEl = ref(null);
      const dayMapEl = ref(null);
      const overviewMapEl = ref(null);
      const showOverviewMap = ref(false);
      const overviewMapOpts = reactive({ showPrice: true });
      const overviewSelectedId = ref(null);
      const overviewShowWork = ref(false);
      const overviewSelected = computed(() => propOf(overviewSelectedId.value) || null);
      const overviewSelectedAppt = computed(() => nextApptForProp(overviewSelectedId.value));
      const overviewSelectedFotos = computed(() => propFotos(overviewSelected.value));
      let overviewMap = null, overviewMarkers = [], overviewPriceWindows = [], overviewWorkMarker = null;

      /* AI */
      const aiOpen = ref(false);
      const aiInput = ref("");
      const aiMessages = ref([{ ...AI_WELCOME }]);
      const aiBusy = ref(false);
      const pendingActions = ref([]);
      const aiMsgs = ref(null);
      const aiSummarizing = ref(false);

      function toast(text, type = "") {
        const id = uid();
        toasts.value.push({ id, text, type });
        setTimeout(() => { toasts.value = toasts.value.filter((t) => t.id !== id); }, 3200);
      }

      function syncConfigured() {
        return !!(data.config.githubToken && String(data.config.githubToken).trim());
      }

      function normalizeSyncConfig() {
        if (data.config.githubToken) data.config.githubToken = String(data.config.githubToken).trim();
        if (data.config.gistId) data.config.gistId = String(data.config.gistId).trim();
      }

      // Nunca subir secretos al Gist: GitHub/proveedores los detectan y los revocan.
      // personaActiva es por dispositivo; tampoco se sincroniza.
      function toSyncPayload() {
        const payload = JSON.parse(JSON.stringify(data));
        if (payload.config) {
          payload.config.githubToken = "";
          payload.config.mapsKey = "";
          payload.config.openaiKey = "";
          payload.config.personaActiva = "";
        }
        return payload;
      }

      function preserveLocalSecrets(applyFn) {
        const secrets = {
          githubToken: data.config.githubToken || "",
          mapsKey: data.config.mapsKey || "",
          openaiKey: data.config.openaiKey || "",
          openaiModel: data.config.openaiModel || "gpt-4o-mini",
          personaActiva: PERSONAS.includes(data.config.personaActiva) ? data.config.personaActiva : "Brandon",
        };
        applyFn();
        data.config.githubToken = secrets.githubToken;
        data.config.mapsKey = secrets.mapsKey;
        data.config.openaiKey = secrets.openaiKey;
        data.config.personaActiva = secrets.personaActiva;
        if (!data.config.openaiModel) data.config.openaiModel = secrets.openaiModel;
      }

      function persist(opts = {}) {
        normalizeSyncConfig();
        data.updatedAt = new Date().toISOString();
        if (!opts.keepRev) data.rev = (Number(data.rev) || 0) + 1;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        if (syncConfigured()) {
          syncMeta.pending = true;
          saveSyncMeta(syncMeta);
          updateSyncLabel();
          schedulePush();
        } else {
          // Sin Gist: solo local. No marcar pendiente ni intentar subir.
          syncMeta.pending = false;
          saveSyncMeta(syncMeta);
          updateSyncLabel();
        }
      }

      function updateSyncLabel() {
        if (!syncConfigured()) {
          sync.level = "";
          sync.label = "Guardado local";
          sync.detail = "Los cambios se guardan en este dispositivo. Configura un token de GitHub para sincronizar entre equipos.";
          return;
        }
        if (!navigator.onLine) {
          sync.level = "warn";
          sync.label = syncMeta.pending ? "Sin conexión, pendiente" : "Sin conexión";
          sync.detail = "Los cambios se guardan en este dispositivo.";
          return;
        }
        if (syncMeta.pending) {
          sync.level = "warn";
          sync.label = "Pendiente de subir";
          sync.detail = "Hay cambios locales por sincronizar.";
        } else if (syncMeta.lastSyncAt) {
          const t = new Date(syncMeta.lastSyncAt);
          sync.level = "ok";
          sync.label = "Sincronizado " + t.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
          sync.detail = "";
        } else {
          sync.level = "";
          sync.label = "Guardado local";
          sync.detail = "Aún no sincronizado con Gist.";
        }
      }

      function schedulePush() {
        if (!syncConfigured()) return;
        clearTimeout(syncTimer);
        syncTimer = setTimeout(() => pushToGist(), 2000);
      }

      async function gistHeaders() {
        normalizeSyncConfig();
        return {
          Accept: "application/vnd.github+json",
          Authorization: "Bearer " + data.config.githubToken,
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        };
      }

      async function fetchRemoteGist() {
        if (!data.config.githubToken || !data.config.gistId) return null;
        const res = await fetch("https://api.github.com/gists/" + data.config.gistId, { headers: await gistHeaders() });
        if (res.status === 401 || res.status === 403) throw new Error("Token inválido o sin permiso gist.");
        if (res.status === 404) throw new Error("Gist no encontrado. Borra el Gist ID para crear uno nuevo.");
        if (!res.ok) throw new Error("Error al leer Gist (" + res.status + ")");
        const gist = await res.json();
        const file = gist.files?.[GIST_FILENAME];
        if (!file) return null;
        let content = file.content;
        if (file.truncated && file.raw_url) {
          const raw = await fetch(file.raw_url);
          content = await raw.text();
        }
        return JSON.parse(content);
      }

      async function createGist(payload) {
        const res = await fetch("https://api.github.com/gists", {
          method: "POST",
          headers: await gistHeaders(),
          body: JSON.stringify({
            description: "HomeFinder Monterrey backup",
            public: false,
            files: { [GIST_FILENAME]: { content: JSON.stringify(payload, null, 2) } },
          }),
        });
        if (!res.ok) throw new Error("No se pudo crear el Gist (" + res.status + ")");
        const gist = await res.json();
        data.config.gistId = gist.id;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return gist.id;
      }

      async function pushToGist(force = false) {
        if (!syncConfigured()) {
          updateSyncLabel();
          return;
        }
        if (!navigator.onLine) {
          updateSyncLabel();
          scheduleRetry();
          return;
        }
        sync.level = "busy";
        sync.label = "Sincronizando";
        sync.detail = "Subiendo cambios…";
        try {
          if (!data.config.gistId) {
            await createGist(toSyncPayload());
            syncMeta.knownRev = data.rev;
            syncMeta.pending = false;
            syncMeta.lastSyncAt = new Date().toISOString();
            saveSyncMeta(syncMeta);
            retryAttempt = 0;
            updateSyncLabel();
            return;
          }
          const remote = await fetchRemoteGist();
          if (remote && !force) {
            const remoteRev = Number(remote.rev) || 0;
            if (syncMeta.knownRev != null && remoteRev !== syncMeta.knownRev && remoteRev !== data.rev) {
              openConflict(remote);
              sync.level = "warn";
              sync.label = "Conflicto";
              sync.detail = "Hay una versión remota distinta.";
              return;
            }
            if (remoteRev > data.rev && syncMeta.pending) {
              openConflict(remote);
              sync.level = "warn";
              sync.label = "Conflicto";
              sync.detail = "Hay una versión remota distinta.";
              return;
            }
          }
          const res = await fetch("https://api.github.com/gists/" + data.config.gistId, {
            method: "PATCH",
            headers: await gistHeaders(),
            body: JSON.stringify({ files: { [GIST_FILENAME]: { content: JSON.stringify(toSyncPayload(), null, 2) } } }),
          });
          if (!res.ok) throw new Error("Error al subir (" + res.status + ")");
          syncMeta.knownRev = data.rev;
          syncMeta.pending = false;
          syncMeta.lastSyncAt = new Date().toISOString();
          saveSyncMeta(syncMeta);
          retryAttempt = 0;
          updateSyncLabel();
        } catch (e) {
          sync.level = "err";
          sync.label = "Error de sincronización";
          sync.detail = e.message || String(e);
          scheduleRetry();
        }
      }

      function openConflict(remote) {
        conflict.value = {
          remote,
          localMeta: `Rev ${data.rev} · ${data.properties.length} props · ${data.appointments.length} citas · ${new Date(data.updatedAt).toLocaleString("es-MX")}`,
          remoteMeta: `Rev ${remote.rev} · ${(remote.properties || []).length} props · ${(remote.appointments || []).length} citas · ${new Date(remote.updatedAt || 0).toLocaleString("es-MX")}`,
        };
      }

      function resolveConflict(choice) {
        if (!conflict.value) return;
        const remote = conflict.value.remote;
        if (choice === "local") {
          backups.value = pushBackup(remote, "Remoto descartado en conflicto");
          conflict.value = null;
          pushToGist(true);
        } else {
          backups.value = pushBackup(JSON.parse(JSON.stringify(data)), "Local descartado en conflicto");
          applyRemote(remote);
          conflict.value = null;
          syncMeta.pending = false;
          syncMeta.knownRev = data.rev;
          syncMeta.lastSyncAt = new Date().toISOString();
          saveSyncMeta(syncMeta);
          sync.level = "ok";
          updateSyncLabel();
        }
      }

      function applyRemote(remote) {
        preserveLocalSecrets(() => {
          const migrated = migrate(remote);
          data.rev = migrated.rev;
          data.updatedAt = migrated.updatedAt;
          data.properties.splice(0, data.properties.length, ...(migrated.properties || []));
          data.advisors.splice(0, data.advisors.length, ...(migrated.advisors || []));
          data.appointments.splice(0, data.appointments.length, ...(migrated.appointments || []));
          data.aiChats = normalizeAiChats(migrated.aiChats);
          Object.assign(data.config, migrated.config);
          Object.assign(data.config.ponderaciones, migrated.config.ponderaciones || {});
          Object.assign(data.config.trabajo, migrated.config.trabajo || {});
          Object.assign(data.config.apiUsage, migrated.config.apiUsage || {});
          data.config.dias.splice(0, data.config.dias.length, ...(migrated.config.dias || []));
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        if (data.config.mapsKey) ensureMaps();
        hydrateAiFromData();
      }

      async function pullFromGist(opts = {}) {
        if (!data.config.githubToken || !data.config.gistId) return;
        if (!navigator.onLine) return;
        try {
          const remote = await fetchRemoteGist();
          if (!remote) return;
          const remoteRev = Number(remote.rev) || 0;
          if (remoteRev === data.rev) {
            syncMeta.knownRev = remoteRev;
            saveSyncMeta(syncMeta);
            return;
          }
          if (syncMeta.pending && remoteRev !== syncMeta.knownRev) {
            openConflict(remote);
            return;
          }
          if (!syncMeta.pending && remoteRev > (syncMeta.knownRev ?? -1)) {
            applyRemote(remote);
            syncMeta.knownRev = data.rev;
            syncMeta.lastSyncAt = new Date().toISOString();
            saveSyncMeta(syncMeta);
            sync.level = "ok";
            updateSyncLabel();
            if (!opts.silent) toast("Datos actualizados desde Gist", "ok");
            return;
          }
          if (opts.force) {
            if (syncMeta.pending) openConflict(remote);
            else {
              applyRemote(remote);
              syncMeta.knownRev = data.rev;
              saveSyncMeta(syncMeta);
              toast("Descarga forzada aplicada", "ok");
            }
          }
        } catch (e) {
          if (!opts.silent) {
            sync.level = "err";
            sync.label = "Error de sincronización";
            sync.detail = e.message || String(e);
          }
        }
      }

      function scheduleRetry() {
        clearTimeout(retryTimer);
        const delays = [5000, 15000, 60000];
        const delay = delays[Math.min(retryAttempt, delays.length - 1)];
        retryAttempt++;
        retryTimer = setTimeout(() => pushToGist(), delay);
      }

      function retrySync() {
        if (!syncConfigured()) {
          updateSyncLabel();
          toast("Configura un token de GitHub para sincronizar", "err");
          return;
        }
        sync.level = "busy";
        sync.label = "Sincronizando";
        sync.detail = "Reintentando…";
        if (syncMeta.pending) pushToGist();
        else pullFromGist({ silent: false }).finally(() => {
          if (sync.level === "busy") updateSyncLabel();
        });
      }
      function forcePull() {
        if (!syncConfigured()) { toast("Configura un token de GitHub primero", "err"); return; }
        if (!data.config.gistId) { toast("Aún no hay Gist. Usa Forzar subida primero.", "err"); return; }
        pullFromGist({ force: true });
      }
      function forcePush() {
        if (!syncConfigured()) { toast("Configura un token de GitHub primero", "err"); return; }
        pushToGist(true);
      }

      function otraPersona(quien) {
        const p = quien || data.config.personaActiva;
        return p === "Atziri" ? "Brandon" : "Atziri";
      }
      /* Quien registra la propiedad ya cuenta como que la vio. */
      function haVisto(prop, quien) {
        if (!prop || !quien) return false;
        if (prop.registradoPor === quien) return true;
        return !!(prop.vistos && prop.vistos[quien]);
      }
      function toggleVisto(prop, quien) {
        if (!prop || !quien || prop.registradoPor === quien) return;
        normalizeProperty(prop);
        prop.vistos[quien] = prop.vistos[quien] ? null : new Date().toISOString();
        persist();
      }
      function marcarVistoYo(prop) {
        const yo = data.config.personaActiva || "Brandon";
        if (!prop) return;
        if (prop.registradoPor === yo) {
          toast(yo + " ya cuenta como vista (la registró)", "ok");
          return;
        }
        normalizeProperty(prop);
        prop.vistos[yo] = new Date().toISOString();
        persist();
        toast(yo + " marcó como vista", "ok");
      }

      /* ---------- Computed ---------- */
      const filteredProperties = computed(() => {
        const q = (propFilter.q || "").toLowerCase().trim();
        const pendiente = PERSONAS.includes(propFilter.pendienteVer) ? propFilter.pendienteVer : "";
        return data.properties.filter((p) => {
          if (propFilter.estado && p.estado !== propFilter.estado) return false;
          if (propFilter.perros && p.perros?.acepta !== propFilter.perros) return false;
          if (propFilter.registradoPor && p.registradoPor !== propFilter.registradoPor) return false;
          if (pendiente && haVisto(p, pendiente)) return false;
          if (q && !(p.alias || "").toLowerCase().includes(q) && !(p.colonia || "").toLowerCase().includes(q)) return false;
          return true;
        });
      });
      function addComentario(prop) {
        const texto = (commentForm.texto || "").trim();
        const autor = PERSONAS.includes(commentForm.autor) ? commentForm.autor : data.config.personaActiva;
        if (!prop || !texto) { toast("Escribe un comentario", "err"); return; }
        normalizeProperty(prop);
        prop.comentarios.unshift({
          id: uid(),
          autor,
          texto,
          fecha: new Date().toISOString(),
        });
        commentForm.texto = "";
        persist();
        toast("Comentario publicado", "ok");
      }
      function removeComentario(prop, id) {
        if (!prop || !confirm("¿Eliminar comentario?")) return;
        normalizeProperty(prop);
        prop.comentarios = prop.comentarios.filter((c) => c.id !== id);
        persist();
      }
      function formatCommentDate(iso) {
        if (!iso) return "";
        try {
          return new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
        } catch { return iso; }
      }
      const eligibleProperties = computed(() => data.properties.filter((p) => p.estado !== "Descartada"));
      const discardedProperties = computed(() => data.properties.filter((p) => p.estado === "Descartada"));

      const stats = computed(() => ({
        total: data.properties.length,
        contactPending: data.properties.filter((p) => ["Por revisar", "Interesante", "Contacto pendiente"].includes(p.estado)).length,
        apptRequested: data.appointments.filter((a) => a.estado === "Solicitada").length,
        apptConfirmed: data.appointments.filter((a) => a.estado === "Confirmada" || a.estado === "Reprogramada").length,
        visited: data.properties.filter((p) => p.estado === "Visitada").length,
        favorites: data.properties.filter((p) => p.favorita || p.estado === "Favorita").length,
        discarded: discardedProperties.value.length,
      }));

      const upcomingAppts = computed(() => {
        return [...data.appointments]
          .filter((a) => a.estado !== "Cancelada" && a.estado !== "Realizada")
          .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))
          .slice(0, 6);
      });
      const pendingConfirm = computed(() => data.appointments.filter((a) => a.estado === "Por solicitar" || a.estado === "Solicitada"));
      const advisorFollowups = computed(() => data.advisors.filter((a) => a.proximoSeguimiento).sort((a, b) => a.proximoSeguimiento.localeCompare(b.proximoSeguimiento)).slice(0, 5));

      function enrichScore(p) {
        const pre = scoreEval(p, "pre", data.config.ponderaciones);
        const post = scoreEval(p, "post", data.config.ponderaciones);
        const visited = p.estado === "Visitada" || p.estado === "Favorita" || post.score != null;
        const usePost = visited && post.score != null;
        return {
          ...p,
          _pre: pre.score, _prePct: pre.pct, _post: post.score, _postPct: post.pct,
          _score: usePost ? post.score : pre.score,
          _scoreKind: usePost ? "Presencial" : (pre.score != null ? "Preliminar" : null),
          _total: totalMensual(p),
          _tec: p.trasladoTrabajo?.min ?? null,
        };
      }

      const rankedProperties = computed(() => {
        let list = data.properties.map(enrichScore);
        if (rankOnlyEligible.value) list = list.filter((p) => p.estado !== "Descartada");
        const f = rankFilters;
        const qAlias = String(f.alias || "").trim().toLowerCase();
        const qCol = String(f.colonia || "").trim().toLowerCase();
        list = list.filter((p) => {
          if (qAlias && !(p.alias || "").toLowerCase().includes(qAlias)) return false;
          if (qCol && !(p.colonia || "").toLowerCase().includes(qCol)) return false;
          if (f.estado && p.estado !== f.estado) return false;
          if (!inRankRange(p._total, f.totalMin, f.totalMax)) return false;
          if (!inRankRange(p._pre, f.preMin, f.preMax)) return false;
          if (!inRankRange(p._post, f.postMin, f.postMax)) return false;
          if (!inRankRange(p._tec, f.tecMin, f.tecMax)) return false;
          return true;
        });
        const dir = rankColSort.dir === "asc" ? 1 : -1;
        const key = rankColSort.key;
        list.sort((a, b) => {
          let av, bv;
          if (key === "alias") return dir * (a.alias || "").localeCompare(b.alias || "");
          if (key === "colonia") return dir * (a.colonia || "").localeCompare(b.colonia || "");
          if (key === "estado") return dir * (a.estado || "").localeCompare(b.estado || "");
          if (key === "total") { av = a._total ?? (dir > 0 ? Infinity : -Infinity); bv = b._total ?? (dir > 0 ? Infinity : -Infinity); }
          else if (key === "pre") { av = a._pre ?? (dir > 0 ? Infinity : -Infinity); bv = b._pre ?? (dir > 0 ? Infinity : -Infinity); }
          else if (key === "post") { av = a._post ?? (dir > 0 ? Infinity : -Infinity); bv = b._post ?? (dir > 0 ? Infinity : -Infinity); }
          else if (key === "tec") { av = a._tec ?? (dir > 0 ? Infinity : -Infinity); bv = b._tec ?? (dir > 0 ? Infinity : -Infinity); }
          else { av = a._score ?? -1; bv = b._score ?? -1; }
          return dir * (av - bv);
        });
        return list;
      });
      const top5 = computed(() => rankedProperties.value.filter((p) => p.estado !== "Descartada").slice(0, 5));
      const compareProps = computed(() => compareIds.value.map((id) => data.properties.find((p) => p.id === id)).filter(Boolean));
      const weightsSum = computed(() => Object.values(data.config.ponderaciones).reduce((s, n) => s + (Number(n) || 0), 0));

      const dayAppts = computed(() => {
        return data.appointments
          .filter((a) => a.fecha === agendaDay.value && a.estado !== "Cancelada")
          .sort((a, b) => a.hora.localeCompare(b.hora));
      });
      function collectDayConflicts(list) {
        const msgs = [];
        const ids = new Set();
        const details = [];
        function pushDetail(a, kind, extra = {}) {
          if (a?.id) ids.add(a.id);
          details.push({
            id: a?.id || "",
            propertyId: a?.propertyId || "",
            alias: propName(a?.propertyId),
            estado: a?.estado || "",
            hora: a?.hora || "",
            kind,
            travelMin: extra.travelMin ?? null,
            travelFuente: extra.travelFuente || "",
            arrivesAt: extra.arrivesAt || "",
            endsAt: extra.endsAt || "",
          });
        }
        for (let i = 0; i < list.length; i++) {
          for (let j = i + 1; j < list.length; j++) {
            const a = list[i], b = list[j];
            const a0 = timeToMin(a.hora), a1 = a0 + (a.duracion || 45);
            const b0 = timeToMin(b.hora), b1 = b0 + (b.duracion || 45);
            if (a0 < b1 && b0 < a1) {
              msgs.push(`Traslape: ${propName(a.propertyId)} vs ${propName(b.propertyId)}`);
              const earlier = a0 <= b0 ? a : b;
              const later = a0 <= b0 ? b : a;
              const travel = travelBetween(earlier, later);
              const extra = travel?.min != null
                ? {
                  travelMin: travel.min,
                  travelFuente: travel.fuente === "estimado" ? "estimado" : "carro",
                  endsAt: minToTime(timeToMin(earlier.hora) + (earlier.duracion || 45)),
                  arrivesAt: minToTime(timeToMin(earlier.hora) + (earlier.duracion || 45) + travel.min),
                }
                : {};
              pushDetail(a, "traslape", extra);
              pushDetail(b, "traslape", extra);
            }
          }
        }
        for (let i = 0; i < list.length - 1; i++) {
          const a = list[i], b = list[i + 1];
          const travel = travelBetween(a, b);
          if (!travel || travel.min == null) continue;
          const aEnd = timeToMin(a.hora) + (a.duracion || 45);
          const bStart = timeToMin(b.hora);
          if (aEnd + travel.min > bStart) {
            const fuente = travel.fuente === "estimado" ? "estimado" : "carro";
            msgs.push(`No alcanzas: ${propName(a.propertyId)} → ${propName(b.propertyId)} (${travel.min} min ${fuente})`);
            const extra = {
              travelMin: travel.min,
              travelFuente: fuente,
              endsAt: minToTime(aEnd),
              arrivesAt: minToTime(aEnd + travel.min),
            };
            pushDetail(a, "traslado", extra);
            pushDetail(b, "traslado", extra);
          }
        }
        return { msgs, ids, details };
      }
      const dayConflicts = computed(() => collectDayConflicts(dayAppts.value).msgs);
      const dayConflictIds = computed(() => collectDayConflicts(dayAppts.value).ids);
      function apptHasConflict(a) {
        return !!(a?.id && dayConflictIds.value.has(a.id));
      }
      function trialApptsFromForm() {
        if (!apptForm.fecha || !apptForm.hora || !apptForm.propertyId) return [];
        const draft = {
          id: apptForm.id || "__draft__",
          propertyId: apptForm.propertyId,
          fecha: apptForm.fecha,
          hora: apptForm.hora,
          duracion: apptForm.duracion || data.config.duracionDefault || 45,
          estado: apptForm.estado || "Por solicitar",
        };
        return data.appointments
          .filter((a) => a.fecha === draft.fecha && a.estado !== "Cancelada" && a.id !== apptForm.id)
          .concat([draft])
          .sort((a, b) => String(a.hora).localeCompare(String(b.hora)));
      }
      const apptFormConflicts = computed(() => {
        if (!modals.appt) return { msgs: [], details: [], ids: new Set() };
        const trial = trialApptsFromForm();
        if (trial.length < 2) return { msgs: [], details: [], ids: new Set() };
        return collectDayConflicts(trial);
      });
      const apptFormConflictOthers = computed(() => {
        const draftId = apptForm.id || "__draft__";
        const seen = new Set();
        return (apptFormConflicts.value.details || []).filter((d) => {
          if (!d.id || d.id === draftId) return false;
          if (seen.has(d.id)) return false;
          seen.add(d.id);
          return true;
        });
      });
      function conflictTravelLine(d) {
        if (!d || d.travelMin == null) return "";
        const fuente = d.travelFuente || "carro";
        if (d.endsAt && d.arrivesAt) {
          return `Banda de traslado: ${d.travelMin} min ${fuente} (fin ${d.endsAt} → llega ~${d.arrivesAt}).`;
        }
        return `Banda de traslado: ${d.travelMin} min ${fuente}.`;
      }
      const apptResolveOptions = ref([]);
      const apptResolveBusy = ref(false);
      let apptResolveTimer = null;
      let apptResolveFingerprint = "";
      function clearApptResolve() {
        apptResolveOptions.value = [];
        apptResolveFingerprint = "";
      }
      function apptResolveKey() {
        const ids = apptFormConflictOthers.value.map((d) => d.id).sort().join(",");
        return [apptForm.fecha, apptForm.hora, apptForm.duracion, apptForm.propertyId, ids].join("|");
      }
      function resolveOptLabel(opt) {
        if (!opt) return "";
        if (opt.id === "move_new") return `Mover esta cita a ${opt.hora}`;
        const a = data.appointments.find((x) => x.id === opt.targetApptId);
        return `Mover ${propName(a?.propertyId) || "cita existente"} a ${opt.hora}`;
      }

      /* ---------- Property ops ---------- */
      function propOf(id) { return data.properties.find((p) => p.id === id); }
      function propName(id) { return propOf(id)?.alias || "Propiedad"; }
      function propFotos(p) {
        if (!p) return [];
        const raw = Array.isArray(p.fotos) ? p.fotos : [];
        return raw.map(normalizePhoto).filter(Boolean);
      }
      function propHasFotos(p) {
        return propFotos(p).length > 0;
      }
      function advisorIdForProp(p) {
        if (!p) return "";
        if (p.advisorId) return String(p.advisorId);
        const next = data.appointments
          .filter((a) => a.propertyId === p.id && a.estado !== "Cancelada" && a.advisorId)
          .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))[0];
        return next?.advisorId ? String(next.advisorId) : "";
      }
      function advisorOf(p) {
        if (!p) return null;
        const id = typeof p === "string" ? String(p) : advisorIdForProp(p);
        if (!id) return null;
        return data.advisors.find((a) => String(a.id) === id) || null;
      }
      function advisorName(id) { return data.advisors.find((a) => String(a.id) === String(id))?.nombre || "—"; }
      function apptAdvisorLine(a, prop) {
        const id = a?.advisorId || advisorIdForProp(prop) || "";
        const ad = data.advisors.find((x) => String(x.id) === String(id));
        if (!ad) return "";
        return [ad.nombre, ad.inmobiliaria].filter(Boolean).join(" · ");
      }
      function propsOfAdvisor(id) {
        if (!id) return [];
        const sid = String(id);
        const viaAppt = new Set(
          data.appointments
            .filter((a) => a.estado !== "Cancelada" && String(a.advisorId || "") === sid)
            .map((a) => a.propertyId)
            .filter(Boolean)
        );
        return data.properties.filter(
          (p) => String(p.advisorId || "") === sid || viaAppt.has(p.id)
        );
      }
      function apptsOf(pid) { return data.appointments.filter((a) => a.propertyId === pid).sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora)); }

      const propertyAssignTarget = ref(null); // "appt" | null
      function openQuickAdd(assignTarget) {
        propertyAssignTarget.value = assignTarget || null;
        Object.assign(quickForm, {
          alias: "", calle: "", numeroExt: "", numeroInt: "",
          colonia: "", municipio: "", estadoMx: "Nuevo León", cp: "",
          renta: null, enlace: "",
          registradoPor: data.config.personaActiva || "Brandon",
        });
        modals.quickAdd = true;
      }
      function closeQuickAdd() {
        modals.quickAdd = false;
        propertyAssignTarget.value = null;
      }
      function quickNewPropertyForAppt() {
        openQuickAdd("appt");
      }
      function saveQuickAdd() {
        if (!quickForm.alias && !quickForm.colonia && !quickForm.calle) {
          toast("Agrega al menos un alias, colonia o calle", "err");
          return;
        }
        const p = newProperty({
          alias: quickForm.alias || (quickForm.colonia ? "Casa " + quickForm.colonia : "Nueva propiedad"),
          calle: quickForm.calle || "",
          numeroExt: quickForm.numeroExt || "",
          numeroInt: quickForm.numeroInt || "",
          colonia: quickForm.colonia || "",
          municipio: quickForm.municipio || "",
          estadoMx: quickForm.estadoMx || "Nuevo León",
          cp: quickForm.cp || "",
          enlace: quickForm.enlace,
          registradoPor: quickForm.registradoPor || data.config.personaActiva || "Brandon",
          costos: { ...newProperty().costos, renta: quickForm.renta },
        });
        syncDireccionFromMx(p);
        data.properties.unshift(p);
        const assignToAppt = propertyAssignTarget.value === "appt";
        propertyAssignTarget.value = null;
        persist();
        modals.quickAdd = false;
        geocodeProperty(p, { silent: true });
        if (assignToAppt) {
          apptForm.propertyId = p.id;
          if (p.advisorId) apptForm.advisorId = p.advisorId;
          else onApptPropertyChange();
          toast("Propiedad creada y asignada a la cita", "ok");
          if (p.enlace) applyCoverPhoto(p, { notify: true });
          return;
        }
        toast("Propiedad registrada", "ok");
        if (p.enlace) applyCoverPhoto(p, { notify: true });
        openProperty(p.id);
      }

      function openProperty(id) {
        const p = propOf(id);
        if (!p) return;
        // Ensure nested structures
        if (!p.costos) p.costos = newProperty().costos;
        if (!p.fisicas) p.fisicas = newProperty().fisicas;
        if (!p.espacios) p.espacios = newProperty().espacios;
        if (!p.amenidades) p.amenidades = newProperty().amenidades;
        if (!p.amenidades.items) p.amenidades.items = {};
        if (!p.perros) p.perros = newProperty().perros;
        if (!p.requisitos) p.requisitos = { items: defaultReqs(), duracionContrato: "", condiciones: "" };
        if (!p.evaluacion) p.evaluacion = newProperty().evaluacion;
        if (!p.evaluacion.pre.scores) p.evaluacion.pre.scores = emptyScores();
        if (!p.evaluacion.post.scores) p.evaluacion.post.scores = emptyScores();
        if (!p.servicios) p.servicios = {};
        if (!p.travelCache) p.travelCache = {};
        normalizeProperty(p);
        editingProp.value = p;
        propTab.value = "resumen";
        commentForm.autor = data.config.personaActiva || "Brandon";
        commentForm.texto = "";
        Object.assign(manualTravel, { min: p.trasladoTrabajo?.min ?? null, km: p.trasladoTrabajo?.km ?? null });
        galleryAddOpen.value = false;
        modals.property = true;
        nextTick(() => { if (propTab.value === "ubicacion") renderPropMap(); });
      }
      function closeProperty() {
        if (photoMode.propertyId && editingProp.value?.id === photoMode.propertyId) endPhotoMode();
        galleryAddOpen.value = false;
        modals.property = false;
        editingProp.value = null;
      }
      function saveEditingProp() {
        if (!editingProp.value) return;
        const idx = data.properties.findIndex((p) => p.id === editingProp.value.id);
        if (idx >= 0) data.properties[idx] = editingProp.value;
        persist();
      }
      function onPropTab(id) {
        nextTick(() => {
          const root = propTabsEl.value;
          const btn = root?.querySelector?.(`.tab[data-tab="${id}"]`);
          btn?.scrollIntoView?.({ inline: "center", block: "nearest", behavior: "smooth" });
          if (id === "ubicacion" && mapsReady.value) renderPropMap();
        });
      }
      function mapQuery(p) {
        if (!p) return "";
        if (p.lat != null && p.lng != null) return `${p.lat},${p.lng}`;
        const composed = formatDireccionMX(p);
        if (composed) return composed;
        return [p.direccion, p.colonia, "Monterrey", "Nuevo León"].filter(Boolean).join(", ");
      }
      let geocodeDebounceTimer = null;
      function saveMxAddress() {
        if (!editingProp.value) return;
        syncDireccionFromMx(editingProp.value);
        saveEditingProp();
        clearTimeout(geocodeDebounceTimer);
        geocodeDebounceTimer = setTimeout(() => {
          geocodeProperty(editingProp.value, { silent: true });
        }, 500);
      }
      function duplicateProp(p) {
        const copy = JSON.parse(JSON.stringify(p));
        copy.id = uid();
        copy.alias = (p.alias || "Propiedad") + " (copia)";
        copy.createdAt = new Date().toISOString();
        data.properties.unshift(copy);
        persist();
        toast("Propiedad duplicada", "ok");
        openProperty(copy.id);
      }
      function deleteProp(id) {
        if (!confirm("¿Eliminar esta propiedad?")) return;
        data.properties = data.properties.filter((p) => p.id !== id);
        data.appointments = data.appointments.filter((a) => a.propertyId !== id);
        persist();
        closeProperty();
        toast("Eliminada");
      }
      function changeEstado(p, estado) {
        if (estado === "Descartada" && p.estado !== "Descartada") {
          discardForm.propertyId = p.id;
          discardForm.motivo = "decision";
          discardForm.nota = "";
          modals.discard = true;
          return;
        }
        if (estado !== "Descartada" && p.estado === "Descartada") {
          p.descarte = null;
        }
        p.estado = estado;
        if (estado === "Favorita") p.favorita = true;
        persist();
        if (editingProp.value?.id === p.id) editingProp.value.estado = estado;
      }
      function confirmDiscard() {
        const p = propOf(discardForm.propertyId);
        if (!p) return;
        p.descarte = {
          motivo: discardForm.motivo,
          nota: discardForm.nota,
          fecha: new Date().toISOString().slice(0, 10),
          estadoPrevio: p.estado === "Descartada" ? (p.descarte?.estadoPrevio || "Por revisar") : p.estado,
        };
        p.estado = "Descartada";
        persist();
        modals.discard = false;
        toast("Propiedad descartada");
      }
      function onPerrosChange() {
        const p = editingProp.value;
        if (!p) return;
        if (p.perros.acepta === "no") {
          if (p.estado !== "Descartada") {
            p.descarte = {
              motivo: "mascotas",
              nota: "No acepta ambos perros",
              fecha: new Date().toISOString().slice(0, 10),
              estadoPrevio: p.estado,
            };
            p.estado = "Descartada";
          } else if (!p.descarte) {
            p.descarte = { motivo: "mascotas", nota: "No acepta ambos perros", fecha: new Date().toISOString().slice(0, 10), estadoPrevio: "Por revisar" };
          }
        } else if (p.estado === "Descartada" && p.descarte?.motivo === "mascotas") {
          p.estado = p.descarte.estadoPrevio || "Por revisar";
          p.descarte = null;
          toast("Descarte por mascotas revertido", "ok");
        }
        saveEditingProp();
      }
      function setTri(obj, key, val) { obj[key] = val; saveEditingProp(); }
      function setScore(kind, key, n) {
        editingProp.value.evaluacion[kind].scores[key] = n;
        saveEditingProp();
      }
      function photoFromUrl(imgUrl) {
        if (!imgUrl) return null;
        let abs = String(imgUrl).trim();
        if (abs.startsWith("//")) abs = "https:" + abs;
        if (!/^https?:\/\//i.test(abs)) return null;
        return { id: uid(), url: abs, thumb: abs, fuente: "anuncio", addedAt: new Date().toISOString() };
      }

      function extractOgImage(html) {
        if (!html) return null;
        const patterns = [
          /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
          /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
          /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
          /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
        ];
        for (const re of patterns) {
          const m = html.match(re);
          if (m?.[1]) return m[1];
        }
        return null;
      }

      async function fetchCoverViaMicrolink(raw) {
        const endpoint = "https://api.microlink.io/?url=" + encodeURIComponent(raw);
        const res = await fetch(endpoint);
        const json = await res.json().catch(() => ({}));
        if (json.status === "success") {
          const img = json.data?.image;
          const imgUrl = typeof img === "string" ? img : (img?.url || null);
          return { ok: !!imgUrl, imgUrl, antibot: false, message: imgUrl ? "" : "Sin imagen en la vista previa" };
        }
        const antibot = json.code === "EPROXYNEEDED" || /antibot/i.test(JSON.stringify(json.data || {}));
        return {
          ok: false,
          imgUrl: null,
          antibot,
          message: antibot
            ? "Este portal bloquea la extracción automática (antibot)."
            : (json.message || json.data?.url || "Microlink no pudo leer el anuncio"),
        };
      }

      async function fetchCoverViaHtmlProxy(raw) {
        // Respaldo: leer HTML vía proxy público y sacar og:image
        const proxies = [
          (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
          (u) => "https://corsproxy.io/?" + encodeURIComponent(u),
        ];
        let lastErr = "";
        for (const make of proxies) {
          try {
            const res = await fetch(make(raw), { signal: AbortSignal.timeout?.(20000) });
            if (!res.ok) { lastErr = "proxy " + res.status; continue; }
            const html = await res.text();
            const img = extractOgImage(html);
            if (img) return { ok: true, imgUrl: img, message: "" };
            lastErr = "sin og:image";
          } catch (e) {
            lastErr = e.message || "proxy falló";
          }
        }
        return { ok: false, imgUrl: null, message: lastErr };
      }

      async function fetchCoverFromEnlace(url) {
        const raw = String(url || "").trim();
        if (!/^https?:\/\//i.test(raw)) return null;

        const primary = await fetchCoverViaMicrolink(raw);
        if (primary.ok) return photoFromUrl(primary.imgUrl);

        // Si Microlink falla (p. ej. Pincali antibot), intentar HTML
        const fallback = await fetchCoverViaHtmlProxy(raw);
        if (fallback.ok) return photoFromUrl(fallback.imgUrl);

        if (primary.antibot) {
          throw new Error(
            "Este sitio (p. ej. Pincali) bloquea la extracción automática. Abre el anuncio, clic derecho en una foto → «Copiar dirección de imagen» y pégala en Agregar URL."
          );
        }
        throw new Error(primary.message || fallback.message || "No se pudo obtener la foto del anuncio");
      }

      async function applyCoverPhoto(prop, opts = {}) {
        const force = !!opts.force;
        if (!prop?.enlace) {
          if (force) toast("Agrega el enlace del anuncio primero", "err");
          return false;
        }
        normalizeProperty(prop);
        const hasAnuncio = (prop.fotos || []).some((f) => f.fuente === "anuncio");
        if (hasAnuncio && !force && (prop.fotos || []).length) return false;
        photoBusy.value = true;
        try {
          const cover = await fetchCoverFromEnlace(prop.enlace);
          if (!cover) {
            if (force) toast("No se encontró imagen en el anuncio", "err");
            return false;
          }
          prop.fotos = prop.fotos || [];
          const sameUrlIdx = prop.fotos.findIndex((f) => f.url === cover.url);
          if (sameUrlIdx === 0) {
            prop.fotos[0].fuente = "anuncio";
            persist();
            return true;
          }
          // Quitar portada de anuncio previa si se fuerza / actualizar
          prop.fotos = prop.fotos.filter((f) => f.fuente !== "anuncio" && f.url !== cover.url);
          prop.fotos.unshift(cover);
          persist();
          if (force || opts.notify) toast("Foto del anuncio agregada", "ok");
          return true;
        } catch (e) {
          if (force || opts.notify) toast(e.message || "Error al obtener foto", "err");
          return false;
        } finally {
          photoBusy.value = false;
        }
      }

      function onEnlaceChange() {
        saveEditingProp();
        const p = editingProp.value;
        if (!p?.enlace) return;
        const hasAnuncio = (p.fotos || []).some((f) => f.fuente === "anuncio");
        if (!hasAnuncio) applyCoverPhoto(p, { notify: true });
      }

      function addPhotoUrl() {
        if (!photoUrl.value.trim() || !editingProp.value) return;
        normalizeProperty(editingProp.value);
        const url = photoUrl.value.trim();
        if ((editingProp.value.fotos || []).some((f) => f.url === url)) {
          toast("Esa foto ya está en la galería", "err");
          return;
        }
        editingProp.value.fotos.push({
          id: uid(), url, thumb: url, fuente: "manual", addedAt: new Date().toISOString(),
        });
        photoUrl.value = "";
        saveEditingProp();
      }

      function cloudinaryConfigured() {
        return !!(String(data.config.cloudinaryCloud || "").trim() && String(data.config.cloudinaryPreset || "").trim());
      }

      function requireCloudinary() {
        if (cloudinaryConfigured()) return true;
        toast("Configura Cloudinary en Ajustes → Fotos", "err");
        view.value = "settings";
        secs.cloudinary = true;
        return false;
      }

      function cloudinaryThumb(secureUrl) {
        if (!secureUrl || !String(secureUrl).includes("/upload/")) return secureUrl;
        return String(secureUrl).replace("/upload/", "/upload/c_fill,w_480,h_360,q_auto,f_auto/");
      }

      function prepareImage(file, opts = {}) {
        const crop = !!opts.crop;
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
          reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error("Imagen inválida"));
            img.onload = () => {
              let sx = 0, sy = 0, sw = img.width, sh = img.height;
              const ratio = sh / Math.max(sw, 1);
              if (crop && ratio > 1.9) {
                sy = Math.round(sh * 0.10);
                const bottom = Math.round(sh * 0.08);
                sh = Math.max(1, sh - sy - bottom);
              }
              const maxSide = 1600;
              const scale = Math.min(1, maxSide / Math.max(sw, sh));
              const cw = Math.max(1, Math.round(sw * scale));
              const ch = Math.max(1, Math.round(sh * scale));
              const canvas = document.createElement("canvas");
              canvas.width = cw;
              canvas.height = ch;
              const ctx = canvas.getContext("2d");
              ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
              canvas.toBlob(
                (blob) => {
                  if (!blob) reject(new Error("No se pudo comprimir"));
                  else resolve(blob);
                },
                "image/jpeg",
                0.82
              );
            };
            img.src = reader.result;
          };
          reader.readAsDataURL(file);
        });
      }

      async function uploadToCloudinary(blob) {
        const cloud = String(data.config.cloudinaryCloud || "").trim();
        const preset = String(data.config.cloudinaryPreset || "").trim();
        if (!cloud || !preset) throw new Error("Cloudinary no configurado");
        const form = new FormData();
        form.append("file", blob, "photo.jpg");
        form.append("upload_preset", preset);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`, {
          method: "POST",
          body: form,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error?.message || "Error al subir a Cloudinary (" + res.status + ")");
        if (!json.secure_url) throw new Error("Cloudinary no devolvió URL");
        return json.secure_url;
      }

      async function addFiles(prop, fileList, fuente, opts = {}) {
        if (!prop || !fileList?.length) return;
        if (!requireCloudinary()) return;
        normalizeProperty(prop);
        const files = Array.from(fileList).filter((f) => f && f.type && f.type.startsWith("image/"));
        if (!files.length) {
          toast("No se seleccionaron imágenes", "err");
          return;
        }
        const crop = fuente === "captura" ? (opts.crop !== false && photoMode.cropBars) : false;
        uploadProgress.active = true;
        uploadProgress.current = 0;
        uploadProgress.total = files.length;
        uploadProgress.label = "Subiendo…";
        photoBusy.value = true;
        let ok = 0;
        const errors = [];
        try {
          for (let i = 0; i < files.length; i++) {
            uploadProgress.current = i + 1;
            uploadProgress.label = `${i + 1} de ${files.length}`;
            try {
              const blob = await prepareImage(files[i], { crop });
              const secureUrl = await uploadToCloudinary(blob);
              prop.fotos.push({
                id: uid(),
                url: secureUrl,
                thumb: cloudinaryThumb(secureUrl),
                fuente: PHOTO_FUENTES.includes(fuente) ? fuente : "subida",
                addedAt: new Date().toISOString(),
              });
              ok++;
            } catch (e) {
              errors.push((files[i].name || ("foto " + (i + 1))) + ": " + (e.message || "falló"));
            }
          }
          if (ok) persist();
          if (ok && !errors.length) toast(ok === 1 ? "1 foto agregada" : ok + " fotos agregadas", "ok");
          else if (ok && errors.length) toast(`Se agregaron ${ok}. Fallaron ${errors.length}.`, "err");
          else if (errors.length) toast(errors[0], "err");
        } finally {
          uploadProgress.active = false;
          uploadProgress.current = 0;
          uploadProgress.total = 0;
          uploadProgress.label = "";
          photoBusy.value = false;
        }
      }

      function toggleGalleryAdd() {
        galleryAddOpen.value = !galleryAddOpen.value;
      }

      function chooseGalleryPhone() {
        galleryAddOpen.value = false;
        pickUploads();
      }

      function chooseGalleryListing() {
        galleryAddOpen.value = false;
        startPhotoMode(editingProp.value);
      }

      function startPhotoMode(prop) {
        if (!prop?.enlace) {
          toast("Agrega el enlace del anuncio primero", "err");
          return;
        }
        if (!requireCloudinary()) return;
        photoMode.propertyId = prop.id;
        window.open(prop.enlace, "_blank", "noopener");
        toast("Toma capturas y vuelve aquí a Elegir capturas", "ok");
      }

      function endPhotoMode() {
        photoMode.propertyId = null;
      }

      function pickCaptures() {
        if (!photoMode.propertyId) return;
        if (!requireCloudinary()) return;
        captureInputEl.value?.click?.();
      }

      function pickUploads() {
        if (!editingProp.value) return;
        if (!requireCloudinary()) return;
        uploadInputEl.value?.click?.();
      }

      function onCaptureFilesSelected(ev) {
        const files = ev.target?.files;
        const prop = propOf(photoMode.propertyId) || editingProp.value;
        if (files?.length && prop) addFiles(prop, files, "captura", { crop: photoMode.cropBars });
        if (ev.target) ev.target.value = "";
      }

      function onUploadFilesSelected(ev) {
        const files = ev.target?.files;
        if (files?.length && editingProp.value) addFiles(editingProp.value, files, "subida", { crop: false });
        if (ev.target) ev.target.value = "";
      }

      function removePhoto(prop, id) {
        if (!prop) return;
        normalizeProperty(prop);
        prop.fotos = prop.fotos.filter((f) => f.id !== id);
        if (lightbox.open && lightbox.propertyId === prop.id) {
          if (!prop.fotos.length) closeLightbox();
          else lightbox.index = Math.min(lightbox.index, prop.fotos.length - 1);
        }
        persist();
      }

      function setCoverPhoto(prop, id) {
        if (!prop) return;
        normalizeProperty(prop);
        const idx = prop.fotos.findIndex((f) => f.id === id);
        if (idx <= 0) return;
        const [foto] = prop.fotos.splice(idx, 1);
        prop.fotos.unshift(foto);
        persist();
        toast("Portada actualizada", "ok");
      }

      function openLightbox(prop, index) {
        if (!prop) return;
        normalizeProperty(prop);
        if (!propHasFotos(prop)) return;
        lightbox.open = true;
        lightbox.propertyId = prop.id;
        lightbox.index = Math.max(0, Math.min(index || 0, prop.fotos.length - 1));
      }
      function closeLightbox() {
        lightbox.open = false;
        lightbox.propertyId = null;
        lightbox.index = 0;
      }
      function lightboxPhotos() {
        const p = propOf(lightbox.propertyId);
        return p?.fotos || [];
      }
      function lightboxPrev() {
        const n = lightboxPhotos().length;
        if (!n) return;
        lightbox.index = (lightbox.index - 1 + n) % n;
      }
      function lightboxNext() {
        const n = lightboxPhotos().length;
        if (!n) return;
        lightbox.index = (lightbox.index + 1) % n;
      }
      function addCustomReq() {
        if (!newReqName.value.trim()) return;
        editingProp.value.requisitos.items.push({
          id: uid(), nombre: newReqName.value.trim(), estado: "pendiente", costo: null, fechaLimite: "", notas: "", custom: true,
        });
        newReqName.value = "";
        saveEditingProp();
      }
      function removeReq(id) {
        editingProp.value.requisitos.items = editingProp.value.requisitos.items.filter((r) => r.id !== id);
        saveEditingProp();
      }
      function reqProgress(p) {
        const items = p?.requisitos?.items || [];
        if (!items.length) return 0;
        const relevant = items.filter((r) => r.estado !== "na" && r.estado !== "no_solicitado");
        if (!relevant.length) return 0;
        const done = relevant.filter((r) => r.estado === "cumplido").length;
        return Math.round((done / relevant.length) * 100);
      }
      function toggleReqOpen(id) { openReqs[id] = !openReqs[id]; }
      function tabBadge(p, id) {
        if (!p) return "";
        if (id === "costos") return totalMensual(p) ? "✓" : "";
        if (id === "mascotas") return p.perros?.acepta === "si" ? "OK" : p.perros?.acepta === "no" ? "✕" : "?";
        if (id === "requisitos") {
          const pct = reqProgress(p);
          return pct ? pct + "%" : "";
        }
        if (id === "ubicacion") return p.trasladoTrabajo?.min != null ? p.trasladoTrabajo.min + "m" : (p.lat != null ? "✓" : "");
        if (id === "eval") {
          const pre = scoreEval(p, "pre", data.config.ponderaciones).score;
          const post = scoreEval(p, "post", data.config.ponderaciones).score;
          const s = post ?? pre;
          return s != null ? s.toFixed(1) : "";
        }
        if (id === "citas") {
          const n = apptsOf(p.id).length;
          return n ? String(n) : "";
        }
        return "";
      }
      function quickNewAdvisor() {
        openAdvisorForm(null, "property");
      }

      /* ---------- Advisors ---------- */
      function openAdvisorForm(ad, assignTarget) {
        advisorAssignTarget.value = assignTarget || null;
        const base = ad
          ? normalizeAdvisor(JSON.parse(JSON.stringify(ad)))
          : newAdvisor({ registradoPor: data.config.personaActiva || "Brandon" });
        Object.assign(advisorForm, base);
        modals.advisor = true;
      }
      function closeAdvisorForm() {
        modals.advisor = false;
        advisorAssignTarget.value = null;
      }
      function applyAdvisorAssign(adId) {
        const target = advisorAssignTarget.value;
        advisorAssignTarget.value = null;
        if (!adId || !target) return;
        if (target === "property" && editingProp.value) {
          editingProp.value.advisorId = adId;
          saveEditingProp();
          toast("Asesor creado y asignado", "ok");
          return;
        }
        if (target === "appt") {
          apptForm.advisorId = adId;
          const p = propOf(apptForm.propertyId);
          if (p && !p.advisorId) {
            p.advisorId = adId;
            if (editingProp.value?.id === p.id) editingProp.value.advisorId = adId;
          }
          persist();
          toast("Asesor creado y asignado a la cita", "ok");
        }
      }
      function saveAdvisor() {
        if (!advisorForm.nombre.trim()) { toast("Nombre requerido", "err"); return; }
        const idx = data.advisors.findIndex((a) => a.id === advisorForm.id);
        const copy = JSON.parse(JSON.stringify(advisorForm));
        if (idx >= 0) data.advisors[idx] = copy;
        else data.advisors.push(copy);
        persist();
        modals.advisor = false;
        if (advisorAssignTarget.value) applyAdvisorAssign(copy.id);
        else toast("Asesor guardado", "ok");
      }
      function deleteAdvisor(id) {
        if (!confirm("¿Eliminar asesor?")) return;
        data.advisors = data.advisors.filter((a) => a.id !== id);
        data.properties.forEach((p) => { if (p.advisorId === id) p.advisorId = ""; });
        persist();
        closeAdvisorForm();
      }
      function addAdvisorNote(ad) {
        const texto = prompt("Nota de conversación:");
        if (!texto) return;
        ad.bitacora = ad.bitacora || [];
        ad.bitacora.unshift({ fecha: new Date().toISOString().slice(0, 10), texto, pendiente: false });
        ad.ultimoContacto = new Date().toISOString().slice(0, 10);
        persist();
      }

      /* ---------- Appointments ---------- */
      const apptMenuId = ref(null);
      function toggleApptMenu(id) {
        apptMenuId.value = apptMenuId.value === id ? null : id;
      }
      function editApptFromMenu(a) {
        apptMenuId.value = null;
        openApptForm(a);
      }
      function deleteApptFromMenu(id) {
        apptMenuId.value = null;
        deleteAppt(id);
      }
      function openApptForm(a) {
        apptMenuId.value = null;
        clearApptResolve();
        apptResolveBusy.value = false;
        const base = newAppt({
          fecha: agendaDay.value,
          duracion: data.config.duracionDefault || 45,
        });
        Object.assign(apptForm, a ? { ...base, ...JSON.parse(JSON.stringify(a)) } : base);
        if (a?.propertyId && !a.id) apptForm.propertyId = a.propertyId;
        if (apptForm.propertyId && !apptForm.advisorId) {
          apptForm.advisorId = propOf(apptForm.propertyId)?.advisorId || "";
        }
        modals.appt = true;
      }
      function onApptPropertyChange() {
        if (!apptForm.advisorId && apptForm.propertyId) {
          apptForm.advisorId = propOf(apptForm.propertyId)?.advisorId || "";
        }
        clearApptResolve();
      }
      function quickNewAdvisorForAppt() {
        openAdvisorForm(null, "appt");
      }
      function commitAppt(copy) {
        const idx = data.appointments.findIndex((a) => a.id === copy.id);
        if (idx >= 0) data.appointments[idx] = copy;
        else data.appointments.push(copy);
        const p = propOf(copy.propertyId);
        if (p) {
          if (copy.advisorId && !p.advisorId) {
            p.advisorId = copy.advisorId;
            if (editingProp.value?.id === p.id) editingProp.value.advisorId = copy.advisorId;
          }
          if (p.estado !== "Descartada") {
            if (copy.estado === "Confirmada" || copy.estado === "Reprogramada") p.estado = "Cita confirmada";
            else if (copy.estado === "Solicitada" && !["Cita confirmada", "Visitada", "Favorita"].includes(p.estado)) p.estado = "Cita solicitada";
            else if (copy.estado === "Realizada" && !["Favorita"].includes(p.estado)) p.estado = "Visitada";
          }
        }
        persist();
        apptResolveOptions.value = [];
        modals.appt = false;
        toast("Cita guardada", "ok");
        nextTick(() => renderDayMap());
      }
      function ceilTo5(min) {
        return Math.ceil(min / 5) * 5;
      }
      function localApptResolveOptions(draft, others) {
        const day = data.config.dias.find((d) => d.fecha === draft.fecha);
        const dur = draft.duracion || data.config.duracionDefault || 45;
        const dayStart = timeToMin(day?.desde || "09:00");
        const dayEnd = timeToMin(day?.hasta || "20:00");
        const options = [];
        const sorted = [...others].sort((a, b) => String(a.hora).localeCompare(String(b.hora)));

        function fits(horaMin, excludeId) {
          const probe = { ...draft, hora: minToTime(horaMin), id: draft.id || "__draft__" };
          const trial = data.appointments
            .filter((a) => a.fecha === draft.fecha && a.estado !== "Cancelada" && a.id !== draft.id && a.id !== excludeId)
            .concat([probe])
            .sort((a, b) => String(a.hora).localeCompare(String(b.hora)));
          return collectDayConflicts(trial).details.length === 0;
        }

        let cursor = dayStart;
        if (fits(cursor)) {
          options.push({
            id: "move_new",
            targetApptId: null,
            fecha: draft.fecha,
            hora: minToTime(cursor),
            reason: "Inicio de la ventana del día",
            travelMinExtra: 0,
          });
        }
        for (const o of sorted) {
          const oDur = o.duracion || 45;
          const travel = travelBetween(o, draft) || { min: 5, fuente: "estimado" };
          cursor = ceilTo5(timeToMin(o.hora) + oDur + travel.min);
          const fuente = travel.fuente === "estimado" ? "estimado" : "carro";
          if (cursor + dur <= dayEnd && fits(cursor)) {
            options.push({
              id: "move_new",
              targetApptId: null,
              fecha: draft.fecha,
              hora: minToTime(cursor),
              reason: `Tras ${o.hora} · ${oDur} min + ${travel.min} min ${fuente}`,
              travelMinExtra: travel.min || 0,
            });
          }
          if (options.length >= 2) break;
        }
        for (const o of sorted.slice(0, 2)) {
          const travel = travelBetween(draft, o) || { min: 5, fuente: "estimado" };
          let moveAt = ceilTo5(timeToMin(draft.hora) + dur + travel.min);
          if (moveAt + (o.duracion || 45) > dayEnd) continue;
          const probeExisting = { ...o, hora: minToTime(moveAt) };
          const trial = data.appointments
            .filter((a) => a.fecha === draft.fecha && a.estado !== "Cancelada" && a.id !== o.id && a.id !== draft.id)
            .concat([draft, probeExisting])
            .sort((a, b) => String(a.hora).localeCompare(String(b.hora)));
          if (collectDayConflicts(trial).details.length) continue;
          const fuente = travel.fuente === "estimado" ? "estimado" : "carro";
          options.push({
            id: "move_existing",
            targetApptId: o.id,
            fecha: draft.fecha,
            hora: minToTime(moveAt),
            reason: `+${travel.min} min ${fuente} · deja esta cita a las ${draft.hora}`,
            travelMinExtra: travel.min || 0,
          });
        }
        return options.slice(0, 3);
      }
      async function suggestApptResolve(opts = {}) {
        const quiet = !!opts.quiet;
        if (!apptForm.propertyId || !apptForm.fecha || !apptForm.hora) return;
        const fpAtStart = apptResolveKey();
        apptResolveBusy.value = true;
        if (!quiet) apptResolveOptions.value = [];
        try {
          await calcDayTravel(apptForm.fecha, {
            silent: true,
            extraPropertyIds: [apptForm.propertyId],
          });
          const draft = {
            id: apptForm.id || "__draft__",
            propertyId: apptForm.propertyId,
            fecha: apptForm.fecha,
            hora: apptForm.hora,
            duracion: apptForm.duracion || data.config.duracionDefault || 45,
            estado: apptForm.estado || "Por solicitar",
          };
          const others = data.appointments.filter(
            (a) => a.fecha === draft.fecha && a.estado !== "Cancelada" && a.id !== apptForm.id
          );
          const pDraft = propOf(draft.propertyId);
          let options = null;
          if (data.config.openaiKey) {
            try {
              const travels = [];
              const props = [pDraft, ...others.map((a) => propOf(a.propertyId))].filter(Boolean);
              for (let i = 0; i < props.length; i++) {
                for (let j = 0; j < props.length; j++) {
                  if (i === j) continue;
                  const t = getTravel(props[i], props[j]) || (() => {
                    const km = haversineKm(props[i], props[j]);
                    return km == null ? null : { min: Math.max(5, Math.round(km * 2.5)), fuente: "estimado" };
                  })();
                  if (t?.min != null) {
                    travels.push({
                      from: props[i].id,
                      to: props[j].id,
                      min: t.min,
                      fuente: t.fuente === "estimado" ? "estimado" : "carro",
                    });
                  }
                }
              }
              const day = data.config.dias.find((d) => d.fecha === draft.fecha);
              const ctx = {
                ventana: day ? { desde: day.desde, hasta: day.hasta } : null,
                reglaHueco: "horaMinimaSiguiente = horaCita + duracion + minutosTrasladoCarro (usar trasladosMin; NO agregar margen extra)",
                nueva: {
                  propertyId: draft.propertyId,
                  alias: pDraft?.alias || "",
                  colonia: pDraft?.colonia || "",
                  lat: pDraft?.lat ?? null,
                  lng: pDraft?.lng ?? null,
                  horaDeseada: draft.hora,
                  duracion: draft.duracion,
                  fecha: draft.fecha,
                },
                existentes: others.map((a) => {
                  const p = propOf(a.propertyId);
                  return {
                    id: a.id, propertyId: a.propertyId, estado: a.estado, hora: a.hora,
                    duracion: a.duracion || 45, alias: p?.alias || "", colonia: p?.colonia || "",
                    lat: p?.lat ?? null, lng: p?.lng ?? null,
                  };
                }),
                trasladosMin: travels,
              };
              const content = await askAI([
                {
                  role: "system",
                  content: `Eres el asistente de agenda de HomeFinder. Hay un conflicto de horario/traslado.
Responde SOLO JSON válido (sin markdown): {"options":[{"id":"move_new"|"move_existing","targetApptId":null|"id","fecha":"YYYY-MM-DD","hora":"HH:MM","reason":"texto corto","travelMinExtra":0}]}.
Máximo 3 opciones. move_new = reubicar la cita nueva. move_existing = reubicar una existente (targetApptId) para liberar el horario deseado de la nueva.
La hora mínima después de una cita es exactamente hora+duracion+traslado en carro de trasladosMin. NO inventes ni agregues margen extra. Preferir fuente carro sobre estimado. Minimiza traslados y respeta la ventana del día. No inventes ids.`,
                },
                { role: "user", content: JSON.stringify(ctx) },
              ]);
              const parsed = JSON.parse(String(content || "").replace(/```json|```/g, "").trim());
              if (Array.isArray(parsed?.options) && parsed.options.length) {
                options = parsed.options
                  .filter((o) => o && (o.id === "move_new" || o.id === "move_existing") && o.hora)
                  .map((o) => ({
                    id: o.id,
                    targetApptId: o.id === "move_existing" ? (o.targetApptId || null) : null,
                    fecha: o.fecha || draft.fecha,
                    hora: o.hora,
                    reason: o.reason || "",
                    travelMinExtra: Number(o.travelMinExtra) || 0,
                  }))
                  .slice(0, 3);
              }
            } catch {
              options = null;
            }
          }
          if (!options || !options.length) options = localApptResolveOptions(draft, others);
          if (fpAtStart === apptResolveKey()) {
            apptResolveOptions.value = options || [];
            apptResolveFingerprint = fpAtStart;
            if (!quiet && !apptResolveOptions.value.length) {
              toast("No hay hueco libre sugerido ese día", "err");
            }
          }
        } finally {
          apptResolveBusy.value = false;
        }
      }
      function applyApptResolve(opt) {
        if (!opt) return;
        if (opt.id === "move_new") {
          if (opt.fecha) apptForm.fecha = opt.fecha;
          if (opt.hora) apptForm.hora = opt.hora;
          clearApptResolve();
          toast("Horario de esta cita ajustado — revisa y guarda", "ok");
          return;
        }
        if (opt.id === "move_existing" && opt.targetApptId) {
          const existing = data.appointments.find((a) => a.id === opt.targetApptId);
          if (!existing) { toast("No se encontró la cita a mover", "err"); return; }
          existing.hora = opt.hora;
          if (opt.fecha) existing.fecha = opt.fecha;
          persist();
          apptResolveOptions.value = [];
          const copy = JSON.parse(JSON.stringify(apptForm));
          const trial = data.appointments
            .filter((a) => a.fecha === copy.fecha && a.estado !== "Cancelada" && a.id !== copy.id)
            .concat([copy])
            .sort((a, b) => String(a.hora).localeCompare(String(b.hora)));
          if (collectDayConflicts(trial).details.length) {
            toast("Aún hay conflicto — elige otra opción o cambia la hora", "err");
            return;
          }
          commitAppt(copy);
          return;
        }
      }
      async function saveAppt() {
        if (!apptForm.propertyId || !apptForm.fecha || !apptForm.hora) {
          toast("Propiedad, fecha y hora son requeridos", "err"); return;
        }
        if (!apptForm.advisorId) apptForm.advisorId = propOf(apptForm.propertyId)?.advisorId || "";
        const copy = JSON.parse(JSON.stringify(apptForm));
        await calcDayTravel(copy.fecha, { silent: true });
        const trial = data.appointments
          .filter((a) => a.fecha === copy.fecha && a.estado !== "Cancelada" && a.id !== copy.id)
          .concat([copy])
          .sort((a, b) => String(a.hora).localeCompare(String(b.hora)));
        const conflicts = collectDayConflicts(trial);
        if (conflicts.details.length) {
          const seen = new Set();
          const lines = [];
          for (const d of conflicts.details) {
            if (!d.id || d.id === copy.id) continue;
            if (seen.has(d.id)) continue;
            seen.add(d.id);
            lines.push(`Ya hay una cita ${d.estado} a las ${d.hora} (${d.alias}).`);
            const travelLine = conflictTravelLine(d);
            if (travelLine) lines.push(travelLine);
          }
          if (!lines.length) lines.push("Hay traslape o no alcanza el traslado con otra cita.");
          alert(lines.join("\n") + "\n\nNo se pueden guardar dos eventos que se encimen.");
          if (!apptResolveOptions.value.length) await suggestApptResolve();
          return;
        }
        commitAppt(copy);
      }
      function deleteAppt(id) {
        if (!confirm("¿Eliminar cita?")) return;
        data.appointments = data.appointments.filter((a) => a.id !== id);
        persist();
        modals.appt = false;
      }

      function apptClass(a) {
        if (a.estado === "Confirmada" || a.estado === "Reprogramada") return "confirmed";
        if (a.estado === "Solicitada") return "solicitada";
        return "tentative";
      }
      function apptBadgeClass(estado) {
        if (estado === "Confirmada" || estado === "Reprogramada" || estado === "Realizada") return "badge-ok";
        if (estado === "Solicitada") return "badge-info";
        if (estado === "Cancelada") return "badge-danger";
        return "";
      }
      function estadoBadge(e) {
        if (e === "Descartada") return "badge-danger";
        if (e === "Favorita" || e === "Visitada") return "badge-accent";
        if (e === "Cita confirmada") return "badge-ok";
        if (e === "Cita solicitada") return "badge-info";
        return "";
      }
      function dayWindowLabel(fecha) {
        const d = data.config.dias.find((x) => x.fecha === fecha);
        if (!d) return "";
        return `${d.label || ""} · ${d.desde} – ${d.hasta}`;
      }

      /* ---------- Travel cache helpers ---------- */
      function travelKey(aId, bId) { return aId + "→" + bId; }
      function getTravel(fromId, toId) {
        // Check property travelCache on from
        const from = typeof fromId === "object" ? fromId : propOf(fromId);
        const to = typeof toId === "object" ? toId : propOf(toId);
        if (!from || !to) return null;
        const key = travelKey(from.id, to.id);
        return from.travelCache?.[key] || to.travelCache?.[travelKey(to.id, from.id)] || null;
      }
      function travelBetween(a, b) {
        const pa = propOf(a.propertyId), pb = propOf(b.propertyId);
        if (!pa || !pb) return null;
        const real = getTravel(pa, pb);
        if (real) return real;
        const km = haversineKm(pa, pb);
        if (km == null) return null;
        return { min: Math.max(5, Math.round(km * 2.5)), km: +km.toFixed(1), fuente: "estimado" };
      }
      function setTravel(from, to, info) {
        from.travelCache = from.travelCache || {};
        from.travelCache[travelKey(from.id, to.id)] = info;
      }

      /* ---------- Maps ---------- */
      function ensureMaps() {
        const key = data.config.mapsKey;
        if (!key) { mapsReady.value = false; return Promise.resolve(false); }
        if (window.google?.maps) { mapsReady.value = true; return Promise.resolve(true); }
        if (mapsScriptPromise) return mapsScriptPromise;
        mapsLoading.value = true;
        mapsScriptPromise = new Promise((resolve) => {
          const s = document.createElement("script");
          s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places,marker&loading=async`;
          s.async = true;
          s.onload = () => { mapsReady.value = true; mapsLoading.value = false; resolve(true); };
          s.onerror = () => { mapsReady.value = false; mapsLoading.value = false; toast("No se pudo cargar Google Maps", "err"); resolve(false); };
          document.head.appendChild(s);
        });
        return mapsScriptPromise;
      }
      function onMapsKeyChange() {
        persist();
        mapsScriptPromise = null;
        ensureMaps();
      }
      function bumpUsage(kind) {
        data.config.apiUsage = data.config.apiUsage || { geocoding: 0, routes: 0, places: 0 };
        data.config.apiUsage[kind] = (data.config.apiUsage[kind] || 0) + 1;
        persist({ keepRev: true });
        // still bump rev lightly — actually keepRev skips? Let's just persist normally without double
      }

      async function renderPropMap() {
        if (!mapsReady.value && !data.config.mapsKey) return;
        await ensureMaps();
        await nextTick();
        const el = propMapEl.value;
        if (!el || !window.google?.maps || !editingProp.value) return;
        const p = editingProp.value;
        if (propColoniaRect) { propColoniaRect.setMap(null); propColoniaRect = null; }
        const hasPin = p.lat != null && p.lng != null;
        const boundsObj = normalizeColoniaBounds(p.coloniaBounds);
        const center = hasPin
          ? { lat: p.lat, lng: p.lng }
          : (boundsObj
            ? { lat: (boundsObj.north + boundsObj.south) / 2, lng: (boundsObj.east + boundsObj.west) / 2 }
            : { lat: data.config.trabajo.lat, lng: data.config.trabajo.lng });
        propMap = new google.maps.Map(el, {
          center,
          zoom: hasPin ? 16 : (boundsObj ? 14 : 12),
          mapTypeControl: false,
          streetViewControl: false,
        });
        if (boundsObj) {
          propColoniaRect = new google.maps.Rectangle({
            map: propMap,
            bounds: boundsObj,
            strokeColor: "#0f766e",
            strokeOpacity: 0.9,
            strokeWeight: 2,
            fillColor: "#0f766e",
            fillOpacity: 0.18,
            clickable: false,
          });
        }
        if (hasPin) {
          propMarker = new google.maps.Marker({
            map: propMap, position: center, draggable: true, title: p.alias,
          });
          propMarker.addListener("dragend", () => {
            const pos = propMarker.getPosition();
            p.lat = +pos.lat().toFixed(6);
            p.lng = +pos.lng().toFixed(6);
            saveEditingProp();
            toast("Ubicación actualizada", "ok");
          });
        } else {
          propMarker = null;
        }
        if (boundsObj) {
          const fit = new google.maps.LatLngBounds(
            { lat: boundsObj.south, lng: boundsObj.west },
            { lat: boundsObj.north, lng: boundsObj.east }
          );
          if (hasPin) fit.extend(center);
          propMap.fitBounds(fit, 48);
        }
      }

      function nextApptForProp(propertyId) {
        if (!propertyId) return null;
        return data.appointments
          .filter((a) => a.propertyId === propertyId && a.estado !== "Cancelada" && a.estado !== "Realizada")
          .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))[0] || null;
      }
      function escapeHtml(s) {
        return String(s ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      }
      function overviewPriceChipHtml(p) {
        const price = money(totalMensual(p)) || "—";
        return `<div class="overview-price-chip">${escapeHtml(price)}</div>`;
      }
      function overviewPinColor(estado) {
        if (estado === "Descartada") return "#b91c1c";
        if (estado === "Favorita" || estado === "Visitada") return "#0f766e";
        if (estado === "Cita confirmada") return "#15803d";
        if (estado === "Cita solicitada") return "#0369a1";
        return "#1d4ed8";
      }
      function overviewMarkerIcon(color, selected) {
        return {
          path: google.maps.SymbolPath.CIRCLE,
          scale: selected ? 13 : 9,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: selected ? "#f59e0b" : "#fff",
          strokeWeight: selected ? 3.5 : 2.5,
        };
      }
      function setOverviewMarkerHighlight(selectedId) {
        if (!window.google?.maps) return;
        overviewMarkers.forEach(({ id, marker, color }) => {
          const on = !!selectedId && id === selectedId;
          marker.setIcon(overviewMarkerIcon(color, on));
          marker.setZIndex(on ? 100 : 10);
        });
      }
      function closeOverviewDetail(opts = {}) {
        overviewSelectedId.value = null;
        overviewShowWork.value = false;
        setOverviewMarkerHighlight(null);
        if (opts.fit !== false && showOverviewMap.value && overviewMap) fitOverviewAll();
      }
      function openOverviewDetail(id) {
        overviewShowWork.value = false;
        overviewSelectedId.value = id || null;
        const p = propOf(id);
        if (p) normalizeProperty(p);
        setOverviewMarkerHighlight(id);
      }
      function openOverviewWork() {
        if (overviewShowWork.value) {
          closeOverviewDetail();
          return;
        }
        overviewSelectedId.value = null;
        setOverviewMarkerHighlight(null);
        overviewShowWork.value = true;
        const w = data.config.trabajo;
        if (overviewMap && w?.lat != null && w?.lng != null) {
          overviewMap.panTo({ lat: w.lat, lng: w.lng });
          const z = overviewMap.getZoom();
          if (z == null || z < 13) overviewMap.setZoom(14);
        }
      }
      function openOverviewWorkMaps() {
        const w = data.config.trabajo;
        if (w?.lat == null || w?.lng == null) return;
        window.open(`https://www.google.com/maps?q=${w.lat},${w.lng}`, "_blank", "noopener");
      }
      function openOverviewProperty() {
        const id = overviewSelectedId.value;
        if (!id) return;
        closeOverviewDetail({ fit: false });
        openProperty(id);
      }
      function openOverviewEnlace() {
        const p = overviewSelected.value;
        if (!p?.enlace) { toast("Sin enlace del anuncio", "err"); return; }
        window.open(p.enlace, "_blank", "noopener");
      }
      function openOverviewGallery() {
        const p = overviewSelected.value;
        if (!p) return;
        normalizeProperty(p);
        if (!propHasFotos(p)) { toast("Sin fotos aún", "err"); return; }
        openLightbox(p, 0);
      }
      function panOverviewToProperty(id) {
        if (!overviewMap || !id) return;
        const p = propOf(id);
        if (p?.lat == null || p?.lng == null) return;
        overviewMap.panTo({ lat: p.lat, lng: p.lng });
        const z = overviewMap.getZoom();
        if (z == null || z < 13) overviewMap.setZoom(14);
      }
      function fitOverviewAll() {
        if (!overviewMap || !overviewMarkers.length) return;
        const bounds = new google.maps.LatLngBounds();
        overviewMarkers.forEach(({ marker }) => bounds.extend(marker.getPosition()));
        const work = data.config.trabajo;
        if (work?.lat != null && work?.lng != null) bounds.extend({ lat: work.lat, lng: work.lng });
        overviewMap.fitBounds(bounds);
      }
      async function focusOverviewProperty(id) {
        const p = propOf(id);
        if (!p) return;
        if (overviewSelectedId.value === id) {
          closeOverviewDetail();
          return;
        }
        openOverviewDetail(id);
        if (!showOverviewMap.value) {
          showOverviewMap.value = true;
          await nextTick();
          await renderOverviewMap({ focusId: id });
        } else if (!overviewMap) {
          await renderOverviewMap({ focusId: id });
        } else {
          setOverviewMarkerHighlight(id);
          panOverviewToProperty(id);
        }
        nextTick(() => {
          overviewMapEl.value?.closest(".overview-map-wrap")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      }
      async function toggleOverviewMap() {
        showOverviewMap.value = !showOverviewMap.value;
        if (!showOverviewMap.value) closeOverviewDetail({ fit: false });
        if (showOverviewMap.value) nextTick(() => renderOverviewMap());
      }
      function refreshOverviewMapLabels() {
        if (showOverviewMap.value) nextTick(() => renderOverviewMap({ keepView: true }));
      }
      function clearOverviewOverlays() {
        overviewMarkers.forEach(({ marker }) => marker.setMap(null));
        overviewMarkers = [];
        overviewPriceWindows.forEach((iw) => iw.close());
        overviewPriceWindows = [];
        if (overviewWorkMarker) {
          overviewWorkMarker.setMap(null);
          overviewWorkMarker = null;
        }
      }
      async function renderOverviewMap(opts = {}) {
        await ensureMaps();
        await nextTick();
        const el = overviewMapEl.value;
        if (!el) return;
        if (!window.google?.maps) {
          el.innerHTML = `<div class="map-fallback"><p>Configura Google Maps en Ajustes.</p></div>`;
          return;
        }
        const keepView = !!opts.keepView && overviewMap;
        const focusId = opts.focusId || overviewSelectedId.value;
        const prevCenter = keepView ? overviewMap.getCenter() : null;
        const prevZoom = keepView ? overviewMap.getZoom() : null;
        clearOverviewOverlays();
        const pts = filteredProperties.value.filter((p) => p.lat != null);
        const center = pts[0] ? { lat: pts[0].lat, lng: pts[0].lng } : { lat: data.config.trabajo.lat, lng: data.config.trabajo.lng };
        overviewMap = new google.maps.Map(el, {
          center: prevCenter || center,
          zoom: prevZoom || 11,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          styles: [
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "simplified" }] },
          ],
        });
        overviewMap.addListener("click", () => closeOverviewDetail());
        const bounds = new google.maps.LatLngBounds();
        pts.forEach((p) => {
          const color = overviewPinColor(p.estado);
          const selected = focusId === p.id;
          const m = new google.maps.Marker({
            map: overviewMap,
            position: { lat: p.lat, lng: p.lng },
            title: p.alias,
            icon: overviewMarkerIcon(color, selected),
            zIndex: selected ? 100 : 10,
          });
          m.addListener("click", (e) => {
            e?.domEvent?.stopPropagation?.();
            openOverviewDetail(p.id);
          });
          if (overviewMapOpts.showPrice) {
            const priceIw = new google.maps.InfoWindow({
              content: overviewPriceChipHtml(p),
              disableAutoPan: true,
              pixelOffset: new google.maps.Size(0, -6),
            });
            priceIw.open({ map: overviewMap, anchor: m });
            overviewPriceWindows.push(priceIw);
          }
          overviewMarkers.push({ id: p.id, marker: m, color });
          bounds.extend(m.getPosition());
        });
        const work = data.config.trabajo;
        if (work?.lat != null && work?.lng != null) {
          overviewWorkMarker = new google.maps.Marker({
            map: overviewMap,
            position: { lat: work.lat, lng: work.lng },
            title: work.nombre || "Trabajo (Tec)",
            label: { text: "T", color: "#fff", fontWeight: "700" },
            zIndex: overviewShowWork.value ? 100 : 5,
          });
          overviewWorkMarker.addListener("click", (e) => {
            e?.domEvent?.stopPropagation?.();
            openOverviewWork();
          });
          bounds.extend(overviewWorkMarker.getPosition());
        }
        if (focusId && pts.some((p) => p.id === focusId)) {
          panOverviewToProperty(focusId);
        } else if (overviewShowWork.value && work?.lat != null) {
          overviewMap.panTo({ lat: work.lat, lng: work.lng });
        } else if (!keepView && pts.length) {
          overviewMap.fitBounds(bounds);
        }
        if (overviewSelectedId.value && !pts.some((p) => p.id === overviewSelectedId.value)) {
          closeOverviewDetail({ fit: false });
        } else {
          setOverviewMarkerHighlight(overviewSelectedId.value);
        }
      }

      async function renderDayMap() {
        await ensureMaps();
        await nextTick();
        const el = dayMapEl.value;
        if (!el || view.value !== "agenda" || agendaMode.value !== "day") return;
        if (!window.google?.maps) {
          el.innerHTML = `<div class="map-fallback"><p>Configura Google Maps en Ajustes.</p></div>`;
          return;
        }
        dayMarkers.forEach((m) => m.setMap(null));
        dayMarkers = [];
        const pts = dayAppts.value.map((a) => propOf(a.propertyId)).filter((p) => p?.lat != null);
        const center = pts[0] ? { lat: pts[0].lat, lng: pts[0].lng } : { lat: data.config.trabajo.lat, lng: data.config.trabajo.lng };
        dayMap = new google.maps.Map(el, { center, zoom: 12, mapTypeControl: false, streetViewControl: false });
        const bounds = new google.maps.LatLngBounds();
        pts.forEach((p, i) => {
          const m = new google.maps.Marker({ map: dayMap, position: { lat: p.lat, lng: p.lng }, label: String(i + 1), title: p.alias });
          dayMarkers.push(m);
          bounds.extend(m.getPosition());
        });
        if (pts.length > 1) dayMap.fitBounds(bounds);
      }

      function geocodeAddress(geocoder, address) {
        return new Promise((resolve, reject) => {
          geocoder.geocode({ address, region: "mx" }, (results, status) => {
            if (status === "OK" && results[0]) resolve(results[0]);
            else reject(new Error(status));
          });
        });
      }
      function boundsFromGeocodeResult(result) {
        const vp = result?.geometry?.viewport || result?.geometry?.bounds;
        if (!vp) return null;
        const ne = vp.getNorthEast();
        const sw = vp.getSouthWest();
        return {
          north: +ne.lat().toFixed(6),
          east: +ne.lng().toFixed(6),
          south: +sw.lat().toFixed(6),
          west: +sw.lng().toFixed(6),
        };
      }
      async function geocodeProperty(p, opts = {}) {
        const silent = !!opts.silent;
        if (!p) return false;
        if (!data.config.mapsKey) return false;
        syncDireccionFromMx(p);
        const hasStreet = !!(String(p.calle || "").trim() || String(p.direccion || "").trim());
        const hasColonia = !!String(p.colonia || "").trim();
        if (!hasStreet && !hasColonia) return false;
        await ensureMaps();
        if (!window.google?.maps) return false;
        mapsBusy.value = true;
        try {
          const geocoder = new google.maps.Geocoder();
          const municipio = String(p.municipio || "").trim() || "Monterrey";
          const estado = String(p.estadoMx || "Nuevo León").trim() || "Nuevo León";

          if (hasColonia) {
            const colQ = ["Colonia " + p.colonia, municipio, estado, "México"].join(", ");
            const colRes = await geocodeAddress(geocoder, colQ);
            data.config.apiUsage.geocoding = (data.config.apiUsage.geocoding || 0) + 1;
            p.coloniaBounds = boundsFromGeocodeResult(colRes);
            if (!hasStreet || !(String(p.calle || "").trim())) {
              const loc = colRes.geometry.location;
              p.lat = +loc.lat().toFixed(6);
              p.lng = +loc.lng().toFixed(6);
            }
          }

          if (String(p.calle || "").trim()) {
            const addrQ = formatDireccionMX(p) || [p.calle, p.numeroExt, p.colonia, municipio, estado, "México"].filter(Boolean).join(", ");
            const addrRes = await geocodeAddress(geocoder, addrQ);
            data.config.apiUsage.geocoding = (data.config.apiUsage.geocoding || 0) + 1;
            const loc = addrRes.geometry.location;
            p.lat = +loc.lat().toFixed(6);
            p.lng = +loc.lng().toFixed(6);
          } else if (hasStreet && p.direccion && !p.calle) {
            const addrRes = await geocodeAddress(geocoder, [p.direccion, p.colonia, municipio, estado, "México"].filter(Boolean).join(", "));
            data.config.apiUsage.geocoding = (data.config.apiUsage.geocoding || 0) + 1;
            const loc = addrRes.geometry.location;
            p.lat = +loc.lat().toFixed(6);
            p.lng = +loc.lng().toFixed(6);
          }

          syncDireccionFromMx(p);
          if (editingProp.value && editingProp.value.id === p.id) {
            saveEditingProp();
            if (propTab.value === "ubicacion") renderPropMap();
          } else {
            persist();
          }
          if (!silent) {
            toast(p.coloniaBounds ? "Ubicación y colonia en el mapa" : "Ubicación encontrada", "ok");
          }
          mapsBusy.value = false;
          if (p.lat != null && p.lng != null) {
            await calcWorkTravelFor(p, { silent: true });
          }
          return true;
        } catch (e) {
          if (!silent) toast("No se pudo geocodificar: " + e.message, "err");
          return false;
        } finally { mapsBusy.value = false; }
      }

      async function computeRouteMatrix(origins, destinations, departureTime) {
        const key = data.config.mapsKey;
        if (!key) throw new Error("Falta API key de Maps");
        const body = {
          origins: origins.map((o) => ({ waypoint: { location: { latLng: { latitude: o.lat, longitude: o.lng } } } })),
          destinations: destinations.map((d) => ({ waypoint: { location: { latLng: { latitude: d.lat, longitude: d.lng } } } })),
          travelMode: "DRIVE",
          routingPreference: departureTime ? "TRAFFIC_AWARE" : "TRAFFIC_UNAWARE",
          languageCode: "es-MX",
          units: "METRIC",
        };
        if (departureTime) body.departureTime = departureTime;
        const res = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask": "originIndex,destinationIndex,duration,distanceMeters,status,condition",
          },
          body: JSON.stringify(body),
        });
        data.config.apiUsage.routes = (data.config.apiUsage.routes || 0) + 1;
        const txt = await res.text();
        if (!res.ok) throw new Error("Routes API: " + res.status + " " + txt.slice(0, 160));
        // REST returns a JSON array; some clients historically streamed NDJSON lines.
        const trimmed = String(txt || "").trim();
        let rows;
        if (trimmed.startsWith("[")) {
          rows = JSON.parse(trimmed);
        } else {
          rows = trimmed.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => JSON.parse(l));
        }
        if (!Array.isArray(rows)) rows = [rows];
        return rows;
      }

      async function calcWorkTravelFor(p, opts = {}) {
        const silent = !!opts.silent;
        if (!p || p.lat == null || p.lng == null) {
          if (!silent) toast("Ubica la propiedad primero", "err");
          return false;
        }
        if (!data.config.mapsKey || !data.config.trabajo?.lat) return false;
        mapsBusy.value = true;
        try {
          const rows = await computeRouteMatrix(
            [{ lat: p.lat, lng: p.lng }],
            [{ lat: data.config.trabajo.lat, lng: data.config.trabajo.lng }]
          );
          const row = rows.find((r) => !r.error && (r.duration || r.distanceMeters)) || rows[0];
          if (!row || row.error) throw new Error(row?.error?.message || "Sin ruta disponible");
          const secs = Number(String(row.duration || "").replace("s", "")) || 0;
          const measuredAt = new Date().toISOString();
          p.trasladoTrabajo = {
            min: Math.round(secs / 60),
            km: row.distanceMeters ? +(row.distanceMeters / 1000).toFixed(1) : null,
            fuente: "carro",
            fecha: measuredAt,
            measuredAt,
          };
          if (editingProp.value && editingProp.value.id === p.id) {
            saveEditingProp();
            Object.assign(manualTravel, { min: p.trasladoTrabajo.min, km: p.trasladoTrabajo.km });
          } else {
            persist();
          }
          if (!silent) toast("Traslado al Tec calculado (carro)", "ok");
          return true;
        } catch (e) {
          if (!silent) toast(e.message || "Error Routes API", "err");
          return false;
        } finally { mapsBusy.value = false; persist(); }
      }
      function onCoordsChange() {
        if (!editingProp.value) return;
        saveEditingProp();
        calcWorkTravelFor(editingProp.value, { silent: true });
      }

      function saveManualTravel() {
        const p = editingProp.value;
        if (!p) return;
        const measuredAt = new Date().toISOString();
        p.trasladoTrabajo = {
          min: manualTravel.min,
          km: manualTravel.km,
          fuente: "manual",
          fecha: measuredAt,
          measuredAt,
        };
        saveEditingProp();
        toast("Traslado manual guardado", "ok");
      }

      function formatTrasladoMeasure(t) {
        if (!t) return "";
        const at = t.measuredAt || t.fecha;
        if (!at) return "";
        try {
          const d = new Date(at);
          if (Number.isNaN(d.getTime())) return "";
          return "medido " + d.toLocaleString("es-MX", {
            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
          });
        } catch {
          return "";
        }
      }

      function durationToMin(duration) {
        if (duration == null) return 0;
        if (typeof duration === "number" && Number.isFinite(duration)) return Math.max(0, Math.round(duration / 60));
        if (typeof duration === "object" && duration.seconds != null) {
          const secs = Number(duration.seconds);
          return Number.isFinite(secs) ? Math.max(0, Math.round(secs / 60)) : 0;
        }
        const secs = Number(String(duration).replace(/s$/i, "").trim());
        return Number.isFinite(secs) ? Math.max(0, Math.round(secs / 60)) : 0;
      }

      async function calcDayTravel(fecha, opts = {}) {
        const silent = !!opts.silent;
        const appts = data.appointments.filter((a) => a.fecha === fecha && a.estado !== "Cancelada");
        if (!appts.length) {
          if (!silent) toast("No hay citas este día", "err");
          return false;
        }
        const byId = new Map();
        for (const a of appts) {
          const p = propOf(a.propertyId);
          if (p?.lat != null && p?.lng != null) byId.set(p.id, p);
        }
        for (const id of opts.extraPropertyIds || []) {
          const p = propOf(id);
          if (p?.lat != null && p?.lng != null) byId.set(p.id, p);
        }
        const props = [...byId.values()];
        if (props.length < 2) {
          if (!silent) {
            toast(
              props.length
                ? "Solo hay 1 propiedad ubicada; se necesitan al menos 2 con coordenadas"
                : "Las citas del día no tienen coordenadas; geocodifica las propiedades",
              "err"
            );
          }
          return false;
        }
        if (!data.config.mapsKey) {
          if (!silent) toast("Falta API key de Maps en Ajustes", "err");
          return false;
        }
        mapsBusy.value = true;
        try {
          const rows = await computeRouteMatrix(props, props);
          const list = Array.isArray(rows) ? rows : [];
          let saved = 0;
          for (const r of list) {
            if (r == null || r.originIndex === r.destinationIndex) continue;
            if (r.condition && r.condition !== "ROUTE_EXISTS") continue;
            const from = props[r.originIndex], to = props[r.destinationIndex];
            if (!from || !to) continue;
            const min = durationToMin(r.duration);
            const km = r.distanceMeters != null ? +(Number(r.distanceMeters) / 1000).toFixed(1) : null;
            if (!min && km == null) continue;
            setTravel(from, to, {
              min: min || Math.max(5, Math.round((km || 0) * 2.5)),
              km,
              fuente: "real",
              fecha: new Date().toISOString(),
            });
            saved += 1;
          }
          persist();
          if (!silent) {
            if (saved) toast(`Traslados del día listos (${saved} rutas)`, "ok");
            else toast("Routes no devolvió rutas útiles. Revisa la API key y el billing de Routes.", "err");
          }
          return saved > 0;
        } catch (e) {
          if (!silent) toast(e.message || "Error Routes API", "err");
          return false;
        } finally { mapsBusy.value = false; }
      }

      async function calcDayTravelBtn() {
        await ensureMaps();
        if (!data.config.mapsKey) {
          toast("Configura Google Maps en Ajustes", "err");
          return;
        }
        if (!mapsReady.value) {
          toast("No se pudo cargar Google Maps", "err");
          return;
        }
        await calcDayTravel(agendaDay.value);
      }

      const customCatForm = reactive({ label: "", query: "" });

      const allPlaceCats = computed(() => {
        const fixed = PLACE_CATS.map((c) => ({
          key: c.key,
          label: c.label,
          type: c.type,
          basic: !!c.basic,
          custom: false,
          query: "",
        }));
        const custom = (data.config.placeCatsCustom || []).map((c) => ({
          key: c.id,
          label: c.label,
          type: "",
          basic: false,
          custom: true,
          query: c.query,
        }));
        return [...fixed, ...custom];
      });

      function serviciosOf(prop, catKey) {
        const list = prop?.servicios?.[catKey];
        return Array.isArray(list) ? list : [];
      }

      function formatServicioLine(s) {
        if (!s) return "";
        const parts = [];
        if (s.min != null) parts.push(s.min + " min");
        if (s.km != null) parts.push(s.km + " km");
        if (s.measuredAt) {
          try {
            const d = new Date(s.measuredAt);
            if (!Number.isNaN(d.getTime())) {
              parts.push("medido " + d.toLocaleString("es-MX", {
                day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
              }));
            }
          } catch { /* ignore */ }
        }
        return parts.join(" · ");
      }

      function openServicioRoute(prop, servicio) {
        if (!prop || prop.lat == null || prop.lng == null) {
          toast("Ubica la propiedad primero", "err");
          return;
        }
        if (servicio?.lat == null || servicio?.lng == null) {
          toast("Este resultado no tiene coordenadas; vuelve a buscar", "err");
          return;
        }
        const origin = `${prop.lat},${prop.lng}`;
        const dest = `${servicio.lat},${servicio.lng}`;
        window.open(
          `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}&travelmode=driving`,
          "_blank"
        );
      }

      async function fetchNearbyPlaces(p, type) {
        const key = data.config.mapsKey;
        if (!key) throw new Error("Falta API key de Maps");
        const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask": "places.displayName,places.location",
          },
          body: JSON.stringify({
            includedTypes: [type],
            maxResultCount: 3,
            rankPreference: "DISTANCE",
            languageCode: "es",
            locationRestriction: {
              circle: {
                center: { latitude: Number(p.lat), longitude: Number(p.lng) },
                radius: 2000.0,
              },
            },
          }),
        });
        data.config.apiUsage.places = (data.config.apiUsage.places || 0) + 1;
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error?.message || json.error_message || ("Places API " + res.status));
        return Array.isArray(json.places) ? json.places : [];
      }

      async function fetchTextPlaces(p, query) {
        const key = data.config.mapsKey;
        if (!key) throw new Error("Falta API key de Maps");
        const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask": "places.displayName,places.location",
          },
          body: JSON.stringify({
            textQuery: query,
            maxResultCount: 3,
            languageCode: "es",
            locationBias: {
              circle: {
                center: { latitude: Number(p.lat), longitude: Number(p.lng) },
                radius: 2000.0,
              },
            },
          }),
        });
        data.config.apiUsage.places = (data.config.apiUsage.places || 0) + 1;
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error?.message || json.error_message || ("Places Text API " + res.status));
        return Array.isArray(json.places) ? json.places : [];
      }

      function placesToCandidates(places) {
        return (places || []).map((place) => {
          const lat = place.location?.latitude;
          const lng = place.location?.longitude;
          if (lat == null || lng == null) return null;
          return {
            id: uid(),
            nombre: place.displayName?.text || "Sin nombre",
            lat: Number(lat),
            lng: Number(lng),
            min: null,
            km: null,
            fuente: "places",
            measuredAt: "",
          };
        }).filter(Boolean).slice(0, 3);
      }

      async function enrichWithDriving(prop, candidates) {
        if (!candidates.length) return [];
        const measuredAt = new Date().toISOString();
        try {
          const rows = await computeRouteMatrix(
            [{ lat: prop.lat, lng: prop.lng }],
            candidates.map((c) => ({ lat: c.lat, lng: c.lng }))
          );
          const list = Array.isArray(rows) ? rows : [];
          return candidates.map((c, i) => {
            const row = list.find((r) => Number(r.destinationIndex) === i)
              || list.find((r) => r.originIndex === 0 && r.destinationIndex === i)
              || list[i];
            const secs = Number(String(row?.duration || "").replace("s", "")) || 0;
            const km = row?.distanceMeters != null ? +(row.distanceMeters / 1000).toFixed(1) : null;
            return {
              ...c,
              min: secs ? Math.round(secs / 60) : null,
              km,
              measuredAt,
            };
          }).sort((a, b) => {
            const am = a.min != null ? a.min : 9999;
            const bm = b.min != null ? b.min : 9999;
            return am - bm;
          });
        } catch (e) {
          toast("Lugares encontrados, pero falló la ruta en carro: " + (e.message || "error"), "err");
          return candidates.map((c) => ({ ...c, measuredAt }));
        }
      }

      async function searchCategoryPlaces(prop, cat) {
        if (!prop || prop.lat == null || prop.lng == null) throw new Error("Ubica la propiedad primero");
        if (!data.config.mapsKey) throw new Error("Falta API key de Maps");
        let places;
        if (cat.custom) {
          places = await fetchTextPlaces(prop, cat.query || cat.label);
        } else {
          places = await fetchNearbyPlaces(prop, cat.type);
        }
        const candidates = placesToCandidates(places);
        if (!candidates.length) return [];
        return enrichWithDriving(prop, candidates);
      }

      async function searchBasicPlaces() {
        const p = editingProp.value;
        if (!p || p.lat == null) { toast("Ubica la propiedad primero", "err"); return; }
        mapsBusy.value = true;
        try {
          p.servicios = p.servicios || {};
          for (const cat of allPlaceCats.value.filter((c) => c.basic)) {
            const items = await searchCategoryPlaces(p, cat);
            p.servicios[cat.key] = items;
          }
          saveEditingProp();
          persist();
          toast("Servicios básicos consultados", "ok");
        } catch (e) { toast(e.message, "err"); }
        finally { mapsBusy.value = false; }
      }

      async function searchOnePlace(cat) {
        const p = editingProp.value;
        if (!p || p.lat == null) { toast("Ubica la propiedad primero", "err"); return; }
        mapsBusy.value = true;
        try {
          const items = await searchCategoryPlaces(p, cat);
          p.servicios = p.servicios || {};
          p.servicios[cat.key] = items;
          if (!items.length) toast("Sin resultados para " + cat.label);
          else toast(cat.label + ": " + items.length + " cercanos", "ok");
          saveEditingProp();
          persist();
        } catch (e) { toast(e.message, "err"); }
        finally { mapsBusy.value = false; }
      }

      function addCustomPlaceCat() {
        const label = String(customCatForm.label || "").trim();
        const query = String(customCatForm.query || label).trim();
        if (!label) { toast("Escribe un nombre para la categoría", "err"); return; }
        if (!query) { toast("Escribe el texto de búsqueda", "err"); return; }
        if (!Array.isArray(data.config.placeCatsCustom)) data.config.placeCatsCustom = [];
        data.config.placeCatsCustom.push({ id: uid(), label, query });
        customCatForm.label = "";
        customCatForm.query = "";
        persist();
        toast("Categoría agregada", "ok");
      }

      function removeCustomPlaceCat(id) {
        if (!id || !confirm("¿Eliminar esta categoría personalizada?")) return;
        data.config.placeCatsCustom = (data.config.placeCatsCustom || []).filter((c) => c.id !== id);
        if (editingProp.value?.servicios) {
          delete editingProp.value.servicios[id];
          saveEditingProp();
        } else {
          persist();
        }
      }

      function openInMaps(p) {
        if (!p) return;
        const q = mapQuery(p);
        if (!q) { toast("Agrega dirección, colonia o coordenadas primero", "err"); return; }
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`, "_blank");
      }
      function navigateTo(p) {
        if (!p) return;
        const dest = mapQuery(p);
        if (!dest) { toast("Agrega dirección, colonia o coordenadas primero", "err"); return; }
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`, "_blank");
      }

      /* ---------- WhatsApp ---------- */
      function openWhatsApp(phone, text) {
        if (!phone) { toast("Sin número de WhatsApp", "err"); return; }
        const num = String(phone).replace(/\D/g, "");
        const url = `https://wa.me/${num}${text ? "?text=" + encodeURIComponent(text) : ""}`;
        window.open(url, "_blank");
      }
      function whatsappForProp(p) {
        const ad = advisorOf(p);
        if (!ad) { toast("Sin asesor asignado", "err"); return; }
        const msg = `Hola ${ad.nombre}, te escribo por la propiedad "${p.alias}" en ${p.colonia || "Monterrey"}${p.enlace ? " (" + p.enlace + ")" : ""}. ¿Sigue disponible? Me gustaría agendar una visita.`;
        openWhatsApp(ad.whatsapp || ad.telefono, msg);
      }
      function whatsappForAppt(a) {
        const p = propOf(a.propertyId);
        const ad = data.advisors.find((x) => String(x.id) === String(a.advisorId || advisorIdForProp(p) || ""));
        if (!ad) { toast("Sin asesor", "err"); return; }
        const msg = `Hola ${ad.nombre}, confirmo la visita a "${p?.alias}" el ${formatDay(a.fecha)} a las ${a.hora}. ¿Nos vemos ahí?`;
        openWhatsApp(ad.whatsapp || ad.telefono, msg);
      }

      /* ---------- Planner ---------- */
      function buildLocalDayPlan(fecha) {
        const day = data.config.dias.find((d) => d.fecha === fecha);
        if (!day) return null;
        const margen = data.config.margen || 15;
        const durDefault = data.config.duracionDefault || 45;
        const existing = data.appointments.filter((a) => a.fecha === fecha && a.estado !== "Cancelada" && a.estado !== "Realizada");
        const fixed = existing.filter((a) => a.estado === "Confirmada" || a.estado === "Reprogramada");
        const semi = existing.filter((a) => a.estado === "Solicitada");
        const freeAppts = existing.filter((a) => a.estado === "Por solicitar");
        const knownIds = new Set([...fixed, ...semi, ...freeAppts].map((a) => a.id));
        const otherAppts = existing.filter((a) => !knownIds.has(a.id));

        const occupiedIds = new Set(existing.map((a) => a.propertyId));
        const candidates = eligibleProperties.value
          .filter((p) => !occupiedIds.has(p.id) && (p.estado === "Interesante" || p.estado === "Contactado" || p.estado === "Cita solicitada" || p.favorita || p.estado === "Contacto pendiente"))
          .map((p) => enrichScore(p))
          .sort((a, b) => (b._score ?? -1) - (a._score ?? -1) || (b.favorita ? 1 : 0) - (a.favorita ? 1 : 0));

        const zones = assignZones(data.properties);
        const zoneOf = (pid) => zones.find((z) => z.ids.includes(pid))?.id;

        const slots = [];
        const warnings = [];
        const suggestions = [];
        const changes = [];

        function placeFixed(a, label, kind) {
          const p = propOf(a.propertyId);
          slots.push({
            key: a.id, apptId: a.id, propertyId: a.propertyId, hora: a.hora,
            duracion: a.duracion || durDefault, alias: p?.alias, colonia: p?.colonia,
            label, kind, zona: zoneOf(a.propertyId), travelMissing: false, fixed: true,
          });
        }
        fixed.forEach((a) => placeFixed(a, "Confirmada (fija)", "confirmed"));
        semi.forEach((a) => placeFixed(a, "Solicitada (semifija)", "solicitada"));
        otherAppts.forEach((a) => placeFixed(a, a.estado || "Agendada", "solicitada"));

        const movable = freeAppts.map((a) => ({ appt: a, prop: propOf(a.propertyId) })).filter((x) => x.prop);
        const newCandidates = candidates.map((p) => ({ appt: null, prop: p }));
        const pool = [...movable, ...newCandidates];
        const anchors = [...fixed, ...semi].map((a) => propOf(a.propertyId)).filter((p) => p?.lat != null);

        function priority(item) {
          const p = item.prop;
          let score = (enrichScore(p)._score ?? 0) * 10;
          if (p.favorita) score += 5;
          if (anchors.length && p.lat != null) {
            const near = Math.min(...anchors.map((a) => haversineKm(a, p) ?? 99));
            score += Math.max(0, 5 - near);
          }
          return score;
        }
        pool.sort((a, b) => priority(b) - priority(a));

        const dayStart = timeToMin(day.desde);
        const dayEnd = timeToMin(day.hasta);

        function occupiedRanges() {
          return slots.map((s) => {
            const start = timeToMin(s.hora);
            return { start, end: start + s.duracion + margen, slot: s };
          }).sort((a, b) => a.start - b.start);
        }

        function findGap(dur, preferAfterProp) {
          const ranges = occupiedRanges();
          let cursor = dayStart;
          const gaps = [];
          for (const r of ranges) {
            if (r.start - cursor >= dur + margen) gaps.push({ start: cursor, end: r.start });
            cursor = Math.max(cursor, r.end);
          }
          if (dayEnd - cursor >= dur) gaps.push({ start: cursor, end: dayEnd });
          if (!gaps.length) return null;
          gaps.sort((g1, g2) => g1.start - g2.start);
          for (const g of gaps) {
            let start = g.start;
            const prev = occupiedRanges().filter((r) => r.end <= start + margen).pop();
            if (prev) {
              const prevProp = propOf(prev.slot.propertyId);
              const travel = preferAfterProp && prevProp ? getTravel(prevProp, preferAfterProp) : null;
              if (preferAfterProp && prevProp) {
                if (!travel) return { start, travelMissing: true, prevId: prevProp.id };
                start = Math.max(start, prev.start + prev.slot.duracion + travel.min + margen);
              } else {
                start = Math.max(start, prev.end);
              }
            }
            if (start + dur <= g.end && start + dur <= dayEnd) {
              return { start, travelMissing: false };
            }
          }
          return null;
        }

        for (const item of pool) {
          const dur = item.appt?.duracion || durDefault;
          const gap = findGap(dur, item.prop);
          if (!gap) {
            warnings.push(`Sin espacio para ${item.prop.alias}`);
            continue;
          }
          const hora = minToTime(gap.start);
          slots.push({
            key: "new-" + item.prop.id,
            apptId: item.appt?.id || null,
            propertyId: item.prop.id,
            hora, duracion: dur,
            alias: item.prop.alias, colonia: item.prop.colonia,
            label: item.appt ? "Reubicada (libre)" : "Nueva propuesta",
            kind: "tentative",
            zona: zoneOf(item.prop.id),
            travelMissing: gap.travelMissing,
            fixed: false,
          });
          changes.push({
            type: item.appt ? "update" : "create",
            apptId: item.appt?.id || null,
            propertyId: item.prop.id,
            fecha, hora, duracion: dur,
          });
        }

        slots.sort((a, b) => a.hora.localeCompare(b.hora));

        for (let i = 0; i < slots.length - 1; i++) {
          const a = propOf(slots[i].propertyId), b = propOf(slots[i + 1].propertyId);
          if (a && b && !getTravel(a, b) && a.lat != null && b.lat != null) {
            slots[i + 1].travelMissing = true;
          }
        }

        for (const s of semi) {
          const p = propOf(s.propertyId);
          if (!p?.lat) continue;
          const neighbors = slots.filter((x) => x.propertyId !== s.propertyId && propOf(x.propertyId)?.lat != null);
          for (const n of neighbors) {
            const np = propOf(n.propertyId);
            const dist = haversineKm(p, np);
            if (dist != null && dist < 2) {
              const ideal = minToTime(timeToMin(n.hora) + (n.duracion || 45) + margen);
              if (ideal !== s.hora) {
                const ad = data.advisors.find((x) => x.id === (s.advisorId || p.advisorId));
                suggestions.push({
                  text: `Convendría pedir cambiar "${p.alias}" (ahora ${s.hora}) cerca de "${n.alias}" hacia las ${ideal}.`,
                  whatsapp: ad?.whatsapp || ad?.telefono,
                  message: `Hola ${ad?.nombre || ""}, ¿sería posible reagendar la visita a ${p.alias} alrededor de las ${ideal}? Estaré por la zona.`,
                });
                break;
              }
            }
          }
        }

        if (slots.some((s) => s.travelMissing)) {
          warnings.push("Hay tramos sin dato de traslado. Usa «Calcular traslados del día» o captura tiempos manuales.");
        }

        const fixedCount = slots.filter((s) => s.fixed).length;
        const newCount = slots.length - fixedCount;
        return {
          fecha,
          generatedAt: new Date().toISOString(),
          source: "local",
          summary: `Plan local: ${slots.length} parada(s)`
            + (fixedCount ? ` · ${fixedCount} fija(s)` : "")
            + (newCount ? ` · ${newCount} propuesta(s)` : "")
            + ` · ${formatDay(fecha)}.`,
          slots,
          warnings,
          suggestions,
          changes,
        };
      }

      function buildDayPlanAiContext(fecha) {
        const day = data.config.dias.find((d) => d.fecha === fecha);
        const durDefault = data.config.duracionDefault || 45;
        const margen = data.config.margen || 15;
        const appts = data.appointments.filter((a) => a.fecha === fecha && a.estado !== "Cancelada" && a.estado !== "Realizada");
        const apptLines = appts.map((a) => {
          const p = propOf(a.propertyId);
          return {
            id: a.id, propertyId: a.propertyId, estado: a.estado, hora: a.hora,
            duracion: a.duracion || durDefault,
            alias: p?.alias || "", colonia: p?.colonia || "",
            lat: p?.lat ?? null, lng: p?.lng ?? null,
          };
        });
        const occupied = new Set(appts.map((a) => a.propertyId));
        const candidates = eligibleProperties.value
          .filter((p) => !occupied.has(p.id))
          .slice(0, 8)
          .map((p) => ({
            id: p.id, alias: p.alias, colonia: p.colonia, estado: p.estado,
            favorita: !!p.favorita, lat: p.lat ?? null, lng: p.lng ?? null,
          }));
        const travels = [];
        for (let i = 0; i < apptLines.length; i++) {
          for (let j = 0; j < apptLines.length; j++) {
            if (i === j) continue;
            const pa = propOf(apptLines[i].propertyId), pb = propOf(apptLines[j].propertyId);
            const t = pa && pb ? getTravel(pa, pb) : null;
            if (t?.min != null) {
              travels.push({ from: apptLines[i].propertyId, to: apptLines[j].propertyId, min: t.min, fuente: t.fuente || "real" });
            }
          }
        }
        return {
          fecha,
          ventana: day ? { desde: day.desde, hasta: day.hasta, label: day.label || "" } : null,
          duracionDefault: durDefault,
          margen,
          citas: apptLines,
          trasladosMin: travels,
          candidatos: candidates,
        };
      }

      function normalizeAiDayPlan(raw, fecha) {
        if (!raw || typeof raw !== "object") return null;
        const durDefault = data.config.duracionDefault || 45;
        const slots = Array.isArray(raw.slots) ? raw.slots.map((s, i) => {
          const p = propOf(s.propertyId);
          return {
            key: s.key || s.apptId || ("ai-" + (s.propertyId || i)),
            apptId: s.apptId || null,
            propertyId: s.propertyId,
            hora: s.hora,
            duracion: s.duracion || durDefault,
            alias: s.alias || p?.alias || "Propiedad",
            colonia: s.colonia || p?.colonia || "",
            label: s.label || "Propuesta",
            kind: s.kind || "tentative",
            zona: s.zona || "",
            travelMissing: !!s.travelMissing,
            fixed: !!s.fixed,
          };
        }).filter((s) => s.propertyId && s.hora) : [];
        const changes = Array.isArray(raw.changes) ? raw.changes.filter((c) => c && (c.type === "create" || c.type === "update")) : [];
        const suggestions = Array.isArray(raw.suggestions) ? raw.suggestions.map((s) => (
          typeof s === "string" ? { text: s } : { text: s.text || "", whatsapp: s.whatsapp || "", message: s.message || "" }
        )).filter((s) => s.text) : [];
        return {
          fecha,
          generatedAt: new Date().toISOString(),
          source: "ai",
          summary: String(raw.summary || "").trim(),
          slots,
          warnings: Array.isArray(raw.warnings) ? raw.warnings.map(String) : [],
          suggestions,
          changes,
        };
      }

      function saveDayPlan(plan) {
        if (!plan?.fecha) return;
        if (!data.dayPlans || typeof data.dayPlans !== "object") data.dayPlans = {};
        data.dayPlans[plan.fecha] = plan;
        persist();
      }

      function discardDayPlan() {
        const fecha = agendaDay.value;
        if (data.dayPlans?.[fecha]) {
          delete data.dayPlans[fecha];
          persist();
        }
      }

      function ensureAgendaDay(fecha) {
        if (!fecha || data.config.dias.some((d) => d.fecha === fecha)) return;
        data.config.dias.push({
          fecha,
          label: formatDayShort(fecha) || "Día",
          desde: "09:00",
          hasta: "20:00",
        });
        data.config.dias.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
        persist();
      }

      function pickAgendaDayWithAppts() {
        const appts = [...data.appointments]
          .filter((a) => a.estado !== "Cancelada" && a.estado !== "Realizada" && a.fecha)
          .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
        if (!appts.length) return null;
        const inConfig = appts.find((a) => data.config.dias.some((d) => d.fecha === a.fecha));
        const fecha = (inConfig || appts[0]).fecha;
        ensureAgendaDay(fecha);
        return fecha;
      }

      async function openDayPlanner() {
        const fecha = pickAgendaDayWithAppts();
        if (fecha) agendaDay.value = fecha;
        view.value = "agenda";
        agendaMode.value = "planner";
        await nextTick();
        if (!dayAppts.value.length) {
          toast("No hay citas para planificar. Elige otro día o agenda una visita.", "err");
          return;
        }
        await runPlanner();
      }

      function askAIWithTimeout(messages, ms = 25000) {
        return Promise.race([
          askAI(messages),
          new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
        ]);
      }

      async function calcPlannerTravel() {
        const fecha = agendaDay.value;
        if (!dayAppts.value.length) { toast("No hay citas este día", "err"); return; }
        await ensureMaps();
        await calcDayTravel(fecha);
      }

      async function runPlanner() {
        const fecha = agendaDay.value;
        const day = data.config.dias.find((d) => d.fecha === fecha);
        if (!day) { toast("Día no configurado en Ajustes", "err"); return; }
        if (!dayAppts.value.length) { toast("No hay citas este día", "err"); return; }
        plannerBusy.value = true;
        try {
          await ensureMaps();
          await calcDayTravel(fecha, { silent: true });

          let plan = buildLocalDayPlan(fecha);
          if (!plan?.slots?.length) {
            toast("No se pudo armar un plan con las citas de este día", "err");
            return;
          }
          saveDayPlan(plan);

          if (data.config.openaiKey) {
            toast("Plan local listo — mejorando con IA…", "ok");
            try {
              const ctx = buildDayPlanAiContext(fecha);
              const content = await askAIWithTimeout([
                {
                  role: "system",
                  content: `Eres el planificador de visitas de HomeFinder (renta en Monterrey).
Responde SOLO un JSON válido (sin markdown) con: summary (string corto), warnings (string[]), suggestions ({text,whatsapp?,message?}[]), slots ({key?,apptId?,propertyId,hora,duracion,alias?,colonia?,label,kind,travelMissing?,fixed?}[]), changes ({type:"create"|"update",apptId?,propertyId,fecha,hora,duracion}[]).
Reglas: Confirmada/Reprogramada son fijas; Solicitada es semifija (no muevas su hora en changes; puedes sugerir WhatsApp). Solo crea/reubica citas Por solicitar o candidatos nuevos. No inventes minutos de ruta: usa trasladosMin del contexto. Respeta ventana, duración y margen.`,
                },
                { role: "user", content: JSON.stringify(ctx) },
              ]);
              const parsed = JSON.parse(String(content || "").replace(/```json|```/g, "").trim());
              const aiPlan = normalizeAiDayPlan(parsed, fecha);
              if (aiPlan?.slots?.length) {
                saveDayPlan(aiPlan);
                toast("Propuesta con IA lista", "ok");
                return;
              }
              toast("IA sin slots útiles — se mantiene el plan local", "err");
            } catch (e) {
              toast(e?.message === "timeout" ? "IA tardó demasiado — plan local" : "IA no disponible — plan local", "err");
            }
            return;
          }

          toast("Propuesta local lista", "ok");
        } catch (e) {
          toast(e?.message || "No se pudo generar la propuesta", "err");
        } finally {
          plannerBusy.value = false;
        }
      }

      function applyPlanner() {
        const plan = plannerResult.value;
        if (!plan) return;
        const { changes, fecha } = plan;
        for (const ch of changes || []) {
          if (ch.type === "update" && ch.apptId) {
            const a = data.appointments.find((x) => x.id === ch.apptId);
            if (a) { a.hora = ch.hora; a.duracion = ch.duracion; }
          } else if (ch.type === "create") {
            data.appointments.push(newAppt({
              propertyId: ch.propertyId,
              advisorId: propOf(ch.propertyId)?.advisorId || "",
              fecha: ch.fecha || fecha,
              hora: ch.hora,
              duracion: ch.duracion,
              estado: "Por solicitar",
            }));
          }
        }
        if (data.dayPlans?.[fecha]) delete data.dayPlans[fecha];
        persist();
        agendaMode.value = "day";
        toast("Propuesta aplicada. Confirma con los asesores.", "ok");
        nextTick(() => renderDayMap());
      }

      /* ---------- Ranking compare ---------- */
      function toggleCompare(id) {
        const i = compareIds.value.indexOf(id);
        if (i >= 0) compareIds.value.splice(i, 1);
        else if (compareIds.value.length < 3) compareIds.value.push(id);
      }
      function fmtScore(s) { return s == null ? "—" : Number(s).toFixed(2); }

      /* ---------- Settings ---------- */
      function toggleSec(k) { secs[k] = !secs[k]; }
      function addVisitDay() {
        data.config.dias.push({ fecha: "", label: "Nuevo", desde: "09:00", hasta: "20:00" });
        persist();
      }
      function exportBackup() {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `homefinder-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
      }
      function importBackup(ev) {
        const file = ev.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const parsed = JSON.parse(reader.result);
            backups.value = pushBackup(JSON.parse(JSON.stringify(data)), "Pre-importación");
            applyRemote(parsed);
            syncMeta.pending = true;
            saveSyncMeta(syncMeta);
            persist();
            toast("Respaldo importado", "ok");
          } catch (e) { toast("JSON inválido", "err"); }
        };
        reader.readAsText(file);
        ev.target.value = "";
      }
      function restoreBackup(i) {
        const b = backups.value[i];
        if (!b || !confirm("¿Restaurar este respaldo? Se guardará una copia del estado actual.")) return;
        backups.value = pushBackup(JSON.parse(JSON.stringify(data)), "Pre-restauración");
        applyRemote(b.data);
        syncMeta.pending = true;
        saveSyncMeta(syncMeta);
        persist();
        toast("Respaldo restaurado", "ok");
      }

      /* ---------- AI ---------- */
      function ensureAiChats() {
        if (!data.aiChats || typeof data.aiChats !== "object") {
          data.aiChats = emptyAiChats();
        }
        if (!Array.isArray(data.aiChats.chats)) data.aiChats.chats = [];
        if (!data.aiChats.chats.length) {
          const chat = {
            id: uid(),
            title: "Nueva conversación",
            updatedAt: new Date().toISOString(),
            summary: "",
            messages: [],
          };
          data.aiChats.chats.push(chat);
          data.aiChats.activeId = chat.id;
        } else if (!data.aiChats.activeId || !data.aiChats.chats.some((c) => c.id === data.aiChats.activeId)) {
          data.aiChats.activeId = data.aiChats.chats[0].id;
        }
        return data.aiChats;
      }
      function activeAiChat() {
        const chats = data.aiChats?.chats;
        if (!Array.isArray(chats) || !chats.length) return null;
        const id = data.aiChats.activeId;
        return chats.find((c) => c.id === id) || chats[0] || null;
      }
      function uiMessagesFromChat(chat) {
        const msgs = [{ ...AI_WELCOME }];
        for (const m of chat?.messages || []) msgs.push({ role: m.role, content: m.content });
        return msgs;
      }
      function hydrateAiFromData() {
        const chat = activeAiChat();
        aiMessages.value = uiMessagesFromChat(chat);
        pendingActions.value = [];
      }
      function pruneAiChats() {
        ensureAiChats();
        data.aiChats.chats.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
        if (data.aiChats.chats.length <= AI_CHAT_MAX) return;
        const keep = [];
        const active = data.aiChats.chats.find((c) => c.id === data.aiChats.activeId);
        if (active) keep.push(active);
        for (const c of data.aiChats.chats) {
          if (keep.length >= AI_CHAT_MAX) break;
          if (!keep.some((k) => k.id === c.id)) keep.push(c);
        }
        data.aiChats.chats = keep;
      }
      function syncActiveChatFromUi(opts = {}) {
        const chat = activeAiChat();
        if (!chat) return null;
        chat.messages = aiMessages.value
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role, content: clipAiText(m.content) }));
        const firstUser = chat.messages.find((m) => m.role === "user");
        if (firstUser) {
          chat.title = firstUser.content.replace(/\s+/g, " ").trim().slice(0, 40) || "Nueva conversación";
        }
        chat.updatedAt = new Date().toISOString();
        pruneAiChats();
        if (!opts.skipPersist) persist();
        return chat;
      }
      function newAiChat() {
        ensureAiChats();
        const chat = {
          id: uid(),
          title: "Nueva conversación",
          updatedAt: new Date().toISOString(),
          summary: "",
          messages: [],
        };
        data.aiChats.chats.unshift(chat);
        data.aiChats.activeId = chat.id;
        pruneAiChats();
        hydrateAiFromData();
        persist();
      }
      function selectAiChat(id) {
        if (!id || id === data.aiChats?.activeId) return;
        syncActiveChatFromUi({ skipPersist: true });
        if (!data.aiChats.chats.some((c) => c.id === id)) return;
        data.aiChats.activeId = id;
        hydrateAiFromData();
        persist();
      }
      function deleteAiChat(id) {
        ensureAiChats();
        const target = id || data.aiChats.activeId;
        if (!target) return;
        if (!confirm("¿Borrar esta conversación?")) return;
        data.aiChats.chats = data.aiChats.chats.filter((c) => c.id !== target);
        if (data.aiChats.activeId === target) data.aiChats.activeId = data.aiChats.chats[0]?.id || "";
        if (!data.aiChats.chats.length) {
          newAiChat();
          return;
        }
        hydrateAiFromData();
        persist();
      }
      function activeAiSummary() {
        return activeAiChat()?.summary || "";
      }
      function openAiPanel() {
        ensureAiChats();
        if (!aiMessages.value?.length) hydrateAiFromData();
        aiOpen.value = true;
      }
      function formatAiChatLabel(c) {
        if (!c) return "";
        const title = c.title || "Nueva conversación";
        const d = c.updatedAt ? new Date(c.updatedAt) : null;
        const when = d && !Number.isNaN(d.getTime())
          ? d.toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
          : "";
        return when ? `${title} · ${when}` : title;
      }

      function formatPropServiciosAi(p) {
        const map = p?.servicios && typeof p.servicios === "object" ? p.servicios : {};
        const cats = allPlaceCats.value;
        const parts = [];
        let total = 0;
        let catsWithData = 0;
        for (const cat of cats) {
          const list = Array.isArray(map[cat.key]) ? map[cat.key].filter(Boolean) : [];
          if (!list.length) continue;
          catsWithData += 1;
          total += list.length;
          const items = list.map((s) => {
            const dist = [
              s.min != null ? `${s.min}min` : null,
              s.km != null ? `${s.km}km` : null,
            ].filter(Boolean).join("/");
            return `${s.nombre || "sin nombre"}${dist ? `(${dist})` : ""}`;
          }).join(", ");
          parts.push(`${cat.label}[${list.length}]: ${items}`);
        }
        if (!parts.length) return "serviciosCercanos=sin_dato (aún no buscados en la ficha)";
        return `serviciosCount=${total} categoriasConDato=${catsWithData} | ${parts.join(" || ")}`;
      }

      function formatPropFichaAi(p) {
        const pre = scoreEval(p, "pre", data.config.ponderaciones);
        const post = scoreEval(p, "post", data.config.ponderaciones);
        const c = p.costos || {};
        const f = p.fisicas || {};
        const e = p.espacios || {};
        const am = p.amenidades?.items || {};
        const reqs = (p.requisitos?.items || [])
          .filter((r) => r.estado && r.estado !== "no_solicitado")
          .map((r) => `${r.nombre}:${r.estado}${r.costo != null ? `($${r.costo})` : ""}`)
          .join(", ") || "ninguno_activo";
        const citasN = data.appointments.filter((a) => a.propertyId === p.id && a.estado !== "Cancelada").length;
        const comentarios = (p.comentarios || []).slice(0, 3).map((x) => `${x.autor}: ${x.texto}`).join(" | ") || "ninguno";
        const espacios = Object.entries(e).filter(([, v]) => v && v !== "pc").map(([k, v]) => `${k}=${v}`).join(",") || "sin_dato";
        const amenidades = Object.entries(am).filter(([, v]) => v === "si" || v === true).map(([k]) => k).join(",") || "sin_dato";
        return [
          `[${p.id}] ${p.alias || "Sin nombre"}`,
          `colonia=${p.colonia || "—"} | direccion=${formatDireccionMX(p) || p.direccion || "—"} | estado=${p.estado || "—"}`,
          `registradoPor=${p.registradoPor || "?"} | vistoAtziri=${haVisto(p, "Atziri") ? "si" : "no"} | vistoBrandon=${haVisto(p, "Brandon") ? "si" : "no"} | favorita=${!!p.favorita}`,
          `renta=${c.renta ?? "—"} | mant=${c.mantenimiento ?? "—"} | deposito=${c.deposito ?? "—"} | totalMes=${totalMensual(p) ?? "—"} | desembolso=${desembolsoInicial(p) ?? "—"} | serviciosIncluidos=${c.serviciosIncluidos || "—"}`,
          `rec=${f.recamaras ?? "—"} | banos=${f.banos ?? "—"} | estac=${f.estacionamiento ?? "—"} | m2=${f.m2Const ?? "—"} | amueblado=${p.amueblado || "—"}`,
          `perros=${p.perros?.acepta || "—"} | perrosNota=${p.perros?.notas || "—"}`,
          `espacios={${espacios}} | amenidadesSi={${amenidades}}`,
          `alTec=${p.trasladoTrabajo?.min ?? "Sin dato"}min / ${p.trasladoTrabajo?.km ?? "?"}km (${p.trasladoTrabajo?.fuente || "—"})`,
          formatPropServiciosAi(p),
          `requisitos=[${reqs}] | contrato=${p.requisitos?.duracionContrato || "—"} | condiciones=${p.requisitos?.condiciones || "—"}`,
          `pre=${pre.score?.toFixed(2) ?? "Sin evaluar"}(${pre.pct}%) | post=${post.score?.toFixed(2) ?? "Sin evaluar"}(${post.pct}%)`,
          `asesor=${advisorName(advisorIdForProp(p)) || advisorName(p.advisorId)} | citasActivas=${citasN} | descarte=${p.descarte ? p.descarte.motivo : "no"}`,
          `comentarios=[${comentarios}] | obs=${(p.observaciones || "").slice(0, 160) || "—"}`,
        ].join("\n  ");
      }

      function buildContext() {
        const lines = [];
        lines.push(`Fecha actual del sistema: ${new Date().toISOString()}`);
        lines.push(`Persona activa en este dispositivo: ${data.config.personaActiva || "Brandon"}`);
        lines.push(`Punto de trabajo: ${data.config.trabajo.nombre}`);
        lines.push(`Presupuesto: ${data.config.presupuesto ?? "no definido"}`);
        lines.push(`Días de visita: ${data.config.dias.map((d) => `${d.fecha} ${d.desde}-${d.hasta}`).join("; ")}`);
        lines.push("\nPROPIEDADES (ficha completa; usa estos campos para comparar):");
        for (const p of data.properties) {
          lines.push("- " + formatPropFichaAi(p));
        }
        lines.push("\nASESORES:");
        for (const a of data.advisors) {
          lines.push(`- [${a.id}] ${a.nombre} | ${a.inmobiliaria} | registradoPor=${a.registradoPor || "?"} | wa=${a.whatsapp || a.telefono} | seguimiento=${a.proximoSeguimiento || "—"} | pendientes=${(a.bitacora || []).filter((b) => b.pendiente).length}`);
        }
        lines.push("\nCITAS:");
        for (const a of data.appointments) {
          lines.push(`- [${a.id}] ${a.fecha} ${a.hora} ${a.duracion}min | ${propName(a.propertyId)} | estado=${a.estado} | asesor=${advisorName(a.advisorId || "")} | notas=${a.notas || ""}`);
        }
        return lines.join("\n");
      }

      async function askAI(messages) {
        const key = data.config.openaiKey;
        if (!key) throw new Error("Configura tu API key de OpenAI en Ajustes.");
        const model = data.config.openaiModel || "gpt-4o-mini";
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
          body: JSON.stringify({ model, temperature: 0.3, messages }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error?.message || "OpenAI error " + res.status);
        }
        const json = await res.json();
        return json.choices?.[0]?.message?.content || "";
      }

      async function maybeSummarizeActiveChat() {
        const chat = activeAiChat();
        if (!chat || chat.messages.length <= AI_MSG_LIVE_MAX) return;
        const keep = chat.messages.slice(-AI_MSG_KEEP);
        const old = chat.messages.slice(0, -AI_MSG_KEEP);
        const prompt = `Resume de forma compacta (máximo 400 palabras, español) esta conversación sobre búsqueda de casa en renta.
Incluye preferencias, decisiones, propiedades mencionadas y pendientes.
No inventes datos.

Resumen previo:
${chat.summary || "(ninguno)"}

Mensajes a comprimir:
${old.map((m) => `${m.role}: ${m.content}`).join("\n")}`;
        aiSummarizing.value = true;
        try {
          const summary = await askAI([{ role: "user", content: prompt }]);
          chat.summary = clipAiText(summary, 8000);
          chat.messages = keep;
          chat.updatedAt = new Date().toISOString();
          hydrateAiFromData();
          toast("Conversación resumida para seguir el hilo", "ok");
        } catch (e) {
          toast("No se pudo resumir el chat; se reintentará después", "err");
        } finally {
          aiSummarizing.value = false;
        }
      }

      async function sendAI() {
        const text = aiInput.value.trim();
        if (!text || aiBusy.value) return;
        ensureAiChats();
        aiMessages.value.push({ role: "user", content: clipAiText(text) });
        aiInput.value = "";
        aiBusy.value = true;
        await nextTick();
        if (aiMsgs.value) aiMsgs.value.scrollTop = aiMsgs.value.scrollHeight;
        try {
          const chat = activeAiChat();
          const system = `Eres el asistente de HomeFinder, una app personal para buscar casa en renta en Monterrey.
Debes basarte SOLO en el contexto de registros (fichas) proporcionado.
Cada propiedad incluye costos, espacios, mascotas, requisitos, traslado al Tec, servicios cercanos, evaluación, asesor, citas y comentarios.
Para preguntas de comparación (p. ej. "cuál tiene más servicios cerca"):
- Usa serviciosCount y las categorías listadas en serviciosCercanos.
- Si dice serviciosCercanos=sin_dato, indícalo; no inventes comercios ni distancias.
- También puedes usar alTec, totalMes, perros, espacios y scores cuando aporten.
Distingue claramente: **Registrado**, **Por confirmar** y **Sugerencia**.
No inventes datos faltantes.
Si propones cambios (citas, estados), añade al final un bloque JSON así:
\`\`\`acciones
[{"type":"create_appt|update_appt|set_estado","descripcion":"...","payload":{...}}]
\`\`\`
Contexto:\n${buildContext()}`;
          const history = [];
          if (chat?.summary) {
            history.push({
              role: "system",
              content: "Resumen de la conversación hasta ahora:\n" + chat.summary,
            });
          }
          const live = aiMessages.value
            .filter((m) => m.role === "user" || m.role === "assistant")
            .slice(-AI_MSG_KEEP)
            .map((m) => ({ role: m.role, content: m.content }));
          history.push(...live);
          const content = await askAI([{ role: "system", content: system }, ...history]);
          aiMessages.value.push({ role: "assistant", content: clipAiText(content) });
          const match = content.match(/```acciones\s*([\s\S]*?)```/);
          if (match) {
            try { pendingActions.value = JSON.parse(match[1]); }
            catch { pendingActions.value = []; }
          } else pendingActions.value = [];
          syncActiveChatFromUi({ skipPersist: true });
          await maybeSummarizeActiveChat();
          persist();
        } catch (e) {
          aiMessages.value.push({ role: "assistant", content: "Error: " + e.message });
          syncActiveChatFromUi();
        } finally {
          aiBusy.value = false;
          await nextTick();
          if (aiMsgs.value) aiMsgs.value.scrollTop = aiMsgs.value.scrollHeight;
        }
      }

      function applyAIActions() {
        for (const a of pendingActions.value) {
          const p = a.payload || {};
          if (a.type === "set_estado" && p.propertyId && p.estado) {
            const prop = propOf(p.propertyId);
            if (prop) changeEstado(prop, p.estado);
          } else if (a.type === "create_appt") {
            data.appointments.push(newAppt({
              propertyId: p.propertyId, fecha: p.fecha, hora: p.hora,
              duracion: p.duracion || data.config.duracionDefault, estado: p.estado || "Por solicitar", notas: p.notas || "",
            }));
            persist();
          } else if (a.type === "update_appt" && p.id) {
            const ap = data.appointments.find((x) => x.id === p.id);
            if (ap) { Object.assign(ap, p); persist(); }
          }
        }
        pendingActions.value = [];
        toast("Acciones aplicadas", "ok");
      }

      function openPasteAd() {
        pasteText.value = "";
        extractForm.value = null;
        modals.pasteAd = true;
      }
      async function extractAd() {
        aiBusy.value = true;
        try {
          const content = await askAI([
            {
              role: "system",
              content: `Extrae datos de un anuncio inmobiliario de Monterrey. Responde SOLO un JSON válido con estas claves (usa null si no aparece en el texto; NUNCA inventes): alias, calle, numeroExt, numeroInt, colonia, municipio, estadoMx, cp, renta, mantenimiento, deposito, recamaras, banos, estacionamiento, m2Const, amueblado (sin|semi|full|pc), perros (si|no|pc), jardin (si|no|pc), terraza (si|no|pc), enlace, observaciones. Sin markdown.`,
            },
            { role: "user", content: pasteText.value },
          ]);
          const json = JSON.parse(content.replace(/```json|```/g, "").trim());
          extractForm.value = {
            alias: json.alias || "",
            calle: json.calle || "",
            numeroExt: json.numeroExt || "",
            numeroInt: json.numeroInt || "",
            colonia: json.colonia || "",
            municipio: json.municipio || "",
            estadoMx: json.estadoMx || "Nuevo León",
            cp: json.cp || "",
            renta: json.renta ?? null,
            mantenimiento: json.mantenimiento ?? null,
            recamaras: json.recamaras ?? null,
            banos: json.banos ?? null,
            estacionamiento: json.estacionamiento ?? null,
            amueblado: json.amueblado || "pc",
            perros: json.perros || "pc",
            enlace: json.enlace || "",
            observaciones: json.observaciones || "",
            jardin: json.jardin || "pc",
            terraza: json.terraza || "pc",
            deposito: json.deposito ?? null,
            m2Const: json.m2Const ?? null,
            registradoPor: data.config.personaActiva || "Brandon",
          };
        } catch (e) {
          toast("No se pudo extraer: " + e.message, "err");
        } finally { aiBusy.value = false; }
      }
      function saveExtracted() {
        const f = extractForm.value;
        if (!f) return;
        const p = newProperty({
          alias: f.alias || (f.colonia ? "Casa " + f.colonia : "Desde anuncio"),
          calle: f.calle || "",
          numeroExt: f.numeroExt || "",
          numeroInt: f.numeroInt || "",
          colonia: f.colonia || "",
          municipio: f.municipio || "",
          estadoMx: f.estadoMx || "Nuevo León",
          cp: f.cp || "",
          enlace: f.enlace,
          observaciones: f.observaciones,
          amueblado: f.amueblado,
          registradoPor: f.registradoPor || data.config.personaActiva || "Brandon",
          costos: { ...newProperty().costos, renta: f.renta, mantenimiento: f.mantenimiento, deposito: f.deposito },
          fisicas: { ...newProperty().fisicas, recamaras: f.recamaras, banos: f.banos, estacionamiento: f.estacionamiento, m2Const: f.m2Const },
          espacios: { jardin: f.jardin || "pc", terraza: f.terraza || "pc", balcon: "pc" },
          perros: { ...newProperty().perros, acepta: f.perros || "pc" },
        });
        syncDireccionFromMx(p);
        if (p.perros.acepta === "no") {
          p.estado = "Descartada";
          p.descarte = { motivo: "mascotas", nota: "Extraído del anuncio", fecha: new Date().toISOString().slice(0, 10), estadoPrevio: "Por revisar" };
        }
        data.properties.unshift(p);
        persist();
        modals.pasteAd = false;
        geocodeProperty(p, { silent: true });
        toast("Propiedad creada desde anuncio", "ok");
        if (p.enlace) applyCoverPhoto(p, { notify: true });
        openProperty(p.id);
      }

      /* ---------- Watchers / lifecycle ---------- */
      watch(agendaDay, () => { nextTick(() => renderDayMap()); });
      watch(agendaMode, (m) => { if (m === "day") nextTick(() => renderDayMap()); });
      watch(view, (v) => { if (v === "agenda") nextTick(() => renderDayMap()); });
      watch(
        () => [
          modals.appt,
          apptForm.fecha,
          apptForm.hora,
          apptForm.duracion,
          apptForm.propertyId,
          apptFormConflictOthers.value.map((d) => d.id).join(","),
        ],
        () => {
          clearTimeout(apptResolveTimer);
          if (!modals.appt) {
            clearApptResolve();
            return;
          }
          apptResolveTimer = setTimeout(async () => {
            if (!apptFormConflictOthers.value.length) {
              clearApptResolve();
              return;
            }
            const fp = apptResolveKey();
            if (fp === apptResolveFingerprint && apptResolveOptions.value.length) return;
            await suggestApptResolve({ quiet: true });
          }, 600);
        }
      );

      onMounted(async () => {
        if (!syncConfigured()) {
          syncMeta.pending = false;
          saveSyncMeta(syncMeta);
        }
        updateSyncLabel();
        hydrateAiFromData();
        if (data.config.mapsKey) ensureMaps();
        if (syncConfigured()) {
          await pullFromGist({ silent: true });
          if (syncMeta.pending) schedulePush();
        }
        hydrateAiFromData();

        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible" && syncConfigured()) pullFromGist({ silent: true });
        });
        window.addEventListener("keydown", (ev) => {
          if (ev.key !== "Escape") return;
          if (apptMenuId.value) { apptMenuId.value = null; return; }
          if (rankFilterModal.open) { closeRankFilter(); return; }
          if (modals.discard) { modals.discard = false; return; }
          if (modals.appt) { modals.appt = false; return; }
          if (modals.advisor) { closeAdvisorForm(); return; }
          if (modals.quickAdd) { closeQuickAdd(); return; }
          if (modals.pasteAd) { modals.pasteAd = false; return; }
          if (showCompare.value) { showCompare.value = false; return; }
          if (modals.property) { closeProperty(); return; }
          if (aiOpen.value) { aiOpen.value = false; }
        });
        window.addEventListener("online", () => {
          updateSyncLabel();
          if (!syncConfigured()) return;
          pullFromGist({ silent: true }).then(() => { if (syncMeta.pending) pushToGist(); });
        });
        window.addEventListener("offline", updateSyncLabel);
        setInterval(() => {
          if (!polling && navigator.onLine && syncConfigured() && data.config.gistId) {
            polling = true;
            pullFromGist({ silent: true }).finally(() => { polling = false; });
          }
        }, 60000);
      });

      return {
        // const
        PROPERTY_STATES, APPT_STATES, DIM_LABELS, AMENITY_KEYS, PLACE_CATS, PERSONAS,
        // state
        data, view, navItems, sync, conflict, toasts, backups, modals,
        quickForm, pasteText, extractForm, discardForm, apptForm, advisorForm, commentForm,
        editingProp, propTab, propTabs, photoUrl, photoBusy, galleryAddOpen, lightbox, photoMode, uploadProgress,
        captureInputEl, uploadInputEl, newReqName, openReqs, manualTravel,
        propFilter, agendaDay, agendaMode, plannerResult, plannerBusy,
        rankOnlyEligible, rankColSort, rankFilters, toggleRankSort, rankSortMark,
        rankFilterModal, rankFilterDraft, rankFilterActive, openRankFilter, closeRankFilter,
        applyRankFilter, clearRankFilterCol, clearAllRankFilters, rankAnyFilterActive,
        rankFilterModalTitle, rankFilterModalType,
        compareIds, showCompare, secs,
        mapsReady, mapsBusy, propMapEl, propTabsEl, dayMapEl, overviewMapEl, showOverviewMap, overviewMapOpts,
        overviewSelectedId, overviewShowWork, overviewSelected, overviewSelectedAppt, overviewSelectedFotos, closeOverviewDetail, openOverviewWork, openOverviewWorkMaps, openOverviewProperty, openOverviewEnlace, openOverviewGallery, focusOverviewProperty, propFotos, propHasFotos,
        aiOpen, aiInput, aiMessages, aiBusy, aiSummarizing, pendingActions, aiMsgs,
        activeAiSummary, formatAiChatLabel,
        // computed
        filteredProperties, eligibleProperties, discardedProperties, stats,
        upcomingAppts, pendingConfirm, advisorFollowups, rankedProperties, top5,
        compareProps, weightsSum, dayAppts, dayConflicts, dayConflictIds, apptHasConflict,
        apptFormConflicts, apptFormConflictOthers, apptResolveOptions, apptResolveBusy,
        // methods
        money, totalMensual, desembolsoInicial, reqCosts, amuebladoLabel, descarteLabel,
        formatDay, formatDayShort, scoreEval, fmtScore, persist, formatDireccionMX, saveMxAddress,
        openQuickAdd, closeQuickAdd, quickNewPropertyForAppt, saveQuickAdd, propertyAssignTarget,
        openProperty, closeProperty, saveEditingProp, onPropTab,
        duplicateProp, deleteProp, changeEstado, confirmDiscard, onPerrosChange,
        setTri, setScore, addPhotoUrl, removePhoto, setCoverPhoto, onEnlaceChange,
        cloudinaryConfigured, toggleGalleryAdd, chooseGalleryPhone, chooseGalleryListing,
        startPhotoMode, endPhotoMode, pickCaptures, pickUploads,
        onCaptureFilesSelected, onUploadFilesSelected, fotoFuenteLabel, fotoFuenteBadge,
        openLightbox, closeLightbox, lightboxPrev, lightboxNext, lightboxPhotos,
        addCustomReq, removeReq, reqProgress, toggleReqOpen, tabBadge, quickNewAdvisor,
        propOf, propName, advisorOf, advisorName, apptAdvisorLine, propsOfAdvisor, apptsOf,
        openAdvisorForm, closeAdvisorForm, saveAdvisor, deleteAdvisor, addAdvisorNote,
        otraPersona, haVisto, toggleVisto, marcarVistoYo, addComentario, removeComentario, formatCommentDate,
        apptMenuId, toggleApptMenu, editApptFromMenu, deleteApptFromMenu,
        openApptForm, onApptPropertyChange, quickNewAdvisorForAppt, saveAppt, deleteAppt,
        applyApptResolve, suggestApptResolve, clearApptResolve, resolveOptLabel, conflictTravelLine,
        apptClass, apptBadgeClass, estadoBadge, dayWindowLabel,
        travelBetween, calcDayTravel, calcWorkTravelFor, onCoordsChange, saveManualTravel, formatTrasladoMeasure, geocodeProperty,
        allPlaceCats, customCatForm, serviciosOf, formatServicioLine, openServicioRoute,
        searchBasicPlaces, searchOnePlace, addCustomPlaceCat, removeCustomPlaceCat,
        openInMaps, navigateTo, toggleOverviewMap, refreshOverviewMapLabels, mapQuery,
        openWhatsApp, whatsappForProp, whatsappForAppt,
        openDayPlanner, runPlanner, calcPlannerTravel, calcDayTravelBtn, applyPlanner, discardDayPlan, toggleCompare,
        toggleSec, addVisitDay, exportBackup, importBackup, restoreBackup,
        retrySync, forcePull, forcePush, resolveConflict, onMapsKeyChange,
        sendAI, openAiPanel, newAiChat, selectAiChat, deleteAiChat, applyAIActions, openPasteAd, extractAd, saveExtracted,
      };
    },
  }).mount("#app");
})();
