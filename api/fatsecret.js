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
  const { query, max_results = "20" } = req.query;
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
      return { id: `fs_${f.food_id}`, nombre: nombreCompleto, porcion, proteinas, carbos, lipidos, calorias, precio_kg: 0, prep: "moderado", cat, fuente: "fatsecret" };
    });
    return res.status(200).json({ resultados });
  } catch (err) {
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}
