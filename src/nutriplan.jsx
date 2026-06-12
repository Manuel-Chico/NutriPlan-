import { useState, useMemo } from "react";

// ── BASE DE DATOS DE ALIMENTOS ─────────────────────────────────────────
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
  gratuito: { id: "gratuito", label: "Gratuito", precio: "$0", color: "#888", icon: "🆓", features: ["Diagnóstico básico — IMC y TDEE", "Cuestionario de diagnóstico", "Base de 10 alimentos", "Plan de 1 día sin guardar", "Macros en tiempo real"], bloqueado: ["protocolos_avanzados", "ajuste_porciones", "distribucion_comidas", "seguimiento", "ia", "infusiones", "pdf"] },
  premium:  { id: "premium",  label: "Premium",  precio: "$99 MXN/mes",  color: "#FFB74D", icon: "⭐", features: ["Todo lo gratuito sin límites", "Base completa de alimentos", "Todos los protocolos (Keto, Ayuno, Keto+Ayuno)", "Ajuste de porciones y precios", "Distribución de comidas personalizada", "Seguimiento semanal con gráficas", "Recomendación con IA cada semana", "Exportar plan en PDF"], bloqueado: ["infusiones"] },
  pro:      { id: "pro",      label: "Pro",       precio: "$149 MXN/mes", color: "#CE93D8", icon: "💎", features: ["Todo lo Premium", "Módulo de infusiones con respaldo científico", "Dosis escaladas personalizadas", "Historial completo de progreso", "Análisis de tendencias con IA", "Ajuste automático de plan según progreso", "Soporte prioritario"], bloqueado: [] },
};

const FEATURE_TIER = { protocolos_avanzados: "premium", ajuste_porciones: "premium", distribucion_comidas: "premium", seguimiento: "premium", ia: "premium", pdf: "premium", infusiones: "pro" };

const INFUSIONES = {
  hipertension: { label: "Control de presión arterial", icon: "❤️", color: "#ef9a9a", objetivos: ["bajar", "quemar", "mantener"], condicion: ["condicion"], plantas: [{ nombre: "Jamaica", parte: "Cálices secos", dosis: "3–6g en infusión", dosis_inicio: "3g · semanas 1–2", dosis_completa: "6g · semana 3 en adelante", momento: "Mañana y tarde", prep: "Hervir 5 min, reposar 10 min", ciencia: "Ensayo clínico RCT (PubMed): redujo presión 15.4/9.6 mmHg en 8 semanas, comparable al captopril 25mg." }, { nombre: "Hoja de Olivo", parte: "Hojas secas", dosis: "1–2g en infusión", dosis_inicio: "1g · semanas 1–2", dosis_completa: "2g · semana 3 en adelante", momento: "Mañana", prep: "Infusión 8–10 min en agua caliente", ciencia: "Estudio 663 pacientes (PMC): reducción 13/7.1 mmHg en 2 meses con oleuropeína 100mg/día." }] },
  glucemia:     { label: "Control de glucemia",          icon: "🩸", color: "#CE93D8", objetivos: ["bajar", "quemar", "mantener"], condicion: ["condicion"], plantas: [{ nombre: "Canela",    parte: "Corteza en rama o polvo", dosis: "1–3g en infusión", dosis_inicio: "1g · semanas 1–2", dosis_completa: "3g · semana 3 en adelante", momento: "Con las comidas principales", prep: "Hervir rama 10 min o añadir polvo al té", ciencia: "Revisión 2023 (Pharmaceutics): inhibe α-glucosidasa, reduce glucosa postprandial en T2DM y prediabetes." }, { nombre: "Fenogreco", parte: "Semillas", dosis: "4–10g en infusión", dosis_inicio: "4g · semanas 1–2", dosis_completa: "10g · semana 3 en adelante", momento: "Antes de comidas", prep: "Remojar semillas 8h, hervir 10 min", ciencia: "Meta-análisis 2023: reduce glucosa en ayuno, postprandial y HbA1c por fibra soluble." }] },
  apetito:      { label: "Reducción de apetito",         icon: "🍃", color: "#81C784", objetivos: ["bajar", "quemar"], condicion: [], plantas: [{ nombre: "Té Verde",   parte: "Hojas", dosis: "4–9g en infusión (2–3 tazas)", dosis_inicio: "4g · semanas 1–2", dosis_completa: "9g · semana 3 en adelante", momento: "Entre comidas", prep: "Agua a 80°C, infusión 3 min", ciencia: "ECA 60 días: mejora metabolismo lipídico y glucémico, modula absorción de nutrientes y apetito." }, { nombre: "Yerba Mate", parte: "Hojas secas", dosis: "2–3g en infusión", dosis_inicio: "2g · semanas 1–2", dosis_completa: "3g · semana 3 en adelante", momento: "Mañana", prep: "Infusión 5 min en agua a 75°C", ciencia: "Investigación reciente: 3g/día durante 12 semanas redujo grasa corporal y mejoró relación cintura-cadera." }] },
  ansiedad:     { label: "Reducción de ansiedad",        icon: "😌", color: "#64B5F6", objetivos: ["bajar", "quemar", "mantener", "masa"], condicion: [], plantas: [{ nombre: "Ashwagandha", parte: "Raíz en polvo", dosis: "300–600mg/día", dosis_inicio: "300mg · semanas 1–2", dosis_completa: "600mg · semana 3 en adelante", momento: "Noche", prep: "Disolver en agua tibia o leche vegetal", ciencia: "Meta-análisis 2024: reducción significativa de ansiedad y cortisol. Efecto completo en 4–8 semanas." }, { nombre: "Pasiflora", parte: "Hojas y flores secas", dosis: "2–4g en infusión", dosis_inicio: "2g · semanas 1–2", dosis_completa: "4g · semana 3 en adelante", momento: "Tarde o noche", prep: "Infusión 10 min, reposar tapado", ciencia: "ECA: reducción 40–60% síntomas de ansiedad. Actúa potenciando GABA en sistema nervioso central." }] },
  energia:      { label: "Aumento de energía",           icon: "⚡", color: "#FFB74D", objetivos: ["masa", "mantener", "quemar"], condicion: [], plantas: [{ nombre: "Ginseng", parte: "Raíz seca", dosis: "1–2g en infusión", dosis_inicio: "1g · semanas 1–2", dosis_completa: "2g · semana 3 en adelante", momento: "Mañana (no después de las 2pm)", prep: "Hervir 15 min a fuego lento", ciencia: "Meta-análisis 2023 (Memorial Sloan Kettering): eficacia significativa del ginseng en manejo de fatiga." }, { nombre: "Maca", parte: "Raíz en polvo", dosis: "1.5–3g disuelto", dosis_inicio: "1.5g · semanas 1–2", dosis_completa: "3g · semana 3 en adelante", momento: "Mañana", prep: "Disolver en agua, jugo o batido", ciencia: "Meta-análisis oct. 2024 (PubMed/Scopus): beneficios en rendimiento físico en atletas con 1.5–3g/día." }] },
  piel:         { label: "Salud de la piel",             icon: "✨", color: "#F48FB1", objetivos: ["bajar", "quemar", "mantener", "masa"], condicion: [], plantas: [{ nombre: "Cúrcuma", parte: "Rizoma en polvo", dosis: "500–1000mg de curcumina", dosis_inicio: "500mg · semanas 1–2", dosis_completa: "1000mg · semana 3 en adelante", momento: "Con comidas (añadir pimienta negra)", prep: "Disolver en agua tibia con pimienta negra para absorción", ciencia: "ECA doble ciego 2024 (CTRI India): mejora salud de piel facial, promueve síntesis de colágeno." }, { nombre: "Rosa Mosqueta", parte: "Frutos secos", dosis: "2–4g en infusión", dosis_inicio: "2g · semanas 1–2", dosis_completa: "4g · semana 3 en adelante", momento: "Mañana", prep: "Hervir 10 min, colar bien", ciencia: "Frontiers in Pharmacology 2024: mayor contenido de vitamina C entre frutos silvestres (1252mg/100g)." }] },
};

function getDaysLeft(startDate) {
  const ms = 14 * 24 * 60 * 60 * 1000 - (Date.now() - startDate.getTime());
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}
function costoPorcion(food, precios) {
  return (food.porcion / 1000) * (precios[food.id] ?? food.precio_kg);
}

// ═══════════════════════════════════════════════════════════════════════
// COMPONENTES STANDALONE — definidos FUERA de NutriPlan para evitar el
// bug de hooks (useState dentro de componentes redefinidos en cada render)
// ═══════════════════════════════════════════════════════════════════════

function GuiaDieta({ guiaActiva, guiaOrigen, somatotipo, setProtocolo, setScreen }) {
  const [seccion, setSeccion] = useState("que");
  const g    = GUIAS_DIETA[guiaActiva];
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
          {guiaOrigen === "protocolo" ? `Elegir ${g.titulo} →` : "Entendido →"}
        </button>
        <button onClick={() => setScreen(guiaOrigen)} style={{ width: "100%", marginTop: 10, padding: "12px", borderRadius: 14, border: "1.5px solid #333", background: "transparent", color: "#666", fontSize: 13, cursor: "pointer" }}>
          ← {guiaOrigen === "app" ? "Regresar al plan" : "Ver otras opciones"}
        </button>
      </div>
    </div>
  );
}

