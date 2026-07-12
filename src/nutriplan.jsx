import { useState, useMemo, useEffect, useRef, Fragment } from "react";

// ── BASE DE DATOS DE ALIMENTOS ─────────────────────────────────────────
// ── Diccionario es↔en de alimentos comunes (para mejorar búsquedas en FatSecret) ──
const TRADUCCION_ALIMENTOS = {
  "papa": "potato", "papas": "potatoes", "cebolla": "onion", "cebollas": "onions",
  "zanahoria": "carrot", "zanahorias": "carrots", "manzana": "apple", "manzanas": "apples",
  "platano": "banana", "plátano": "banana", "platanos": "bananas", "plátanos": "bananas",
  "pollo": "chicken", "res": "beef", "carne": "meat", "puerco": "pork", "cerdo": "pork",
  "pescado": "fish", "atun": "tuna", "atún": "tuna", "huevo": "egg", "huevos": "eggs",
  "leche": "milk", "queso": "cheese", "yogur": "yogurt", "yogurt": "yogurt",
  "arroz": "rice", "frijol": "bean", "frijoles": "beans", "lenteja": "lentil", "lentejas": "lentils",
  "avena": "oats", "pan": "bread", "tortilla": "tortilla", "pasta": "pasta",
  "tomate": "tomato", "jitomate": "tomato", "tomates": "tomatoes", "jitomates": "tomatoes",
  "lechuga": "lettuce", "espinaca": "spinach", "espinacas": "spinach", "brocoli": "broccoli", "brócoli": "broccoli",
  "calabaza": "squash", "calabacita": "zucchini", "pepino": "cucumber", "pimiento": "bell pepper",
  "chile": "chili pepper", "ajo": "garlic", "elote": "corn", "maiz": "corn", "maíz": "corn",
  "naranja": "orange", "naranjas": "oranges", "limon": "lime", "limón": "lime",
  "fresa": "strawberry", "fresas": "strawberries", "uva": "grape", "uvas": "grapes",
  "sandia": "watermelon", "sandía": "watermelon", "melon": "melon", "melón": "melon",
  "pina": "pineapple", "piña": "pineapple", "mango": "mango", "papaya": "papaya",
  "aguacate": "avocado", "aceite": "oil", "mantequilla": "butter", "crema": "cream",
  "almendra": "almond", "almendras": "almonds", "nuez": "walnut", "nueces": "walnuts",
  "cacahuate": "peanut", "cacahuates": "peanuts", "tocino": "bacon", "jamon": "ham", "jamón": "ham",
  "salchicha": "sausage", "azucar": "sugar", "azúcar": "sugar", "miel": "honey",
  "harina": "flour", "camote": "sweet potato", "betabel": "beet", "apio": "celery",
  "col": "cabbage", "coliflor": "cauliflower", "champinon": "mushroom", "champiñón": "mushroom",
  "champinones": "mushrooms", "champiñones": "mushrooms", "ejote": "green bean", "ejotes": "green beans",
};
// Inverso (en→es) para mostrar el nombre en español junto al resultado en inglés
const TRADUCCION_INVERSA = Object.entries(TRADUCCION_ALIMENTOS).reduce((acc, [es, en]) => {
  acc[en.toLowerCase()] = es;
  return acc;
}, {});

function traducirParaBusqueda(query) {
  const q = query.trim().toLowerCase();
  return TRADUCCION_ALIMENTOS[q] || null;
}

function traducirNombreResultado(nombreIngles) {
  const n = nombreIngles.trim().toLowerCase();
  if (TRADUCCION_INVERSA[n]) return TRADUCCION_INVERSA[n];
  // intenta match por la primera palabra del nombre, ej: Potatoes Flesh Boiled -> potatoes
  const primera = n.split(/[\s,(]/)[0];
  return TRADUCCION_INVERSA[primera] || null;
}

// ── Heurística genérico vs platillo compuesto ──────────────────────────
// FatSecret a veces devuelve solo platillos preparados (ej. "Papas Gratinadas")
// en vez del alimento genérico (ej. "Potatoes"). Esto detecta cuáles son
// probablemente platillos compuestos para poder mostrarlos después.
const PALABRAS_COMPUESTO = [
  "with", "casserole", "salad", "soup", "pie", "fries", "fried", "sandwich",
  "burger", "stuffed", "style", "mix", "bake", "baked", "stew", "gratin",
  "mashed", "chowder", "skillet", "bowl", "wrap", "taco", "burrito",
  "quesadilla", "empanada", "nuggets", "croquettes", "chips", "sauce",
  "casera", "guisad", "ensalada", "sopa", "rellen", "gratinad", "milanesa",
  "tortita", "frit",
];

function esResultadoGenerico(nombreIngles, terminoEsperado) {
  const n = (nombreIngles || "").trim().toLowerCase();
  if (PALABRAS_COMPUESTO.some(p => n.includes(p))) return false;
  const cantidadPalabras = n.split(/\s+/).filter(Boolean).length;
  if (!terminoEsperado) return cantidadPalabras <= 2;
  const t = terminoEsperado.trim().toLowerCase();
  const raizT = t.replace(/s$/, "");
  // Genérico si el nombre empieza con el término esperado (singular o plural)
  // y no le sobran más de una palabra descriptiva (ej. "raw", "boiled").
  if (n.startsWith(t) || n.startsWith(raizT)) {
    const sobrante = n.replace(raizT, "").trim().split(/\s+/).filter(Boolean);
    return sobrante.length <= 1;
  }
  return cantidadPalabras <= 2;
}

// ── Fecha local (YYYY-MM-DD) — evita que el corte UTC desfase el "día de hoy" ──
function fechaLocalISO(d = new Date()) {
  const offsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 10);
}

