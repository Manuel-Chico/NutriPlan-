// /api/alimentos.js
// — Ruta serverless para buscar en nuestra base propia de alimentos (Neon) —
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
    fuente: "propia",
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { query, max_results = "30" } = req.query;
  const maxResultsSeguro = Math.min(Math.max(parseInt(max_results, 10) || 30, 1), 50);

  if (!query || query.length < 2) return res.status(400).json({ error: "Query requerido" });

  try {
    const q = query.trim();
    const likeContiene = `%${q}%`;
    const likeEmpieza = `${q}%`;

    // Buscamos coincidencias en nombre O marca, y calculamos un "score" de
    // relevancia para poder ordenar: coincidencia exacta > empieza con > contiene.
    // Esto prioriza los resultados más relevantes de NUESTRA base antes de
    // siquiera pensar en pedirle algo a FatSecret.
    const filas = await sql`
      SELECT
        id, nombre, marca, categoria, subcategoria, fuente,
        base_g, porcion_g, porcion_desc,
        calorias, proteinas, carbohidratos, lipidos, fibra,
        CASE
          WHEN lower(nombre) = lower(${q}) THEN 3
          WHEN lower(nombre) LIKE lower(${likeEmpieza}) THEN 2
          WHEN lower(nombre) LIKE lower(${likeContiene}) THEN 1
          WHEN lower(marca) LIKE lower(${likeContiene}) THEN 1
          ELSE 0
        END AS score
      FROM alimentos
      WHERE
        lower(nombre) LIKE lower(${likeContiene})
        OR lower(marca) LIKE lower(${likeContiene})
      ORDER BY score DESC, nombre ASC
      LIMIT ${maxResultsSeguro}
    `;

    const resultados = filas.map(aFormatoFrontend);

    return res.status(200).json({ resultados });
  } catch (err) {
    return res.status(500).json({ error: "Error interno del servidor", detalle: err.message });
  }
}