// ── INFUSION CARD — standalone (useState propio, fuera de NutriPlan) ──
function InfusionCard({ inf }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ marginBottom: 10, background: "rgba(255,255,255,0.03)", border: `1.5px solid ${inf.color}33`, borderRadius: 14, overflow: "hidden" }}>
      <button onClick={() => setExpanded(e => !e)} style={{ width: "100%", padding: "13px 15px", background: "none", border: "none", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 20 }}>{inf.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{inf.label}</div>
          <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{inf.plantas.map(p => p.nombre).join(" · ")}</div>
        </div>
        <span style={{ color: inf.color, fontSize: 16 }}>{expanded ? "▾" : "▸"}</span>
      </button>
      {expanded && (
        <div style={{ borderTop: `1px solid ${inf.color}22`, padding: "12px 15px" }}>
          {inf.plantas.map((p, i) => (
            <div key={i} style={{ marginBottom: i < inf.plantas.length - 1 ? 14 : 0, paddingBottom: i < inf.plantas.length - 1 ? 14 : 0, borderBottom: i < inf.plantas.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: inf.color }}>{p.nombre}</div>
                  <div style={{ fontSize: 11, color: "#666", marginTop: 1 }}>Parte: {p.parte}</div>
                </div>
                <div style={{ fontSize: 10, color: "#555" }}>{p.momento}</div>
              </div>
              <div style={{ padding: "10px 12px", background: `${inf.color}0d`, border: `1px solid ${inf.color}30`, borderRadius: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 9, color: inf.color, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>📅 Protocolo de escalado</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1, padding: "8px 10px", background: "rgba(255,255,255,0.05)", borderRadius: 8, borderLeft: `3px solid ${inf.color}66` }}>
                    <div style={{ fontSize: 9, color: "#666", marginBottom: 3 }}>INICIO</div>
                    <div style={{ fontSize: 12, color: inf.color, fontWeight: 700 }}>{p.dosis_inicio}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", color: "#444", fontSize: 16 }}>→</div>
                  <div style={{ flex: 1, padding: "8px 10px", background: "rgba(255,255,255,0.05)", borderRadius: 8, borderLeft: `3px solid ${inf.color}` }}>
                    <div style={{ fontSize: 9, color: "#666", marginBottom: 3 }}>DOSIS COMPLETA</div>
                    <div style={{ fontSize: 12, color: inf.color, fontWeight: 700 }}>{p.dosis_completa}</div>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: "#555", marginTop: 8, lineHeight: 1.5 }}>⚠️ Si notas malestar en las primeras 2 semanas, mantén la dosis mínima o consulta a tu médico antes de subir.</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                <div style={{ padding: "7px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 8 }}>
                  <div style={{ fontSize: 9, color: "#666", marginBottom: 2, textTransform: "uppercase", letterSpacing: 1 }}>Momento</div>
                  <div style={{ fontSize: 11, color: "#aaa" }}>{p.momento}</div>
                </div>
                <div style={{ padding: "7px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 8 }}>
                  <div style={{ fontSize: 9, color: "#666", marginBottom: 2, textTransform: "uppercase", letterSpacing: 1 }}>Preparación</div>
                  <div style={{ fontSize: 11, color: "#aaa" }}>{p.prep}</div>
                </div>
              </div>
              <div style={{ padding: "8px 10px", background: "rgba(100,181,246,0.06)", border: "1px solid rgba(100,181,246,0.15)", borderRadius: 8 }}>
                <div style={{ fontSize: 9, color: "#64B5F6", letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>📚 Respaldo científico</div>
                <div style={{ fontSize: 10, color: "#777", lineHeight: 1.6 }}>{p.ciencia}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── FOOD CARD — standalone (useState propio, fuera de NutriPlan) ──────
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
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "#4CAF50", fontWeight: 600 }}>${costo.toFixed(1)}</span>
            <span style={{ fontSize: 15, color: selected ? "#FFB74D" : "#444" }}>{selected ? "✓" : "+"}</span>
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#777", marginTop: 4 }}>
          <span style={{ color: selected && porciones[food.id] ? "#FFB74D" : "#888", fontWeight: selected && porciones[food.id] ? 700 : 400 }}>{porcionActual}g</span>
          &nbsp;·&nbsp;<span style={{ color: "#81C784" }}>{macros.proteinas}P</span>&nbsp;·&nbsp;<span style={{ color: "#64B5F6" }}>{macros.carbos}C</span>&nbsp;·&nbsp;<span style={{ color: "#FFB74D" }}>{macros.lipidos}L</span>&nbsp;·&nbsp;<b style={{ color: "#ddd" }}>{macros.calorias} kcal</b>
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
export default function NutriPlan() {
  const [screen, setScreen]         = useState("landing");
  const [step, setStep]             = useState(0);
  const [registro, setRegistro]     = useState({ nombre: "", email: "" });
  const [trialStart, setTrialStart] = useState(null);
  const [tier, setTier]             = useState("premium");
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
  const [registros, setRegistros]   = useState([]);
  const [nuevoRegistro, setNuevoRegistro] = useState({ peso: "", cintura: "", cuello: "" });
  const [recomendacionIA, setRecomendacionIA] = useState("");
  const [cargandoIA, setCargandoIA] = useState(false);
  const [seleccion, setSeleccion]   = useState({ proteinas: [], carbohidratos: [], lipidos: [] });
  const [precios, setPrecios]       = useState({});
  const [porciones, setPorciones]   = useState({});

  const daysLeft = trialStart ? getDaysLeft(trialStart) : 14;
  const trialPct = trialStart ? Math.min(((14 - daysLeft) / 14) * 100, 100) : 0;

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

  const infusionesRecomendadas = useMemo(() => Object.values(INFUSIONES).filter(inf => inf.objetivos.includes(objetivo) || inf.condicion.includes(restriccion)), [objetivo, restriccion]);

  const totales = useMemo(() => {
    const all = [...seleccion.proteinas, ...seleccion.carbohidratos, ...seleccion.lipidos];
    return all.reduce((acc, f) => {
      const factor = (porciones[f.id] ?? f.porcion) / f.porcion;
      return { calorias: acc.calorias + f.calorias * factor, proteinas: acc.proteinas + f.proteinas * factor, carbos: acc.carbos + f.carbos * factor, lipidos: acc.lipidos + f.lipidos * factor, costo: acc.costo + costoPorcion(f, precios) * factor };
    }, { calorias: 0, proteinas: 0, carbos: 0, lipidos: 0, costo: 0 });
  }, [seleccion, precios, porciones]);

  const pctCal = (totales.calorias / calMeta) * 100;

  const toggle = (cat, food) => setSeleccion(prev => {
    const arr = prev[cat]; const exists = arr.find(f => f.id === food.id);
    return { ...prev, [cat]: exists ? arr.filter(f => f.id !== food.id) : [...arr, food] };
  });

  const CONSUMER_KEY = "38baceb355454aa7a21dbc6d660967c1";

  const buscarAlimento = async (query) => {
    if (!query || query.length < 2) { setResultadosBusqueda([]); return; }
    setBuscando(true); setErrorBusqueda(null);
    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce     = Math.random().toString(36).substring(2, 15);
      const baseUrl   = "https://platform.fatsecret.com/rest/server.api";
      const params    = { method: "foods.search", search_expression: query, format: "json", max_results: "20", oauth_consumer_key: CONSUMER_KEY, oauth_nonce: nonce, oauth_signature_method: "HMAC-SHA1", oauth_timestamp: timestamp, oauth_version: "1.0" };
      const qs        = Object.keys(params).sort().map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join("&");
      const res       = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(baseUrl + "?" + qs)}`);
      const data      = await res.json();
      const parsed    = JSON.parse(data.contents);
      if (parsed?.foods?.food) {
        const foods = Array.isArray(parsed.foods.food) ? parsed.foods.food : [parsed.foods.food];
        setResultadosBusqueda(foods.map(f => {
          const desc = f.food_description || "";
          const por  = desc.match(/Per\s+([\d.]+)g/i);   const cal = desc.match(/Calories:\s*([\d.]+)kcal/i);
          const fat  = desc.match(/Fat:\s*([\d.]+)g/i);  const carb = desc.match(/Carbs:\s*([\d.]+)g/i);
          const pro  = desc.match(/Protein:\s*([\d.]+)g/i);
          const porcion   = por  ? +por[1]  : 100; const calorias  = cal  ? +cal[1]  : 0;
          const lipidos   = fat  ? +fat[1]  : 0;   const carbos    = carb ? +carb[1] : 0;
          const proteinas = pro  ? +pro[1]  : 0;
          const cat = proteinas >= carbos && proteinas >= lipidos ? "proteinas" : carbos >= lipidos ? "carbohidratos" : "lipidos";
          return { id: `fs_${f.food_id}`, nombre: f.food_name, porcion, proteinas, carbos, lipidos, calorias, precio_kg: 0, prep: "moderado", cat, fuente: "fatsecret" };
        }));
      } else { setResultadosBusqueda([]); setErrorBusqueda("Sin resultados para esa búsqueda."); }
    } catch { setErrorBusqueda("Búsqueda no disponible en modo prototipo. Funcionará completo en la versión publicada."); setResultadosBusqueda([]); }
    finally { setBuscando(false); }
  };

  const tieneAcceso = (feature) => {
    const r = FEATURE_TIER[feature]; if (!r) return true;
    if (r === "premium") return tier === "premium" || tier === "pro";
    if (r === "pro")     return tier === "pro";
    return true;
  };
  const intentarAcceder = (feature, accion) => { if (tieneAcceso(feature)) { accion(); } else { setUpgradeFeature(feature); setScreen("upgrade"); } };

  const pedirRecomendacionIA = async (regs) => {
    if (regs.length < 1) return;
    setCargandoIA(true); setRecomendacionIA("");
    const ultimo = regs[regs.length - 1]; const anterior = regs.length > 1 ? regs[regs.length - 2] : null;
    const objInfo = OBJETIVOS.find(o => o.id === objetivo); const somaInfo = SOMATOTIPOS.find(s => s.id === somatotipo);
    const prompt = `Eres un nutriólogo deportivo experto. Da una recomendación concreta y motivadora en 3-4 oraciones. Usa el nombre del usuario.\n\nUsuario: ${registro.nombre}\nObjetivo: ${objInfo?.label}\nMeta calórica: ${calMeta} kcal/día\nMeta proteína: ${proteinaMeta}g/día\n\nRegistro actual:\n- Peso: ${ultimo.peso} kg\n- Cintura: ${ultimo.cintura} cm\n\n${anterior ? `Registro anterior:\n- Peso: ${anterior.peso} kg\n- Diferencia: ${(+ultimo.peso - +anterior.peso).toFixed(1)} kg` : "Primer registro."}\n\nRecomendación personalizada y accionable. Al final nota que es orientativa y no sustituye consulta médica.`;
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }) });
      const data = await response.json();
      setRecomendacionIA(data.content?.find(b => b.type === "text")?.text || "No se pudo generar la recomendación.");
    } catch { setRecomendacionIA("Error al conectar con el asistente. Intenta de nuevo."); }
    finally { setCargandoIA(false); }
  };

  const guardarRegistro = () => {
    if (!nuevoRegistro.peso || !nuevoRegistro.cintura) return;
    const nuevo  = { ...nuevoRegistro, fecha: new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "short" }), semana: registros.length + 1 };
    const nuevos = [...registros, nuevo];
    setRegistros(nuevos); setNuevoRegistro({ peso: "", cintura: "", cuello: "" });
    pedirRecomendacionIA(nuevos);
  };

  const handleRegister = () => { if (!registro.nombre || !registro.email) return; setTrialStart(new Date()); setScreen("cuestionario"); };

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
    const enriquecer = arr => arr.map(f => {
      const bK = excluirKeto.includes(f.id); const bR = excluirRest.includes(f.id); const bP = !prepPermitido.includes(f.prep);
      return { ...f, bloqueado: bK || bR || bP, razonBloqueo: bK ? "No compatible con Keto — alto en carbos" : bR ? "Excluido por tu restricción alimentaria" : bP ? "Tiempo de preparación mayor a tu disponibilidad" : null, tipoBloqeo: bK ? "keto" : bR ? "restriccion" : bP ? "prep" : null };
    });
    return { proteinas: enriquecer(FOOD_DB.proteinas), carbohidratos: enriquecer(FOOD_DB.carbohidratos), lipidos: enriquecer(FOOD_DB.lipidos) };
  }, [restriccion, protocolo, tiempoPrep]);

  const inputStyle = { display: "block", width: "100%", marginTop: 6, padding: "13px 14px", background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.11)", borderRadius: 12, color: "#fff", fontSize: 15, outline: "none", boxSizing: "border-box" };

  const Bar = ({ value, max, color }) => (
    <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 99, height: 8, overflow: "hidden", flex: 1 }}>
      <div style={{ width: `${Math.min((value / (max || 1)) * 100, 100)}%`, background: color, height: "100%", borderRadius: 99, transition: "width 0.5s ease" }} />
    </div>
  );

  const BlockedFoodCard = ({ food }) => {
    const colorBloq = food.tipoBloqeo === "keto" ? "#ef9a9a" : food.tipoBloqeo === "restriccion" ? "#FFB74D" : "#666";
    const iconBloq  = food.tipoBloqeo === "keto" ? "🚫" : food.tipoBloqeo === "restriccion" ? "⚠️" : "⏱️";
    return (
      <div style={{ padding: "11px 14px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: "1.5px solid rgba(255,255,255,0.05)", opacity: 0.6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>{iconBloq}</span>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 600, color: "#666", textDecoration: "line-through" }}>{food.nombre}</span>
          </div>
          <span style={{ fontSize: 10, color: colorBloq, background: `${colorBloq}15`, borderRadius: 99, padding: "2px 8px", whiteSpace: "nowrap" }}>{food.tipoBloqeo === "keto" ? "Keto ✗" : food.tipoBloqeo === "restriccion" ? "Restringido" : "Prep. larga"}</span>
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
      <div style={{ marginTop: 48, width: "100%", maxWidth: 420, background: "rgba(255,255,255,0.04)", borderRadius: 20, padding: "28px 24px", border: "1px solid rgba(255,255,255,0.08)", textAlign: "center" }}>
        <div style={{ fontSize: 12, color: "#888", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Después de la prueba</div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 38, fontWeight: 700 }}>$99 <span style={{ fontSize: 18, color: "#888" }}>MXN/mes</span></div>
        <div style={{ color: "#666", fontSize: 13, marginTop: 8 }}>Acceso completo · Cancela en cualquier momento</div>
        <button onClick={() => setScreen("register")} style={{ marginTop: 20, width: "100%", padding: "14px", borderRadius: 14, border: "1.5px solid #FFB74D", background: "transparent", color: "#FFB74D", fontWeight: 600, fontSize: 15, cursor: "pointer" }}>Empezar los 14 días gratis</button>
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

  if (screen === "guia" && guiaActiva) return <GuiaDieta guiaActiva={guiaActiva} guiaOrigen={guiaOrigen} somatotipo={somatotipo} setProtocolo={setProtocolo} setScreen={setScreen} />;

  // ── UPGRADE ───────────────────────────────────────────────────────────
  if (screen === "upgrade") {
    const featLabel = { protocolos_avanzados: "Protocolos Keto y Ayuno Intermitente", ajuste_porciones: "Ajuste de porciones personalizado", distribucion_comidas: "Distribución de comidas", seguimiento: "Seguimiento semanal con gráficas", ia: "Recomendaciones con Inteligencia Artificial", pdf: "Exportar plan en PDF", infusiones: "Módulo de infusiones de plantas" };
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
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 10, letterSpacing: 4, color: "#FFB74D", textTransform: "uppercase" }}>NutriPlan</div><div style={{ fontSize: 14, fontWeight: 600 }}>Seguimiento</div></div>
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
            <div style={{ fontSize: 12, color: "#81C784", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600, marginBottom: 14 }}>📝 Registro semanal #{registros.length + 1}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
              {[{ key: "peso", label: "Peso (kg)", placeholder: "75.5" }, { key: "cintura", label: "Cintura (cm)", placeholder: "85" }, { key: "cuello", label: "Cuello (cm)", placeholder: "38" }].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label style={{ fontSize: 9, color: "#888", letterSpacing: 1, textTransform: "uppercase" }}>{label}</label>
                  <input type="number" placeholder={placeholder} value={nuevoRegistro[key]} onChange={e => setNuevoRegistro(r => ({ ...r, [key]: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4, padding: "10px 10px", background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.11)", borderRadius: 10, color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
              ))}
            </div>
            <button onClick={guardarRegistro} disabled={!nuevoRegistro.peso || !nuevoRegistro.cintura} style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: nuevoRegistro.peso && nuevoRegistro.cintura ? "#FFB74D" : "#222", color: nuevoRegistro.peso && nuevoRegistro.cintura ? "#000" : "#555", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Guardar y analizar con IA →</button>
          </div>
          {registros.length > 0 && (
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "16px 18px", marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: "#64B5F6", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600, marginBottom: 16 }}>📈 Progreso de peso</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 80, marginBottom: 8 }}>
                {registros.map((r, i) => {
                  const altura = Math.max(12, Math.round(((+r.peso - minPeso) / rangoPeso) * 60 + 12)); const esUltimo = i === registros.length - 1;
                  return (<div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}><div style={{ fontSize: 9, color: esUltimo ? "#FFB74D" : "#555" }}>{r.peso}</div><div style={{ width: "100%", height: altura, background: esUltimo ? "#FFB74D" : "rgba(255,183,77,0.25)", borderRadius: "4px 4px 0 0" }} /><div style={{ fontSize: 9, color: "#444" }}>S{r.semana}</div></div>);
                })}
              </div>
            </div>
          )}
          {registros.length > 0 && (
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "16px 18px" }}>
              <div style={{ fontSize: 12, color: "#888", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>📋 Historial</div>
              {[...registros].reverse().map((r, i) => {
                const idx = registros.length - 1 - i; const prev = idx > 0 ? registros[idx - 1] : null;
                const diffPeso = prev ? (+r.peso - +prev.peso).toFixed(1) : null; const diffCintura = prev ? (+r.cintura - +prev.cintura).toFixed(1) : null;
                const pctG = calcGrasaCorporal(+r.cintura, +r.cuello, +perfil.talla, +perfil.cadera, perfil.sexo);
                return (
                  <div key={i} style={{ padding: "12px 0", borderBottom: i < registros.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Semana {r.semana} <span style={{ color: "#555", fontWeight: 400, fontSize: 11 }}>· {r.fecha}</span></span>
                      {pctG && <span style={{ fontSize: 11, color: "#CE93D8" }}>Grasa: {pctG.toFixed(1)}%</span>}
                    </div>
                    <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
                      <span>⚖️ {r.peso} kg {diffPeso && <span style={{ color: +diffPeso <= 0 ? "#81C784" : "#ef5350" }}>({+diffPeso > 0 ? "+" : ""}{diffPeso})</span>}</span>
                      <span>📏 {r.cintura} cm {diffCintura && <span style={{ color: +diffCintura <= 0 ? "#81C784" : "#ef5350" }}>({+diffCintura > 0 ? "+" : ""}{diffCintura})</span>}</span>
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
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: `${info.color}22`, border: `2px solid ${info.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 16px" }}>{objInfo?.icon}</div>
            <div style={{ fontSize: 11, letterSpacing: 3, color: info.color, textTransform: "uppercase", marginBottom: 8 }}>Diagnóstico completo</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, margin: 0 }}>{info.titulo}</h2>
            <p style={{ color: "#666", fontSize: 14, marginTop: 10, lineHeight: 1.7 }}>{info.desc}</p>
          </div>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: "18px 20px", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "#888", letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>Distribución de macros asignada</div>
            <div style={{ display: "flex" }}>
              {[["🥩", "Proteína", Math.round(dist2.p * 100), "#81C784"], ["🌾", "Carbos", Math.round(dist2.c * 100), "#64B5F6"], ["🥑", "Lípidos", Math.round(dist2.l * 100), "#FFB74D"]].map(([icon, label, pct, color]) => (
                <div key={label} style={{ flex: 1, textAlign: "center", padding: "10px 0" }}>
                  <div style={{ fontSize: 20 }}>{icon}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color, fontFamily: "'Playfair Display', serif", marginTop: 4 }}>{pct}%</div>
                  <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
          {restriccion !== "ninguna" && <div style={{ background: "rgba(100,181,246,0.07)", border: "1px solid rgba(100,181,246,0.2)", borderRadius: 14, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#64B5F6" }}>ℹ️ Ajustamos tu lista de alimentos según tu restricción alimentaria.</div>}
          <button onClick={() => setScreen("protocolo")} style={{ width: "100%", padding: "16px", borderRadius: 14, border: "none", background: "#FFB74D", color: "#000", fontWeight: 700, fontSize: 16, cursor: "pointer" }}>Elegir mi protocolo →</button>
          <button onClick={() => setScreen("cuestionario")} style={{ marginTop: 12, width: "100%", padding: "12px", borderRadius: 14, border: "1.5px solid #333", background: "transparent", color: "#666", fontSize: 13, cursor: "pointer" }}>← Repetir diagnóstico</button>
        </div>
      </div>
    );
  }

  // ── CUESTIONARIO ──────────────────────────────────────────────────────
  if (screen === "cuestionario") {
    const pregunta = PREGUNTAS[preguntaActual]; const pct = Math.round((preguntaActual / PREGUNTAS.length) * 100);
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#0a0f18 0%,#111827 100%)", fontFamily: "'DM Sans',sans-serif", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px 60px" }}>
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
        <div style={{ width: "100%", maxWidth: 420 }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{ fontSize: 10, letterSpacing: 4, color: "#FFB74D", textTransform: "uppercase", marginBottom: 8 }}>NutriPlan · Diagnóstico</div>
            <div style={{ fontSize: 13, color: "#555" }}>Hola, {registro.nombre} 👋 Cuéntanos un poco sobre ti</div>
          </div>
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: "#FFB74D" }}>Pregunta {preguntaActual + 1} de {PREGUNTAS.length}</span>
              <span style={{ fontSize: 11, color: "#555" }}>{pct}% completado</span>
            </div>
            <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: 99, height: 6, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, background: "#FFB74D", height: "100%", borderRadius: 99, transition: "width 0.4s ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              {PREGUNTAS.map((_, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: i < preguntaActual ? "#81C784" : i === preguntaActual ? "#FFB74D" : "rgba(255,255,255,0.12)", transition: "all 0.3s" }} />)}
            </div>
          </div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, marginBottom: 24, lineHeight: 1.3 }}>{pregunta.texto}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pregunta.opciones.map(op => (
              <button key={op.id} onClick={() => handleRespuesta(pregunta.id, op.id)} style={{ padding: "16px 18px", borderRadius: 16, border: "1.5px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.04)", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 14, color: "#fff", transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,183,77,0.12)"; e.currentTarget.style.borderColor = "#FFB74D"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; }}>
                <span style={{ fontSize: 24, minWidth: 32, textAlign: "center" }}>{op.icon}</span>
                <span style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.4 }}>{op.label}</span>
                <span style={{ marginLeft: "auto", color: "#444", fontSize: 18 }}>›</span>
              </button>
            ))}
          </div>
          {preguntaActual > 0 && <button onClick={() => setPreguntaActual(i => i - 1)} style={{ marginTop: 20, background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 13, width: "100%", textAlign: "center" }}>← Pregunta anterior</button>}
          <button onClick={() => setScreen("app")} style={{ marginTop: 10, background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 12, width: "100%", textAlign: "center" }}>Omitir diagnóstico — elegir manualmente</button>
        </div>
      </div>
    );
  }

  // ── APP PRINCIPAL ─────────────────────────────────────────────────────
  const stepLabels = ["Perfil", "Cuerpo", "Objetivo", "Alimentos", "Comidas", "Resumen"];

  const nombreComidas = useMemo(() => {
    if (protocolo === "ayuno16" || protocolo === "ketoAyuno") return numComidas === 2 ? ["Primera comida (12:00 pm)", "Última comida (7:00 pm)"] : ["Primera comida (12:00 pm)", "Comida (3:00 pm)", "Última comida (7:00 pm)"];
    if (protocolo === "ayuno18") return numComidas === 2 ? ["Primera comida (1:00 pm)", "Última comida (6:00 pm)"] : ["Primera comida (1:00 pm)", "Merienda (4:00 pm)", "Última comida (6:30 pm)"];
    return numComidas >= 4 ? ["Desayuno", "Media mañana", "Comida", "Merienda", "Cena"] : numComidas === 3 ? ["Desayuno", "Comida", "Cena"] : ["Comida principal", "Cena"];
  }, [protocolo, numComidas]);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0d1117 0%,#161b22 50%,#0d1117 100%)", fontFamily: "'DM Sans',sans-serif", color: "#fff", paddingBottom: 60 }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ background: daysLeft <= 2 ? "rgba(239,83,80,0.10)" : "rgba(255,183,77,0.07)", border: `1px solid ${daysLeft <= 2 ? "rgba(239,83,80,0.3)" : "rgba(255,183,77,0.18)"}`, borderRadius: 12, padding: "10px 14px", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: daysLeft <= 2 ? "#ef5350" : "#FFB74D", fontWeight: 600 }}>{daysLeft <= 2 ? "⚠️" : "✦"} {daysLeft} día{daysLeft !== 1 ? "s" : ""} de prueba gratis</span>
            {daysLeft <= 2 && <button style={{ fontSize: 11, background: "#ef5350", border: "none", borderRadius: 8, padding: "4px 10px", color: "#fff", cursor: "pointer", fontWeight: 600 }}>Suscribirme</button>}
          </div>
          <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: 99, height: 4, overflow: "hidden" }}>
            <div style={{ width: `${trialPct}%`, background: daysLeft <= 2 ? "#ef5350" : "#FFB74D", height: "100%", borderRadius: 99 }} />
          </div>
        </div>
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 10, letterSpacing: 4, color: "#FFB74D", textTransform: "uppercase" }}>NutriPlan</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 13, color: "#555" }}>Hola, {registro.nombre || "usuario"} 👋</span>
            <button onClick={() => { setUpgradeFeature(null); setScreen("upgrade"); }} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, border: "none", cursor: "pointer", background: TIERS[tier]?.color + "22", color: TIERS[tier]?.color, fontWeight: 700 }}>{TIERS[tier]?.icon} {TIERS[tier]?.label}</button>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 4, overflowX: "auto" }}>
          {stepLabels.map((s, i) => (
            <div key={i} onClick={() => i <= step && setStep(i)} style={{ display: "flex", alignItems: "center", gap: 4, cursor: i <= step ? "pointer" : "default", opacity: i > step ? 0.25 : 1 }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: i === step ? "#FFB74D" : i < step ? "#81C784" : "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: i <= step ? "#000" : "#666", flexShrink: 0 }}>{i < step ? "✓" : i + 1}</div>
              {i === step && <span style={{ fontSize: 10, color: "#FFB74D", whiteSpace: "nowrap" }}>{s}</span>}
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "22px 20px 0" }}>

        {/* STEP 0 */}
        {step === 0 && (
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, marginBottom: 20 }}>Datos corporales</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
              {[{ key: "peso", label: "Peso (kg)", placeholder: "75" }, { key: "talla", label: "Talla (cm)", placeholder: "175" }].map(({ key, label, placeholder }) => (
                <div key={key}><label style={{ fontSize: 11, color: "#888", letterSpacing: 1, textTransform: "uppercase" }}>{label}</label><input type="number" placeholder={placeholder} value={perfil[key]} onChange={e => setPerfil(p => ({ ...p, [key]: e.target.value }))} style={inputStyle} /></div>
              ))}
              <div style={{ gridColumn: "1 / -1" }}><label style={{ fontSize: 11, color: "#888", letterSpacing: 1, textTransform: "uppercase" }}>Edad</label><input type="number" placeholder="35" value={perfil.edad} onChange={e => setPerfil(p => ({ ...p, edad: e.target.value }))} style={inputStyle} /></div>
              <div>
                <label style={{ fontSize: 11, color: "#888", letterSpacing: 1, textTransform: "uppercase" }}>Sexo</label>
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  {[["M", "Hombre"], ["F", "Mujer"]].map(([v, l]) => <button key={v} onClick={() => setPerfil(p => ({ ...p, sexo: v }))} style={{ flex: 1, padding: "12px", borderRadius: 12, cursor: "pointer", background: perfil.sexo === v ? "#FFB74D" : "rgba(255,255,255,0.06)", border: "none", color: perfil.sexo === v ? "#000" : "#fff", fontWeight: 600, fontSize: 14 }}>{l}</button>)}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#888", letterSpacing: 1, textTransform: "uppercase" }}>Actividad</label>
                <select value={perfil.actividad} onChange={e => setPerfil(p => ({ ...p, actividad: e.target.value }))} style={{ ...inputStyle, background: "#1c2333" }}>
                  {Object.entries({ sedentario: "Sedentario", ligero: "Ligero", moderado: "Moderado", activo: "Activo", muyactivo: "Muy activo" }).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 18, padding: "14px 16px", background: "rgba(100,181,246,0.07)", border: "1px solid rgba(100,181,246,0.18)", borderRadius: 14 }}>
              <div style={{ fontSize: 11, color: "#64B5F6", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10, fontWeight: 600 }}>📏 Medidas corporales <span style={{ color: "#555", fontWeight: 400 }}>(para calcular % grasa)</span></div>
              <div style={{ fontSize: 11, color: "#666", marginBottom: 12, lineHeight: 1.6 }}>Mide con cinta métrica en cm. Cintura: a la altura del ombligo. Cuello: parte más estrecha. {perfil.sexo === "F" && "Cadera: parte más ancha."}</div>
              <div style={{ display: "grid", gridTemplateColumns: perfil.sexo === "F" ? "1fr 1fr 1fr" : "1fr 1fr", gap: 10 }}>
                {[{ key: "cintura", label: "Cintura (cm)", placeholder: "85" }, { key: "cuello", label: "Cuello (cm)", placeholder: "38" }, ...(perfil.sexo === "F" ? [{ key: "cadera", label: "Cadera (cm)", placeholder: "95" }] : [])].map(({ key, label, placeholder }) => (
                  <div key={key}><label style={{ fontSize: 10, color: "#888", letterSpacing: 1, textTransform: "uppercase" }}>{label}</label><input type="number" placeholder={placeholder} value={perfil[key]} onChange={e => setPerfil(p => ({ ...p, [key]: e.target.value }))} style={{ ...inputStyle, marginTop: 4, padding: "10px 12px", fontSize: 14 }} /></div>
                ))}
              </div>
            </div>
            {imc && (
              <div style={{ marginTop: 14, background: "rgba(255,255,255,0.03)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ padding: "10px 16px", background: "rgba(255,183,77,0.08)", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 11, color: "#FFB74D", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 }}>📊 Tu diagnóstico</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                  {[
                    { label: "IMC", value: imc.toFixed(1), sub: imcLabel, color: +imc >= 18.5 && +imc < 25 ? "#81C784" : "#FFB74D" },
                    { label: "TDEE", value: tdee ? `${tdee}` : "—", sub: "kcal/día", color: "#64B5F6" },
                    { label: "% Grasa corporal", value: pctGrasa ? `${pctGrasa.toFixed(1)}%` : "Agrega medidas", sub: pctGrasa ? (perfil.sexo === "M" ? (pctGrasa < 6 ? "Esencial" : pctGrasa < 14 ? "Atlético" : pctGrasa < 18 ? "Fitness" : pctGrasa < 25 ? "Normal" : "Exceso") : (pctGrasa < 14 ? "Esencial" : pctGrasa < 21 ? "Atlético" : pctGrasa < 25 ? "Fitness" : pctGrasa < 32 ? "Normal" : "Exceso")) : "", color: "#CE93D8" },
                    { label: "Masa magra", value: masaMagra ? `${masaMagra.toFixed(1)} kg` : "—", sub: "músculo + hueso", color: "#81C784" },
                    { label: "Índice cin./altura", value: indCinturaAltura ? indCinturaAltura.toFixed(2) : "—", sub: indCinturaAltura ? (indCinturaAltura < 0.5 ? "Óptimo ✓" : indCinturaAltura < 0.6 ? "Moderado" : "Alto riesgo") : "", color: indCinturaAltura && indCinturaAltura < 0.5 ? "#81C784" : "#FFB74D" },
                    { label: "Meta proteína", value: proteinaMeta ? `${proteinaMeta} g` : "—", sub: `${PROTEINA_G_KG[objetivo] || 1.6} g/kg · objetivo actual`, color: "#FFB74D" },
                  ].map(({ label, value, sub, color }, i) => (
                    <div key={label} style={{ padding: "13px 16px", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.05)" : "none", borderRight: i % 2 === 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                      <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: "'Playfair Display', serif" }}>{value}</div>
                      {sub && <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>{sub}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button onClick={() => setStep(1)} disabled={!perfil.peso || !perfil.talla || !perfil.edad} style={{ marginTop: 18, width: "100%", padding: "15px", borderRadius: 14, border: "none", background: perfil.peso && perfil.talla && perfil.edad ? "#FFB74D" : "#222", color: perfil.peso && perfil.talla && perfil.edad ? "#000" : "#555", fontWeight: 700, fontSize: 16, cursor: "pointer" }}>Continuar →</button>
          </div>
        )}

        {/* STEP 1 */}
        {step === 1 && (
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, marginBottom: 6 }}>¿Cuál es tu tipo de cuerpo?</h2>
            <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>Esto ajusta tu distribución de macros de forma personalizada.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {SOMATOTIPOS.map(s => (
                <button key={s.id} onClick={() => setSomatotipo(s.id)} style={{ padding: "16px 18px", borderRadius: 16, border: "none", cursor: "pointer", textAlign: "left", background: somatotipo === s.id ? "rgba(255,183,77,0.12)" : "rgba(255,255,255,0.04)", outline: somatotipo === s.id ? "2px solid #FFB74D" : "2px solid transparent", transition: "all 0.2s" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <span style={{ fontSize: 28 }}>{s.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>{s.label}</div>
                      <div style={{ color: "#888", fontSize: 12, marginTop: 3, lineHeight: 1.5 }}>{s.desc}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>{s.rasgos.map(r => <span key={r} style={{ fontSize: 10, background: "rgba(255,255,255,0.07)", borderRadius: 99, padding: "3px 9px", color: "#aaa" }}>{r}</span>)}</div>
                    </div>
                    {somatotipo === s.id && <span style={{ color: "#FFB74D", fontSize: 18 }}>✓</span>}
                  </div>
                  {somatotipo === s.id && <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(0,0,0,0.25)", borderRadius: 10 }}><div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Ajuste aplicado a tus macros</div><div style={{ fontSize: 12, color: "#FFB74D", lineHeight: 1.6 }}>{s.nota}</div></div>}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
              <button onClick={() => setStep(0)} style={{ flex: 1, padding: "14px", borderRadius: 14, border: "1.5px solid #333", background: "transparent", color: "#fff", cursor: "pointer" }}>← Atrás</button>
              <button onClick={() => setStep(2)} style={{ flex: 2, padding: "14px", borderRadius: 14, border: "none", background: somatotipo ? "#FFB74D" : "#333", color: somatotipo ? "#000" : "#555", fontWeight: 700, cursor: somatotipo ? "pointer" : "default" }}>{somatotipo ? "Continuar →" : "Selecciona un tipo"}</button>
            </div>
            <div style={{ textAlign: "center", marginTop: 10 }}><span onClick={() => { setSomatotipo(null); setStep(2); }} style={{ fontSize: 12, color: "#555", cursor: "pointer", textDecoration: "underline" }}>No sé mi tipo — omitir</span></div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, marginBottom: 6 }}>¿Cuál es tu objetivo?</h2>
            <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>{somatotipo && <span style={{ color: "#FFB74D" }}>Somatotipo {SOMATOTIPOS.find(s => s.id === somatotipo)?.label} · </span>}La distribución se ajusta a tu perfil.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {OBJETIVOS.map(o => {
                const tabla = DISTRIBUCIONES[o.id] || DISTRIBUCIONES.mantener; const dAdj = tabla[somatotipo] || tabla.default; const tot = dAdj.p + dAdj.c + dAdj.l;
                return (
                  <button key={o.id} onClick={() => setObjetivo(o.id)} style={{ padding: "15px 17px", borderRadius: 16, border: "none", cursor: "pointer", textAlign: "left", background: objetivo === o.id ? "rgba(255,183,77,0.12)" : "rgba(255,255,255,0.04)", outline: objetivo === o.id ? "2px solid #FFB74D" : "2px solid transparent", transition: "all 0.2s" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 22 }}>{o.icon}</span>
                      <div style={{ flex: 1 }}><div style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>{o.label}</div><div style={{ color: "#777", fontSize: 12, marginTop: 2 }}>{o.desc}</div></div>
                      {objetivo === o.id && <span style={{ color: "#FFB74D" }}>✓</span>}
                    </div>
                    {objetivo === o.id && tdee && (
                      <div style={{ marginTop: 11, padding: "10px 12px", background: "rgba(0,0,0,0.25)", borderRadius: 10 }}>
                        <div style={{ fontSize: 11, color: "#888" }}>Meta calórica diaria</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: "#FFB74D", marginTop: 2 }}>{Math.round(tdee * dAdj.factor)} kcal</div>
                        <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11, color: "#aaa" }}><span>🥩 {Math.round((dAdj.p / tot) * 100)}% P</span><span>🌾 {Math.round((dAdj.c / tot) * 100)}% C</span><span>🥑 {Math.round((dAdj.l / tot) * 100)}% L</span></div>
                        {(o.id === "bajar" || o.id === "mantener" || o.id === "masa") && (
                          <button onClick={e => { e.stopPropagation(); const guiaMap = { bajar: "estandar", mantener: "mantener_guia", masa: "masa" }; setGuiaActiva(guiaMap[o.id]); setGuiaOrigen("app"); setScreen("guia"); }} style={{ marginTop: 10, width: "100%", padding: "8px", borderRadius: 9, border: "1.5px solid rgba(206,147,216,0.3)", background: "transparent", color: "#CE93D8", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>📖 Ver guía completa de esta dieta</button>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, padding: "14px", borderRadius: 14, border: "1.5px solid #333", background: "transparent", color: "#fff", cursor: "pointer" }}>← Atrás</button>
              <button onClick={() => setStep(3)} style={{ flex: 2, padding: "14px", borderRadius: 14, border: "none", background: "#FFB74D", color: "#000", fontWeight: 700, cursor: "pointer" }}>Elegir alimentos →</button>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, marginBottom: 4 }}>Elige tus alimentos</h2>
            <p style={{ color: "#666", fontSize: 13, marginBottom: 12 }}>Selecciona lo que te gusta. Toca <span style={{ color: "#FFB74D" }}>editar</span> para poner el precio de tu mercado.</p>
            {(protocolo === "keto" || protocolo === "ketoAyuno") && <div style={{ padding: "10px 14px", background: "rgba(255,183,77,0.08)", border: "1px solid rgba(255,183,77,0.2)", borderRadius: 12, marginBottom: 14, fontSize: 12, color: "#FFB74D", lineHeight: 1.6 }}>🥑 Protocolo Keto activo — alimentos altos en carbohidratos fueron removidos de tu lista.</div>}
            {(protocolo === "ayuno16" || protocolo === "ayuno18") && <div style={{ padding: "10px 14px", background: "rgba(100,181,246,0.07)", border: "1px solid rgba(100,181,246,0.2)", borderRadius: 12, marginBottom: 14, fontSize: 12, color: "#64B5F6", lineHeight: 1.6 }}>⏱️ Ayuno Intermitente activo — tu proteína está elevada para proteger músculo durante el ayuno.</div>}

            <div style={{ padding: "13px 15px", background: "rgba(255,255,255,0.04)", borderRadius: 14, marginBottom: 18, border: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                <span style={{ fontSize: 13, color: "#aaa" }}>Calorías</span>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#4CAF50", fontWeight: 600 }}>💰 ${totales.costo.toFixed(0)}/día</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: pctCal > 105 ? "#ef5350" : "#FFB74D" }}>{Math.round(totales.calorias)} / {calMeta} kcal</span>
                </div>
              </div>
              <Bar value={totales.calorias} max={calMeta} color={pctCal > 105 ? "#ef5350" : "#FFB74D"} />
              <div style={{ display: "flex", gap: 9, marginTop: 10 }}>
                {[["Prot.", totales.proteinas, Math.round(calMeta * dist.p / 4), "#81C784"], ["Carbos", totales.carbos, Math.round(calMeta * dist.c / 4), "#64B5F6"], ["Líp.", totales.lipidos, Math.round(calMeta * dist.l / 9), "#FFB74D"]].map(([l, v, max, c]) => (
                  <div key={l} style={{ flex: 1 }}><div style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>{l} <span style={{ color: c }}>{v.toFixed(0)}g</span></div><Bar value={v} max={max} color={c} /></div>
                ))}
              </div>
              {pctCal > 105 && <div style={{ marginTop: 8, fontSize: 12, color: "#ef5350" }}>⚠️ Excedes tu meta — considera quitar algún alimento.</div>}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: "#666" }}>{[...seleccion.proteinas, ...seleccion.carbohidratos, ...seleccion.lipidos].length} alimentos seleccionados</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setVistaTabla(false)} style={{ padding: "5px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: !vistaTabla ? "#FFB74D" : "rgba(255,255,255,0.07)", color: !vistaTabla ? "#000" : "#888", fontSize: 11, fontWeight: !vistaTabla ? 700 : 400 }}>☰ Cards</button>
                <button onClick={() => setVistaTabla(true)}  style={{ padding: "5px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: vistaTabla  ? "#FFB74D" : "rgba(255,255,255,0.07)", color: vistaTabla  ? "#000" : "#888", fontSize: 11, fontWeight: vistaTabla  ? 700 : 400 }}>📊 Tabla</button>
              </div>
            </div>

            {vistaTabla && (
              <div style={{ marginBottom: 20, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead><tr style={{ background: "rgba(255,255,255,0.05)" }}>{["Alimento", "Porción", "P (g)", "C (g)", "L (g)", "kcal", ""].map(h => <th key={h} style={{ padding: "8px 6px", textAlign: h === "Alimento" ? "left" : "center", color: "#888", fontWeight: 600, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {[...seleccion.proteinas, ...seleccion.carbohidratos, ...seleccion.lipidos].map((f, i) => {
                      const factor = (porciones[f.id] ?? f.porcion) / f.porcion;
                      const catColor = seleccion.proteinas.find(x => x.id === f.id) ? "#81C784" : seleccion.carbohidratos.find(x => x.id === f.id) ? "#64B5F6" : "#FFB74D";
                      return (
                        <tr key={f.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
                          <td style={{ padding: "9px 6px" }}><div style={{ fontWeight: 600, color: catColor, fontSize: 12 }}>{f.nombre}</div></td>
                          <td style={{ padding: "9px 6px", textAlign: "center" }}><input type="number" value={porciones[f.id] ?? f.porcion} onChange={e => setPorciones(p => ({ ...p, [f.id]: +e.target.value }))} style={{ width: 52, padding: "4px 6px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "#fff", fontSize: 11, textAlign: "center", outline: "none" }} /><span style={{ fontSize: 9, color: "#555", marginLeft: 2 }}>g</span></td>
                          <td style={{ padding: "9px 6px", textAlign: "center", color: "#81C784", fontWeight: 600 }}>{(f.proteinas * factor).toFixed(1)}</td>
                          <td style={{ padding: "9px 6px", textAlign: "center", color: "#64B5F6", fontWeight: 600 }}>{(f.carbos    * factor).toFixed(1)}</td>
                          <td style={{ padding: "9px 6px", textAlign: "center", color: "#FFB74D", fontWeight: 600 }}>{(f.lipidos   * factor).toFixed(1)}</td>
                          <td style={{ padding: "9px 6px", textAlign: "center", color: "#fff",    fontWeight: 700 }}>{Math.round(f.calorias * factor)}</td>
                          <td style={{ padding: "9px 6px", textAlign: "center" }}>
                            <button onClick={() => { const cat = seleccion.proteinas.find(x => x.id === f.id) ? "proteinas" : seleccion.carbohidratos.find(x => x.id === f.id) ? "carbohidratos" : "lipidos"; setSeleccion(prev => ({ ...prev, [cat]: prev[cat].filter(x => x.id !== f.id) })); }} style={{ background: "rgba(239,83,80,0.15)", border: "none", borderRadius: 6, padding: "3px 8px", color: "#ef5350", cursor: "pointer", fontSize: 13 }}>×</button>
                          </td>
                        </tr>
                      );
                    })}
                    {[...seleccion.proteinas, ...seleccion.carbohidratos, ...seleccion.lipidos].length > 0 && (
                      <tr style={{ background: "rgba(255,183,77,0.06)", borderTop: "2px solid rgba(255,183,77,0.2)" }}>
                        <td style={{ padding: "10px 6px", fontWeight: 700, color: "#FFB74D", fontSize: 12 }}>TOTAL</td>
                        <td style={{ padding: "10px 6px", textAlign: "center", color: "#555", fontSize: 11 }}>—</td>
                        <td style={{ padding: "10px 6px", textAlign: "center", color: "#81C784", fontWeight: 700 }}>{totales.proteinas.toFixed(1)}</td>
                        <td style={{ padding: "10px 6px", textAlign: "center", color: "#64B5F6", fontWeight: 700 }}>{totales.carbos.toFixed(1)}</td>
                        <td style={{ padding: "10px 6px", textAlign: "center", color: "#FFB74D", fontWeight: 700 }}>{totales.lipidos.toFixed(1)}</td>
                        <td style={{ padding: "10px 6px", textAlign: "center", color: "#fff",    fontWeight: 700 }}>{Math.round(totales.calorias)}</td>
                        <td></td>
                      </tr>
                    )}
                    <tr style={{ background: "rgba(255,255,255,0.03)", borderTop: "1px dashed rgba(255,255,255,0.08)" }}>
                      <td style={{ padding: "8px 6px", color: "#555", fontSize: 11 }}>META</td><td style={{ padding: "8px 6px", textAlign: "center", color: "#555", fontSize: 11 }}>—</td>
                      <td style={{ padding: "8px 6px", textAlign: "center", color: "#555", fontSize: 11 }}>{Math.round(calMeta * dist.p / 4)}</td>
                      <td style={{ padding: "8px 6px", textAlign: "center", color: "#555", fontSize: 11 }}>{Math.round(calMeta * dist.c / 4)}</td>
                      <td style={{ padding: "8px 6px", textAlign: "center", color: "#555", fontSize: 11 }}>{Math.round(calMeta * dist.l / 9)}</td>
                      <td style={{ padding: "8px 6px", textAlign: "center", color: "#555", fontSize: 11 }}>{calMeta}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: "#FFB74D", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>🔍 Buscar cualquier alimento</div>
              <div style={{ position: "relative" }}>
                <input type="text" placeholder="Escribe un alimento — ej: pechuga de pollo..." value={busqueda} onChange={e => { setBusqueda(e.target.value); if (e.target.value.length >= 2) { clearTimeout(window._searchTimer); window._searchTimer = setTimeout(() => buscarAlimento(e.target.value), 600); } else { setResultadosBusqueda([]); } }} style={{ ...inputStyle, paddingRight: "40px", fontSize: 14 }} />
                {buscando && <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, border: "2px solid #FFB74D", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
              </div>
              {resultadosBusqueda.length > 0 && (
                <div style={{ marginTop: 8, background: "#131a27", border: "1.5px solid rgba(255,183,77,0.2)", borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 10, color: "#555" }}>{resultadosBusqueda.length} resultados de FatSecret · Toca para agregar al plan</div>
                  <div style={{ maxHeight: 280, overflowY: "auto" }}>
                    {resultadosBusqueda.map(food => {
                      const yaSeleccionado = seleccion[food.cat]?.find(f => f.id === food.id);
                      return (
                        <div key={food.id} onClick={() => { if (!yaSeleccionado) { setSeleccion(prev => ({ ...prev, [food.cat]: [...prev[food.cat], food] })); } else { setSeleccion(prev => ({ ...prev, [food.cat]: prev[food.cat].filter(f => f.id !== food.id) })); } }} style={{ padding: "11px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", background: yaSeleccionado ? "rgba(255,183,77,0.08)" : "transparent", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: yaSeleccionado ? "#FFB74D" : "#fff" }}>{food.nombre}</div>
                            <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{food.porcion}g · <span style={{ color: "#81C784" }}>{food.proteinas}P</span> · <span style={{ color: "#64B5F6" }}>{food.carbos}C</span> · <span style={{ color: "#FFB74D" }}>{food.lipidos}L</span> · <b style={{ color: "#ddd" }}>{food.calorias} kcal</b></div>
                          </div>
                          <span style={{ fontSize: 18, color: yaSeleccionado ? "#FFB74D" : "#444", marginLeft: 10 }}>{yaSeleccionado ? "✓" : "+"}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {errorBusqueda && <div style={{ marginTop: 8, padding: "10px 14px", background: "rgba(255,183,77,0.06)", border: "1px solid rgba(255,183,77,0.15)", borderRadius: 10, fontSize: 12, color: "#888" }}>ℹ️ {errorBusqueda}</div>}
            </div>

            <div style={{ fontSize: 11, color: "#555", marginBottom: 14, letterSpacing: 1 }}>— O elige de tu lista base —</div>

            {[["proteinas", "🥩 Alta en Proteína", "#81C784"], ["carbohidratos", "🌾 Alta en Carbohidratos", "#64B5F6"], ["lipidos", "🥑 Alta en Lípidos", "#FFB74D"]].map(([cat, titulo, color]) => (
              <div key={cat} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>{titulo}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {foodDbFiltrado[cat].filter(food => !food.bloqueado).map(food => (
                    <FoodCard key={food.id} food={food} cat={cat} selected={!!seleccion[cat].find(f => f.id === food.id)} porciones={porciones} setPorciones={setPorciones} precios={precios} setPrecios={setPrecios} toggle={toggle} />
                  ))}
                  {foodDbFiltrado[cat].some(f => f.bloqueado) && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ fontSize: 10, color: "#444", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6, paddingLeft: 2 }}>No disponibles con tu protocolo actual</div>
                      {foodDbFiltrado[cat].filter(food => food.bloqueado).map(food => <BlockedFoodCard key={food.id} food={food} />)}
                    </div>
                  )}
                </div>
              </div>
            ))}

            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setStep(2)} style={{ flex: 1, padding: "14px", borderRadius: 14, border: "1.5px solid #333", background: "transparent", color: "#fff", cursor: "pointer" }}>← Atrás</button>
              <button onClick={() => setStep(4)} style={{ flex: 2, padding: "14px", borderRadius: 14, border: "none", background: "#FFB74D", color: "#000", fontWeight: 700, cursor: "pointer" }}>Organizar comidas →</button>
            </div>
          </div>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, marginBottom: 4 }}>Organiza tus comidas</h2>
            <p style={{ color: "#666", fontSize: 13, marginBottom: 6 }}>Protocolo: <span style={{ color: "#FFB74D" }}>{PROTOCOLOS[protocolo]?.label}</span> · {numComidas} comidas al día</p>
            {(protocolo === "ayuno16" || protocolo === "ayuno18" || protocolo === "ketoAyuno") && <div style={{ padding: "10px 14px", background: "rgba(255,183,77,0.08)", border: "1px solid rgba(255,183,77,0.2)", borderRadius: 12, marginBottom: 16, fontSize: 12, color: "#FFB74D", lineHeight: 1.6 }}>⏱️ Ventana de alimentación: {protocolo === "ayuno18" ? "6 horas · No comer antes de 1:00 pm" : "8 horas · No comer antes de 12:00 pm"}</div>}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, color: "#888", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Alimentos seleccionados</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {[...seleccion.proteinas, ...seleccion.carbohidratos, ...seleccion.lipidos].map(f => {
                  const asignado = Object.values(planComidas).some(arr => arr.find(x => x.id === f.id));
                  return <div key={f.id} style={{ padding: "6px 12px", borderRadius: 99, fontSize: 12, fontWeight: 600, background: asignado ? "rgba(129,199,132,0.12)" : "rgba(255,183,77,0.12)", border: `1px solid ${asignado ? "rgba(129,199,132,0.3)" : "rgba(255,183,77,0.3)"}`, color: asignado ? "#81C784" : "#FFB74D" }}>{asignado ? "✓ " : ""}{f.nombre}</div>;
                })}
              </div>
            </div>
            {nombreComidas.map(nombre => {
              const comidaFoods = planComidas[nombre] || []; const allFoods = [...seleccion.proteinas, ...seleccion.carbohidratos, ...seleccion.lipidos];
              return (
                <div key={nombre} style={{ marginBottom: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{nombre}</div>
                    <div style={{ fontSize: 11, color: "#555" }}>{comidaFoods.reduce((acc, f) => { const factor = (porciones[f.id] ?? f.porcion) / f.porcion; return acc + f.calorias * factor; }, 0).toFixed(0)} kcal</div>
                  </div>
                  {comidaFoods.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>{comidaFoods.map(f => <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "rgba(255,183,77,0.1)", border: "1px solid rgba(255,183,77,0.25)", borderRadius: 99, fontSize: 11 }}>{f.nombre}<button onClick={() => setPlanComidas(p => ({ ...p, [nombre]: p[nombre].filter(x => x.id !== f.id) }))} style={{ background: "none", border: "none", color: "#ef5350", cursor: "pointer", fontSize: 13, padding: 0, lineHeight: 1 }}>×</button></div>)}</div>}
                  <select value="" onChange={e => { const food = allFoods.find(f => f.id === e.target.value); if (food) setPlanComidas(p => ({ ...p, [nombre]: [...(p[nombre] || []), food] })); }} style={{ width: "100%", padding: "8px 10px", background: "#1a2333", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: comidaFoods.length === 0 ? "#555" : "#888", fontSize: 12, outline: "none", cursor: "pointer" }}>
                    <option value="">+ Agregar alimento a {nombre.split(" ")[0]}...</option>
                    {allFoods.filter(f => !comidaFoods.find(x => x.id === f.id)).map(f => <option key={f.id} value={f.id}>{f.nombre} · {Math.round(f.calorias * ((porciones[f.id] ?? f.porcion) / f.porcion))} kcal</option>)}
                  </select>
                </div>
              );
            })}
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button onClick={() => setStep(3)} style={{ flex: 1, padding: "14px", borderRadius: 14, border: "1.5px solid #333", background: "transparent", color: "#fff", cursor: "pointer" }}>← Atrás</button>
              <button onClick={() => setStep(5)} style={{ flex: 2, padding: "14px", borderRadius: 14, border: "none", background: "#FFB74D", color: "#000", fontWeight: 700, cursor: "pointer" }}>Ver resumen →</button>
            </div>
          </div>
        )}

        {/* STEP 5 */}
        {step === 5 && (
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, marginBottom: 4 }}>Tu plan del día</h2>
            <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, background: "rgba(255,183,77,0.12)", border: "1px solid rgba(255,183,77,0.25)", borderRadius: 99, padding: "3px 12px", color: "#FFB74D" }}>{OBJETIVOS.find(o => o.id === objetivo)?.icon} {OBJETIVOS.find(o => o.id === objetivo)?.label}</span>
              {somatotipo && <span style={{ fontSize: 12, background: "rgba(129,199,132,0.10)", border: "1px solid rgba(129,199,132,0.2)", borderRadius: 99, padding: "3px 12px", color: "#81C784" }}>{SOMATOTIPOS.find(s => s.id === somatotipo)?.icon} {SOMATOTIPOS.find(s => s.id === somatotipo)?.label}</span>}
              <span style={{ fontSize: 12, background: "rgba(100,181,246,0.10)", border: "1px solid rgba(100,181,246,0.2)", borderRadius: 99, padding: "3px 12px", color: "#64B5F6" }}>{PROTOCOLOS[protocolo]?.icon} {PROTOCOLOS[protocolo]?.label}</span>
              <span style={{ fontSize: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 99, padding: "3px 12px", color: "#888" }}>🍽️ {numComidas} comidas · ⚡ {tiempoPrep === "rapido" ? "<10 min" : tiempoPrep === "moderado" ? "<20 min" : "Sin límite"}</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
              {[{ label: "Calorías", value: Math.round(totales.calorias), meta: calMeta, unit: "kcal", color: "#FFB74D" }, { label: "Proteína", value: Math.round(totales.proteinas), meta: Math.round(calMeta * dist.p / 4), unit: "g", color: "#81C784" }, { label: "Carbos", value: Math.round(totales.carbos), meta: Math.round(calMeta * dist.c / 4), unit: "g", color: "#64B5F6" }, { label: "Lípidos", value: Math.round(totales.lipidos), meta: Math.round(calMeta * dist.l / 9), unit: "g", color: "#CE93D8" }].map(({ label, value, meta, unit, color }) => {
                const over = value > meta * 1.05;
                return (
                  <div key={label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "12px 8px", textAlign: "center", border: `1.5px solid ${over ? "#ef5350" : "rgba(255,255,255,0.07)"}` }}>
                    <div style={{ fontSize: 9, color: "#666", marginBottom: 5, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: over ? "#ef5350" : color }}>{value}</div>
                    <div style={{ fontSize: 9, color: "#555" }}>/ {meta}{unit}</div>
                    <div style={{ marginTop: 6 }}><Bar value={value} max={meta} color={over ? "#ef5350" : color} /></div>
                    {over && <div style={{ fontSize: 9, color: "#ef5350", marginTop: 2 }}>↑ exceso</div>}
                  </div>
                );
              })}
            </div>

            {Object.keys(planComidas).some(k => planComidas[k]?.length > 0) && (
              <div style={{ background: "rgba(100,181,246,0.06)", border: "1.5px solid rgba(100,181,246,0.18)", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#64B5F6", fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>🍽️ Tu distribución de comidas</div>
                {nombreComidas.map(nombre => {
                  const foods = planComidas[nombre] || []; if (!foods.length) return null;
                  const calComida = foods.reduce((acc, f) => { const factor = (porciones[f.id] ?? f.porcion) / f.porcion; return acc + f.calorias * factor; }, 0);
                  return (
                    <div key={nombre} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}><span style={{ fontSize: 12, fontWeight: 600, color: "#64B5F6" }}>{nombre}</span><span style={{ fontSize: 11, color: "#555" }}>{calComida.toFixed(0)} kcal</span></div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{foods.map(f => <span key={f.id} style={{ fontSize: 10, padding: "2px 8px", background: "rgba(100,181,246,0.1)", borderRadius: 99, color: "#aaa" }}>{f.nombre}</span>)}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {proteinaMeta && (
              <div style={{ padding: "13px 16px", background: "rgba(129,199,132,0.07)", border: "1.5px solid rgba(129,199,132,0.18)", borderRadius: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: "#81C784", fontWeight: 600, marginBottom: 6 }}>🥩 Meta de proteína diaria</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}><span style={{ fontSize: 32, fontWeight: 700, fontFamily: "'Playfair Display', serif", color: "#81C784" }}>{proteinaMeta}g</span><span style={{ fontSize: 12, color: "#555" }}>{PROTEINA_G_KG[objetivo]} g/kg · {perfil.peso} kg peso</span></div>
                {pctGrasa && masaMagra && <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>Masa magra: {masaMagra.toFixed(1)} kg · % Grasa: {pctGrasa.toFixed(1)}%</div>}
                <div style={{ marginTop: 8 }}><Bar value={totales.proteinas} max={proteinaMeta} color="#81C784" /></div>
                <div style={{ fontSize: 11, color: totales.proteinas >= proteinaMeta ? "#81C784" : "#888", marginTop: 4 }}>{totales.proteinas >= proteinaMeta ? "✓ Meta cubierta" : `Llevas ${Math.round(totales.proteinas)}g — faltan ${Math.round(proteinaMeta - totales.proteinas)}g`}</div>
              </div>
            )}

            {totales.costo > 0 && (
              <div style={{ padding: "14px 16px", background: "rgba(76,175,80,0.08)", border: "1.5px solid rgba(76,175,80,0.2)", borderRadius: 14, marginBottom: 18 }}>
                <div style={{ fontSize: 12, color: "#4CAF50", fontWeight: 600, marginBottom: 8 }}>💰 Costo estimado de tu plan</div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  {[["$" + totales.costo.toFixed(0), "por día", "#4CAF50"], ["$" + (totales.costo * 7).toFixed(0), "por semana", "#81C784"], ["$" + (totales.costo * 30).toFixed(0), "por mes", "#aaa"]].map(([val, sub, color]) => (
                    <div key={sub} style={{ textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Playfair Display', serif", color }}>{val}</div><div style={{ fontSize: 10, color: "#555" }}>{sub}</div></div>
                  ))}
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: "#555", textAlign: "center" }}>Un plan de nutriólogo cuesta $1,500–$3,000/mes solo en consultas.</div>
              </div>
            )}

            {[["proteinas", "🥩"], ["carbohidratos", "🌾"], ["lipidos", "🥑"]].map(([cat, icon]) => seleccion[cat].length > 0 && (
              <div key={cat} style={{ marginBottom: 13 }}>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>{icon} {cat}</div>
                {seleccion[cat].map(f => {
                  const porcionReal = porciones[f.id] ?? f.porcion; const factor = porcionReal / f.porcion;
                  return (
                    <div key={f.id} style={{ padding: "10px 13px", background: "rgba(255,255,255,0.04)", borderRadius: 10, marginBottom: 5 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{f.nombre}</span>
                        <div style={{ textAlign: "right" }}><div style={{ fontSize: 12, color: "#FFB74D", fontWeight: 600 }}>{Math.round(f.calorias * factor)} kcal</div><div style={{ fontSize: 10, color: "#4CAF50" }}>${((porcionReal / 1000) * (precios[f.id] ?? f.precio_kg)).toFixed(1)}</div></div>
                      </div>
                      <div style={{ fontSize: 11, color: "#666", marginTop: 3 }}>
                        <span style={{ color: porciones[f.id] ? "#FFB74D" : "#555" }}>{porcionReal}g</span>{porciones[f.id] && <span style={{ color: "#444" }}> (base: {f.porcion}g)</span>}
                        &nbsp;·&nbsp;<span style={{ color: "#81C784" }}>{(f.proteinas * factor).toFixed(1)}P</span>&nbsp;·&nbsp;<span style={{ color: "#64B5F6" }}>{(f.carbos * factor).toFixed(1)}C</span>&nbsp;·&nbsp;<span style={{ color: "#FFB74D" }}>{(f.lipidos * factor).toFixed(1)}L</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {seleccion.proteinas.length === 0 && seleccion.carbohidratos.length === 0 && seleccion.lipidos.length === 0 && (
              <div style={{ textAlign: "center", color: "#555", padding: "32px 0" }}>No seleccionaste alimentos aún.<br /><button onClick={() => setStep(3)} style={{ marginTop: 12, background: "#FFB74D", border: "none", borderRadius: 10, padding: "10px 20px", color: "#000", cursor: "pointer", fontWeight: 600 }}>Elegir alimentos</button></div>
            )}

            {daysLeft <= 5 && (
              <div style={{ marginTop: 18, padding: "16px", background: "rgba(255,183,77,0.08)", border: "1.5px solid rgba(255,183,77,0.22)", borderRadius: 16, textAlign: "center" }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, marginBottom: 5 }}>¿Te está funcionando?</div>
                <div style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>Quedan {daysLeft} días. Continúa por solo $99 MXN/mes.</div>
                <button style={{ background: "#FFB74D", border: "none", borderRadius: 12, padding: "11px 26px", color: "#000", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Suscribirme ahora</button>
              </div>
            )}

            <div style={{ marginTop: 20, marginBottom: 4 }}>
              <div style={{ fontSize: 12, letterSpacing: 2, color: "#F48FB1", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>🌿 Complementos del día</div>
              <div style={{ fontSize: 11, color: "#555", marginBottom: 14, lineHeight: 1.6 }}>Infusiones recomendadas según tu objetivo y condición. Respaldo científico incluido. <span style={{ color: "#CE93D8" }}>💎 Tier Pro</span></div>
              {tieneAcceso("infusiones") ? (
                infusionesRecomendadas.map(inf => <InfusionCard key={inf.label} inf={inf} />)
              ) : (
                <div onClick={() => intentarAcceder("infusiones", () => {})} style={{ padding: "20px", background: "rgba(206,147,216,0.06)", border: "1.5px dashed rgba(206,147,216,0.3)", borderRadius: 14, textAlign: "center", cursor: "pointer" }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>🔒</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#CE93D8", marginBottom: 6 }}>Módulo de Infusiones</div>
                  <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6, marginBottom: 14 }}>{infusionesRecomendadas.length} infusiones recomendadas para tu objetivo.<br />Dosis escaladas + respaldo científico incluido.</div>
                  <div style={{ display: "inline-block", padding: "8px 20px", background: "#CE93D8", borderRadius: 99, color: "#000", fontWeight: 700, fontSize: 13 }}>💎 Activar Pro — $149/mes</div>
                </div>
              )}
              <div style={{ fontSize: 10, color: "#444", lineHeight: 1.6, marginTop: 12, padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 10 }}>⚠️ Estas recomendaciones son orientativas y no sustituyen consulta médica. Consulta a tu médico antes de iniciar cualquier suplementación, especialmente si tomas medicamentos.</div>
            </div>

            <button onClick={() => intentarAcceder("seguimiento", () => setScreen("seguimiento"))} style={{ width: "100%", marginTop: 16, padding: "14px", borderRadius: 14, border: "1.5px solid rgba(255,183,77,0.3)", background: "linear-gradient(135deg, rgba(255,183,77,0.15), rgba(129,199,132,0.15))", color: "#FFB74D", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              {tieneAcceso("seguimiento") ? "📈" : "🔒"} Seguimiento semanal + recomendación IA {!tieneAcceso("seguimiento") && <span style={{ fontSize: 11, color: "#FFB74D88" }}>· Premium</span>}
            </button>

            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              <button onClick={() => setStep(4)} style={{ flex: 1, padding: "13px", borderRadius: 14, border: "1.5px solid #333", background: "transparent", color: "#fff", cursor: "pointer" }}>← Comidas</button>
              <button onClick={() => { setStep(0); setSeleccion({ proteinas: [], carbohidratos: [], lipidos: [] }); setSomatotipo(null); setPlanComidas({}); setProtocolo("estandar"); }} style={{ flex: 2, padding: "13px", borderRadius: 14, border: "none", background: "#81C784", color: "#000", fontWeight: 700, cursor: "pointer" }}>Nuevo plan ↺</button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
