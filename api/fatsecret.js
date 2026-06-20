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
  const { query, max_results = "50" } = req.query;
  if (!query || query.length < 2) return res.status(400).json({ error: "Query requerido" });
  const consumerKey = process.env.FATSECRET_CONSUMER_KEY;
  const consumerSecret = process.env.FATSECRET_CONSUMER_SECRET;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(8).toString("hex");
  // region=MX + language=es: usa el dataset localizado de México (mismo que mobile.fatsecret.com.mx),
  // así reconoce marcas mexicanas (FUD, Bafar, San Rafael, etc.) buscando en español tal cual.
  const params = { method: "foods.search", search_expression: query, format: "json", max_results, region: "MX", language: "es", oauth_consumer_key: consumerKey, oauth_nonce: nonce, oauth_signature_method: "HMAC-SHA1", oauth_timestamp: timestamp, oauth_version: "1.0" };
  params.oauth_signature = oauthSign(params, consumerSecret);
  const qs = Object.keys(params).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join("&");
  try {
    const response = await fetch(`${BASE_URL}?${qs}`);
    const data = await response.json();
    const foods = data?.foods?.food ? (Array.isArray(data.foods.food) ? data.foods.food : [data.foods.food]) : [];

    // ── Normaliza texto para comparar sin acentos ni mayúsculas ──
    const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const palabrasQuery = norm(query).split(/\s+/).filter(Boolean);

    // Si la consulta trae 2+ palabras, asumimos que la(s) última(s) palabra(s)
    // pueden ser la marca (ej. "jamon fud" → alimento="jamon", marca="fud").
    // Esto separa la intención del usuario en dos partes para comparar cada una por su lado.
    const posibleMarca    = palabrasQuery.length > 1 ? palabrasQuery[palabrasQuery.length - 1] : null;
    const palabrasAlimento = posibleMarca ? palabrasQuery.slice(0, -1) : palabrasQuery;

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

      const nombreNorm    = norm(f.food_name);
      const nombrePalabras = nombreNorm.split(/\s+/);
      const marcaNorm     = norm(f.brand_name || "");

      // ── Tier de relevancia (no acumulable — el nivel más alto que aplique gana) ──
      // Esto evita que coincidencias parciales débiles se mezclen con coincidencias de marca real.
      let tier = 0;
      const marcaPedidaCoincide = posibleMarca && (marcaNorm === posibleMarca || marcaNorm.split(/\s+/).includes(posibleMarca));
      const alimentoCoincideCompleto = palabrasAlimento.length > 0 && palabrasAlimento.every(p => nombrePalabras.includes(p));
      const alimentoCoincideParcial  = palabrasAlimento.some(p => nombreNorm.includes(p));

      if (marcaPedidaCoincide && alimentoCoincideCompleto)      tier = 5; // marca exacta + alimento exacto: "Jamón (Fud)"
      else if (marcaPedidaCoincide && alimentoCoincideParcial)  tier = 4; // marca exacta + alimento parcial
      else if (marcaPedidaCoincide)                             tier = 3; // solo la marca coincide (otro tipo de producto Fud)
      else if (alimentoCoincideCompleto && !f.brand_name)       tier = 2; // genérico sin marca, pero nombre exacto
      else if (alimentoCoincideCompleto)                        tier = 1; // nombre exacto, marca distinta a la pedida
      else if (alimentoCoincideParcial)                         tier = 0.5; // coincidencia floja, pero al menos hay relación
      else                                                      tier = 0; // sin relación real con lo buscado (match basura de FatSecret)

      return { id: `fs_${f.food_id}`, nombre: nombreCompleto, porcion, proteinas, carbos, lipidos, calorias, precio_kg: 0, prep: "moderado", cat, fuente: "fatsecret", _tier: tier };
    });

    const conRelacion = resultados.filter(f => f._tier > 0);
    // Si filtrar deja la lista vacía (ej. búsquedas muy raras donde nada hace match real),
    // mejor mostrar los resultados crudos de FatSecret que dejar al usuario sin nada.
    const finalResultados = (conRelacion.length > 0 ? conRelacion : resultados)
      .sort((a, b) => b._tier - a._tier)
      .map(({ _tier, ...resto }) => resto); // quita el tier interno antes de responder

    return res.status(200).json({ resultados: finalResultados });
  } catch (err) {
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}
