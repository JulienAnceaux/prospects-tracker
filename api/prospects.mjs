import { requireAuth } from "./_lib/auth.mjs";

// Source officielle : cadastre.data.gouv.fr (IGN / DGFiP, licence ODbL).
// Un fichier GeoJSON par commune, gzippé côté serveur (fetch Node décompresse
// automatiquement via l'en-tête Content-Encoding, aucune manipulation nécessaire).
const BASE = "https://cadastre.data.gouv.fr/bundler/cadastre-etalab/communes";

// Seuil validé dans le case study Domus (POC Pontoise, 53 prospects) :
// une parcelle dont la date "updated" cadastrale est récente signale une
// division volontaire (géomètre mandaté), donc un vendeur potentiellement motivé.
const MONTHS_THRESHOLD = 12;
const QUALIFYING_SCORE = 40;

// Garde-fou pour les très grosses communes (Paris, Marseille...) : au-delà,
// on tronque et on le signale, plutôt que de risquer un timeout de la fonction.
const MAX_FEATURES = 80000;

function monthsSince(dateStr) {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return null;
  const diffMs = Date.now() - parsed.getTime();
  return diffMs / (1000 * 60 * 60 * 24 * 30.44);
}

function scoreParcelle(properties) {
  let score = 0;
  const signaux = [];

  const months = monthsSince(properties.updated);
  if (months !== null && months < MONTHS_THRESHOLD) {
    score += 40;
    signaux.push("division_recente");
  }

  // PermisAPI (+30) et DVF (+20) : prévus au case study, pas encore branchés
  // dans cette V1. Le score plafonne donc à 40 pour l'instant.

  return { score, signaux };
}

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Méthode non autorisée." });
  }

  const code = String(req.query?.code || "").trim();
  if (!/^\d{5}$/.test(code)) {
    return res.status(400).json({ error: "Code INSEE de commune invalide." });
  }

  const url = `${BASE}/${code}/geojson/parcelles`;

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/vnd.geo+json", "User-Agent": "ProspectsTracker/0.1" },
      signal: AbortSignal.timeout(45000)
    });

    if (response.status === 404) {
      return res.status(404).json({ error: "Aucune donnée cadastrale disponible pour cette commune." });
    }
    if (!response.ok) throw new Error(`Cadastre ${response.status}`);

    const geojson = await response.json();
    const allFeatures = Array.isArray(geojson.features) ? geojson.features : [];
    const truncated = allFeatures.length > MAX_FEATURES;
    const scanned = truncated ? allFeatures.slice(0, MAX_FEATURES) : allFeatures;

    const results = [];
    for (const feature of scanned) {
      const p = feature.properties || {};
      const { score, signaux } = scoreParcelle(p);
      if (score < QUALIFYING_SCORE) continue;

      results.push({
        id: p.id,
        commune: p.commune,
        section: p.section,
        numero: p.numero,
        contenance: Number(p.contenance || 0),
        arpente: Boolean(p.arpente),
        created: p.created || null,
        updated: p.updated || null,
        score,
        signaux
      });
    }

    results.sort((a, b) => b.score - a.score || b.contenance - a.contenance);

    const surfaceCumulee = results.reduce((sum, r) => sum + r.contenance, 0);
    const scoreMoyen = results.length
      ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
      : 0;

    res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
    return res.status(200).json({
      codeCommune: code,
      totalParcelles: allFeatures.length,
      scanned: scanned.length,
      truncated,
      qualifies: results.length,
      surfaceCumulee,
      scoreMoyen,
      results,
      disclaimer:
        "Score basé uniquement sur les divisions cadastrales récentes (<12 mois). PermisAPI (+30) et DVF (+20) non encore intégrés — V2."
    });
  } catch (error) {
    console.error("Cadastre fetch failed", error instanceof Error ? error.message : error);
    return res.status(502).json({ error: "La source cadastrale est temporairement indisponible." });
  }
}
