// /api/registros.js
// ── Ruta serverless para persistir los registros de seguimiento semanal ──
// Requiere: npm install @neondatabase/serverless
// Requiere: variable de entorno DATABASE_URL (la inyecta Vercel automáticamente
// al instalar la integración de Neon desde el Marketplace de Vercel)

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

// Convierte una fila de la base de datos al formato que ya espera el frontend
function aFormatoFrontend(fila) {
  return {
    id: fila.id,
    semana: fila.semana,
    peso: fila.peso,
    cintura: fila.cintura,
    cuello: fila.cuello,
    fecha: fila.fecha,
  };
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const { userId } = req.query;
      if (!userId) return res.status(400).json({ error: "Falta userId" });

      const filas = await sql.query(
        "SELECT * FROM registros WHERE user_id = $1 ORDER BY semana ASC",
        [userId]
      );
      return res.status(200).json({ registros: filas.map(aFormatoFrontend) });
    }

    if (req.method === "POST") {
      const { userId, peso, cintura, cuello, fecha } = req.body || {};
      if (!userId || !peso || !cintura) {
        return res.status(400).json({ error: "Faltan datos requeridos (userId, peso, cintura)" });
      }

      const filas = await sql.query(
        `INSERT INTO registros (user_id, semana, peso, cintura, cuello, fecha)
         VALUES ($1, (SELECT COALESCE(MAX(semana), 0) + 1 FROM registros WHERE user_id = $1), $2, $3, $4, $5)
         RETURNING *`,
        [userId, peso, cintura, cuello || null, fecha || ""]
      );
      return res.status(201).json({ registro: aFormatoFrontend(filas[0]) });
    }

    if (req.method === "PUT") {
      const { userId, id, peso, cintura, cuello } = req.body || {};
      if (!userId || !id || !peso || !cintura) {
        return res.status(400).json({ error: "Faltan datos requeridos (userId, id, peso, cintura)" });
      }

      const filas = await sql.query(
        `UPDATE registros SET peso = $1, cintura = $2, cuello = $3
         WHERE id = $4 AND user_id = $5
         RETURNING *`,
        [peso, cintura, cuello || null, id, userId]
      );
      if (filas.length === 0) return res.status(404).json({ error: "Registro no encontrado" });
      return res.status(200).json({ registro: aFormatoFrontend(filas[0]) });
    }

    if (req.method === "DELETE") {
      const { userId, id } = req.query;
      if (!userId || !id) return res.status(400).json({ error: "Faltan userId o id" });

      const filas = await sql.query(
        "DELETE FROM registros WHERE id = $1 AND user_id = $2 RETURNING id",
        [id, userId]
      );
      if (filas.length === 0) return res.status(404).json({ error: "Registro no encontrado" });
      return res.status(200).json({ deleted: true });
    }

    res.setHeader("Allow", "GET, POST, PUT, DELETE");
    return res.status(405).json({ error: "Método no permitido" });
  } catch (err) {
    console.error("Error en /api/registros:", err);
    return res.status(500).json({ error: "Error del servidor al procesar registros" });
  }
}
