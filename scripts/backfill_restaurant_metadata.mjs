import "dotenv/config";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Load Next-style env file explicitly
dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
if (!GOOGLE_KEY) {
  console.error("Missing GOOGLE_MAPS_API_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

function mapPriceLevelEnumToInt(v) {
  // Places API (New) enum strings -> 0..4 integer scale used in our DB
  // 0=free/cheapest ... 4=very expensive
  if (!v) return null;

  const m = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
    PRICE_LEVEL_UNSPECIFIED: null,
  };

  return Object.prototype.hasOwnProperty.call(m, v) ? m[v] : null;
}

async function fetchPlaceDetails(placeId) {
  const url = `https://places.googleapis.com/v1/places/${placeId}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": GOOGLE_KEY,
      "X-Goog-FieldMask": "id,primaryType,types,priceLevel",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places details failed (${res.status}) for ${placeId}: ${text}`);
  }

  return await res.json();
}

async function main() {
  // Pull a batch; rerun if you have more than 200
  const { data: rows, error } = await supabase
    .from("restaurants")
    .select("id, google_place_id, name, primary_type")
    .or("primary_type.is.null")
    .not("google_place_id", "is", null)
    .limit(200);

  if (error) throw error;

  console.log(`Found ${rows.length} restaurants to check`);

  let ok = 0;
  let fail = 0;

  for (const r of rows) {
    try {
      const details = await fetchPlaceDetails(r.google_place_id);

      const priceInt = mapPriceLevelEnumToInt(details.priceLevel);

      const patch = {
        primary_type: details.primaryType ?? null,
        types: Array.isArray(details.types) ? details.types : [],
        // only set price_level if we can map it
        price_level: priceInt,
      };

      const { error: uerr } = await supabase
        .from("restaurants")
        .update(patch)
        .eq("id", r.id);

      if (uerr) throw uerr;

      ok++;
      console.log(`✓ ${r.name}: ${patch.primary_type ?? "null"} | price_level=${patch.price_level ?? "null"}`);
    } catch (e) {
      fail++;
      console.error(`✗ ${r.name} (${r.google_place_id}): ${e.message}`);
    }

    // gentle throttle
    await new Promise((res) => setTimeout(res, 120));
  }

  console.log(`Done. Updated=${ok}, Failed=${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
