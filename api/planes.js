// /api/planes.js
// ── Ruta serverless para persistir el plan de alimentos del día (historial por día) ──
// Requiere: npm install @neondatabase/serverless (ya instalado para /api/registros.js)
// Requiere: variable de entorno DATABASE_URL (ya configurada)

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const { userId, fecha } = req.query;
      if (!userId) return res.status(400).json({ error: "Falta userId" });

      if (fecha) {
        // Plan de un día específico (ej. hoy, al cargar la app)
        const filas = await sql.query(
          "SELECT fecha, datos FROM planes WHERE user_id = $1 AND fecha = $2",
          [userId, fecha]
        );
        return res.status(200).json({ plan: filas[0] || null });
      }

      // Historial completo de planes de este usuario
      const filas = await sql.query(
        "SELECT fecha, datos FROM planes WHERE user_id = $1 ORDER BY fecha DESC",
        [userId]
      );
      return res.status(200).json({ planes: filas });
    }

    if (req.method === "POST") {
      const { userId, fecha, datos } = req.body || {};
      if (!userId || !fecha || !datos) {
        return res.status(400).json({ error: "Faltan datos requeridos (userId, fecha, datos)" });
      }

      // Upsert: si ya existe un plan para ese usuario+fecha, lo actualiza; si no, lo crea
      const filas = await sql.query(
        `INSERT INTO planes (user_id, fecha, datos)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, fecha)
         DO UPDATE SET datos = EXCLUDED.datos, actualizado_en = NOW()
         RETURNING fecha, datos`,
        [userId, fecha, JSON.stringify(datos)]
      );
      return res.status(200).json({ plan: filas[0] });
    }

    if (req.method === "DELETE") {
      const { userId, fecha } = req.query;
      if (!userId || !fecha) return res.status(400).json({ error: "Faltan userId o fecha" });

      const filas = await sql.query(
        "DELETE FROM planes WHERE user_id = $1 AND fecha = $2 RETURNING fecha",
        [userId, fecha]
      );
      if (filas.length === 0) return res.status(404).json({ error: "Plan no encontrado" });
      return res.status(200).json({ deleted: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "Método no permitido" });
  } catch (err) {
    console.error("Error en /api/planes:", err);
    return res.status(500).json({ error: "Error del servidor al procesar el plan" });
  }
}
