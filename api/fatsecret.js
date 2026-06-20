import crypto from "crypto";
const BASE_URL = "https://platform.fatsecret.com/rest/server.api";
function oauthSign(params, consumerSecret) {
  const sorted = Object.keys(params).sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join("&");
  const baseString = ["GET", encodeURIComponent(BASE_URL), encodeURIComponent(sorted)].join("&");
  const signingKey = `${encodeURIComponent(consumerSecret)}&`;
  return crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");
}
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const { query, max_results = "100" } = req.query;
  if (!query || query.length < 2) return res.status(400).json({ error: "Query requerido" });
  const consumerKey = process.env.FATSECRET_CONSUMER_KEY;
  const consumerSecret = process.env.FATSECRET_CONSUMER_SECRET;

  // region=MX + language=es: usa el dataset localizado de México (mismo que mobile.fatsecret.com.mx),
  // así reconoce marcas mexicanas (FUD, Bafar, San Rafael, etc.) buscando en español tal cual.
  const buscarFatSecret = async (searchExpression, maxResults) => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(8).toString("hex");
    const params = { method: "foods.search", search_expression: searchExpression, format: "json", max_results: String(maxResults), region: "MX", language: "es", oauth_consumer_key: consumerKey, oauth_nonce: nonce, oauth_signature_method: "HMAC-SHA1", oauth_timestamp: timestamp, oauth_version: "1.0" };
    params.oauth_signature = oauthSign(params, consumerSecret);
    const qs = Object.keys(params).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join("&");
    const response = await fetch(`${BASE_URL}?${qs}`);
    const data = await response.json();
    return data?.foods?.food ? (Array.isArray(data.foods.food) ? data.foods.food : [data.foods.food]) : [];
  };

  try {
    // ── Normaliza texto para comparar sin acentos ni mayúsculas ──
    const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const palabrasQuery = norm(query).split(/\s+/).filter(Boolean);

    // Si la consulta trae 2+ palabras, asumimos que la última es la marca
    // (ej. "jamon fud" → alimento="jamon", marca="fud").
    const posibleMarca     = palabrasQuery.length > 1 ? palabrasQuery[palabrasQuery.length - 1] : null;
    const palabrasAlimento = posibleMarca ? palabrasQuery.slice(0, -1) : palabrasQuery;

    // Búsqueda principal con la query completa, y si hay marca, una segunda búsqueda
    // solo por la marca — FatSecret a veces no trae todos los productos de una marca
    // cuando se combina con el nombre del alimento en una sola consulta de texto libre.
    const busquedas = [buscarFatSecret(query, max_results)];
    if (posibleMarca) busquedas.push(buscarFatSecret(posibleMarca, max_results));
    const resultadosCrudos = await Promise.all(busquedas);

    const vistos = new Set();
    const foods = [];
    for (const lista of resultadosCrudos) {
      for (const f of lista) {
        if (!vistos.has(f.food_id)) { vistos.add(f.food_id); foods.push(f); }
      }
    }

    const resultados = foods.map(f => {
      const desc = f.food_description || "";
      // Con region=MX&language=es, FatSecret puede devolver la descripción en español
      // (ej. "Por 100g - Calorías: 22kcal | Grasa: 0.34g | Carbh: 3.28g | Prot: 3.09g")
      // pero algunos alimentos genéricos siguen viniendo en inglés. Soportamos ambos formatos.
      const por = desc.match(/(?:Per|Por)\s+([\d.]+)\s*g/i);
      const cal = desc.match(/Calor[ií]as?:\s*([\d.]+)\s*kcal/i) || desc.match(/Calories:\s*([\d.]+)\s*kcal/i);
      const fat = desc.match(/(?:Fat|Grasas?|L[ií]pidos?):\s*([\d.]+)\s*g/i);
      const carb = desc.match(/(?:Carbs?|Carbh|Carbohidratos?):\s*([\d.]+)\s*g/i);
      const pro = desc.match(/(?:Protein|Prote[ií]nas?|Prot):\s*([\d.]+)\s*g/i);
      const porcion = por ? +por[1] : 100; const calorias = cal ? +cal[1] : 0;
      const lipidos = fat ? +fat[1] : 0; const carbos = carb ? +carb[1] : 0; const proteinas = pro ? +pro[1] : 0;
      const cat = proteinas >= carbos && proteinas >= lipidos ? "proteinas" : carbos >= lipidos ? "carbohidratos" : "lipidos";
      const nombreCompleto = f.brand_name ? `${f.food_name} (${f.brand_name})` : f.food_name;

      const nombreNorm     = norm(f.food_name);
      const nombrePalabras = nombreNorm.split(/\s+/);
      const marcaNorm      = norm(f.brand_name || "");

      const marcaPedidaCoincide      = posibleMarca && (marcaNorm === posibleMarca || marcaNorm.split(/\s+/).includes(posibleMarca));
      const alimentoCoincideCompleto = palabrasAlimento.length > 0 && palabrasAlimento.every(p => nombrePalabras.includes(p));
      const alimentoCoincideParcial  = palabrasAlimento.some(p => nombreNorm.includes(p));

      // ── Score solo para ordenar DENTRO del grupo ya filtrado por marca ──
      let score = 0;
      if (alimentoCoincideCompleto) score = 2;
      else if (alimentoCoincideParcial) score = 1;

      return { id: `fs_${f.food_id}`, nombre: nombreCompleto, porcion, proteinas, carbos, lipidos, calorias, precio_kg: 0, prep: "moderado", cat, fuente: "fatsecret", _marcaPedidaCoincide: marcaPedidaCoincide, _alimentoCoincideCompleto: alimentoCoincideCompleto, _alimentoCoincideParcial: alimentoCoincideParcial, _score: score };
    });

    let finalResultados;
    if (posibleMarca) {
      // Si el usuario pidió una marca, mostramos SOLO esa marca — sin mezclar otras,
      // ordenando primero los que mejor coinciden con el alimento pedido.
      const soloMarca = resultados.filter(f => f._marcaPedidaCoincide);
      const base = soloMarca.length > 0 ? soloMarca : resultados.filter(f => f._alimentoCoincideCompleto || f._alimentoCoincideParcial);
      finalResultados = (base.length > 0 ? base : resultados)
        .sort((a, b) => b._score - a._score);
    } else {
      // Sin marca detectada: prioriza coincidencia completa del alimento, luego parcial.
      const conRelacion = resultados.filter(f => f._alimentoCoincideCompleto || f._alimentoCoincideParcial);
      finalResultados = (conRelacion.length > 0 ? conRelacion : resultados)
        .sort((a, b) => b._score - a._score);
    }

    finalResultados = finalResultados.map(({ _marcaPedidaCoincide, _alimentoCoincideCompleto, _alimentoCoincideParcial, _score, ...resto }) => resto);

    return res.status(200).json({ resultados: finalResultados });
  } catch (err) {
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}
