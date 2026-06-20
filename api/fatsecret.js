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
  const { query, max_results = "100", debug } = req.query;
  if (!query || query.length < 2) return res.status(400).json({ error: "Query requerido" });
  const consumerKey = process.env.FATSECRET_CONSUMER_KEY;
  const consumerSecret = process.env.FATSECRET_CONSUMER_SECRET;

  const buscarFatSecret = async (searchExpression, maxResults) => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(8).toString("hex");
    const params = { method: "foods.search", search_expression: searchExpression, format: "json", max_results: String(maxResults), region: "MX", language: "es", oauth_consumer_key: consumerKey, oauth_nonce: nonce, oauth_signature_method: "HMAC-SHA1", oauth_timestamp: timestamp, oauth_version: "1.0" };
    params.oauth_signature = oauthSign(params, consumerSecret);
    const qs = Object.keys(params).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join("&");
    const response = await fetch(`${BASE_URL}?${qs}`);
    const data = await response.json();
    if (data?.error) {
      return { items: [], errorInfo: { searchExpression, httpStatus: response.status, fatsecretError: data.error } };
    }
    const items = data?.foods?.food ? (Array.isArray(data.foods.food) ? data.foods.food : [data.foods.food]) : [];
    return { items, errorInfo: null, totalResults: data?.foods?.total_results, httpStatus: response.status };
  };

  try {
    const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // FatSecret no traduce de forma consistente: algunos productos de la MISMA marca
    // vienen con food_name en español ("Jamón de Pavo Virginia") y otros en inglés
    // ("Turkey Ham", "Cooked Ham"). Por cada palabra original guardamos su "grupo"
    // de variantes válidas (la propia palabra + sinónimos en inglés).
    const SINONIMOS = {
      jamon: ["ham"], queso: ["cheese"], pollo: ["chicken"], res: ["beef"],
      cerdo: ["pork"], pavo: ["turkey"], pescado: ["fish"],
      salchicha: ["sausage", "sausages"], salchichas: ["sausage", "sausages"],
      tocino: ["bacon"], leche: ["milk"], huevo: ["egg", "eggs"], huevos: ["egg", "eggs"],
      arroz: ["rice"], pan: ["bread"], mantequilla: ["butter"],
      yogurt: ["yogurt", "yoghurt"], crema: ["cream"], atun: ["tuna"],
      camaron: ["shrimp", "shrimps"], camarones: ["shrimp", "shrimps"],
    };
    const gruposDeSinonimos = palabras => palabras.map(p => [p, ...(SINONIMOS[p] || [])]);

    const palabrasQuery = norm(query).split(/\s+/).filter(Boolean);

    const posibleMarca     = palabrasQuery.length > 1 ? palabrasQuery[palabrasQuery.length - 1] : null;
    const gruposAlimento   = gruposDeSinonimos(posibleMarca ? palabrasQuery.slice(0, -1) : palabrasQuery);

    const etiquetas  = [`completa:"${query}"`];
    const busquedas  = [buscarFatSecret(query, max_results)];
    if (posibleMarca) { etiquetas.push(`marca:"${posibleMarca}"`); busquedas.push(buscarFatSecret(posibleMarca, max_results)); }
    const resultadosCrudos = await Promise.all(busquedas);

    const diagnostico = resultadosCrudos.map((r, i) => ({
      busqueda: etiquetas[i],
      itemsRecibidos: r.items.length,
      totalResultsFatSecret: r.totalResults ?? null,
      httpStatus: r.httpStatus,
      error: r.errorInfo,
      nombresCrudos: r.items.map(f => ({ food_name: f.food_name, brand_name: f.brand_name || null })),
    }));

    const vistos = new Set();
    const foods = [];
    for (const r of resultadosCrudos) {
      for (const f of r.items) {
        if (!vistos.has(f.food_id)) { vistos.add(f.food_id); foods.push(f); }
      }
    }

    const resultados = foods.map(f => {
      const desc = f.food_description || "";
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

      const marcaPedidaCoincide = posibleMarca && (marcaNorm === posibleMarca || marcaNorm.split(/\s+/).includes(posibleMarca));
      const alimentoCoincideCompleto = gruposAlimento.length > 0 && gruposAlimento.every(grupo => grupo.some(v => nombrePalabras.includes(v)));
      const alimentoCoincideParcial  = gruposAlimento.some(grupo => grupo.some(v => nombreNorm.includes(v)));

      let score = 0;
      if (alimentoCoincideCompleto) score = 2;
      else if (alimentoCoincideParcial) score = 1;

      return { id: `fs_${f.food_id}`, nombre: nombreCompleto, porcion, proteinas, carbos, lipidos, calorias, precio_kg: 0, prep: "moderado", cat, fuente: "fatsecret", _marcaPedidaCoincide: marcaPedidaCoincide, _alimentoCoincideCompleto: alimentoCoincideCompleto, _alimentoCoincideParcial: alimentoCoincideParcial, _score: score };
    });

    let finalResultados;
    if (posibleMarca) {
      const soloMarca = resultados.filter(f => f._marcaPedidaCoincide);
      const baseMarca = soloMarca.length > 0 ? soloMarca : resultados;
      const marcaYAlimento = baseMarca.filter(f => f._alimentoCoincideCompleto || f._alimentoCoincideParcial);
      finalResultados = (marcaYAlimento.length > 0 ? marcaYAlimento : baseMarca)
        .sort((a, b) => b._score - a._score);
    } else {
      const conRelacion = resultados.filter(f => f._alimentoCoincideCompleto || f._alimentoCoincideParcial);
      finalResultados = (conRelacion.length > 0 ? conRelacion : resultados)
        .sort((a, b) => b._score - a._score);
    }

    finalResultados = finalResultados.map(({ _marcaPedidaCoincide, _alimentoCoincideCompleto, _alimentoCoincideParcial, _score, ...resto }) => resto);

    const respuesta = { resultados: finalResultados };
    if (debug === "1") respuesta._diagnostico = diagnostico;

    return res.status(200).json(respuesta);
  } catch (err) {
    if (debug === "1") return res.status(500).json({ error: "Error interno del servidor", detalle: err.message, stack: err.stack });
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}