// ── Formatea "2026-06-18" o "2026-06-18T00:00:00.000Z" → "18 jun 2026" ──
function formatearFecha(fechaStr) {
  if (!fechaStr) return fechaStr;
  const solo = fechaStr.slice(0, 10); // toma solo YYYY-MM-DD
  const [y, m, d] = solo.split("-").map(Number);
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${d} ${meses[m - 1]} ${y}`;
}

// ── Calcula totales de macros/costo para un plan guardado (no es el estado en vivo) ──
function calcularTotalesDe(seleccion, porciones, precios) {
  const all = [...(seleccion?.proteinas || []), ...(seleccion?.carbohidratos || []), ...(seleccion?.lipidos || [])];
  return all.reduce((acc, f) => {
    const factor = (porciones?.[f.id] ?? f.porcion) / f.porcion;
    return { calorias: acc.calorias + f.calorias * factor, proteinas: acc.proteinas + f.proteinas * factor, carbos: acc.carbos + f.carbos * factor, lipidos: acc.lipidos + f.lipidos * factor, costo: acc.costo + costoPorcion(f, precios) * factor };
  }, { calorias: 0, proteinas: 0, carbos: 0, lipidos: 0, costo: 0 });
}

const FOOD_DB = {
  proteinas: [
    { id: "p1", nombre: "Tocino",        porcion: 70,  proteinas: 25.928, carbos: 1.001, lipidos: 25.928, calorias: 378.7, precio_kg: 180, prep: "rapido"   },
    { id: "p2", nombre: "Atún",          porcion: 400, proteinas: 102.04, carbos: 0,     lipidos: 3.28,   calorias: 464,   precio_kg: 95,  prep: "rapido"   },
    { id: "p3", nombre: "Huevo Revuelto",porcion: 250, proteinas: 34.6,   carbos: 5.2,   lipidos: 40.45,  calorias: 530,   precio_kg: 55,  prep: "rapido"   },
    { id: "p4", nombre: "Jamón Pavo",    porcion: 300, proteinas: 36,     carbos: 22.5,  lipidos: 7.2,    calorias: 300,   precio_kg: 130, prep: "rapido"   },
    { id: "p5", nombre: "Picadillo",     porcion: 400, proteinas: 80,     carbos: 0,     lipidos: 40,     calorias: 704,   precio_kg: 120, prep: "elaborado"},
    { id: "p6", nombre: "Huevo Rev (2)", porcion: 150, proteinas: 20.76,  carbos: 3.12,  lipidos: 24.27,  calorias: 318,   precio_kg: 55,  prep: "rapido"   },
  ],
  carbohidratos: [
    { id: "c1", nombre: "Frijol",        porcion: 300,  proteinas: 16.62, carbos: 64.17,  lipidos: 15.45, calorias: 453,   precio_kg: 35, prep: "moderado"  },
    { id: "c2", nombre: "Sandía",        porcion: 1500, proteinas: 9.15,  carbos: 113.25, lipidos: 2.25,  calorias: 450,   precio_kg: 12, prep: "rapido"    },
    { id: "c3", nombre: "Melón",         porcion: 1000, proteinas: 8.4,   carbos: 81.6,   lipidos: 1.9,   calorias: 340,   precio_kg: 18, prep: "rapido"    },
    { id: "c4", nombre: "Verduras",      porcion: 90,   proteinas: 2.331, carbos: 8.631,  lipidos: 0.225, calorias: 44.1,  precio_kg: 25, prep: "rapido"    },
    { id: "c5", nombre: "Frijoles (2)",  porcion: 400,  proteinas: 22.16, carbos: 85.56,  lipidos: 20.6,  calorias: 604,   precio_kg: 35, prep: "moderado"  },
  ],
  lipidos: [
    { id: "l1", nombre: "Aguacate",      porcion: 150, proteinas: 3,     carbos: 12.795, lipidos: 21.99, calorias: 240,   precio_kg: 45, prep: "rapido"    },
    { id: "l2", nombre: "Aguacate (2)",  porcion: 150, proteinas: 3,     carbos: 12.795, lipidos: 21.99, calorias: 240,   precio_kg: 45, prep: "rapido"    },
  ],
};

const PREP_INFO = {
  rapido:    { icon: "⚡", label: "<10 min",   color: "#81C784" },
  moderado:  { icon: "🕐", label: "10-20 min", color: "#FFB74D" },
  elaborado: { icon: "🍳", label: ">20 min",   color: "#ef5350" },
};

const PROTOCOLOS = {
  estandar: {
    id: "estandar", label: "Estándar", icon: "🍽️",
    desc: "Distribución clásica de macros. Sin restricciones de horario ni alimentos.",
    advertencia: null,
    ciencia: "La frecuencia de comidas no acelera el metabolismo — lo que importa es el total calórico y la distribución de macros.",
    ajusteMacros: null,
    objetivosPermitidos: ["bajar", "quemar", "mantener", "masa"],
    ketoExcluye: [],
  },
  keto: {
    id: "keto", label: "Cetogénica (Keto)", icon: "🥑",
    desc: "Muy bajo en carbohidratos, alto en grasas. Induce cetosis para quemar grasa como combustible.",
    advertencia: "⚠️ Keto requiere adaptación de 2-4 semanas. Puedes sentir fatiga, irritabilidad y dolor de cabeza al inicio (keto flu). No recomendado si tienes diabetes tipo 1 o problemas renales.",
    ciencia: "Meta-análisis (Frontiers in Nutrition, 2022): dietas cetogénicas producen mayor pérdida de grasa a corto plazo, pero requieren adherencia estricta (carbos <50g/día).",
    ajusteMacros: { p: 0.25, c: 0.05, l: 0.70 },
    objetivosPermitidos: ["bajar", "quemar", "mantener"],
    ketoExcluye: ["c1", "c2", "c3", "c5"],
  },
  ayuno16: {
    id: "ayuno16", label: "Ayuno Intermitente 16:8", icon: "⏱️",
    desc: "16 horas de ayuno, 8 horas de alimentación. Los mismos macros concentrados en una ventana horaria.",
    advertencia: "⚠️ En ayuno intermitente se eleva la proteína para proteger músculo durante las horas de restricción. Esto modifica tu distribución de macros habitual.",
    ciencia: "El mito de '5-6 comidas aceleran el metabolismo' está refutado (Schoenfeld et al., 2015). Lo que importa es el balance calórico total. El ayuno 16:8 mejora sensibilidad a insulina y facilita déficit calórico.",
    ajusteMacros: { p: 0.45, c: 0.35, l: 0.20 },
    objetivosPermitidos: ["bajar", "quemar", "mantener", "masa"],
    ketoExcluye: [],
  },
  ayuno18: {
    id: "ayuno18", label: "Ayuno Intermitente 18:6", icon: "⏱️",
    desc: "18 horas de ayuno, 6 horas de alimentación. Protocolo más avanzado.",
    advertencia: "⚠️ Protocolo avanzado. Mayor proteína para preservar músculo. No recomendado sin experiencia previa en ayuno.",
    ciencia: "El ayuno 18:6 produce mayor reducción de grasa visceral que el 16:8 en estudios de 8 semanas (Sutton et al., Cell Metabolism 2018).",
    ajusteMacros: { p: 0.48, c: 0.30, l: 0.22 },
    objetivosPermitidos: ["bajar", "quemar"],
    ketoExcluye: [],
  },
  ketoAyuno: {
    id: "ketoAyuno", label: "Keto + Ayuno 16:8", icon: "⚡",
    desc: "Protocolo intensivo. Combina cetosis con ventana de alimentación reducida.",
    advertencia: "⚠️ Protocolo avanzado. No recomendado para principiantes. Adaptación mínima de 4-6 semanas. Consulta a un médico si tienes cualquier condición de salud.",
    ciencia: "La combinación de keto y ayuno potencia la cetosis y la autofagia celular. Mayor pérdida de grasa pero mayor riesgo de pérdida muscular si la proteína no es suficiente.",
    ajusteMacros: { p: 0.30, c: 0.05, l: 0.65 },
    objetivosPermitidos: ["bajar", "quemar"],
    ketoExcluye: ["c1", "c2", "c3", "c5"],
  },
};

const SOMATOTIPOS = [
  { id: "ectomorfo", label: "Ectomorfo", icon: "🦴", desc: "Complexión delgada, metabolismo rápido, dificultad para ganar masa.", rasgos: ["Estructura ósea fina", "Poca grasa y músculo", "Se siente lleno rápido"], nota: "Más carbohidratos en todas las dietas — tu metabolismo los quema sin acumularlos." },
  { id: "mesomorfo", label: "Mesomorfo", icon: "💪", desc: "Complexión atlética, responde bien al ejercicio, facilidad para ganar y perder.", rasgos: ["Hombros anchos, cintura definida", "Gana músculo con facilidad", "Metabolismo equilibrado"], nota: "Distribución estándar óptima. Responde bien a cualquier protocolo." },
  { id: "endomorfo", label: "Endomorfo", icon: "🛡️", desc: "Complexión robusta, tendencia a acumular grasa, metabolismo más lento.", rasgos: ["Marco óseo grande", "Acumula grasa con facilidad", "Buena fuerza natural"], nota: "Más proteína, menos carbos — menor tolerancia a insulina, mayor tendencia a almacenar glucosa como grasa." },
];

const DISTRIBUCIONES = {
  bajar:    { ectomorfo: { p: 0.35, c: 0.35, l: 0.30, factor: 0.85 }, mesomorfo: { p: 0.38, c: 0.32, l: 0.30, factor: 0.80 }, endomorfo: { p: 0.40, c: 0.25, l: 0.35, factor: 0.75 }, default: { p: 0.38, c: 0.30, l: 0.32, factor: 0.80 } },
  quemar:   { ectomorfo: { p: 0.38, c: 0.42, l: 0.20, factor: 0.92 }, mesomorfo: { p: 0.40, c: 0.40, l: 0.20, factor: 0.90 }, endomorfo: { p: 0.43, c: 0.35, l: 0.22, factor: 0.88 }, default: { p: 0.40, c: 0.40, l: 0.20, factor: 0.90 } },
  mantener: { ectomorfo: { p: 0.28, c: 0.47, l: 0.25, factor: 1.00 }, mesomorfo: { p: 0.30, c: 0.45, l: 0.25, factor: 1.00 }, endomorfo: { p: 0.33, c: 0.40, l: 0.27, factor: 1.00 }, default: { p: 0.30, c: 0.44, l: 0.26, factor: 1.00 } },
  masa:     { ectomorfo: { p: 0.30, c: 0.52, l: 0.18, factor: 1.15 }, mesomorfo: { p: 0.33, c: 0.47, l: 0.20, factor: 1.12 }, endomorfo: { p: 0.35, c: 0.45, l: 0.20, factor: 1.08 }, default: { p: 0.33, c: 0.48, l: 0.19, factor: 1.12 } },
};

const OBJETIVOS = [
  { id: "bajar",    label: "Bajar de peso", icon: "↓",  desc: "Déficit calórico controlado" },
  { id: "quemar",   label: "Quemar grasa",  icon: "🔥", desc: "Déficit leve + alto proteína" },
  { id: "mantener", label: "Mantenimiento", icon: "⚖️", desc: "Calorías de equilibrio" },
  { id: "masa",     label: "Ganar masa",    icon: "↑",  desc: "Superávit + alto carbohidrato" },
];

function calcIMC(peso, talla) { return peso / ((talla / 100) ** 2); }

// ── ID anónimo por dispositivo — para persistir registros sin necesitar login (opción B) ──
function getUserId() {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    let id = localStorage.getItem("nutriplan_uid");
    if (!id) {
      id = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : `u_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem("nutriplan_uid", id);
    }
    return id;
  } catch {
    // localStorage puede fallar en modo incógnito estricto o navegación privada
    return `u_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}
function calcTMB(peso, talla, edad, sexo) {
  return sexo === "M" ? 10 * peso + 6.25 * talla - 5 * edad + 5 : 10 * peso + 6.25 * talla - 5 * edad - 161;
}
function calcGrasaCorporal(cintura, cuello, talla, cadera, sexo) {
  if (!cintura || !cuello || !talla) return null;
  if (sexo === "M") {
    const val = 495 / (1.0324 - 0.19077 * Math.log10(cintura - cuello) + 0.15456 * Math.log10(talla)) - 450;
    return Math.max(3, Math.min(60, val));
  } else {
    if (!cadera) return null;
    const val = 495 / (1.29579 - 0.35004 * Math.log10(cintura + cadera - cuello) + 0.22100 * Math.log10(talla)) - 450;
    return Math.max(10, Math.min(70, val));
  }
}
const PROTEINA_G_KG = { bajar: 1.4, quemar: 2.0, mantener: 1.3, masa: 1.9 };
const ACTIVIDAD = { sedentario: 1.2, ligero: 1.375, moderado: 1.55, activo: 1.725, muyactivo: 1.9 };

const PREGUNTAS = [
  { id: "situacion", texto: "¿Cómo describes tu cuerpo hoy?", opciones: [{ id: "sobrepeso", label: "Tengo sobrepeso notorio", icon: "⚖️" }, { id: "algo_grasa", label: "Algo de grasa pero no mucho", icon: "🔸" }, { id: "definir", label: "Peso normal, quiero definirme", icon: "💪" }, { id: "delgado", label: "Estoy delgado, quiero ganar músculo", icon: "🦴" }] },
  { id: "prioridad", texto: "¿Qué es lo más importante para ti?", opciones: [{ id: "bajar_rapido", label: "Bajar de peso lo antes posible", icon: "↓" }, { id: "quemar_grasa", label: "Perder grasa sin sacrificar músculo", icon: "🔥" }, { id: "mantener_salud", label: "Mantener y mejorar mi salud", icon: "⚖️" }, { id: "ganar_masa", label: "Ganar volumen y fuerza", icon: "↑" }] },
  { id: "ejercicio", texto: "¿Cuánto entrenas actualmente?", opciones: [{ id: "nada", label: "Casi nada o nada", icon: "🛋️" }, { id: "ligero", label: "Camino o actividad ligera 1-2x/sem", icon: "🚶" }, { id: "moderado", label: "Entreno 3-4 veces por semana", icon: "🏋️" }, { id: "intenso", label: "Entreno fuerte 5 o más veces", icon: "🔥" }] },
  { id: "historial", texto: "¿Has intentado cambiar tu alimentación antes?", opciones: [{ id: "nunca", label: "Nunca he hecho dieta", icon: "🆕" }, { id: "no_funciono", label: "Lo intenté pero no funcionó", icon: "❌" }, { id: "abandone", label: "Funcionó pero la abandoné", icon: "↩️" }, { id: "tengo_plan", label: "Sigo algún plan actualmente", icon: "✓" }] },
  { id: "restricciones", texto: "¿Tienes alguna restricción alimentaria?", opciones: [{ id: "ninguna", label: "Ninguna", icon: "✅" }, { id: "sin_carne_roja", label: "No como carne roja", icon: "🥩" }, { id: "vegetariano", label: "Soy vegetariano", icon: "🥦" }, { id: "condicion", label: "Tengo diabetes o hipertensión", icon: "💊" }] },
  { id: "comidas", texto: "¿Cuántas veces puedes comer al día?", opciones: [{ id: "2", label: "2 comidas — muy poco tiempo", icon: "⚡" }, { id: "3", label: "3 comidas — tiempo moderado", icon: "🍽️" }, { id: "5", label: "4-5 comidas — tengo flexibilidad", icon: "🕐" }] },
  { id: "tiempoPrep", texto: "¿Cuánto tiempo tienes para preparar tu comida?", opciones: [{ id: "rapido", label: "Menos de 10 minutos — algo rápido", icon: "⚡" }, { id: "moderado", label: "Hasta 20 minutos — sin problema", icon: "🕐" }, { id: "elaborado", label: "Tengo tiempo — puedo cocinar bien", icon: "🍳" }] },
];

function diagnosticarObjetivo(respuestas) {
  const { situacion, prioridad } = respuestas;
  if (situacion === "sobrepeso") return "bajar";
  if (situacion === "delgado" || prioridad === "ganar_masa") return "masa";
  if (prioridad === "mantener_salud") return "mantener";
  if (situacion === "algo_grasa" || situacion === "definir" || prioridad === "quemar_grasa") return "quemar";
  return "quemar";
}

const RESTRICCIONES_FILTRO = { sin_carne_roja: ["p1", "p5"], vegetariano: ["p1", "p5", "p4"], ninguna: [], condicion: [] };

const GUIAS_DIETA = {
  keto: {
    titulo: "Dieta Cetogénica (Keto)", icon: "🥑", color: "#FFB74D",
    resumen: "Alto en grasas, muy bajo en carbohidratos. Induce cetosis — el cuerpo quema grasa como combustible principal.",
    mecanismo: "Al reducir carbos a menos de 50g/día, el cuerpo agota el glucógeno y produce cetonas a partir de grasa. Esto mejora sensibilidad a insulina y acelera la quema de grasa corporal.",
    macros: "25% proteína · 5% carbos · 70% grasas",
    ciencia: "Frontiers in Medicine 2024 · StatPearls 2024 · Frontiers in Nutrition 2025",
    timeline: [
      { dia: "Días 1–2", titulo: "Transición", desc: "El cuerpo agota el glucógeno. Energía normal aún.", color: "#81C784" },
      { dia: "Días 2–4", titulo: "Keto flu", desc: "Fatiga, dolor de cabeza, náusea. Pico de síntomas. Hidratación y electrolitos.", color: "#FFB74D" },
      { dia: "Días 5–7", titulo: "Cetosis iniciando", desc: "Cetonas suben. Empieza claridad mental. Apetito reducido.", color: "#64B5F6" },
      { dia: "Días 8–14", titulo: "Cetosis completa", desc: "La mayoría entra en cetosis. Energía estable. Pérdida de grasa visible.", color: "#CE93D8" },
      { dia: "Semana 3+", titulo: "Adaptación total", desc: "El cuerpo es eficiente quemando grasa. Rendimiento físico se normaliza.", color: "#81C784" },
    ],
    ketoFlu: { normales: ["Dolor de cabeza", "Fatiga", "Náusea leve", "Mareo", "Niebla mental", "Irritabilidad", "Calambres musculares"], parar: ["Palpitaciones fuertes o irregulares", "Dolor en riñones o costado", "Confusión severa después del día 10", "Hipoglucemia extrema (diabéticos)"], remedios: ["Aumentar hidratación — 3L de agua/día", "Electrolitos: sodio, potasio, magnesio", "Caldo de hueso como fuente natural de sodio"] },
    recargas: { descripcion: "La keto cíclica incluye 1–2 días de recarga de carbos por semana para reponer glucógeno muscular.", porSomatotipo: [{ tipo: "Ectomorfo 🦴", protocolo: "Keto cíclica", recargas: "1–2 días/sem desde sem. 3", carbosMax: "30g keto · 150g recarga" }, { tipo: "Mesomorfo 💪", protocolo: "Keto estándar", recargas: "1 día/sem opcional", carbosMax: "50g keto · 120g recarga" }, { tipo: "Endomorfo 🛡️", protocolo: "Keto estricta", recargas: "Sin recargas primeras 6 sem.", carbosMax: "30g/día" }] },
    alimentos: { si: ["Aguacate", "Huevo", "Tocino", "Atún", "Carnes grasas", "Aceite de oliva", "Nueces", "Queso", "Verduras de hoja verde"], no: ["Pan y cereales", "Arroz y pasta", "Frijoles y legumbres", "Frutas (excepto frutos rojos)", "Azúcar", "Leche", "Papas"] },
    advertencias: ["No recomendada en diabetes tipo 1 sin supervisión médica", "Evitar si tienes problemas renales o hepáticos", "Consulta a tu médico si tomas medicamentos para presión o glucosa", "No recomendada para objetivo de ganar masa muscular"],
  },
  ayuno16: {
    titulo: "Ayuno Intermitente 16:8", icon: "⏱️", color: "#64B5F6",
    resumen: "16 horas de ayuno, 8 horas de alimentación. Los mismos macros concentrados en una ventana horaria.",
    mecanismo: "Durante el ayuno, la insulina baja y el cuerpo accede a las reservas de grasa. No es restricción calórica — es restricción temporal. Los macros totales no cambian, solo cuándo los comes.",
    macros: "45% proteína · 35% carbos · 20% grasas",
    ciencia: "Schoenfeld et al. 2015 · Sutton et al. Cell Metabolism 2018 · JAMA Internal Medicine 2020",
    timeline: [
      { dia: "Semana 1", titulo: "Adaptación", desc: "Hambre en horarios acostumbrados. Normal. El cuerpo se ajusta al nuevo ritmo.", color: "#FFB74D" },
      { dia: "Semana 2", titulo: "Transición", desc: "El apetito empieza a regularse. Mejor claridad mental en ayuno.", color: "#64B5F6" },
      { dia: "Semana 3–4", titulo: "Adaptación completa", desc: "Ayuno sin hambre intensa. Energía estable. Pérdida de grasa visible.", color: "#81C784" },
      { dia: "Mes 2+", titulo: "Resultados sostenidos", desc: "Mejora de sensibilidad a insulina documentada. Pérdida de grasa continua.", color: "#CE93D8" },
    ],
    ventanas: [{ nombre: "12:00 pm – 8:00 pm", desc: "La más popular. Compatible con trabajo y vida social.", recomendado: true }, { nombre: "1:00 pm – 9:00 pm", desc: "Para quienes no pueden saltarse el desayuno del todo al inicio." }, { nombre: "10:00 am – 6:00 pm", desc: "Para madrugar y cenar temprano." }],
    ketoFlu: { normales: ["Hambre las primeras 1–2 semanas", "Irritabilidad matutina", "Dificultad para concentrarse en ayuno", "Dolor de cabeza leve"], parar: ["Mareos fuertes o desmayo", "Hipoglucemia severa (diabéticos)", "Pérdida de fuerza muscular notoria", "Trastornos alimenticios previos"], remedios: ["Café o té negro sin azúcar en ayuno", "Agua con electrolitos", "Empezar con 12h e ir subiendo gradualmente"] },
    advertencias: ["No recomendado en embarazo o lactancia", "Precaución en diabéticos — puede causar hipoglucemia", "No recomendado si tienes historial de trastornos alimenticios", "Consulta médico si tomas medicamentos con alimentos"],
  },
  ayuno18: {
    titulo: "Ayuno Intermitente 18:6", icon: "⏱️", color: "#CE93D8",
    resumen: "18 horas de ayuno, 6 horas de alimentación. Protocolo avanzado con mayor quema de grasa.",
    mecanismo: "La ventana más corta profundiza la cetosis metabólica sin entrar en keto estricta. Mayor reducción de insulina y mayor acceso a grasa almacenada.",
    macros: "48% proteína · 30% carbos · 22% grasas",
    ciencia: "Sutton et al. Cell Metabolism 2018: mayor reducción de grasa visceral que 16:8 en estudios de 8 semanas.",
    timeline: [{ dia: "Semana 1–2", titulo: "Adaptación", desc: "Más difícil que 16:8. Se recomienda venir de 16:8 previo.", color: "#FFB74D" }, { dia: "Semana 3–4", titulo: "Transición", desc: "El cuerpo se adapta. Claridad mental pronunciada.", color: "#64B5F6" }, { dia: "Mes 2+", titulo: "Resultados", desc: "Mayor pérdida de grasa visceral que 16:8.", color: "#81C784" }],
    ventanas: [{ nombre: "1:00 pm – 7:00 pm", desc: "La más común. 2 comidas principales.", recomendado: true }, { nombre: "2:00 pm – 8:00 pm", desc: "Para quienes tienen cena social frecuente." }],
    ketoFlu: { normales: ["Hambre intensa primeras 2 semanas", "Fatiga matutina", "Irritabilidad", "Dificultad de concentración"], parar: ["Mismas señales que 16:8 — con mayor vigilancia", "Pérdida de más de 1.5kg/semana sostenida"], remedios: ["No iniciar sin experiencia previa en 16:8", "Café negro, té, agua con sal en ayuno", "Electrolitos obligatorios"] },
    advertencias: ["Solo para personas con experiencia previa en ayuno intermitente", "No recomendado como primer protocolo", "Mayor riesgo de pérdida muscular si proteína no es suficiente", "No combinar con ejercicio de alta intensidad en ayuno sin adaptación previa"],
  },
  estandar: {
    titulo: "Dieta Estándar — Pérdida de peso", icon: "🍽️", color: "#81C784",
    resumen: "Déficit calórico con distribución equilibrada de macros. Sin restricción de horarios ni alimentos específicos. La opción más sostenible a largo plazo.",
    mecanismo: "El déficit calórico es el único factor determinante de pérdida de peso — demostrado en el NEJM. Dietas moderadas en carbos producen mayor saciedad y menos hipoglucemia de rebote.",
    macros: "38% proteína · 32% carbos · 30% grasas",
    ciencia: "NEJM 2009 (811 participantes, 2 años) · Advances in Nutrition 2020 · Healthline Medical Review Feb 2024 · StatPearls NIH 2023",
    timeline: [{ dia: "Semana 1–2", titulo: "Pérdida inicial", desc: "Pérdida rápida de agua y glucógeno. No confundir con grasa real. Normal perder 1–3 kg.", color: "#64B5F6" }, { dia: "Semana 3–4", titulo: "Pérdida real de grasa", desc: "0.5–1 kg/semana es el ritmo óptimo. Más rápido implica pérdida de músculo.", color: "#81C784" }, { dia: "Mes 2–3", titulo: "Posible meseta", desc: "El metabolismo se adapta. Señal de ajustar calorías o aumentar actividad física.", color: "#FFB74D" }, { dia: "Mes 3+", titulo: "Pérdida sostenida", desc: "Con adherencia al déficit la pérdida continúa. La consistencia es el factor clave.", color: "#CE93D8" }],
    ketoFlu: { normales: ["Hambre los primeros días", "Leve fatiga en la primera semana", "Ansiedad por carbos en primeros días"], parar: ["Pérdida de más de 1.5 kg/semana sostenida — déficit demasiado agresivo", "Fatiga extrema o mareos persistentes", "Caída notoria de fuerza o músculo"], remedios: ["Aumentar proteína si hay mucha hambre", "Distribuir comidas según tu horario — 2, 3 o 5 sin problema", "Hidratación adecuada — 2–3L/día"] },
    recargas: { descripcion: "No requiere días de recarga — es una dieta flexible. Sin embargo ajustar calorías según nivel de actividad cada semana mejora resultados.", porSomatotipo: [{ tipo: "Ectomorfo 🦴", protocolo: "Déficit moderado", recargas: "No necesarias", carbosMax: "TDEE − 15% · 35% carbos" }, { tipo: "Mesomorfo 💪", protocolo: "Déficit estándar", recargas: "No necesarias", carbosMax: "TDEE − 20% · 32% carbos" }, { tipo: "Endomorfo 🛡️", protocolo: "Déficit mayor", recargas: "No necesarias", carbosMax: "TDEE − 25% · 25% carbos" }] },
    alimentos: { si: ["Proteínas magras", "Verduras y hortalizas", "Frutas moderadas", "Legumbres", "Cereales integrales", "Aguacate", "Huevo", "Atún", "Pollo"], no: ["Azúcar añadida", "Ultraprocesados", "Bebidas azucaradas", "Harinas refinadas en exceso", "Alcohol frecuente"] },
    advertencias: ["El déficit no debe superar 500 kcal/día para no perder músculo", "Proteína mínima de 1.2 g/kg para preservar masa magra", "Pesarse siempre en las mismas condiciones — misma hora, mismo día", "Una meseta de 2+ semanas es señal de ajustar el plan, no de abandonarlo"],
  },
  quemar_guia: {
    titulo: "Quema de Grasa — Recomposición corporal", icon: "🔥", color: "#FF8A65",
    resumen: "Déficit calórico leve combinado con proteína elevada. La prioridad no es bajar la báscula lo más rápido posible, sino perder grasa minimizando la pérdida de músculo.",
    mecanismo: "Un déficit moderado (8–10%) junto con proteína alta (hasta 2 g/kg) maximiza la oxidación de grasa mientras preserva masa magra — a diferencia de un déficit agresivo enfocado solo en el peso total.",
    macros: "40% proteína · 40% carbos · 20% grasas",
    ciencia: "Longland et al., Am J Clin Nutr 2016: proteína alta (2.4g/kg) durante déficit calórico combinado con entrenamiento de fuerza preserva e incluso aumenta masa muscular mientras se pierde grasa, frente a dietas con menor proteína.",
    timeline: [{ dia: "Semana 1–2", titulo: "Ajuste", desc: "El cuerpo se adapta al déficit leve. Energía y rendimiento se mantienen estables — no debería sentirse como una dieta agresiva.", color: "#FFB74D" }, { dia: "Semana 3–4", titulo: "Recomposición visible", desc: "Cambios en composición corporal antes que en el peso de la báscula. La ropa empieza a sentirse diferente.", color: "#81C784" }, { dia: "Mes 2–3", titulo: "Definición", desc: "Pérdida de grasa sostenida con fuerza estable o en aumento si el entrenamiento es consistente.", color: "#64B5F6" }, { dia: "Mes 3+", titulo: "Mantenimiento del progreso", desc: "Reevaluar el déficit si hay meseta — la proteína alta facilita ajustar calorías sin perder músculo.", color: "#CE93D8" }],
    ketoFlu: { normales: ["Hambre leve entre comidas si el déficit se nota", "Ligera fatiga en entrenamientos intensos los primeros días", "Necesidad de planear comidas para llegar a la proteína meta"], parar: ["Pérdida de fuerza notoria en el gimnasio semana tras semana", "Pérdida de peso mayor a 1% del peso corporal por semana sostenida", "Fatiga persistente o ánimo bajo constante"], remedios: ["Priorizar proteína en cada comida antes que otros macros", "Ajustar el déficit a 8–10%, no más, si hay caída de rendimiento", "Distribuir la proteína en 3–4 tomas para mejor síntesis muscular"] },
    recargas: { descripcion: "No requiere recargas formales, pero un día de mantenimiento calórico cada 1–2 semanas ayuda con la adherencia y el rendimiento en entrenamientos pesados.", porSomatotipo: [{ tipo: "Ectomorfo 🦴", protocolo: "Déficit mínimo", recargas: "1 día/sem a TDEE", carbosMax: "TDEE − 8% · 42% carbos" }, { tipo: "Mesomorfo 💪", protocolo: "Déficit leve estándar", recargas: "Opcional cada 10–14 días", carbosMax: "TDEE − 10% · 40% carbos" }, { tipo: "Endomorfo 🛡️", protocolo: "Déficit leve sostenido", recargas: "No necesarias", carbosMax: "TDEE − 12% · 35% carbos" }] },
    alimentos: { si: ["Proteínas magras en cada comida", "Pollo, pescado, claras de huevo", "Verduras de bajo índice glucémico", "Carbos complejos alrededor del entrenamiento", "Grasas saludables con moderación", "Legumbres"], no: ["Ultraprocesados", "Azúcar añadida", "Alcohol frecuente — interfiere con síntesis proteica", "Grasas en exceso — desplazan proteína sin saciar igual"] },
    advertencias: ["No confundir con un déficit agresivo — la meta es perder grasa, no peso a cualquier costo", "Proteína es la prioridad #1 de este protocolo, más que en pérdida de peso estándar", "Si el rendimiento en el gimnasio cae notoriamente, el déficit es demasiado grande", "El descanso y sueño afectan directamente la retención de músculo en déficit"],
  },
  mantener_guia: {
    titulo: "Dieta de Mantenimiento", icon: "⚖️", color: "#64B5F6",
    resumen: "Comer exactamente lo que el cuerpo gasta. Sin déficit ni superávit. Preservar la composición corporal mientras se mantiene la salud metabólica.",
    mecanismo: "En mantenimiento el foco se traslada de pérdida a preservación — proteína suficiente para no perder músculo, carbos para energía diaria y grasas para función hormonal.",
    macros: "30% proteína · 45% carbos · 25% grasas",
    ciencia: "U.S. Dietary Guidelines AMDR · NEJM Macronutrient Guidelines 2024 · Advances in Nutrition 2020",
    timeline: [{ dia: "Semana 1–2", titulo: "Ajuste calórico", desc: "El peso puede fluctuar 1–2 kg — completamente normal. El cuerpo se calibra.", color: "#FFB74D" }, { dia: "Semana 3–4", titulo: "Peso estable", desc: "Peso estable indica que las calorías están bien calibradas. Señal positiva.", color: "#81C784" }, { dia: "Mes 2+", titulo: "Monitoreo mensual", desc: "No necesita seguimiento semanal intenso. Revisión mensual es suficiente.", color: "#64B5F6" }, { dia: "Reincorporación", titulo: "Vuelta al ejercicio", desc: "Aumentar carbos gradualmente antes de volver al entrenamiento activo.", color: "#CE93D8" }],
    ketoFlu: { normales: ["Fluctuación de peso 1–2 kg en las primeras semanas", "Ligero aumento de apetito si venías de déficit", "Ajuste de energía en primeros días"], parar: ["Aumento sostenido de más de 0.5 kg/semana — ajustar calorías", "Pérdida notoria de músculo — aumentar proteína", "Fatiga persistente — revisar ingesta calórica total"], remedios: ["Mantener proteína mínima 1.2 g/kg aunque no entrenes", "Reducir carbos ligeramente en días de menor actividad", "No hacer déficit agresivo durante lesión"] },
    recargas: { descripcion: "En mantenimiento no hay recargas porque no hay restricción.", porSomatotipo: [{ tipo: "Ectomorfo 🦴", protocolo: "TDEE exacto", recargas: "No aplica", carbosMax: "TDEE · 47% carbos" }, { tipo: "Mesomorfo 💪", protocolo: "TDEE exacto", recargas: "No aplica", carbosMax: "TDEE · 45% carbos" }, { tipo: "Endomorfo 🛡️", protocolo: "TDEE − 5%", recargas: "No aplica", carbosMax: "TDEE − 5% · 40% carbos" }] },
    alimentos: { si: ["Todos los grupos alimenticios", "Proteínas variadas", "Carbos complejos", "Grasas saludables", "Frutas y verduras abundantes", "Legumbres"], no: ["Ultraprocesados frecuentes", "Azúcar añadida en exceso", "Alcohol frecuente", "Grasas trans"] },
    advertencias: ["En caso de lesión: no reducir calorías agresivamente — el cuerpo necesita energía para recuperarse", "Mantener proteína alta durante inactividad para no perder músculo", "Reintroducir actividad gradualmente antes de volver a déficit", "El endomorfo debe vigilar que el mantenimiento no se convierta en superávit encubierto"],
  },
  masa: {
    titulo: "Ganancia de Masa Muscular", icon: "💪", color: "#CE93D8",
    resumen: "Superávit calórico controlado con alta proteína. La clave es el superávit moderado — más calorías no significa más músculo.",
    mecanismo: "La ganancia muscular está biológicamente limitada a 0.5–1 kg/mes. Un superávit pequeño y constante maximiza la ganancia de músculo mientras minimiza la grasa.",
    macros: "33% proteína · 47% carbos · 20% grasas · + superávit según somatotipo",
    ciencia: "Helms et al. Sports Med Open 2023 · Iraki, Aragon, Schoenfeld Front.Nutr 2019",
    timeline: [{ dia: "Semana 1–2", titulo: "Calibración", desc: "Establece tu TDEE real. Si subes más de 0.5kg/semana reduce 100 kcal.", color: "#FFB74D" }, { dia: "Semana 3–4", titulo: "Adaptación", desc: "El cuerpo responde al estímulo calórico. Fuerza aumenta antes que volumen.", color: "#64B5F6" }, { dia: "Mes 2–3", titulo: "Ganancia visible", desc: "Principiante: ~0.9kg músculo/mes. Intermedio: ~0.45kg/mes.", color: "#81C784" }, { dia: "Mes 3–6", titulo: "Resultados sostenidos", desc: "Ganancia constante si proteína y entrenamiento son consistentes.", color: "#CE93D8" }, { dia: "Mes 6+", titulo: "Evaluación", desc: "Si % grasa supera 18% en hombres o 25% en mujeres — pausa el superávit.", color: "#ef9a9a" }],
    ketoFlu: { normales: ["Aumento de peso en primeras semanas (agua y glucógeno)", "Mayor apetito", "Ligero aumento de grasa corporal — inevitable y normal"], parar: ["Aumento de más de 0.7kg/semana sostenido — reducir calorías", "% grasa corporal superando 18% hombres / 25% mujeres"], remedios: ["Lean bulk — superávit pequeño y constante es mejor que grande", "Ciclo zigzag — más calorías días de entrenamiento"] },
    recargas: { descripcion: "Ciclo zigzag para masa — más calorías los días que entrenas, menos los días de descanso.", porSomatotipo: [{ tipo: "Ectomorfo 🦴", protocolo: "Lean bulk agresivo", recargas: "TDEE +15% entrenamiento · +8% descanso", carbosMax: "2.0 g proteína/kg · 52% carbos" }, { tipo: "Mesomorfo 💪", protocolo: "Lean bulk estándar", recargas: "TDEE +12% entrenamiento · +6% descanso", carbosMax: "1.9 g proteína/kg · 47% carbos" }, { tipo: "Endomorfo 🛡️", protocolo: "Lean bulk conservador", recargas: "TDEE +8% entrenamiento · +4% descanso", carbosMax: "1.8 g proteína/kg · 45% carbos" }] },
    alimentos: { si: ["Pechuga de pollo", "Atún", "Huevo", "Arroz integral", "Avena", "Frijoles", "Papa", "Plátano", "Aguacate", "Aceite de oliva", "Queso cottage", "Yogur griego"], no: ["Ultraprocesados", "Azúcar añadida en exceso", "Alcohol frecuente — inhibe síntesis proteica", "Grasas trans"] },
    advertencias: ["Dirty bulk no recomendado — más calorías no produce más músculo pero sí más grasa", "Sin entrenamiento de fuerza progresivo el superávit se convierte en grasa", "No iniciar bulk si % grasa ya es mayor de 18% hombres o 25% mujeres"],
  },
  ketoAyuno: {
    titulo: "Keto + Ayuno 16:8", icon: "⚡", color: "#ef9a9a",
    resumen: "Protocolo intensivo. Combina cetosis con ventana de alimentación reducida. Máxima quema de grasa.",
    mecanismo: "La combinación profundiza y mantiene la cetosis durante más horas. Potencia la autofagia celular — proceso de limpieza y regeneración celular documentado científicamente.",
    macros: "30% proteína · 5% carbos · 65% grasas",
    ciencia: "Evidencia emergente sobre autofagia y cetosis combinada. Premio Nobel de Medicina 2016 (Yoshinori Ohsumi) sobre autofagia.",
    timeline: [{ dia: "Semana 1–4", titulo: "Adaptación doble", desc: "Las primeras 4 semanas son las más difíciles. No saltar pasos.", color: "#ef5350" }, { dia: "Mes 2", titulo: "Adaptación grasa", desc: "El cuerpo es eficiente en cetosis. Ayuno sin hambre severa.", color: "#FFB74D" }, { dia: "Mes 3+", titulo: "Máximo rendimiento", desc: "Energía estable, quema de grasa óptima, autofagia activa.", color: "#81C784" }],
    ventanas: [{ nombre: "12:00 pm – 8:00 pm", desc: "Ventana de 8h con alimentación keto estricta.", recomendado: true }],
    ketoFlu: { normales: ["Todo lo de keto + todo lo de ayuno simultáneamente", "Mayor intensidad de síntomas en semana 1–2"], parar: ["Cualquier síntoma cardíaco", "Confusión mental severa", "Desmayo", "Dolor renal"], remedios: ["Electrolitos son obligatorios, no opcionales", "Caldo de hueso en ventana de ayuno si es necesario"] },
    advertencias: ["⚠️ Solo para personas con experiencia previa en AMBOS protocolos por separado", "Adaptación mínima de 4–6 semanas antes de ver resultados", "Consulta obligatoria con médico si tienes cualquier condición de salud", "No recomendado para principiantes en ningún caso"],
  },
};

const TIERS = {
  gratuito: { id: "gratuito", label: "Gratuito", precio: "$0", color: "#888", icon: "🆓", features: ["Perfil básico — IMC y TDEE", "Cuestionario de perfil", "Base de 10 alimentos", "Plan de 1 día sin guardar", "Macros en tiempo real"], bloqueado: ["protocolos_avanzados", "ajuste_porciones", "distribucion_comidas", "seguimiento", "ia", "pdf"] },
  premium:  { id: "premium",  label: "Premium",  precio: "$99 MXN/mes",  color: "#FFB74D", icon: "⭐", features: ["Todo lo gratuito sin límites", "Base completa de alimentos", "Todos los protocolos (Keto, Ayuno, Keto+Ayuno)", "Ajuste de porciones y precios", "Distribución de comidas personalizada", "Seguimiento semanal con gráficas", "Recomendación con IA cada semana", "Exportar plan en PDF"], bloqueado: [] },
  pro:      { id: "pro",      label: "Pro",       precio: "$149 MXN/mes", color: "#CE93D8", icon: "💎", features: ["Todo lo Premium", "Historial completo de progreso", "Análisis de tendencias con IA", "Ajuste automático de plan según progreso", "Soporte prioritario"], bloqueado: [] },
};

const FEATURE_TIER = { protocolos_avanzados: "premium", ajuste_porciones: "premium", distribucion_comidas: "premium", seguimiento: "premium", ia: "premium", pdf: "premium" };



function getDaysLeft(startDate) {
  const ms = 14 * 24 * 60 * 60 * 1000 - (Date.now() - startDate.getTime());
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}
function costoPorcion(food, precios) {
  return (food.porcion / 1000) * (precios[food.id] ?? food.precio_kg);
}

// ═══════════════════════════════════════════════════════════════════════
// COMPONENTES STANDALONE
// ═══════════════════════════════════════════════════════════════════════

function GuiaDieta({ guiaActiva, guiaOrigen, somatotipo, objetivo, setProtocolo, setScreen }) {
  const [seccion, setSeccion] = useState("que");
  // Para protocolo estándar, mostrar la guía correcta según el objetivo
  const guiaKey = guiaActiva === "estandar"
    ? (objetivo === "mantener" ? "mantener_guia" : objetivo === "masa" ? "masa" : objetivo === "quemar" ? "quemar_guia" : "estandar")
    : guiaActiva;
  const g    = GUIAS_DIETA[guiaKey];
  const soma = SOMATOTIPOS.find(s => s.id === somatotipo);
  if (!g) return null;
  const secciones        = [{ id: "que", label: "¿Qué es?" }, { id: "como", label: "Timeline" }, { id: "flu", label: "Síntomas" }, { id: "tabla", label: "Por cuerpo" }, { id: "alimentos", label: "Alimentos" }];
  const seccionesVisibles = secciones.filter(s => { if (s.id === "tabla" && !g.recargas) return false; if (s.id === "alimentos" && !g.alimentos) return false; return true; });
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#0a0f18 0%,#111827 100%)", fontFamily: "'DM Sans',sans-serif", color: "#fff", paddingBottom: 80 }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <div style={{ padding: "24px 20px 0", display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={() => setScreen(guiaOrigen)} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 22 }}>‹</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: g.color, textTransform: "uppercase" }}>Guía completa</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700 }}>{g.icon} {g.titulo}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, padding: "0 20px", overflowX: "auto", marginBottom: 20 }}>
        {seccionesVisibles.map(s => (
          <button key={s.id} onClick={() => setSeccion(s.id)} style={{ padding: "7px 14px", borderRadius: 99, border: "none", cursor: "pointer", whiteSpace: "nowrap", background: seccion === s.id ? g.color : "rgba(255,255,255,0.07)", color: seccion === s.id ? "#000" : "#888", fontWeight: seccion === s.id ? 700 : 400, fontSize: 12 }}>{s.label}</button>
        ))}
      </div>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 20px" }}>
        {seccion === "que" && (
          <div>
            <div style={{ padding: "16px 18px", background: `${g.color}10`, border: `1.5px solid ${g.color}33`, borderRadius: 16, marginBottom: 14 }}>
              <div style={{ fontSize: 15, lineHeight: 1.7, color: "#ddd" }}>{g.resumen}</div>
            </div>
            <div style={{ padding: "14px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: g.color, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>⚙️ Mecanismo</div>
              <div style={{ fontSize: 13, color: "#aaa", lineHeight: 1.7 }}>{g.mecanismo}</div>
            </div>
            <div style={{ padding: "14px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: g.color, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>📊 Macros</div>
              <div style={{ fontSize: 15, color: "#fff", fontWeight: 600 }}>{g.macros}</div>
            </div>
            <div style={{ padding: "12px 16px", background: "rgba(100,181,246,0.07)", border: "1px solid rgba(100,181,246,0.2)", borderRadius: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: "#64B5F6", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>📚 Respaldo científico</div>
              <div style={{ fontSize: 12, color: "#777" }}>{g.ciencia}</div>
            </div>
            {g.advertencias && (
              <div style={{ padding: "14px 16px", background: "rgba(239,83,80,0.07)", border: "1px solid rgba(239,83,80,0.2)", borderRadius: 14 }}>
                <div style={{ fontSize: 11, color: "#ef9a9a", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>⚠️ Advertencias</div>
                {g.advertencias.map((a, i) => <div key={i} style={{ fontSize: 12, color: "#ef9a9a", marginBottom: 6, lineHeight: 1.5 }}>• {a}</div>)}
              </div>
            )}
          </div>
        )}
        {seccion === "como" && (
          <div>
            <p style={{ color: "#666", fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>Qué puedes esperar semana a semana desde que empiezas.</p>
            {g.timeline.map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 14, marginBottom: 16 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 14, height: 14, borderRadius: "50%", background: t.color, flexShrink: 0, marginTop: 3 }} />
                  {i < g.timeline.length - 1 && <div style={{ width: 2, flex: 1, background: "rgba(255,255,255,0.07)", marginTop: 4 }} />}
                </div>
                <div style={{ paddingBottom: 16 }}>
                  <div style={{ fontSize: 11, color: t.color, fontWeight: 600, marginBottom: 3 }}>{t.dia}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{t.titulo}</div>
                  <div style={{ fontSize: 12, color: "#888", lineHeight: 1.6 }}>{t.desc}</div>
                </div>
              </div>
            ))}
            {g.ventanas && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 12, color: g.color, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600, marginBottom: 10 }}>⏰ Ventanas recomendadas</div>
                {g.ventanas.map((v, i) => (
                  <div key={i} style={{ padding: "12px 14px", background: v.recomendado ? `${g.color}10` : "rgba(255,255,255,0.03)", border: `1px solid ${v.recomendado ? g.color + "44" : "rgba(255,255,255,0.07)"}`, borderRadius: 12, marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: v.recomendado ? g.color : "#fff" }}>{v.nombre} {v.recomendado && "⭐"}</div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 3 }}>{v.desc}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {seccion === "flu" && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#81C784", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600, marginBottom: 10 }}>✓ Síntomas normales</div>
              {g.ketoFlu.normales.map((s, i) => <div key={i} style={{ padding: "8px 12px", background: "rgba(129,199,132,0.07)", borderRadius: 8, marginBottom: 5, fontSize: 13, color: "#aaa" }}>• {s}</div>)}
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#ef9a9a", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600, marginBottom: 10 }}>🛑 Señales para parar</div>
              {g.ketoFlu.parar.map((s, i) => <div key={i} style={{ padding: "8px 12px", background: "rgba(239,83,80,0.08)", border: "1px solid rgba(239,83,80,0.2)", borderRadius: 8, marginBottom: 5, fontSize: 13, color: "#ef9a9a" }}>⚠️ {s}</div>)}
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#64B5F6", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600, marginBottom: 10 }}>💧 Remedios</div>
              {g.ketoFlu.remedios.map((s, i) => <div key={i} style={{ padding: "8px 12px", background: "rgba(100,181,246,0.07)", borderRadius: 8, marginBottom: 5, fontSize: 13, color: "#aaa" }}>• {s}</div>)}
            </div>
          </div>
        )}
        {seccion === "tabla" && g.recargas && (
          <div>
            <p style={{ color: "#666", fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>{g.recargas.descripcion}</p>
            {g.recargas.porSomatotipo.map((r, i) => {
              const esMio = soma?.label === r.tipo.split(" ")[0];
              return (
                <div key={i} style={{ padding: "14px 16px", background: esMio ? `${g.color}12` : "rgba(255,255,255,0.03)", border: `1.5px solid ${esMio ? g.color : "rgba(255,255,255,0.07)"}`, borderRadius: 14, marginBottom: 10 }}>
                  {esMio && <div style={{ fontSize: 10, color: g.color, marginBottom: 6, fontWeight: 700 }}>← Tu somatotipo</div>}
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{r.tipo}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[["Protocolo", r.protocolo, g.color], ["Recargas", r.recargas, "#888"], ["Carbos máx.", r.carbosMax, "#64B5F6"]].map(([label, val, color]) => (
                      <div key={label} style={{ padding: "8px 10px", background: "rgba(0,0,0,0.2)", borderRadius: 8 }}>
                        <div style={{ fontSize: 9, color: "#555", marginBottom: 3, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
                        <div style={{ fontSize: 12, color, fontWeight: 600 }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {seccion === "alimentos" && g.alimentos && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#81C784", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600, marginBottom: 10 }}>✓ Puedes comer</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {g.alimentos.si.map((a, i) => <span key={i} style={{ padding: "5px 12px", background: "rgba(129,199,132,0.1)", border: "1px solid rgba(129,199,132,0.25)", borderRadius: 99, fontSize: 12, color: "#81C784" }}>{a}</span>)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#ef9a9a", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600, marginBottom: 10 }}>✗ Debes evitar</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {g.alimentos.no.map((a, i) => <span key={i} style={{ padding: "5px 12px", background: "rgba(239,83,80,0.08)", border: "1px solid rgba(239,83,80,0.2)", borderRadius: 99, fontSize: 12, color: "#ef9a9a" }}>{a}</span>)}
              </div>
            </div>
          </div>
        )}
        <button onClick={() => { if (guiaOrigen === "protocolo") { setProtocolo(guiaActiva); setScreen("protocolo"); } else setScreen("app"); }} style={{ width: "100%", marginTop: 24, padding: "15px", borderRadius: 14, border: "none", background: g.color, color: "#000", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
          {guiaOrigen === "protocolo" ? `Elegir ${GUIAS_DIETA[guiaActiva]?.titulo || g.titulo} →` : "Entendido →"}
        </button>
        <button onClick={() => setScreen(guiaOrigen)} style={{ width: "100%", marginTop: 10, padding: "12px", borderRadius: 14, border: "1.5px solid #333", background: "transparent", color: "#666", fontSize: 13, cursor: "pointer" }}>
          ← {guiaOrigen === "app" ? "Regresar al plan" : "Ver otras opciones"}
        </button>
      </div>
    </div>
  );
}



function FoodCard({ food, cat, selected, porciones, setPorciones, precios, setPrecios, toggle }) {
  const [editMode, setEditMode] = useState(null);
  const porcionActual = porciones[food.id] ?? food.porcion;
  const factor        = porcionActual / food.porcion;
  const precioKg      = precios[food.id] ?? food.precio_kg;
  const costo         = (porcionActual / 1000) * precioKg;
  const macros = { proteinas: (food.proteinas * factor).toFixed(1), carbos: (food.carbos * factor).toFixed(1), lipidos: (food.lipidos * factor).toFixed(1), calorias: Math.round(food.calorias * factor) };
  const inputSt = { display: "block", width: "100%", marginTop: 6, padding: "13px 14px", background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.11)", borderRadius: 12, color: "#fff", fontSize: 15, outline: "none", boxSizing: "border-box" };
  return (
    <div style={{ marginBottom: 2 }}>
      <button onClick={() => toggle(cat, food)} style={{ background: selected ? "rgba(255,183,77,0.13)" : "rgba(255,255,255,0.04)", border: `1.5px solid ${selected ? "#FFB74D" : "rgba(255,255,255,0.09)"}`, borderRadius: selected && editMode ? "14px 14px 0 0" : 14, padding: "12px 14px", cursor: "pointer", textAlign: "left", transition: "all 0.2s", color: "#fff", width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 600 }}>{food.nombre}</span>
            <span style={{ fontSize: 9, color: PREP_INFO[food.prep]?.color, background: `${PREP_INFO[food.prep]?.color}18`, borderRadius: 99, padding: "2px 6px" }}>{PREP_INFO[food.prep]?.icon} {PREP_INFO[food.prep]?.label}</span>
            {food.prepLarga && <span style={{ fontSize: 9, color: "#FFB74D", background: "rgba(255,183,77,0.12)", borderRadius: 99, padding: "2px 6px" }}>⏱️ Prep. larga</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "#4CAF50", fontWeight: 600 }}>${costo.toFixed(1)}</span>
            <span style={{ fontSize: 15, color: selected ? "#FFB74D" : "#444" }}>{selected ? "✓" : "+"}</span>
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#777", marginTop: 4 }}>
          <span style={{ color: selected && porciones[food.id] ? "#FFB74D" : "#888", fontWeight: selected && porciones[food.id] ? 700 : 400 }}>{porcionActual}g</span>
          &nbsp;·&nbsp;<span style={{ color: "#81C784" }}>{macros.proteinas}Pro</span>&nbsp;·&nbsp;<span style={{ color: "#64B5F6" }}>{macros.carbos}Car</span>&nbsp;·&nbsp;<span style={{ color: "#FFB74D" }}>{macros.lipidos}Lip</span>&nbsp;·&nbsp;<b style={{ color: "#ddd" }}>{macros.calorias} kcal</b>
        </div>
      </button>
      {selected && (
        <div style={{ background: "#131a27", border: "1.5px solid rgba(255,183,77,0.25)", borderTop: "none", borderRadius: "0 0 14px 14px", padding: "12px 14px" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {[["porcion", "⚖️ Porción"], ["precio", "💰 Precio"]].map(([mode, label]) => (
              <button key={mode} onClick={e => { e.stopPropagation(); setEditMode(editMode === mode ? null : mode); }} style={{ fontSize: 11, padding: "5px 12px", borderRadius: 99, border: "none", cursor: "pointer", background: editMode === mode ? "#FFB74D" : "rgba(255,255,255,0.07)", color: editMode === mode ? "#000" : "#888", fontWeight: editMode === mode ? 700 : 400 }}>{label}</button>
            ))}
          </div>
          {editMode === "porcion" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: "#888" }}>Porción base: {food.porcion}g</span>
                <span style={{ fontSize: 13, color: "#FFB74D", fontWeight: 700 }}>{porcionActual}g</span>
              </div>
              <input type="range" min={Math.round(food.porcion * 0.25)} max={Math.round(food.porcion * 3)} step={5} value={porcionActual} onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); setPorciones(p => ({ ...p, [food.id]: +e.target.value })); }} style={{ width: "100%", accentColor: "#FFB74D", cursor: "pointer" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#444", marginTop: 2 }}>
                <span>{Math.round(food.porcion * 0.25)}g</span><span>{Math.round(food.porcion * 3)}g</span>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                {[0.5, 0.75, 1, 1.5, 2].map(mult => (
                  <button key={mult} onClick={e => { e.stopPropagation(); setPorciones(p => ({ ...p, [food.id]: Math.round(food.porcion * mult) })); }} style={{ flex: 1, padding: "5px 0", fontSize: 10, borderRadius: 8, border: "none", cursor: "pointer", background: porcionActual === Math.round(food.porcion * mult) ? "#FFB74D" : "rgba(255,255,255,0.07)", color: porcionActual === Math.round(food.porcion * mult) ? "#000" : "#888" }}>{mult === 1 ? "Base" : `×${mult}`}</button>
                ))}
              </div>
            </div>
          )}
          {editMode === "precio" && (
            <div>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>Precio por kg en tu mercado (MXN)</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="number" placeholder={String(food.precio_kg)} value={precios[food.id] ?? ""} onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); setPrecios(p => ({ ...p, [food.id]: +e.target.value })); }} style={{ ...inputSt, marginTop: 0, flex: 1, fontSize: 14, padding: "9px 12px" }} />
                <button onClick={e => { e.stopPropagation(); setEditMode(null); }} style={{ background: "#FFB74D", border: "none", borderRadius: 10, padding: "9px 16px", color: "#000", fontWeight: 700, cursor: "pointer" }}>✓</button>
              </div>
              <div style={{ fontSize: 10, color: "#555", marginTop: 6 }}>Costo actual: <span style={{ color: "#4CAF50" }}>${costo.toFixed(1)}</span> por esta porción</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════
export default function NutriSelf() {
  const [screen, setScreen]         = useState("landing");
  const [step, setStep]             = useState(0);
  const [registro, setRegistro]     = useState({ nombre: "", email: "" });
  const [trialStart, setTrialStart] = useState(null);
  const [tier, setTier]             = useState("premium");
  const [tierIntent, setTierIntent] = useState(null); // tier elegido en landing, antes de registrarse
  const [upgradeFeature, setUpgradeFeature] = useState(null);
  const [guiaActiva, setGuiaActiva] = useState(null);
  const [guiaOrigen, setGuiaOrigen] = useState("protocolo");
  const [perfil, setPerfil]         = useState({ peso: "", talla: "", edad: "", sexo: "M", actividad: "moderado", cintura: "", cuello: "", cadera: "" });
  const [somatotipo, setSomatotipo] = useState(null);
  const [objetivo, setObjetivo]     = useState("quemar");
  const [respuestas, setRespuestas] = useState({});
  const [preguntaActual, setPreguntaActual] = useState(0);
  const [restriccion, setRestriccion] = useState("ninguna");
  const [protocolo, setProtocolo]   = useState("estandar");
  const [numComidas, setNumComidas] = useState(3);
  const [tiempoPrep, setTiempoPrep] = useState("moderado");
  const [planComidas, setPlanComidas] = useState({});
  const [busqueda, setBusqueda]     = useState("");
  const [vistaTabla, setVistaTabla] = useState(false);
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);
  const [buscando, setBuscando]     = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState(null);
  const [manualNombre, setManualNombre] = useState("");
  const [manualCat, setManualCat] = useState("proteinas");
  const [manualPorcion, setManualPorcion] = useState("");
  const [manualProteinas, setManualProteinas] = useState("");
  const [manualCarbos, setManualCarbos] = useState("");
  const [manualLipidos, setManualLipidos] = useState("");
  const [manualCalorias, setManualCalorias] = useState("");
  const [guardandoManual, setGuardandoManual] = useState(false);
  const [errorManual, setErrorManual] = useState(null);
  const [registros, setRegistros]   = useState([]);
  const [cargandoRegistros, setCargandoRegistros] = useState(true);
  const [errorRegistros, setErrorRegistros] = useState(null);
  const [editandoRegistroId, setEditandoRegistroId] = useState(null);
  const [userId] = useState(getUserId);
  const [nuevoRegistro, setNuevoRegistro] = useState({ peso: "", cintura: "", cuello: "" });
  const [recomendacionIA, setRecomendacionIA] = useState("");
  const [cargandoIA, setCargandoIA] = useState(false);
  const [seleccion, setSeleccion]   = useState({ proteinas: [], carbohidratos: [], lipidos: [] });
  const [precios, setPrecios]       = useState({});
  const [porciones, setPorciones]   = useState({});
  const [foodDbExtra, setFoodDbExtra] = useState({ proteinas: [], carbohidratos: [], lipidos: [] });
  const [distComidas, setDistComidas] = useState(null);
  const [editandoDist, setEditandoDist] = useState(false);
  const [cargandoPlan, setCargandoPlan] = useState(true);
  const [errorPlan, setErrorPlan] = useState(null);
  const [guardandoPlan, setGuardandoPlan] = useState(false);
  const [planCerrado, setPlanCerrado] = useState(false);
  const [cerrandoPlan, setCerrandoPlan] = useState(false);
  const [historialPlanesData, setHistorialPlanesData] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [errorHistorial, setErrorHistorial] = useState(null);
  const [fechaHistorialAbierta, setFechaHistorialAbierta] = useState(null);
  const planListoRef = useRef(false);

  const daysLeft = trialStart ? getDaysLeft(trialStart) : 14;
  const trialPct = trialStart ? Math.min(((14 - daysLeft) / 14) * 100, 100) : 0;

  // ── Cargar el plan de HOY guardado (si existe) al abrir la app ──
  useEffect(() => {
    if (!userId) { setCargandoPlan(false); planListoRef.current = true; return; }
    (async () => {
      try {
        const hoy = fechaLocalISO();
        const res  = await fetch(`/api/planes?userId=${encodeURIComponent(userId)}&fecha=${hoy}`);
        const data = await res.json();
        if (res.ok && data.plan) {
          const d = data.plan.datos || {};
          if (d.protocolo)    setProtocolo(d.protocolo);
          if (d.objetivo)     setObjetivo(d.objetivo);
          if (d.numComidas)   setNumComidas(d.numComidas);
          if (d.tiempoPrep)   setTiempoPrep(d.tiempoPrep);
          if (d.restriccion)  setRestriccion(d.restriccion);
          if (d.seleccion)    setSeleccion(d.seleccion);
          if (d.porciones)    setPorciones(d.porciones);
          if (d.precios)      setPrecios(d.precios);
          if (d.distComidas)  setDistComidas(d.distComidas);
          if (d.planComidas)  setPlanComidas(d.planComidas);
          if (d.cerrado)      setPlanCerrado(true);
        }
      } catch (err) {
        setErrorPlan("No se pudo cargar el plan guardado de hoy.");
      } finally {
        setCargandoPlan(false);
        planListoRef.current = true;
      }
    })();
  }, [userId]);

  // ── Autoguardado del plan del día (con debounce) — por si se cierra la app sin avisar ──
  useEffect(() => {
    if (!planListoRef.current || !userId || planCerrado) return;
    const hayAlgoQueGuardar = seleccion.proteinas.length || seleccion.carbohidratos.length || seleccion.lipidos.length;
    if (!hayAlgoQueGuardar) return;
    const timer = setTimeout(async () => {
      setGuardandoPlan(true);
      try {
        const hoy = fechaLocalISO();
        const datos = { protocolo, objetivo, numComidas, tiempoPrep, restriccion, seleccion, porciones, precios, distComidas, planComidas };
        const res = await fetch("/api/planes", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ userId, fecha: hoy, datos }),
        });
        if (!res.ok) throw new Error("No se pudo guardar el plan");
        setErrorPlan(null);
      } catch (err) {
        setErrorPlan("No se pudo guardar el plan automáticamente.");
      } finally {
        setGuardandoPlan(false);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [userId, protocolo, objetivo, numComidas, tiempoPrep, restriccion, seleccion, porciones, precios, distComidas, planComidas]);

  // ── Cargar registros guardados de este dispositivo al abrir la app ──
  useEffect(() => {
    if (!userId) { setCargandoRegistros(false); return; }
    (async () => {
      try {
        const res  = await fetch(`/api/registros?userId=${encodeURIComponent(userId)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No se pudieron cargar tus registros");
        setRegistros(Array.isArray(data.registros) ? data.registros : []);
      } catch (err) {
        setErrorRegistros(err.message || "Error al cargar registros guardados.");
      } finally {
        setCargandoRegistros(false);
      }
    })();
  }, [userId]);

  const dist = useMemo(() => {
    const tabla = DISTRIBUCIONES[objetivo] || DISTRIBUCIONES.mantener;
    const base  = tabla[somatotipo] || tabla.default;
    const proto = PROTOCOLOS[protocolo];
    if (proto?.ajusteMacros) return { ...base, ...proto.ajusteMacros };
    return base;
  }, [objetivo, somatotipo, protocolo]);

  const tdee = useMemo(() => {
    const { peso, talla, edad, sexo, actividad } = perfil;
    if (!peso || !talla || !edad) return null;
    return Math.round(calcTMB(+peso, +talla, +edad, sexo) * ACTIVIDAD[actividad]);
  }, [perfil]);

  const calMeta           = tdee ? Math.round(tdee * dist.factor) : 2000;
  const imc               = perfil.peso && perfil.talla ? calcIMC(+perfil.peso, +perfil.talla) : null;
  const imcLabel          = imc ? (+imc < 18.5 ? "Bajo peso" : +imc < 25 ? "Peso normal ✓" : +imc < 30 ? "Sobrepeso" : "Obesidad") : null;
  const pctGrasa          = calcGrasaCorporal(+perfil.cintura, +perfil.cuello, +perfil.talla, +perfil.cadera, perfil.sexo);
  const masaMagra         = pctGrasa && perfil.peso ? (+perfil.peso * (1 - pctGrasa / 100)) : null;
  const indCinturaAltura  = perfil.cintura && perfil.talla ? (+perfil.cintura / +perfil.talla) : null;
  const proteinaMeta      = perfil.peso ? Math.round(+perfil.peso * (PROTEINA_G_KG[objetivo] || 1.6)) : null;

  const totales = useMemo(() => {
    const all = [...seleccion.proteinas, ...seleccion.carbohidratos, ...seleccion.lipidos];
    return all.reduce((acc, f) => {
      const factor = (porciones[f.id] ?? f.porcion) / f.porcion;
      return { calorias: acc.calorias + f.calorias * factor, proteinas: acc.proteinas + f.proteinas * factor, carbos: acc.carbos + f.carbos * factor, lipidos: acc.lipidos + f.lipidos * factor, costo: acc.costo + costoPorcion(f, precios) * factor };
    }, { calorias: 0, proteinas: 0, carbos: 0, lipidos: 0, costo: 0 });
  }, [seleccion, precios, porciones]);

  const pctCal = (totales.calorias / calMeta) * 100;

  const toggle = (cat, food) => {
    if (planCerrado) { if (typeof window !== "undefined") window.alert("Este plan ya está cerrado. Para registrar nuevos alimentos, espera al plan de mañana."); return; }
    setSeleccion(prev => {
      const arr = prev[cat]; const exists = arr.find(f => f.id === food.id);
      return { ...prev, [cat]: exists ? arr.filter(f => f.id !== food.id) : [...arr, food] };
    });
  };

  // ── ✅ CAMBIO 3: buscarAlimento — base propia (Neon) primero, FatSecret como respaldo ──
  const buscarAlimento = async (query) => {
    if (!query || query.length < 2) { setResultadosBusqueda([]); return; }
    setBuscando(true); setErrorBusqueda(null);
    try {
      // 1) Buscar primero en nuestra base propia de alimentos (Neon)
      const resPropia  = await fetch(`/api/alimentos?query=${encodeURIComponent(query)}&max_results=30`);
      const dataPropia = await resPropia.json();
      let resultados = resPropia.ok ? (dataPropia.resultados || []) : [];

      // 2) Si hay pocos resultados propios, complementamos con FatSecret
      //    (no reemplaza, solo agrega los que no estén ya cubiertos)
      if (resultados.length < 8) {
        try {
          const resFS  = await fetch(`/api/fatsecret?query=${encodeURIComponent(query)}&max_results=50`);
          const dataFS = await resFS.json();
          let resultadosFS = resFS.ok ? (dataFS.resultados || []) : [];

          // También probamos la traducción al inglés para mejorar cobertura en FatSecret
          const traduccion = traducirParaBusqueda(query);
          if (traduccion) {
            const resFS2  = await fetch(`/api/fatsecret?query=${encodeURIComponent(traduccion)}&max_results=50`);
            const dataFS2 = await resFS2.json();
            if (resFS2.ok && dataFS2.resultados?.length > 0) {
              const idsFS = new Set(resultadosFS.map(r => r.id));
              resultadosFS = [...resultadosFS, ...dataFS2.resultados.filter(r => !idsFS.has(r.id))];
            }
          }

          const conTraduccionFS = resultadosFS.map(f => ({
            ...f,
            nombre_es: traducirNombreResultado(f.nombre),
            _generico: esResultadoGenerico(f.nombre, traduccion),
            fuente_datos: "fatsecret",
          }));
          conTraduccionFS.sort((a, b) => (a._generico === b._generico ? 0 : a._generico ? -1 : 1));

          resultados = [...resultados, ...conTraduccionFS];
        } catch {
          // Si FatSecret falla, seguimos solo con lo que ya tengamos de la base propia
        }
      }

      if (resultados.length > 0) {
        setResultadosBusqueda(resultados.slice(0, 25));
      } else {
        setResultadosBusqueda([]);
        setErrorBusqueda("Sin resultados para esa búsqueda.");
      }
    } catch (err) {
      setErrorBusqueda(err.message || "Error al buscar. Intenta de nuevo.");
      setResultadosBusqueda([]);
    } finally {
      setBuscando(false);
    }
  };

  // ── Guardar un alimento capturado manualmente (no encontrado en el buscador) ──
  const guardarAlimentoManual = async () => {
    if (!manualNombre.trim() || !manualPorcion || !manualProteinas || !manualCarbos || !manualLipidos) {
      setErrorManual("Completa el nombre, la porción y los 3 macros.");
      return;
    }
    setGuardandoManual(true); setErrorManual(null);
    try {
      const res = await fetch("/api/alimentos", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          nombre: manualNombre.trim(),
          categoria: manualCat,
          porcion_g: +manualPorcion,
          proteinas: +manualProteinas,
          carbohidratos: +manualCarbos,
          lipidos: +manualLipidos,
          calorias: manualCalorias !== "" ? +manualCalorias : null,
          fuente: "manual",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar el alimento");
      const nuevo = { ...data.alimento, esExtra: true, prep: "rapido", precio_kg: 0 };
      const cat = nuevo.cat;
      setFoodDbExtra(prev => ({ ...prev, [cat]: [...prev[cat], nuevo] }));
      setSeleccion(prev => ({ ...prev, [cat]: [...prev[cat], nuevo] }));
      setManualNombre(""); setManualPorcion(""); setManualProteinas(""); setManualCarbos(""); setManualLipidos(""); setManualCalorias("");
    } catch (err) {
      setErrorManual(err.message || "Error al guardar. Intenta de nuevo.");
    } finally {
      setGuardandoManual(false);
    }
  };

  const tieneAcceso = (feature) => {
    const r = FEATURE_TIER[feature]; if (!r) return true;
    if (r === "premium") return tier === "premium" || tier === "pro";
    if (r === "pro")     return tier === "pro";
    return true;
  };
  const intentarAcceder = (feature, accion) => { if (tieneAcceso(feature)) { accion(); } else { setUpgradeFeature(feature); setScreen("upgrade"); } };

  // ── ✅ CAMBIO 2: pedirRecomendacionIA — ahora usa /api/claude ─────────
  const pedirRecomendacionIA = async (regs) => {
    if (regs.length < 1) return;
    setCargandoIA(true); setRecomendacionIA("");
    const ultimo   = regs[regs.length - 1];
    const anterior = regs.length > 1 ? regs[regs.length - 2] : null;
    const objInfo  = OBJETIVOS.find(o => o.id === objetivo);

    const prompt = `Eres un nutriólogo deportivo experto. Da una recomendación concreta y motivadora en 3-4 oraciones. Usa el nombre del usuario.\n\nUsuario: ${registro.nombre}\nObjetivo: ${objInfo?.label}\nMeta calórica: ${calMeta} kcal/día\nMeta proteína: ${proteinaMeta}g/día\n\nRegistro actual:\n- Peso: ${ultimo.peso} kg\n- Cintura: ${ultimo.cintura} cm\n\n${anterior ? `Registro anterior:\n- Peso: ${anterior.peso} kg\n- Diferencia: ${(+ultimo.peso - +anterior.peso).toFixed(1)} kg` : "Primer registro."}\n\nRecomendación personalizada y accionable. Al final nota que es orientativa y no sustituye consulta médica.`;

    try {
      const res  = await fetch("/api/claude", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error del servidor");
      setRecomendacionIA(data.texto || "No se pudo generar la recomendación.");
    } catch (err) {
      setRecomendacionIA(err.message || "Error al conectar con el asistente. Intenta de nuevo.");
    } finally {
      setCargandoIA(false);
    }
  };

  const guardarRegistro = async () => {
    if (!nuevoRegistro.peso || !nuevoRegistro.cintura) return;
    setErrorRegistros(null);
    const datos = { peso: nuevoRegistro.peso, cintura: nuevoRegistro.cintura, cuello: nuevoRegistro.cuello || null };
    try {
      if (editandoRegistroId) {
        // ── Actualizar un registro existente ──
        const res  = await fetch("/api/registros", {
          method:  "PUT",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ userId, id: editandoRegistroId, ...datos }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No se pudo actualizar el registro");
        const nuevos = registros.map(r => (r.id === editandoRegistroId ? data.registro : r));
        setRegistros(nuevos);
        setEditandoRegistroId(null);
        setNuevoRegistro({ peso: "", cintura: "", cuello: "" });
        pedirRecomendacionIA(nuevos);
      } else {
        // ── Crear un registro nuevo ──
        const fecha = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
        const res  = await fetch("/api/registros", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ userId, fecha, ...datos }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No se pudo guardar el registro");
        const nuevos = [...registros, data.registro];
        setRegistros(nuevos);
        setNuevoRegistro({ peso: "", cintura: "", cuello: "" });
        pedirRecomendacionIA(nuevos);
      }
    } catch (err) {
      setErrorRegistros(err.message || "Error al guardar. Intenta de nuevo.");
    }
  };

  const editarRegistro = (r) => {
    setNuevoRegistro({ peso: String(r.peso), cintura: String(r.cintura), cuello: r.cuello != null ? String(r.cuello) : "" });
    setEditandoRegistroId(r.id);
  };

  const cancelarEdicionRegistro = () => {
    setEditandoRegistroId(null);
    setNuevoRegistro({ peso: "", cintura: "", cuello: "" });
  };

  const borrarRegistro = async (id) => {
    if (typeof window !== "undefined" && !window.confirm("¿Borrar este registro? No se puede deshacer.")) return;
    setErrorRegistros(null);
    try {
      const res = await fetch(`/api/registros?userId=${encodeURIComponent(userId)}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || "No se pudo borrar el registro"); }
      setRegistros(registros.filter(r => r.id !== id));
      if (editandoRegistroId === id) cancelarEdicionRegistro();
    } catch (err) {
      setErrorRegistros(err.message || "Error al borrar. Intenta de nuevo.");
    }
  };

  const borrarPlanDia = async (fecha) => {
    if (typeof window !== "undefined" && !window.confirm(`¿Borrar el plan del ${formatearFecha(fecha)}? No se puede deshacer.`)) return;
    setErrorHistorial(null);
    try {
      const res = await fetch(`/api/planes?userId=${encodeURIComponent(userId)}&fecha=${encodeURIComponent(fecha)}`, { method: "DELETE" });
      if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || "No se pudo borrar el plan"); }
      setHistorialPlanesData(historialPlanesData.filter(p => p.fecha !== fecha));
      if (fechaHistorialAbierta === fecha) setFechaHistorialAbierta(null);
    } catch (err) {
      setErrorHistorial(err.message || "Error al borrar el plan. Intenta de nuevo.");
    }
  };

  const handleRegister = () => { if (!registro.nombre || !registro.email) return; if (tierIntent) setTier(tierIntent); setTrialStart(new Date()); setScreen("cuestionario"); };

  const handleRespuesta = (pregId, opId) => {
    const nuevas = { ...respuestas, [pregId]: opId }; setRespuestas(nuevas);
    if (pregId === "restricciones") setRestriccion(opId);
    if (pregId === "comidas")       setNumComidas(+opId);
    if (pregId === "tiempoPrep")    setTiempoPrep(opId);
    if (preguntaActual < PREGUNTAS.length - 1) { setPreguntaActual(i => i + 1); }
    else { setObjetivo(diagnosticarObjetivo(nuevas)); setScreen("resultado"); }
  };

  const foodDbFiltrado = useMemo(() => {
    const excluirRest   = RESTRICCIONES_FILTRO[restriccion] || [];
    const excluirKeto   = PROTOCOLOS[protocolo]?.ketoExcluye || [];
    const prepPermitido = tiempoPrep === "rapido" ? ["rapido"] : tiempoPrep === "moderado" ? ["rapido", "moderado"] : ["rapido", "moderado", "elaborado"];
    const enriquecer = (arr, esExtra = false) => arr.map(f => {
      const bK = !esExtra && excluirKeto.includes(f.id);
      const bR = !esExtra && excluirRest.includes(f.id);
      const bP = !esExtra && !!f.prep && !prepPermitido.includes(f.prep); // solo aviso, no bloqueo
      return { ...f, esExtra, bloqueado: bK || bR, prepLarga: bP, razonBloqueo: bK ? "No compatible con Keto — alto en carbos" : bR ? "Excluido por tu restricción alimentaria" : null, tipoBloqeo: bK ? "keto" : bR ? "restriccion" : null };
    });
    return {
      proteinas:     [...enriquecer(FOOD_DB.proteinas), ...enriquecer(foodDbExtra.proteinas, true)],
      carbohidratos: [...enriquecer(FOOD_DB.carbohidratos), ...enriquecer(foodDbExtra.carbohidratos, true)],
      lipidos:       [...enriquecer(FOOD_DB.lipidos), ...enriquecer(foodDbExtra.lipidos, true)],
    };
  }, [restriccion, protocolo, tiempoPrep, foodDbExtra]);
  const nombreComidas = useMemo(() => {
    if (protocolo === "ayuno16" || protocolo === "ketoAyuno") return numComidas === 2 ? ["Primera comida (12:00 pm)", "Última comida (7:00 pm)"] : ["Primera comida (12:00 pm)", "Comida (3:00 pm)", "Última comida (7:00 pm)"];
    if (protocolo === "ayuno18") return numComidas === 2 ? ["Primera comida (1:00 pm)", "Última comida (6:00 pm)"] : ["Primera comida (1:00 pm)", "Merienda (4:00 pm)", "Última comida (6:30 pm)"];
    return numComidas >= 4 ? ["Desayuno", "Media mañana", "Comida", "Merienda", "Cena"] : numComidas === 3 ? ["Desayuno", "Comida", "Cena"] : ["Comida principal", "Cena"];
  }, [protocolo, numComidas]);

  const inputStyle = { display: "block", width: "100%", marginTop: 6, padding: "13px 14px", background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.11)", borderRadius: 12, color: "#fff", fontSize: 15, outline: "none", boxSizing: "border-box" };

  const Bar = ({ value, max, color }) => (
    <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 99, height: 8, overflow: "hidden", flex: 1 }}>
      <div style={{ width: `${Math.min((value / (max || 1)) * 100, 100)}%`, background: color, height: "100%", borderRadius: 99, transition: "width 0.5s ease" }} />
    </div>
  );

  const BlockedFoodCard = ({ food }) => {
    const colorBloq = food.tipoBloqeo === "keto" ? "#ef9a9a" : "#FFB74D";
    const iconBloq  = food.tipoBloqeo === "keto" ? "🚫" : "⚠️";
    return (
      <div style={{ padding: "11px 14px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: "1.5px solid rgba(255,255,255,0.05)", opacity: 0.6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>{iconBloq}</span>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 600, color: "#666", textDecoration: "line-through" }}>{food.nombre}</span>
          </div>
          <span style={{ fontSize: 10, color: colorBloq, background: `${colorBloq}15`, borderRadius: 99, padding: "2px 8px", whiteSpace: "nowrap" }}>{food.tipoBloqeo === "keto" ? "Keto ✗" : "Restringido"}</span>
        </div>
        <div style={{ fontSize: 11, color: "#555", marginTop: 5, lineHeight: 1.5 }}>{food.razonBloqueo}</div>
        <div style={{ fontSize: 10, color: "#444", marginTop: 3 }}>{food.porcion}g · {food.proteinas.toFixed(1)}P · {food.carbos.toFixed(1)}C · {food.lipidos.toFixed(1)}L · {food.calorias} kcal</div>
      </div>
    );
  };

  // ── LANDING ───────────────────────────────────────────────────────────
  if (screen === "landing") return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#0a0f18 0%,#111827 60%,#0a0f18 100%)", fontFamily: "'DM Sans',sans-serif", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", padding: "0 20px 60px" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <div style={{ textAlign: "center", paddingTop: 64, maxWidth: 420 }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 18 }}>NutriSelf</div>
        <div style={{ fontSize: 11, letterSpacing: 5, color: "#FFB74D", textTransform: "uppercase", marginBottom: 16 }}>Tu nutrición, tus reglas</div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 42, lineHeight: 1.15, margin: 0 }}>Come lo que<br /><em style={{ color: "#FFB74D" }}>tú quieres</em><br />y logra tu meta.</h1>
        <p style={{ color: "#666", fontSize: 15, marginTop: 20, lineHeight: 1.7 }}>Diseña tu propia dieta eligiendo los alimentos que te gustan. La app ajusta tus macros automáticamente — según tu tipo de cuerpo y tu bolsillo.</p>
        <div style={{ margin: "32px auto 0", display: "inline-block", background: "rgba(255,183,77,0.1)", border: "1.5px solid rgba(255,183,77,0.3)", borderRadius: 99, padding: "10px 24px" }}>
          <span style={{ color: "#FFB74D", fontWeight: 600, fontSize: 15 }}>✦ 14 días gratis — sin tarjeta</span>
        </div>
        <button onClick={() => setScreen("register")} style={{ marginTop: 20, width: "100%", padding: "17px", borderRadius: 16, border: "none", background: "#FFB74D", color: "#000", fontWeight: 700, fontSize: 17, cursor: "pointer" }}>Comenzar gratis →</button>
        <div style={{ fontSize: 12, color: "#444", marginTop: 10 }}>Sin compromisos. Cancela cuando quieras.</div>
      </div>
      <div style={{ marginTop: 56, width: "100%", maxWidth: 420 }}>
        {[["🥩", "Tú eliges tus alimentos", "No más dietas que no te gustan. Arma tu menú con lo que sí comerás."], ["🦴💪🛡️", "Ajuste por tipo de cuerpo", "Ectomorfo, mesomorfo o endomorfo — cada uno tiene su distribución óptima de macros."], ["💰", "Costo real de tu dieta", "Ingresa los precios de tu mercado y ve cuánto te cuesta al día. Comer bien sin gastar de más."], ["📊", "Macros en tiempo real", "Proteínas, carbos y lípidos calculados al instante mientras armas tu menú."], ["⚠️", "Alertas inteligentes", "Te avisa si excedes calorías o si tu distribución de macros se desvía del objetivo."]].map(([icon, title, desc]) => (
          <div key={title} style={{ display: "flex", gap: 16, padding: "18px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 22, marginTop: 2 }}>{icon}</div>
            <div><div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{title}</div><div style={{ color: "#666", fontSize: 13, lineHeight: 1.6 }}>{desc}</div></div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 48, width: "100%", maxWidth: 420 }}>
        <div style={{ fontSize: 12, color: "#888", letterSpacing: 2, textTransform: "uppercase", marginBottom: 14, textAlign: "center" }}>Después de la prueba</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Premium */}
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 20, padding: "20px 20px 18px", border: "1px solid rgba(255,183,77,0.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <div style={{ fontSize: 13, color: "#FFB74D", fontWeight: 700, letterSpacing: 1 }}>⭐ Premium</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700 }}>$99 <span style={{ fontSize: 12, color: "#888" }}>MXN/mes</span></div>
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 16px" }}>
              {TIERS.premium.features.map((f, i) => (
                <li key={i} style={{ fontSize: 12.5, color: "#aaa", display: "flex", gap: 8, marginBottom: 6, lineHeight: 1.4 }}>
                  <span style={{ color: "#FFB74D", flexShrink: 0 }}>✓</span>{f}
                </li>
              ))}
            </ul>
            <button onClick={() => { setTierIntent("premium"); setScreen("register"); }} style={{ width: "100%", padding: "13px", borderRadius: 14, border: "1.5px solid #FFB74D", background: "transparent", color: "#FFB74D", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Elegir Premium</button>
          </div>

          {/* Pro */}
          <div style={{ background: "rgba(206,147,216,0.06)", borderRadius: 20, padding: "20px 20px 18px", border: "1px solid rgba(206,147,216,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <div style={{ fontSize: 13, color: "#CE93D8", fontWeight: 700, letterSpacing: 1 }}>💎 Pro</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700 }}>$149 <span style={{ fontSize: 12, color: "#888" }}>MXN/mes</span></div>
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 16px" }}>
              {TIERS.pro.features.map((f, i) => (
                <li key={i} style={{ fontSize: 12.5, color: "#aaa", display: "flex", gap: 8, marginBottom: 6, lineHeight: 1.4 }}>
                  <span style={{ color: "#CE93D8", flexShrink: 0 }}>✓</span>{f}
                </li>
              ))}
            </ul>
            <button onClick={() => { setTierIntent("pro"); setScreen("register"); }} style={{ width: "100%", padding: "13px", borderRadius: 14, border: "1.5px solid #CE93D8", background: "transparent", color: "#CE93D8", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Elegir Pro</button>
          </div>

        </div>
        <div style={{ color: "#666", fontSize: 13, marginTop: 16, textAlign: "center" }}>14 días gratis antes de cualquier cobro · Cancela cuando quieras</div>
      </div>
    </div>
  );

  // ── REGISTRO ──────────────────────────────────────────────────────────
  if (screen === "register") return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#0a0f18 0%,#111827 100%)", fontFamily: "'DM Sans',sans-serif", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <div style={{ width: "100%", maxWidth: 400 }}>
        <button onClick={() => setScreen("landing")} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 14, marginBottom: 32, padding: 0 }}>← Regresar</button>
        <div style={{ background: "rgba(129,199,132,0.10)", border: "1.5px solid rgba(129,199,132,0.25)", borderRadius: 14, padding: "14px 18px", marginBottom: 30 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>✦</span>
            <div><div style={{ fontWeight: 700, fontSize: 15, color: "#81C784" }}>14 días completamente gratis</div><div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>Sin tarjeta de crédito · Sin compromisos</div></div>
          </div>
          <div style={{ marginTop: 14, display: "flex" }}>
            {[["Hoy", "Acceso\ncompleto", "#81C784"], ["Día 12", "Recordatorio", "#FFB74D"], ["Día 14", "Elige tu\nplan", "#888"]].map(([day, label, color], i) => (
              <div key={i} style={{ flex: 1, textAlign: "center", position: "relative" }}>
                {i < 2 && <div style={{ position: "absolute", top: 8, left: "50%", right: "-50%", height: 2, background: "rgba(255,255,255,0.08)" }} />}
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: color, margin: "0 auto 6px", position: "relative", zIndex: 1 }} />
                <div style={{ fontSize: 10, color, fontWeight: 600 }}>{day}</div>
                <div style={{ fontSize: 9, color: "#555", marginTop: 2, whiteSpace: "pre-line", lineHeight: 1.4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, margin: "0 0 6px" }}>Crear cuenta</h2>
        <p style={{ color: "#666", fontSize: 13, margin: "0 0 26px" }}>Solo necesitamos tu nombre y correo.</p>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: "#888", letterSpacing: 1, textTransform: "uppercase" }}>Nombre</label>
          <input type="text" placeholder="Tu nombre" value={registro.nombre} onChange={e => setRegistro(r => ({ ...r, nombre: e.target.value }))} style={inputStyle} />
        </div>
        <div style={{ marginBottom: 26 }}>
          <label style={{ fontSize: 11, color: "#888", letterSpacing: 1, textTransform: "uppercase" }}>Correo electrónico</label>
          <input type="email" placeholder="tucorreo@email.com" value={registro.email} onChange={e => setRegistro(r => ({ ...r, email: e.target.value }))} style={inputStyle} />
        </div>
        <button onClick={handleRegister} disabled={!registro.nombre || !registro.email} style={{ width: "100%", padding: "16px", borderRadius: 14, border: "none", background: registro.nombre && registro.email ? "#FFB74D" : "#222", color: registro.nombre && registro.email ? "#000" : "#555", fontWeight: 700, fontSize: 16, cursor: registro.nombre && registro.email ? "pointer" : "default", transition: "all 0.2s" }}>Empezar mi prueba gratuita →</button>
        <div style={{ fontSize: 11, color: "#444", textAlign: "center", marginTop: 12 }}>Sin cargos automáticos.</div>
      </div>
    </div>
  );

  if (screen === "guia" && guiaActiva) return <GuiaDieta guiaActiva={guiaActiva} guiaOrigen={guiaOrigen} somatotipo={somatotipo} objetivo={objetivo} setProtocolo={setProtocolo} setScreen={setScreen} />;

  // ── UPGRADE ───────────────────────────────────────────────────────────
  if (screen === "upgrade") {
    const featLabel = { protocolos_avanzados: "Protocolos Keto y Ayuno Intermitente", ajuste_porciones: "Ajuste de porciones personalizado", distribucion_comidas: "Distribución de comidas", seguimiento: "Seguimiento semanal con gráficas", ia: "Recomendaciones con Inteligencia Artificial", pdf: "Exportar plan en PDF" };
    const tierNecesario = FEATURE_TIER[upgradeFeature] || "premium";
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#0a0f18 0%,#111827 100%)", fontFamily: "'DM Sans',sans-serif", color: "#fff", padding: "0 20px 60px" }}>
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
        <div style={{ maxWidth: 420, margin: "0 auto", paddingTop: 32 }}>
          <button onClick={() => setScreen("app")} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 14, marginBottom: 24, padding: 0 }}>← Regresar</button>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, margin: "0 0 8px" }}>Función Premium</h2>
            <p style={{ color: "#666", fontSize: 14, lineHeight: 1.6 }}><span style={{ color: "#FFB74D" }}>{featLabel[upgradeFeature]}</span> requiere un plan de pago.</p>
          </div>
          {["premium", "pro"].map(tid => {
            const t = TIERS[tid]; const esRec = tid === tierNecesario; const esActual = tid === tier;
            return (
              <div key={tid} style={{ marginBottom: 16, borderRadius: 18, padding: "20px", background: esRec ? `${t.color}10` : "rgba(255,255,255,0.04)", border: `2px solid ${esRec ? t.color : "rgba(255,255,255,0.08)"}`, position: "relative", overflow: "hidden" }}>
                {esRec && <div style={{ position: "absolute", top: 0, right: 0, background: t.color, color: "#000", fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: "0 18px 0 10px" }}>RECOMENDADO</div>}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <span style={{ fontSize: 28 }}>{t.icon}</span>
                  <div><div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: t.color }}>{t.label}</div><div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>{t.precio}</div></div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
                  {t.features.map((f, i) => <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13 }}><span style={{ color: t.color, marginTop: 1 }}>✓</span><span style={{ color: "#aaa", lineHeight: 1.4 }}>{f}</span></div>)}
                </div>
                <button onClick={() => { setTier(tid); setScreen("app"); }} style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", cursor: "pointer", background: esRec ? t.color : "rgba(255,255,255,0.08)", color: esRec ? "#000" : "#aaa", fontWeight: 700, fontSize: 15 }}>{esActual ? "Plan actual ✓" : `Activar ${t.label}`}</button>
              </div>
            );
          })}
          <div style={{ marginTop: 8, padding: "14px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><div style={{ fontSize: 13, color: "#888", fontWeight: 600 }}>🆓 Plan Gratuito</div><div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>Funciones básicas sin costo</div></div>
              <button onClick={() => { setTier("gratuito"); setScreen("app"); }} style={{ fontSize: 12, color: "#555", background: "none", border: "1px solid #333", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>Continuar gratis</button>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#444", textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>Cancela en cualquier momento · Sin compromisos</div>
        </div>
      </div>
    );
  }

  // ── SEGUIMIENTO ───────────────────────────────────────────────────────
  if (screen === "seguimiento") {
    const maxPeso = registros.length ? Math.max(...registros.map(r => +r.peso)) : 100;
    const minPeso = registros.length ? Math.min(...registros.map(r => +r.peso)) : 50;
    const rangoPeso = maxPeso - minPeso || 1;
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0d1117 0%,#161b22 50%,#0d1117 100%)", fontFamily: "'DM Sans',sans-serif", color: "#fff", paddingBottom: 80 }}>
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
        <div style={{ padding: "24px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => setScreen("app")} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 22 }}>‹</button>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 10, letterSpacing: 4, color: "#FFB74D", textTransform: "uppercase" }}>NutriSelf</div><div style={{ fontSize: 14, fontWeight: 600 }}>Seguimiento</div></div>
          <div style={{ width: 24 }} />
        </div>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 20px 0" }}>
          <div style={{ background: "linear-gradient(135deg, rgba(255,183,77,0.08), rgba(129,199,132,0.06))", border: "1.5px solid rgba(255,183,77,0.2)", borderRadius: 16, padding: "16px 18px", marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "#FFB74D", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600, marginBottom: 10 }}>🤖 Recomendación personalizada</div>
            {cargandoIA ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#666", fontSize: 13 }}>
                <div style={{ width: 16, height: 16, border: "2px solid #FFB74D", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />Analizando tus datos...
              </div>
            ) : recomendacionIA ? (
              <div style={{ fontSize: 13, color: "#ccc", lineHeight: 1.7 }}>{recomendacionIA}</div>
            ) : (
              <div style={{ fontSize: 13, color: "#555", lineHeight: 1.6 }}>Registra tu primera semana y recibirás una recomendación personalizada basada en tus datos reales.</div>
            )}
          </div>
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "16px 18px", marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: editandoRegistroId ? "#FFB74D" : "#81C784", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600, marginBottom: 14 }}>
              {editandoRegistroId ? `✏️ Editando Semana ${registros.find(r => r.id === editandoRegistroId)?.semana ?? ""}` : `📝 Registro semanal #${registros.length + 1}`}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              {[{ key: "peso", label: "Peso (kg)", placeholder: "75.5" }, { key: "cintura", label: "Cintura (cm)", placeholder: "85" }].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label style={{ fontSize: 9, color: "#888", letterSpacing: 1, textTransform: "uppercase" }}>{label}</label>
                  <input type="number" placeholder={placeholder} value={nuevoRegistro[key]} onChange={e => setNuevoRegistro(r => ({ ...r, [key]: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4, padding: "10px 10px", background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.11)", borderRadius: 10, color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              {[{ key: "cuello", label: "Cuello (cm)", placeholder: "38" }, { key: "talla", label: "Estatura (cm)", placeholder: perfil.talla || "175" }].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label style={{ fontSize: 9, color: "#888", letterSpacing: 1, textTransform: "uppercase" }}>{label}</label>
                  <input type="number" placeholder={String(placeholder)} value={nuevoRegistro[key] ?? ""} onChange={e => setNuevoRegistro(r => ({ ...r, [key]: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4, padding: "10px 10px", background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.11)", borderRadius: 10, color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
              ))}
            </div>
            {errorRegistros && <div style={{ fontSize: 12, color: "#ef9a9a", marginBottom: 10 }}>⚠️ {errorRegistros}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={guardarRegistro} disabled={!nuevoRegistro.peso || !nuevoRegistro.cintura} style={{ flex: 1, padding: "13px", borderRadius: 12, border: "none", background: nuevoRegistro.peso && nuevoRegistro.cintura ? "#FFB74D" : "#222", color: nuevoRegistro.peso && nuevoRegistro.cintura ? "#000" : "#555", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                {editandoRegistroId ? "Guardar cambios →" : "Guardar y analizar con IA →"}
              </button>
              {editandoRegistroId && (
                <button onClick={cancelarEdicionRegistro} style={{ padding: "13px 16px", borderRadius: 12, border: "1.5px solid #333", background: "transparent", color: "#888", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              )}
            </div>
          </div>
          {registros.length > 0 && (() => {
            const W = 320; const H = 110; const pad = 28;
            const pesos = registros.map(r => +r.peso);
            const cints = registros.map(r => +r.cintura);
            const minP = Math.min(...pesos) - 1; const maxP = Math.max(...pesos) + 1;
            const minC = Math.min(...cints) - 2; const maxC = Math.max(...cints) + 2;
            const xOf = i => pad + (i / Math.max(registros.length - 1, 1)) * (W - pad * 2);
            const yOfP = v => H - pad - ((v - minP) / (maxP - minP || 1)) * (H - pad * 2);
            const yOfC = v => H - pad - ((v - minC) / (maxC - minC || 1)) * (H - pad * 2);
            const pathP = registros.map((r, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOfP(+r.peso).toFixed(1)}`).join(" ");
            const pathC = registros.map((r, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOfC(+r.cintura).toFixed(1)}`).join(" ");
            const cambPeso = pesos.length > 1 ? (pesos[pesos.length-1] - pesos[0]).toFixed(1) : null;
            const cambCint = cints.length > 1 ? (cints[cints.length-1] - cints[0]).toFixed(1) : null;
            return (
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "16px 18px", marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: "#64B5F6", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>📈 Progreso</div>
                <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "#888" }}>⚖️ Peso <span style={{ color: cambPeso && +cambPeso < 0 ? "#81C784" : "#ef9a9a", fontWeight: 700 }}>{cambPeso ? (cambPeso > 0 ? "+" : "") + cambPeso + " kg" : "—"}</span></div>
                  <div style={{ fontSize: 11, color: "#888" }}>📏 Cintura <span style={{ color: cambCint && +cambCint < 0 ? "#81C784" : "#ef9a9a", fontWeight: 700 }}>{cambCint ? (cambCint > 0 ? "+" : "") + cambCint + " cm" : "—"}</span></div>
                </div>
                <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", overflow: "visible" }}>
                  {/* Grid lines */}
                  {[0.25, 0.5, 0.75, 1].map(t => (
                    <line key={t} x1={pad} y1={H - pad - t*(H-pad*2)} x2={W-pad} y2={H - pad - t*(H-pad*2)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                  ))}
                  {/* Peso line */}
                  {registros.length > 1 && <path d={pathP} fill="none" stroke="#FFB74D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
                  {/* Cintura line */}
                  {registros.length > 1 && <path d={pathC} fill="none" stroke="#64B5F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4,3" />}
                  {/* Dots peso */}
                  {registros.map((r, i) => (
                    <g key={i}>
                      <circle cx={xOf(i)} cy={yOfP(+r.peso)} r="4" fill="#FFB74D" />
                      <text x={xOf(i)} y={yOfP(+r.peso) - 7} textAnchor="middle" fontSize="8" fill="#FFB74D">{r.peso}</text>
                    </g>
                  ))}
                  {/* Dots cintura */}
                  {registros.map((r, i) => (
                    <circle key={i} cx={xOf(i)} cy={yOfC(+r.cintura)} r="3" fill="#64B5F6" />
                  ))}
                  {/* Labels eje X */}
                  {registros.map((r, i) => (
                    <text key={i} x={xOf(i)} y={H - 4} textAnchor="middle" fontSize="8" fill="#555">S{r.semana}</text>
                  ))}
                </svg>
                <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#888" }}><div style={{ width: 16, height: 2, background: "#FFB74D", borderRadius: 99 }} /> Peso (kg)</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#888" }}><div style={{ width: 16, height: 2, background: "#64B5F6", borderRadius: 99, borderTop: "2px dashed #64B5F6" }} /> Cintura (cm)</div>
                </div>
              </div>
            );
          })()}
          {registros.length > 0 && (
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "16px 18px" }}>
              <div style={{ fontSize: 12, color: "#888", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>📋 Historial</div>
              {[...registros].reverse().map((r, i) => {
                const idx = registros.length - 1 - i; const prev = idx > 0 ? registros[idx - 1] : null;
                const diffPeso = prev ? (+r.peso - +prev.peso).toFixed(1) : null; const diffCintura = prev ? (+r.cintura - +prev.cintura).toFixed(1) : null;
                const pctG = calcGrasaCorporal(+r.cintura, +r.cuello, +perfil.talla, +perfil.cadera, perfil.sexo);
                return (
                  <div key={r.id ?? i} style={{ padding: "12px 0", borderBottom: i < registros.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Semana {r.semana} <span style={{ color: "#555", fontWeight: 400, fontSize: 11 }}>· {r.fecha}</span></span>
                      {pctG && <span style={{ fontSize: 11, color: "#CE93D8" }}>Grasa: {pctG.toFixed(1)}%</span>}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
                        <span>⚖️ {r.peso} kg {diffPeso && <span style={{ color: +diffPeso <= 0 ? "#81C784" : "#ef5350" }}>({+diffPeso > 0 ? "+" : ""}{diffPeso})</span>}</span>
                        <span>📏 {r.cintura} cm {diffCintura && <span style={{ color: +diffCintura <= 0 ? "#81C784" : "#ef5350" }}>({+diffCintura > 0 ? "+" : ""}{diffCintura})</span>}</span>
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={() => editarRegistro(r)} style={{ background: "none", border: "none", color: "#FFB74D", fontSize: 11, cursor: "pointer", padding: 0 }}>Editar</button>
                        <button onClick={() => borrarRegistro(r.id)} style={{ background: "none", border: "none", color: "#ef9a9a", fontSize: 11, cursor: "pointer", padding: 0 }}>Borrar</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── HISTORIAL DE PLANES (solo lectura) ──────────────────────────────────
  if (screen === "historialPlanes") {
    const planAbierto = historialPlanesData.find(p => p.fecha === fechaHistorialAbierta);
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0d1117 0%,#161b22 50%,#0d1117 100%)", fontFamily: "'DM Sans',sans-serif", color: "#fff", paddingBottom: 60 }}>
        <div style={{ padding: "24px 20px 0", display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button onClick={() => { setScreen("app"); setFechaHistorialAbierta(null); }} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 22 }}>‹</button>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 4, color: "#CE93D8", textTransform: "uppercase" }}>NutriSelf</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700 }}>Historial de planes</div>
          </div>
        </div>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 20px" }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 16, lineHeight: 1.5 }}>Aquí puedes ver los planes de días anteriores. Solo el plan de <b>hoy</b> se puede editar — los demás son de solo consulta.</div>

          {cargandoHistorial && <div style={{ textAlign: "center", color: "#666", padding: 30 }}>Cargando historial…</div>}
          {errorHistorial && <div style={{ fontSize: 13, color: "#ef9a9a", marginBottom: 14 }}>⚠️ {errorHistorial}</div>}

          {!cargandoHistorial && !errorHistorial && historialPlanesData.length === 0 && (
            <div style={{ textAlign: "center", color: "#555", padding: 30, fontSize: 13 }}>Todavía no hay planes guardados.</div>
          )}

          {!cargandoHistorial && historialPlanesData.map(p => {
            const abierto = p.fecha === fechaHistorialAbierta;
            const datos   = p.datos || {};
            const tot     = abierto ? calcularTotalesDe(datos.seleccion, datos.porciones, datos.precios) : null;
            const items   = abierto ? [...(datos.seleccion?.proteinas || []), ...(datos.seleccion?.carbohidratos || []), ...(datos.seleccion?.lipidos || [])] : [];
            const esHoy   = p.fecha === fechaLocalISO();
            return (
              <div key={p.fecha} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, marginBottom: 12, overflow: "hidden" }}>
                <button onClick={() => setFechaHistorialAbierta(abierto ? null : p.fecha)} style={{ width: "100%", padding: "14px 16px", background: "none", border: "none", color: "#fff", textAlign: "left", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{formatearFecha(p.fecha)}{esHoy && <span style={{ color: "#81C784", fontSize: 11 }}> · hoy</span>}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span
                      onClick={(e) => { e.stopPropagation(); borrarPlanDia(p.fecha); }}
                      style={{ color: "#ef9a9a", fontSize: 11, fontWeight: 600 }}
                    >Borrar</span>
                    <span style={{ color: "#666", fontSize: 16 }}>{abierto ? "▾" : "▸"}</span>
                  </span>
                </button>
                {abierto && (
                  <div style={{ padding: "0 16px 16px" }}>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 10 }}>
                      {PROTOCOLOS[datos.protocolo]?.icon} {PROTOCOLOS[datos.protocolo]?.label || "—"} · {OBJETIVOS.find(o => o.id === datos.objetivo)?.icon} {OBJETIVOS.find(o => o.id === datos.objetivo)?.label || "—"}
                    </div>
                    {items.length === 0 ? (
                      <div style={{ fontSize: 12, color: "#555" }}>Sin alimentos guardados ese día.</div>
                    ) : (
                      <>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 8 }}>
                          <thead>
                            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                              {["Alimento", "Porción", "Pro", "Car", "Lip", "kcal"].map(h => (
                                <td key={h} style={{ padding: "5px 4px", fontSize: 9, color: "#555", textTransform: "uppercase" }}>{h}</td>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {items.map(f => {
                              const porcionActual = datos.porciones?.[f.id] ?? f.porcion;
                              const factor = porcionActual / f.porcion;
                              return (
                                <tr key={f.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                  <td style={{ padding: "6px 4px", color: "#ddd" }}>{f.nombre}</td>
                                  <td style={{ padding: "6px 4px", color: "#aaa" }}>{porcionActual}g</td>
                                  <td style={{ padding: "6px 4px", color: "#81C784" }}>{(f.proteinas * factor).toFixed(1)}</td>
                                  <td style={{ padding: "6px 4px", color: "#64B5F6" }}>{(f.carbos * factor).toFixed(1)}</td>
                                  <td style={{ padding: "6px 4px", color: "#FFB74D" }}>{(f.lipidos * factor).toFixed(1)}</td>
                                  <td style={{ padding: "6px 4px", color: "#ddd", fontWeight: 600 }}>{Math.round(f.calorias * factor)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <div style={{ fontSize: 12, color: "#FFB74D", fontWeight: 700 }}>
                          Total: {tot.proteinas.toFixed(1)}g pro · {tot.carbos.toFixed(1)}g car · {tot.lipidos.toFixed(1)}g lip · {Math.round(tot.calorias)} kcal
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── PROTOCOLO ─────────────────────────────────────────────────────────
  if (screen === "protocolo") {
    const protDisponibles = Object.values(PROTOCOLOS).filter(p => p.objetivosPermitidos.includes(objetivo));
    const objInfo = OBJETIVOS.find(o => o.id === objetivo);
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#0a0f18 0%,#111827 100%)", fontFamily: "'DM Sans',sans-serif", color: "#fff", padding: "0 24px 60px" }}>
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
        <div style={{ maxWidth: 420, margin: "0 auto", paddingTop: 32 }}>
          <button onClick={() => setScreen("resultado")} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 14, marginBottom: 24, padding: 0 }}>← Regresar</button>
          <div style={{ fontSize: 10, letterSpacing: 4, color: "#FFB74D", textTransform: "uppercase", marginBottom: 8 }}>Elige tu protocolo</div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, margin: "0 0 6px" }}>¿Cómo quieres comer?</h2>
          <p style={{ color: "#666", fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>Objetivo: <span style={{ color: "#FFB74D" }}>{objInfo?.icon} {objInfo?.label}</span> · Elige el protocolo que mejor se adapte a tu estilo de vida.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {protDisponibles.map(p => {
              const esAvanzado = p.id !== "estandar"; const bloqueado = esAvanzado && !tieneAcceso("protocolos_avanzados");
              return (
                <button key={p.id} onClick={() => bloqueado ? intentarAcceder("protocolos_avanzados", () => {}) : setProtocolo(p.id)} style={{ padding: "16px 18px", borderRadius: 16, border: "none", cursor: "pointer", textAlign: "left", background: protocolo === p.id ? "rgba(255,183,77,0.12)" : "rgba(255,255,255,0.04)", outline: protocolo === p.id ? "2px solid #FFB74D" : "2px solid transparent", transition: "all 0.2s", opacity: bloqueado ? 0.6 : 1, position: "relative" }}>
                  {bloqueado && <div style={{ position: "absolute", top: 10, right: 10, background: "#FFB74D", borderRadius: 99, padding: "2px 8px", fontSize: 10, color: "#000", fontWeight: 700 }}>🔒 Premium</div>}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: p.advertencia ? 10 : 0 }}>
                    <span style={{ fontSize: 26 }}>{p.icon}</span>
                    <div style={{ flex: 1 }}><div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{p.label}</div><div style={{ color: "#888", fontSize: 12, marginTop: 2, lineHeight: 1.5 }}>{p.desc}</div></div>
                    {protocolo === p.id && <span style={{ color: "#FFB74D", fontSize: 18 }}>✓</span>}
                  </div>
                  {protocolo === p.id && (
                    <div>
                      {p.ajusteMacros ? (
                        <div style={{ padding: "10px 12px", background: "rgba(0,0,0,0.25)", borderRadius: 10, marginBottom: 8 }}>
                          <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>Distribución de macros</div>
                          <div style={{ display: "flex", gap: 12, fontSize: 12 }}><span>🥩 {Math.round(p.ajusteMacros.p * 100)}% P</span><span>🌾 {Math.round(p.ajusteMacros.c * 100)}% C</span><span>🥑 {Math.round(p.ajusteMacros.l * 100)}% L</span></div>
                        </div>
                      ) : (
                        <div style={{ padding: "10px 12px", background: "rgba(0,0,0,0.25)", borderRadius: 10, marginBottom: 8 }}>
                          <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Distribución según tu objetivo + somatotipo</div>
                          <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#aaa" }}><span>🥩 {Math.round(dist.p * 100)}% P</span><span>🌾 {Math.round(dist.c * 100)}% C</span><span>🥑 {Math.round(dist.l * 100)}% L</span></div>
                        </div>
                      )}
                      {p.advertencia && <div style={{ padding: "10px 12px", background: "rgba(239,83,80,0.08)", border: "1px solid rgba(239,83,80,0.2)", borderRadius: 10, marginBottom: 8 }}><div style={{ fontSize: 12, color: "#ef9a9a", lineHeight: 1.6 }}>{p.advertencia}</div></div>}
                      <div style={{ padding: "10px 12px", background: "rgba(100,181,246,0.07)", border: "1px solid rgba(100,181,246,0.15)", borderRadius: 10, marginBottom: 8 }}>
                        <div style={{ fontSize: 10, color: "#64B5F6", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>📚 Respaldo científico</div>
                        <div style={{ fontSize: 11, color: "#888", lineHeight: 1.6 }}>{p.ciencia}</div>
                      </div>
                      {GUIAS_DIETA[p.id] && <button onClick={e => { e.stopPropagation(); setGuiaActiva(p.id); setGuiaOrigen("protocolo"); setScreen("guia"); }} style={{ width: "100%", padding: "10px", borderRadius: 10, border: `1.5px solid ${p.id === "estandar" ? "#888" : "#FFB74D"}`, background: "transparent", color: p.id === "estandar" ? "#888" : "#FFB74D", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>📖 Ver guía completa — timeline, síntomas y más</button>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 16, padding: "12px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }}>
            <div style={{ fontSize: 11, color: "#555", lineHeight: 1.6 }}>💡 <span style={{ color: "#888" }}>El número de comidas al día no afecta el metabolismo — está demostrado científicamente. Lo que importa es el total calórico. Tú decides cuántas comidas hacer según tu tiempo.</span></div>
          </div>
          <button onClick={() => setScreen("app")} style={{ marginTop: 20, width: "100%", padding: "15px", borderRadius: 14, border: "none", background: "#FFB74D", color: "#000", fontWeight: 700, fontSize: 16, cursor: "pointer" }}>Armar mi plan con {PROTOCOLOS[protocolo]?.label} →</button>
        </div>
      </div>
    );
  }

  // ── RESULTADO ─────────────────────────────────────────────────────────
  if (screen === "resultado") {
    const objInfo = OBJETIVOS.find(o => o.id === objetivo);
    const etiquetas = { bajar: { titulo: "Tu plan: Bajar de peso", desc: "Basado en tus respuestas, tu prioridad es reducir peso con un déficit calórico controlado.", color: "#64B5F6" }, quemar: { titulo: "Tu plan: Quemar grasa", desc: "Tu perfil indica que puedes perder grasa preservando músculo. Ideal para recomposición corporal.", color: "#FFB74D" }, mantener: { titulo: "Tu plan: Mantenimiento", desc: "Tu objetivo es mantener tu peso actual y mejorar tu salud general.", color: "#81C784" }, masa: { titulo: "Tu plan: Ganar masa", desc: "Tu cuerpo está listo para un superávit calórico controlado y ganancia muscular.", color: "#CE93D8" } };
    const info = etiquetas[objetivo] || etiquetas.quemar;
    const dist2 = (DISTRIBUCIONES[objetivo] || DISTRIBUCIONES.quemar).default;
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#0a0f18 0%,#111827 100%)", fontFamily: "'DM Sans',sans-serif", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px 60px" }}>
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
        <div style={{ width: "100%", maxWidth: 420 }}>
          <button onClick={() => { setPreguntaActual(PREGUNTAS.length - 1); setScreen("cuestionario"); }} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 14, marginBottom: 20, padding: 0 }}>← Regresar al cuestionario</button>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: `${info.color}22`, border: `2px solid ${info.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 16px" }}>{objInfo?.icon}</div>
            <div style={{ fontSize: 11, letterSpacing: 3, color: info.color, textTransform: "uppercase", marginBottom: 8 }}>Perfil completo</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, margin: "0 0 10px" }}>{info.titulo}</h2>
            <p style={{ color: "#888", fontSize: 14, lineHeight: 1.6, margin: 0 }}>{info.desc}</p>
          </div>
          {/* Selector manual de objetivo */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: "#555", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8, textAlign: "center" }}>¿No es tu objetivo? Cámbialo:</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
              {OBJETIVOS.map(o => (
                <button key={o.id} onClick={() => setObjetivo(o.id)} style={{
                  padding: "6px 14px", borderRadius: 99, fontSize: 12, cursor: "pointer", border: "none", fontWeight: objetivo === o.id ? 700 : 400,
                  background: objetivo === o.id ? info.color : "rgba(255,255,255,0.07)",
                  color: objetivo === o.id ? "#000" : "#888",
                  transition: "all 0.2s",
                }}>
                  {o.icon} {o.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "18px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: info.color, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600, marginBottom: 14 }}>Distribución de macros base</div>
            {[["🥩 Proteínas", dist2.p, "#81C784"], ["🌾 Carbohidratos", dist2.c, "#64B5F6"], ["🥑 Lípidos", dist2.l, "#FFB74D"]].map(([label, pct, color]) => (
              <div key={label} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span style={{ color: "#aaa" }}>{label}</span><span style={{ color, fontWeight: 700 }}>{Math.round(pct * 100)}%</span></div>
                <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 99, height: 6 }}><div style={{ width: `${pct * 100}%`, background: color, height: "100%", borderRadius: 99 }} /></div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {SOMATOTIPOS.map(s => (
              <button key={s.id} onClick={() => setSomatotipo(s.id)} style={{ padding: "14px 12px", borderRadius: 14, border: "none", cursor: "pointer", background: somatotipo === s.id ? `${info.color}15` : "rgba(255,255,255,0.04)", outline: somatotipo === s.id ? `2px solid ${info.color}` : "2px solid transparent", textAlign: "left" }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: "#666", lineHeight: 1.4 }}>{s.desc}</div>
                {somatotipo === s.id && <div style={{ fontSize: 10, color: info.color, marginTop: 6, lineHeight: 1.4 }}>{s.nota}</div>}
              </button>
            ))}
          </div>
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "16px 18px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#888", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600, marginBottom: 14 }}>Datos físicos (opcional)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
              {[{ key: "peso", label: "Peso (kg)", placeholder: "75" }, { key: "talla", label: "Talla (cm)", placeholder: "175" }, { key: "edad", label: "Edad", placeholder: "30" }].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label style={{ fontSize: 9, color: "#666", letterSpacing: 1, textTransform: "uppercase" }}>{label}</label>
                  <input type="number" placeholder={placeholder} value={perfil[key]} onChange={e => setPerfil(p => ({ ...p, [key]: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4, padding: "9px 10px", background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.11)", borderRadius: 10, color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: perfil.sexo === "F" ? "1fr 1fr 1fr" : "1fr 1fr", gap: 10, marginBottom: 10 }}>
              {[{ key: "cintura", label: "Cintura (cm)", placeholder: "85" }, { key: "cuello", label: "Cuello (cm)", placeholder: "38" }, ...(perfil.sexo === "F" ? [{ key: "cadera", label: "Cadera (cm)", placeholder: "95" }] : [])].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label style={{ fontSize: 9, color: "#666", letterSpacing: 1, textTransform: "uppercase" }}>{label}</label>
                  <input type="number" placeholder={placeholder} value={perfil[key]} onChange={e => setPerfil(p => ({ ...p, [key]: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4, padding: "9px 10px", background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.11)", borderRadius: 10, color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ fontSize: 9, color: "#666", letterSpacing: 1, textTransform: "uppercase" }}>Sexo</label>
                <select value={perfil.sexo} onChange={e => setPerfil(p => ({ ...p, sexo: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4, padding: "9px 10px", background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.11)", borderRadius: 10, color: "#fff", fontSize: 13, outline: "none" }}>
                  <option value="M">Masculino</option><option value="F">Femenino</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 9, color: "#666", letterSpacing: 1, textTransform: "uppercase" }}>Actividad</label>
                <select value={perfil.actividad} onChange={e => setPerfil(p => ({ ...p, actividad: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4, padding: "9px 10px", background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.11)", borderRadius: 10, color: "#fff", fontSize: 13, outline: "none" }}>
                  <option value="sedentario">Sedentario</option><option value="ligero">Ligero</option><option value="moderado">Moderado</option><option value="activo">Activo</option><option value="muyactivo">Muy activo</option>
                </select>
              </div>
            </div>
            {tdee && (
              <div style={{ marginTop: 14, padding: "12px 14px", background: `${info.color}0d`, border: `1px solid ${info.color}33`, borderRadius: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-around", textAlign: "center" }}>
                  {[[tdee, "TDEE", "kcal/día"], [calMeta, "Meta", "kcal/día"], imc ? [imc.toFixed(1), "IMC", imcLabel] : null, pctGrasa ? [pctGrasa.toFixed(1) + "%", "Grasa", "corporal"] : null].filter(Boolean).map(([val, label, sub], i) => (
                    <div key={i}><div style={{ fontSize: 18, fontWeight: 700, color: info.color }}>{val}</div><div style={{ fontSize: 10, color: "#888" }}>{label}</div><div style={{ fontSize: 9, color: "#555" }}>{sub}</div></div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button onClick={() => setScreen("protocolo")} style={{ width: "100%", padding: "15px", borderRadius: 14, border: "none", background: info.color, color: "#000", fontWeight: 700, fontSize: 16, cursor: "pointer", marginBottom: 10 }}>Elegir protocolo →</button>
          <button onClick={() => setScreen("app")} style={{ width: "100%", padding: "13px", borderRadius: 14, border: `1.5px solid ${info.color}`, background: "transparent", color: info.color, fontWeight: 600, fontSize: 15, cursor: "pointer" }}>Ir directo al plan →</button>
        </div>
      </div>
    );
  }

  // ── RESUMEN FINAL ─────────────────────────────────────────────────────
  if (screen === "resumen") {
    const objInfo = OBJETIVOS.find(o => o.id === objetivo);
    const proto   = PROTOCOLOS[protocolo];
    const soma    = SOMATOTIPOS.find(s => s.id === somatotipo);
    const totalAlimentos = [...seleccion.proteinas, ...seleccion.carbohidratos, ...seleccion.lipidos];
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0d1117 0%,#161b22 50%,#0d1117 100%)", fontFamily: "'DM Sans',sans-serif", color: "#fff", paddingBottom: 80 }}>
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
        <div style={{ padding: "24px 20px 0", display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button onClick={() => setScreen("app")} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 22 }}>‹</button>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 4, color: "#FFB74D", textTransform: "uppercase" }}>NutriSelf</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700 }}>Resumen del plan</div>
          </div>
        </div>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 20px" }}>

          {/* Datos del usuario */}
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "16px", marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#FFB74D", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>👤 Datos registrados</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <tbody>
                {[
                  ["Nombre", registro.nombre || "—"],
                  ["Objetivo", `${objInfo?.icon} ${objInfo?.label}`],
                  ["Protocolo", `${proto?.icon} ${proto?.label}`],
                  ["Somatotipo", soma ? `${soma.icon} ${soma.label}` : "No especificado"],
                  ["Peso", perfil.peso ? `${perfil.peso} kg` : "—"],
                  ["Talla", perfil.talla ? `${perfil.talla} cm` : "—"],
                  ["Edad", perfil.edad ? `${perfil.edad} años` : "—"],
                  ["Sexo", perfil.sexo === "M" ? "Masculino" : "Femenino"],
                  ["Cintura", perfil.cintura ? `${perfil.cintura} cm` : "—"],
                  ["Cuello", perfil.cuello ? `${perfil.cuello} cm` : "—"],
                  ...(perfil.sexo === "F" ? [["Cadera", perfil.cadera ? `${perfil.cadera} cm` : "—"]] : []),
                  ["IMC", imc ? `${imc.toFixed(1)} (${imcLabel})` : "—"],
                  ["% Grasa corporal", pctGrasa ? `${pctGrasa.toFixed(1)}%` : "—"],
                  ["Masa magra", masaMagra ? `${masaMagra.toFixed(1)} kg` : "—"],
                  ["TDEE", tdee ? `${tdee} kcal/día` : "—"],
                  ["Meta calórica", `${calMeta} kcal/día`],
                  ["Meta proteína", proteinaMeta ? `${proteinaMeta} g/día` : "—"],
                  ["Comidas/día", nombreComidas.length.toString()],
                  ["Restricción", restriccion],
                ].map(([label, val], i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ padding: "7px 4px", color: "#666", fontWeight: 500, width: "45%" }}>{label}</td>
                    <td style={{ padding: "7px 4px", color: "#ddd", fontWeight: 600 }}>{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Macros meta */}
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "16px", marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#81C784", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>📊 Distribución de macros objetivo</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                  {["Macro", "% objetivo", "g/día objetivo", "g/día actual"].map(h => (
                    <td key={h} style={{ padding: "6px 4px", fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>{h}</td>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["🥩 Proteína", Math.round(dist.p * 100), Math.round(calMeta * dist.p / 4), totales.proteinas.toFixed(1), "#81C784"],
                  ["🌾 Carbos",   Math.round(dist.c * 100), Math.round(calMeta * dist.c / 4), totales.carbos.toFixed(1),   "#64B5F6"],
                  ["🥑 Lípidos",  Math.round(dist.l * 100), Math.round(calMeta * dist.l / 9), totales.lipidos.toFixed(1),  "#FFB74D"],
                ].map(([label, pct, gMeta, gActual, color]) => (
                  <tr key={label} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ padding: "8px 4px", color, fontWeight: 600 }}>{label}</td>
                    <td style={{ padding: "8px 4px", color: "#aaa" }}>{pct}%</td>
                    <td style={{ padding: "8px 4px", color: "#aaa" }}>{gMeta}g</td>
                    <td style={{ padding: "8px 4px", color: +gActual > 0 ? color : "#555", fontWeight: 700 }}>{+gActual > 0 ? `${gActual}g` : "—"}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ padding: "8px 4px", color: "#FFB74D", fontWeight: 700 }}>Total</td>
                  <td style={{ padding: "8px 4px", color: "#aaa" }}>100%</td>
                  <td style={{ padding: "8px 4px", color: "#aaa" }}>{calMeta} kcal</td>
                  <td style={{ padding: "8px 4px", color: totales.calorias > 0 ? "#FFB74D" : "#555", fontWeight: 700 }}>{totales.calorias > 0 ? `${Math.round(totales.calorias)} kcal` : "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Alimentos seleccionados — tabla con porción editable */}
          {totalAlimentos.length > 0 && (() => {
            const metaPro = Math.round(calMeta * dist.p / 4);
            const metaCar = Math.round(calMeta * dist.c / 4);
            const metaLip = Math.round(calMeta * dist.l / 9);
            const metaCal = calMeta;
            const diffPro = totales.proteinas - metaPro;
            const diffCar = totales.carbos    - metaCar;
            const diffLip = totales.lipidos   - metaLip;
            const diffCal = totales.calorias  - metaCal;
            const okPro   = Math.abs(diffPro / metaPro) < 0.03;
            const okCar   = Math.abs(diffCar / metaCar) < 0.03;
            const okLip   = Math.abs(diffLip / metaLip) < 0.03;
            const okCal   = Math.abs(diffCal / metaCal) < 0.03;
            const colPro  = okPro ? "#81C784" : diffPro > 0 ? "#ef5350" : "#FFB74D";
            const colCar  = okCar ? "#64B5F6" : diffCar > 0 ? "#ef5350" : "#FFB74D";
            const colLip  = okLip ? "#FFB74D" : diffLip > 0 ? "#ef5350" : "#64B5F6";
            const colCal  = okCal ? "#81C784" : diffCal > 0 ? "#ef5350" : "#FFB74D";
            // % que cada macro representa del total de calorías (igual que en la hoja de cálculo original)
            const pctProCal = totales.calorias > 0 ? (totales.proteinas * 4 / totales.calorias) * 100 : 0;
            const pctCarCal = totales.calorias > 0 ? (totales.carbos    * 4 / totales.calorias) * 100 : 0;
            const pctLipCal = totales.calorias > 0 ? (totales.lipidos   * 9 / totales.calorias) * 100 : 0;
            return (
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "16px", marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "#CE93D8", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 }}>🍽️ Alimentos del plan</div>
                  <div style={{ fontSize: 9, color: "#555" }}>toca la porción para editar</div>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                        {["Alimento", "Porción", "Pro", "Car", "Lip", "kcal", "Costo"].map(h => (
                          <td key={h} style={{ padding: "5px 4px", fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap" }}>{h}</td>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const idsAsignados   = new Set(Object.values(planComidas).flat());
                        const sinAsignarTbl  = totalAlimentos.filter(f => !idsAsignados.has(f.id));
                        const grupos = [
                          ...nombreComidas.map(c => ({ nombre: c, foods: totalAlimentos.filter(f => (planComidas[c] || []).includes(f.id)) })),
                          ...(sinAsignarTbl.length ? [{ nombre: "Sin asignar a una comida", foods: sinAsignarTbl, avisar: true }] : []),
                        ];
                        return grupos.map((g, gi) => g.foods.length === 0 ? null : (
                          <Fragment key={g.nombre}>
                            <tr>
                              <td colSpan={7} style={{ padding: "10px 4px 4px", fontSize: 10, fontWeight: 700, color: g.avisar ? "#FFB74D" : "#CE93D8", letterSpacing: 1, textTransform: "uppercase", borderTop: gi > 0 ? "1px solid rgba(255,255,255,0.08)" : "none" }}>{g.avisar ? "⚠️ " : "🍽️ "}{g.nombre}</td>
                            </tr>
                            {g.foods.map(f => {
                              const porcionActual = porciones[f.id] ?? f.porcion;
                              const factor        = porcionActual / f.porcion;
                              const costoFila     = (costoPorcion(f, precios) / f.porcion) * porcionActual;
                              return (
                                <tr key={f.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                  <td style={{ padding: "8px 4px", color: "#ddd", fontWeight: 600, fontSize: 12 }}>{f.nombre}</td>
                                  <td style={{ padding: "4px 4px" }}>
                                    <input
                                      type="number"
                                      min={Math.round(f.porcion * 0.1)}
                                      max={Math.round(f.porcion * 5)}
                                      step={5}
                                      value={porcionActual}
                                      onChange={e => {
                                        const v = +e.target.value;
                                        if (v > 0) setPorciones(p => ({ ...p, [f.id]: v }));
                                      }}
                                      style={{
                                        width: 52, padding: "4px 5px", background: "rgba(206,147,216,0.12)",
                                        border: "1px solid rgba(206,147,216,0.35)", borderRadius: 7,
                                        color: "#CE93D8", fontSize: 12, fontWeight: 700,
                                        outline: "none", textAlign: "center",
                                      }}
                                    />
                                    <span style={{ fontSize: 9, color: "#555", marginLeft: 2 }}>g</span>
                                  </td>
                                  <td style={{ padding: "8px 4px", color: "#81C784" }}>{(f.proteinas * factor).toFixed(1)}</td>
                                  <td style={{ padding: "8px 4px", color: "#64B5F6" }}>{(f.carbos    * factor).toFixed(1)}</td>
                                  <td style={{ padding: "8px 4px", color: "#FFB74D" }}>{(f.lipidos   * factor).toFixed(1)}</td>
                                  <td style={{ padding: "8px 4px", color: "#ddd",    fontWeight: 600 }}>{Math.round(f.calorias * factor)}</td>
                                  <td style={{ padding: "8px 4px", color: "#4CAF50" }}>${costoFila.toFixed(1)}</td>
                                </tr>
                              );
                            })}
                          </Fragment>
                        ));
                      })()}
                      {/* Fila de totales con color dinámico */}
                      <tr style={{ borderTop: "1.5px solid rgba(255,255,255,0.12)" }}>
                        <td style={{ padding: "9px 4px", color: "#FFB74D", fontWeight: 700 }}>Total</td>
                        <td></td>
                        <td style={{ padding: "9px 4px", fontWeight: 700, color: colPro }}>
                          {totales.proteinas.toFixed(1)}
                          <div style={{ fontSize: 8, color: "#444" }}>/{metaPro}g {okPro ? "✓" : diffPro > 0 ? `+${diffPro.toFixed(0)}` : diffPro.toFixed(0)}</div>
                          <div style={{ fontSize: 8, color: colPro }}>{pctProCal.toFixed(1)}%</div>
                        </td>
                        <td style={{ padding: "9px 4px", fontWeight: 700, color: colCar }}>
                          {totales.carbos.toFixed(1)}
                          <div style={{ fontSize: 8, color: "#444" }}>/{metaCar}g {okCar ? "✓" : diffCar > 0 ? `+${diffCar.toFixed(0)}` : diffCar.toFixed(0)}</div>
                          <div style={{ fontSize: 8, color: colCar }}>{pctCarCal.toFixed(1)}%</div>
                        </td>
                        <td style={{ padding: "9px 4px", fontWeight: 700, color: colLip }}>
                          {totales.lipidos.toFixed(1)}
                          <div style={{ fontSize: 8, color: "#444" }}>/{metaLip}g {okLip ? "✓" : diffLip > 0 ? `+${diffLip.toFixed(0)}` : diffLip.toFixed(0)}</div>
                          <div style={{ fontSize: 8, color: colLip }}>{pctLipCal.toFixed(1)}%</div>
                        </td>
                        <td style={{ padding: "9px 4px", fontWeight: 700, color: colCal }}>
                          {Math.round(totales.calorias)}
                          <div style={{ fontSize: 8, color: "#444" }}>/{metaCal} {okCal ? "✓" : diffCal > 0 ? `+${Math.round(diffCal)}` : Math.round(diffCal)}</div>
                        </td>
                        <td style={{ padding: "9px 4px", color: "#4CAF50", fontWeight: 700 }}>${totales.costo.toFixed(0)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* Horario de comidas */}
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "16px", marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#64B5F6", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>⏰ Horario de comidas</div>
            {nombreComidas.map((comida, i) => {
              const factor = 1 / nombreComidas.length;
              return (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < nombreComidas.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                  <div style={{ fontSize: 13, color: "#ddd" }}>{comida}</div>
                  <div style={{ fontSize: 12, color: "#888" }}>{Math.round(totales.calorias * factor)} kcal</div>
                </div>
              );
            })}
          </div>

          {planCerrado ? (
            <div style={{ width: "100%", padding: "13px", borderRadius: 14, border: "1px solid rgba(129,199,132,0.25)", background: "rgba(129,199,132,0.07)", color: "#81C784", fontSize: 13, fontWeight: 600, textAlign: "center", marginBottom: 10 }}>✓ Plan de hoy cerrado y guardado — no se puede editar</div>
          ) : (
            <button disabled={cerrandoPlan} onClick={async () => {
              const hayAlgo = seleccion.proteinas.length || seleccion.carbohidratos.length || seleccion.lipidos.length;
              if (!hayAlgo) { if (typeof window !== "undefined") window.alert("Aún no has agregado alimentos a tu plan de hoy."); return; }
              if (typeof window !== "undefined" && !window.confirm("¿Cerrar y guardar el plan de hoy? Una vez cerrado ya NO podrás editarlo — solo el plan del día actual se puede modificar, los anteriores quedan de solo consulta. Para registrar otro plan tendrás que empezar uno nuevo.")) return;
              setCerrandoPlan(true);
              try {
                const hoy = fechaLocalISO();
                const datos = { protocolo, objetivo, numComidas, tiempoPrep, restriccion, seleccion, porciones, precios, distComidas, planComidas, cerrado: true };
                const res = await fetch("/api/planes", {
                  method:  "POST",
                  headers: { "Content-Type": "application/json" },
                  body:    JSON.stringify({ userId, fecha: hoy, datos }),
                });
                if (!res.ok) throw new Error("No se pudo cerrar el plan");
                setPlanCerrado(true);
                setFoodDbExtra({ proteinas: [], carbohidratos: [], lipidos: [] }); // limpia alimentos agregados del buscador para el próximo plan
              } catch (err) {
                if (typeof window !== "undefined") window.alert("No se pudo cerrar el plan. Intenta de nuevo.");
              } finally {
                setCerrandoPlan(false);
              }
            }} style={{ width: "100%", padding: "14px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", background: cerrandoPlan ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.06)", color: cerrandoPlan ? "#555" : "#fff", fontSize: 14, cursor: cerrandoPlan ? "default" : "pointer", fontWeight: 700, marginBottom: 10 }}>{cerrandoPlan ? "Cerrando…" : "🔒 Cerrar y guardar plan de hoy"}</button>
          )}

          <button onClick={() => setScreen("app")} style={{ width: "100%", padding: "14px", borderRadius: 14, border: "none", background: "#FFB74D", color: "#000", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>← Volver al plan</button>
        </div>
      </div>
    );
  }

  // ── CUESTIONARIO ──────────────────────────────────────────────────────
  if (screen === "cuestionario") {
    const pq = PREGUNTAS[preguntaActual];
    const pct = ((preguntaActual) / PREGUNTAS.length) * 100;
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#0a0f18 0%,#111827 100%)", fontFamily: "'DM Sans',sans-serif", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
        <div style={{ width: "100%", maxWidth: 420 }}>
          {/* Stepper numerado */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
            <button onClick={() => { if (preguntaActual > 0) { setPreguntaActual(i => i - 1); } else { setScreen("register"); } }} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 22, padding: 0, lineHeight: 1, flexShrink: 0 }}>‹</button>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 4, overflowX: "auto" }}>
              {PREGUNTAS.map((_, i) => {
                const done    = i < preguntaActual;
                const current = i === preguntaActual;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <div onClick={() => i < preguntaActual && setPreguntaActual(i)} style={{
                      width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, cursor: i < preguntaActual ? "pointer" : "default",
                      background: done ? "#81C784" : current ? "#FFB74D" : "rgba(255,255,255,0.08)",
                      color: done || current ? "#000" : "#555",
                      border: current ? "2px solid #FFB74D" : "2px solid transparent",
                      transition: "all 0.2s",
                    }}>
                      {done ? "✓" : i + 1}
                    </div>
                    {i < PREGUNTAS.length - 1 && (
                      <div style={{ width: 16, height: 2, background: i < preguntaActual ? "#81C784" : "rgba(255,255,255,0.08)", borderRadius: 99, transition: "background 0.3s" }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, margin: "0 0 28px", lineHeight: 1.3 }}>{pq.texto}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pq.opciones.map(op => (
              <button key={op.id} onClick={() => handleRespuesta(pq.id, op.id)} style={{ padding: "16px 18px", borderRadius: 14, border: "1.5px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#fff", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 14, transition: "all 0.15s" }}>
                <span style={{ fontSize: 22 }}>{op.icon}</span>
                <span style={{ fontSize: 15, lineHeight: 1.4 }}>{op.label}</span>
              </button>
            ))}
          </div>
          {preguntaActual === PREGUNTAS.length - 1 && (
            <button onClick={() => { setObjetivo(diagnosticarObjetivo(respuestas)); setScreen("resultado"); }} style={{ width: "100%", marginTop: 16, padding: "12px", borderRadius: 14, border: "1.5px solid rgba(255,255,255,0.1)", background: "transparent", color: "#666", fontSize: 13, cursor: "pointer" }}>Brincar guía →</button>
          )}
        </div>
      </div>
    );
  }

  // ── APP PRINCIPAL ─────────────────────────────────────────────────────
  const catLabels = { proteinas: { label: "Proteínas", color: "#81C784", icon: "🥩" }, carbohidratos: { label: "Carbohidratos", color: "#64B5F6", icon: "🌾" }, lipidos: { label: "Lípidos", color: "#FFB74D", icon: "🥑" } };
  const pctMacros = totales.calorias > 0 ? {
    p: (totales.proteinas * 4 / totales.calorias) * 100,
    c: (totales.carbos * 4 / totales.calorias) * 100,
    l: (totales.lipidos * 9 / totales.calorias) * 100,
  } : { p: 0, c: 0, l: 0 };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0d1117 0%,#161b22 50%,#0d1117 100%)", fontFamily: "'DM Sans',sans-serif", color: "#fff", paddingBottom: 100 }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ padding: "20px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setScreen("protocolo")} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 22, padding: 0, lineHeight: 1 }}>‹</button>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 4, color: "#FFB74D", textTransform: "uppercase" }}>NutriSelf</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700 }}>Hola, {registro.nombre || "usuario"} 👋</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, color: "#555", marginBottom: 3 }}>Trial: {daysLeft}d restantes</div>
          <div style={{ width: 80, background: "rgba(255,255,255,0.08)", borderRadius: 99, height: 4 }}><div style={{ width: `${trialPct}%`, background: daysLeft < 3 ? "#ef5350" : "#FFB74D", height: "100%", borderRadius: 99 }} /></div>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 16px" }}>

        {planCerrado && (
          <div style={{ padding: "10px 14px", background: "rgba(129,199,132,0.08)", border: "1px solid rgba(129,199,132,0.25)", borderRadius: 12, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 15 }}>🔒</span>
            <span style={{ fontSize: 12, color: "#81C784", lineHeight: 1.5 }}>Tu plan de hoy ya está cerrado y guardado. Vuelve mañana para registrar uno nuevo.</span>
          </div>
        )}

        {errorPlan && !planCerrado && (
          <div style={{ padding: "10px 14px", background: "rgba(239,154,154,0.08)", border: "1px solid rgba(239,154,154,0.25)", borderRadius: 12, marginBottom: 14, display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 15 }}>⚠️</span>
              <span style={{ fontSize: 12, color: "#ef9a9a", lineHeight: 1.5 }}>{errorPlan} Revisa tu conexión — tus cambios no se han guardado.</span>
            </div>
            <button disabled={guardandoPlan} onClick={async () => {
              setGuardandoPlan(true);
              try {
                const hoy = fechaLocalISO();
                const datos = { protocolo, objetivo, numComidas, tiempoPrep, restriccion, seleccion, porciones, precios, distComidas, planComidas };
                const res = await fetch("/api/planes", {
                  method:  "POST",
                  headers: { "Content-Type": "application/json" },
                  body:    JSON.stringify({ userId, fecha: hoy, datos }),
                });
                if (!res.ok) throw new Error("No se pudo guardar el plan");
                setErrorPlan(null);
              } catch {
                setErrorPlan("No se pudo guardar el plan automáticamente.");
              } finally {
                setGuardandoPlan(false);
              }
            }} style={{ fontSize: 11, padding: "5px 12px", borderRadius: 99, border: "1px solid rgba(239,154,154,0.4)", background: "rgba(239,154,154,0.1)", color: "#ef9a9a", cursor: guardandoPlan ? "default" : "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>{guardandoPlan ? "Guardando…" : "Reintentar"}</button>
          </div>
        )}

        {guardandoPlan && !errorPlan && !planCerrado && (
          <div style={{ fontSize: 11, color: "#666", marginBottom: 10, textAlign: "right" }}>Guardando…</div>
        )}

        {/* Meta calórica */}
        <div style={{ background: "linear-gradient(135deg, rgba(255,183,77,0.08), rgba(129,199,132,0.05))", border: "1.5px solid rgba(255,183,77,0.2)", borderRadius: 18, padding: "16px 18px", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: "#FFB74D", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 }}>Meta diaria</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, lineHeight: 1.1 }}>{Math.round(totales.calorias)} <span style={{ fontSize: 13, color: "#555", fontWeight: 400 }}>/ {calMeta} kcal</span></div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "#555", marginBottom: 2 }}>Protocolo</div>
              <button onClick={() => setScreen("protocolo")} style={{ fontSize: 12, color: "#FFB74D", background: "rgba(255,183,77,0.1)", border: "1px solid rgba(255,183,77,0.25)", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>{PROTOCOLOS[protocolo]?.icon} {PROTOCOLOS[protocolo]?.label}</button>
            </div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 99, height: 8, marginBottom: 12, overflow: "hidden" }}>
            <div style={{ width: `${Math.min(pctCal, 100)}%`, height: "100%", background: pctCal > 110 ? "#ef5350" : pctCal > 95 ? "#FFB74D" : "#81C784", borderRadius: 99, transition: "width 0.5s ease" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {[["🥩", "Proteína", totales.proteinas.toFixed(1), "g", "#81C784"], ["🌾", "Carbos", totales.carbos.toFixed(1), "g", "#64B5F6"], ["🥑", "Lípidos", totales.lipidos.toFixed(1), "g", "#FFB74D"], ["💰", "Costo", `$${totales.costo.toFixed(0)}`, "", "#4CAF50"]].map(([icon, label, val, unit, color]) => (
              <div key={label} style={{ textAlign: "center", padding: "8px 4px", background: "rgba(0,0,0,0.2)", borderRadius: 10 }}>
                <div style={{ fontSize: 14, marginBottom: 2 }}>{icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color }}>{val}<span style={{ fontSize: 9, color: "#555" }}>{unit}</span></div>
                <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
              </div>
            ))}
          </div>
          {totales.calorias > 0 && (
            <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
              {[["Pro", pctMacros.p, "#81C784", Math.round(dist.p * 100)], ["Car", pctMacros.c, "#64B5F6", Math.round(dist.c * 100)], ["Lip", pctMacros.l, "#FFB74D", Math.round(dist.l * 100)]].map(([label, actual, color, meta]) => {
                const diff = actual - meta; const ok = Math.abs(diff) < 8;
                return (
                  <div key={label} style={{ flex: 1, padding: "6px 8px", background: ok ? `${color}12` : "rgba(239,83,80,0.08)", border: `1px solid ${ok ? color + "33" : "rgba(239,83,80,0.25)"}`, borderRadius: 8, textAlign: "center" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: ok ? color : "#ef9a9a" }}>{Math.round(actual)}% <span style={{ fontSize: 9, color: "#555" }}>/{meta}%</span></div>
                    <div style={{ fontSize: 9, color: "#555" }}>{label} {ok ? "✓" : diff > 0 ? "↑" : "↓"}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Búsqueda de alimentos */}
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "#888", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600, marginBottom: 10 }}>🔍 Buscar alimento</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="text" placeholder="Ej: pollo, avena, manzana..." value={busqueda} onChange={e => setBusqueda(e.target.value)} onKeyDown={e => e.key === "Enter" && buscarAlimento(busqueda)} style={{ flex: 1, padding: "10px 12px", background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.11)", borderRadius: 10, color: "#fff", fontSize: 14, outline: "none" }} />
            <button onClick={() => buscarAlimento(busqueda)} style={{ padding: "10px 16px", background: "#FFB74D", border: "none", borderRadius: 10, color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>{buscando ? "..." : "Buscar"}</button>
          </div>
          {errorBusqueda && <div style={{ fontSize: 12, color: "#ef9a9a", marginTop: 8 }}>{errorBusqueda}</div>}
          {resultadosBusqueda.length > 0 && (
            <div style={{ marginTop: 10, maxHeight: 240, overflowY: "auto" }}>
              {resultadosBusqueda.map(f => (
                <div key={f.id} style={{ padding: "10px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 10, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
                      {f.nombre_es ? <>{f.nombre_es.charAt(0).toUpperCase() + f.nombre_es.slice(1)} <span style={{ color: "#888", fontWeight: 400, fontStyle: "italic" }}>({f.nombre})</span></> : f.nombre}
                    </div>
                    <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{f.porcion}g · {f.proteinas.toFixed(1)}P · {f.carbos.toFixed(1)}C · {f.lipidos.toFixed(1)}L · {f.calorias}kcal</div>
                  </div>
                  <button onClick={() => {
                    const cat = f.cat || (f.proteinas >= f.carbos && f.proteinas >= f.lipidos ? "proteinas" : f.carbos >= f.lipidos ? "carbohidratos" : "lipidos");
                    const foodNuevo = { ...f, cat, prep: f.prep || "rapido", precio_kg: f.precio_kg || 0, esExtra: true };
                    // Agregar a foodDbExtra para que aparezca como FoodCard editable
                    setFoodDbExtra(prev => {
                      const yaExiste = prev[cat].find(x => x.id === foodNuevo.id);
                      if (yaExiste) return prev;
                      return { ...prev, [cat]: [...prev[cat], foodNuevo] };
                    });
                    // Seleccionarlo automáticamente
                    setSeleccion(prev => {
                      const yaSeleccionado = prev[cat].find(x => x.id === foodNuevo.id);
                      if (yaSeleccionado) return prev;
                      return { ...prev, [cat]: [...prev[cat], foodNuevo] };
                    });
                    setResultadosBusqueda([]); setBusqueda("");
                  }} style={{ padding: "5px 12px", background: "#FFB74D", border: "none", borderRadius: 8, color: "#000", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>+ Agregar</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Captura manual de alimento — para cuando no aparece en el buscador */}
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "#888", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600, marginBottom: 10 }}>✏️ ¿No lo encontraste? Agrégalo tú mismo</div>
          <input
            type="text"
            placeholder="Nombre del alimento (ej: Jamón FUD Virginia)"
            value={manualNombre}
            onChange={e => setManualNombre(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.11)", borderRadius: 10, color: "#fff", fontSize: 14, outline: "none", marginBottom: 8, boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {[["proteinas", "🥩 Proteína", "#81C784"], ["carbohidratos", "🌾 Carbo", "#64B5F6"], ["lipidos", "🥑 Lípido", "#FFB74D"]].map(([id, label, color]) => (
              <button key={id} onClick={() => setManualCat(id)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: manualCat === id ? 700 : 400, background: manualCat === id ? color : "rgba(255,255,255,0.06)", color: manualCat === id ? "#000" : "#888" }}>{label}</button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            {[["Porción (g)", manualPorcion, setManualPorcion], ["Calorías (opcional)", manualCalorias, setManualCalorias]].map(([label, val, setter], i) => (
              <div key={i}>
                <label style={{ fontSize: 9, color: "#666", letterSpacing: 1, textTransform: "uppercase" }}>{label}</label>
                <input type="number" value={val} onChange={e => setter(e.target.value)} style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.11)", borderRadius: 8, color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
            {[["Proteína (g)", manualProteinas, setManualProteinas, "#81C784"], ["Carbos (g)", manualCarbos, setManualCarbos, "#64B5F6"], ["Lípidos (g)", manualLipidos, setManualLipidos, "#FFB74D"]].map(([label, val, setter, color], i) => (
              <div key={i}>
                <label style={{ fontSize: 9, color, letterSpacing: 1, textTransform: "uppercase" }}>{label}</label>
                <input type="number" value={val} onChange={e => setter(e.target.value)} style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.11)", borderRadius: 8, color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
            ))}
          </div>
          {errorManual && <div style={{ fontSize: 12, color: "#ef9a9a", marginBottom: 8 }}>⚠️ {errorManual}</div>}
          <button onClick={guardarAlimentoManual} disabled={guardandoManual} style={{ width: "100%", padding: "11px", borderRadius: 10, border: "none", background: guardandoManual ? "#222" : "#FFB74D", color: guardandoManual ? "#555" : "#000", fontWeight: 700, fontSize: 13, cursor: guardandoManual ? "default" : "pointer" }}>{guardandoManual ? "Guardando…" : "Guardar y agregar al plan"}</button>
          <div style={{ fontSize: 10, color: "#555", marginTop: 6, lineHeight: 1.5 }}>Se guarda en tu base de alimentos — la próxima vez podrás encontrarlo con el buscador.</div>
        </div>

        {/* Selección de alimentos por categoría */}
        {Object.entries(foodDbFiltrado).map(([cat, foods]) => {
          const meta = catLabels[cat];
          const disponibles = foods.filter(f => !f.bloqueado);
          const bloqueados  = foods.filter(f => f.bloqueado);
          return (
            <div key={cat} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 16 }}>{meta.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: meta.color, letterSpacing: 1, textTransform: "uppercase" }}>{meta.label}</span>
                <span style={{ fontSize: 11, color: "#555" }}>· {seleccion[cat].length} seleccionados</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {disponibles.map(food => (
                  <FoodCard key={food.id} food={food} cat={cat} selected={!!seleccion[cat].find(f => f.id === food.id)} porciones={porciones} setPorciones={setPorciones} precios={precios} setPrecios={setPrecios} toggle={toggle} />
                ))}
                {bloqueados.length > 0 && (
                  <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 5 }}>
                    {bloqueados.map(food => <BlockedFoodCard key={food.id} food={food} />)}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Distribución por comidas — asignación de alimentos */}
        {(() => {
          const todosAlimentos = [
            ...seleccion.proteinas.map(f => ({ ...f, _cat: "proteinas" })),
            ...seleccion.carbohidratos.map(f => ({ ...f, _cat: "carbohidratos" })),
            ...seleccion.lipidos.map(f => ({ ...f, _cat: "lipidos" })),
          ];
          if (todosAlimentos.length === 0) return null;

          // planComidas: { [comidaNombre]: [foodId, ...] }
          const asignadosIds = new Set(Object.values(planComidas).flat());
          const sinAsignar   = todosAlimentos.filter(f => !asignadosIds.has(f.id));

          const toggleAsignacion = (comida, foodId) => {
            setPlanComidas(prev => {
              const actual = prev[comida] || [];
              // Si ya está, lo quita; si no, lo agrega (y lo quita de otras comidas)
              const yaEsta = actual.includes(foodId);
              const nuevo  = {};
              for (const k of nombreComidas) {
                nuevo[k] = (prev[k] || []).filter(id => id !== foodId);
              }
              if (!yaEsta) nuevo[comida] = [...(nuevo[comida] || []), foodId];
              return nuevo;
            });
          };

          const catColor = { proteinas: "#81C784", carbohidratos: "#64B5F6", lipidos: "#FFB74D" };

          return (
            <div style={{ marginBottom: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "14px 16px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64B5F6", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>🍽️ ¿Qué comes en cada comida?</div>

              {["ayuno16","ayuno18","ketoAyuno"].includes(protocolo) && (
                <div style={{ padding: "8px 12px", background: "rgba(100,181,246,0.08)", border: "1px solid rgba(100,181,246,0.2)", borderRadius: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: "#64B5F6", lineHeight: 1.6 }}>⏱️ <b>Ventana activa.</b> Solo dentro del horario indicado. Fuera: agua, café o té negro.</div>
                </div>
              )}

              {sinAsignar.length > 0 && (
                <div style={{ padding: "8px 10px", background: "rgba(255,183,77,0.06)", border: "1px solid rgba(255,183,77,0.15)", borderRadius: 10, marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: "#FFB74D", fontWeight: 700, marginBottom: 6 }}>Sin asignar — toca una comida para colocarlos:</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {sinAsignar.map(f => (
                      <span key={f.id} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 99, background: `${catColor[f._cat]}18`, border: `1px solid ${catColor[f._cat]}44`, color: catColor[f._cat] }}>{f.nombre}</span>
                    ))}
                  </div>
                </div>
              )}

              {nombreComidas.map((comida, i) => {
                const idsComida  = planComidas[comida] || [];
                const foodsComida = todosAlimentos.filter(f => idsComida.includes(f.id));
                const calComida  = foodsComida.reduce((acc, f) => acc + (f.calorias * ((porciones[f.id] ?? f.porcion) / f.porcion)), 0);
                const proComida  = foodsComida.reduce((acc, f) => acc + (f.proteinas * ((porciones[f.id] ?? f.porcion) / f.porcion)), 0);
                const carComida  = foodsComida.reduce((acc, f) => acc + (f.carbos * ((porciones[f.id] ?? f.porcion) / f.porcion)), 0);
                const lipComida  = foodsComida.reduce((acc, f) => acc + (f.lipidos * ((porciones[f.id] ?? f.porcion) / f.porcion)), 0);

                return (
                  <div key={i} style={{ marginBottom: 12, padding: "12px 14px", background: "rgba(0,0,0,0.2)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{comida}</div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#FFB74D" }}>{Math.round(calComida)} kcal</span>
                        {foodsComida.length > 0 && (
                          <div style={{ fontSize: 10, color: "#666", marginTop: 1 }}>
                            <span style={{ color: "#81C784" }}>{proComida.toFixed(1)}Pro</span> · <span style={{ color: "#64B5F6" }}>{carComida.toFixed(1)}Car</span> · <span style={{ color: "#FFB74D" }}>{lipComida.toFixed(1)}Lip</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Chips de todos los alimentos para asignar */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {todosAlimentos.map(f => {
                        const asignado = idsComida.includes(f.id);
                        return (
                          <button key={f.id} onClick={() => toggleAsignacion(comida, f.id)} style={{
                            fontSize: 11, padding: "4px 10px", borderRadius: 99, cursor: "pointer", border: "none",
                            background: asignado ? catColor[f._cat] : `${catColor[f._cat]}18`,
                            color: asignado ? "#000" : catColor[f._cat],
                            fontWeight: asignado ? 700 : 400,
                            transition: "all 0.15s",
                          }}>
                            {asignado ? "✓ " : ""}{f.nombre}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <div style={{ padding: "8px 10px", background: "rgba(255,183,77,0.06)", border: "1px solid rgba(255,183,77,0.15)", borderRadius: 10, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "#888" }}>Total del día</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#FFB74D" }}>{Math.round(totales.calorias)} kcal · ${totales.costo.toFixed(0)} MXN</span>
              </div>
            </div>
          );
        })()}

        {/* Botones inferiores */}
        <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
          <button onClick={() => intentarAcceder("seguimiento", () => setScreen("seguimiento"))} style={{ flex: 1, padding: "13px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#888", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>📊 Seguimiento</button>
          <button onClick={() => { setGuiaActiva(protocolo); setGuiaOrigen("app"); setScreen("guia"); }} style={{ flex: 1, padding: "13px", borderRadius: 14, border: "1px solid rgba(255,183,77,0.2)", background: "rgba(255,183,77,0.06)", color: "#FFB74D", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>📖 Guía {PROTOCOLOS[protocolo]?.icon}</button>
          <button onClick={() => setScreen("resumen")} style={{ width: "100%", padding: "13px", borderRadius: 14, border: "1px solid rgba(100,181,246,0.2)", background: "rgba(100,181,246,0.06)", color: "#64B5F6", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>📋 Ver resumen completo del plan</button>
          <button onClick={async () => {
            setScreen("historialPlanes"); setCargandoHistorial(true); setErrorHistorial(null);
            try {
              const res  = await fetch(`/api/planes?userId=${encodeURIComponent(userId)}`);
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || "No se pudo cargar el historial");
              setHistorialPlanesData(Array.isArray(data.planes) ? data.planes : []);
            } catch (err) {
              setErrorHistorial(err.message || "Error al cargar el historial.");
            } finally {
              setCargandoHistorial(false);
            }
          }} style={{ width: "100%", padding: "13px", borderRadius: 14, border: "1px solid rgba(206,147,216,0.2)", background: "rgba(206,147,216,0.06)", color: "#CE93D8", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>🗓️ Historial de planes anteriores</button>
        </div>
      </div>
    </div>
  );
}
