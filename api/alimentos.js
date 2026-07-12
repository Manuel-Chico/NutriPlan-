// /api/alimentos.js
// — Ruta serverless para buscar (GET) y guardar (POST) en nuestra base propia de alimentos (Neon) —
// Requiere: npm install @neondatabase/serverless
// Requiere: variable de entorno DATABASE_URL (la inyecta Vercel automáticamente
// al instalar la integración de Neon desde el Marketplace de Vercel)

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

// Convierte una fila de la tabla `alimentos` al formato que ya espera el frontend
// (mismo shape que /api/fatsecret: id, nombre, porcion, proteinas, carbos, lipidos, calorias, cat, fuente)
function aFormatoFrontend(fila) {
  const porcion = Number(fila.porcion_g ?? fila.base_g ?? 100);
  const proteinas = Number(fila.proteinas) || 0;
  const carbos = Number(fila.carbohidratos) || 0;
  const lipidos = Number(fila.lipidos) || 0;
  const calorias = Number(fila.calorias) || 0;

  // Si no hay categoria guardada, la inferimos por el macro dominante
  const cat = fila.categoria
    || (proteinas >= carbos && proteinas >= lipidos ? "proteinas" : carbos >= lipidos ? "carbohidratos" : "lipidos");

  const nombreCompleto = fila.marca ? `${fila.nombre} (${fila.marca})` : fila.nombre;

  return {
    id: `db_${fila.id}`,
    nombre: nombreCompleto,
    porcion,
    proteinas,
    carbos,
    lipidos,
    calorias,
    precio_kg: 0,
    prep: "moderado",
    cat,
    fuente: fila.fuente || "propia",
  };
}

// ── GET: buscar alimentos ────────────────────────────────────────────
async function handleGet(req, res) {
  const { query, max_results = "30" } = req.query;
  const maxResultsSeguro = Math.min(Math.max(parseInt(max_results, 10) || 30, 1), 50);

  if (!query || query.length < 2) return res.status(400).json({ error: "Query requerido" });

  try {
    const q = query.trim();
    const likeContiene = `%${q}%`;
    const likeEmpieza = `${q}%`;

    // Conectores que no aportan significado para buscar un alimento —
    // si el usuario los omite ("jamón pavo" en vez de "jamón de pavo"),
    // no debe afectar el resultado.
    const CONECTORES = new Set(["de", "del", "la", "el", "los", "las", "y", "con", "sin", "a"]);
    const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const todasLasPalabras = norm(q).split(/\s+/).filter(Boolean);
    const palabrasSignificativas = todasLasPalabras.filter(p => !CONECTORES.has(p));
    // Si al quitar conectores no queda nada (ej. búsqueda = "de"), usamos las
    // palabras originales para no dejar la búsqueda vacía.
    const palabras = palabrasSignificativas.length > 0 ? palabrasSignificativas : todasLasPalabras;

    // Buscamos alimentos donde CADA palabra de la búsqueda aparezca en algún
    // lado del nombre o la marca (sin importar el orden). Así "jamón pavo"
    // SÍ encuentra "Jamón de pavo Virginia" aunque falte la palabra "de" y el
    // orden no sea idéntico — antes exigíamos la frase completa tal cual,
    // lo que hacía fallar búsquedas poco específicas y disparaba el
    // fallback a FatSecret sin necesidad.
    //
    // El score de prioridad se calcula aparte, sobre la frase completa
    // original, para desempatar: coincidencia exacta > empieza con > el
    // resto de coincidencias por palabras sueltas.
    const filas = await sql`
      SELECT
        id, nombre, marca, categoria, subcategoria, fuente,
        base_g, porcion_g, porcion_desc,
        calorias, proteinas, carbohidratos, lipidos, fibra,
        CASE
          WHEN lower(nombre) = lower(${q}) THEN 3
          WHEN lower(nombre) LIKE lower(${likeEmpieza}) THEN 2
          WHEN lower(nombre) LIKE lower(${likeContiene}) THEN 1
          ELSE 0
        END AS score
      FROM alimentos
      WHERE (
        SELECT bool_and(
          translate(lower(nombre), 'áéíóúñ', 'aeioun') LIKE '%' || palabra || '%'
          OR translate(lower(coalesce(marca, '')), 'áéíóúñ', 'aeioun') LIKE '%' || palabra || '%'
        )
        FROM unnest(${palabras}::text[]) AS palabra
      )
      ORDER BY score DESC, nombre ASC, id ASC
      LIMIT ${maxResultsSeguro}
    `;

    const resultados = filas.map(aFormatoFrontend);

    return res.status(200).json({ resultados });
  } catch (err) {
    return res.status(500).json({ error: "Error interno del servidor", detalle: err.message });
  }
}

// ── POST: guardar un alimento capturado manualmente por el usuario ───
async function handlePost(req, res) {
  const {
    nombre,
    categoria,
    porcion_g,
    proteinas,
    carbohidratos,
    lipidos,
    calorias,
    marca,
    fuente,
  } = req.body || {};

  // Validación de campos requeridos
  if (!nombre || typeof nombre !== "string" || !nombre.trim()) {
    return res.status(400).json({ error: "El nombre del alimento es requerido" });
  }
  if (!["proteinas", "carbohidratos", "lipidos"].includes(categoria)) {
    return res.status(400).json({ error: "Categoría inválida — debe ser proteinas, carbohidratos o lipidos" });
  }
  const porcionNum = Number(porcion_g);
  const proteinasNum = Number(proteinas);
  const carbosNum = Number(carbohidratos);
  const lipidosNum = Number(lipidos);
  if (!porcionNum || porcionNum <= 0) {
    return res.status(400).json({ error: "La porción (g) debe ser un número mayor a 0" });
  }
  if ([proteinasNum, carbosNum, lipidosNum].some(v => Number.isNaN(v) || v < 0)) {
    return res.status(400).json({ error: "Proteína, carbohidratos y lípidos deben ser números válidos" });
  }

  // Si no se especifican calorías, se calculan a partir de los macros (4/4/9 kcal por gramo)
  const caloriasNum = (calorias !== undefined && calorias !== null && calorias !== "")
    ? Number(calorias)
    : proteinasNum * 4 + carbosNum * 4 + lipidosNum * 9;

  if (Number.isNaN(caloriasNum) || caloriasNum < 0) {
    return res.status(400).json({ error: "Las calorías deben ser un número válido" });
  }

  try {
    const filas = await sql`
      INSERT INTO alimentos (nombre, marca, categoria, fuente, base_g, porcion_g, calorias, proteinas, carbohidratos, lipidos)
      VALUES (
        ${nombre.trim()},
        ${marca || null},
        ${categoria},
        ${fuente || "manual"},
        ${porcionNum},
        ${porcionNum},
        ${caloriasNum},
        ${proteinasNum},
        ${carbosNum},
        ${lipidosNum}
      )
      RETURNING id, nombre, marca, categoria, base_g, porcion_g, calorias, proteinas, carbohidratos, lipidos, fuente
    `;

    const alimento = aFormatoFrontend(filas[0]);
    return res.status(201).json({ alimento });
  } catch (err) {
    return res.status(500).json({ error: "No se pudo guardar el alimento", detalle: err.message });
  }
}

export default async function handler(req, res) {
  if (req.method === "GET")  return handleGet(req, res);
  if (req.method === "POST") return handlePost(req, res);
  return res.status(405).json({ error: "Method not allowed" });
}
