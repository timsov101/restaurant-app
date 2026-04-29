import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export type PlaceSearchResult = {
  place_id: string;
  name: string | null;
  formatted_address: string | null;
  primary_type: string | null;
  types: string[];
  price_level: number | null;
  distance_miles: number | null;
};

export type AreaAutocompleteSuggestion = {
  place_id: string;
  label: string;
  types: string[];
  source?: "places" | "geocode" | "derived";
  query_text?: string;
};

export type AreaPlaceResult = {
  label: string;
  place_id: string;
  lat: number | null;
  lng: number | null;
  types: string[];
  formatted_address: string | null;
};

function parsePricePart(units: unknown, nanos: unknown) {
  const parsedUnits =
    typeof units === "number"
      ? units
      : typeof units === "string" && units.trim() !== ""
        ? Number(units)
        : null;
  const parsedNanos =
    typeof nanos === "number"
      ? nanos
      : typeof nanos === "string" && nanos.trim() !== ""
        ? Number(nanos)
        : null;

  if (parsedUnits == null && parsedNanos == null) return null;

  return (parsedUnits ?? 0) + (parsedNanos ?? 0) / 1_000_000_000;
}

export function extractAccessToken(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export function createAuthorizedSupabaseClient(accessToken: string) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function requireGroupMembership(
  request: Request,
  groupId: string
) {
  const accessToken = extractAccessToken(request);
  if (!accessToken) {
    return {
      error: "Missing Authorization header",
      status: 401,
    } as const;
  }

  const supabase = createAuthorizedSupabaseClient(accessToken);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(accessToken);

  if (userError || !user) {
    return {
      error: userError?.message ?? "Not signed in",
      status: 401,
    } as const;
  }

  const { data: membership, error: membershipError } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    return {
      error: membershipError.message,
      status: 500,
    } as const;
  }

  if (!membership) {
    return {
      error: "You do not have access to this group.",
      status: 403,
    } as const;
  }

  return {
    supabase,
    userId: user.id,
  } as const;
}

export function prettyCuisine(primaryType: string | null) {
  if (!primaryType) return null;

  return primaryType
    .replace(/_restaurant$/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function normalizePriceLevel(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(4, Math.round(value)));
  }

  if (typeof value !== "string" || value.trim() === "") return null;

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return Math.max(0, Math.min(4, Math.round(numeric)));
  }

  switch (value) {
    case "PRICE_LEVEL_FREE":
      return 0;
    case "PRICE_LEVEL_INEXPENSIVE":
      return 1;
    case "PRICE_LEVEL_MODERATE":
      return 2;
    case "PRICE_LEVEL_EXPENSIVE":
      return 3;
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return 4;
    default:
      return null;
  }
}

export function normalizePlaceFromGoogle(
  place: Record<string, unknown>,
  anchorLat?: number | null,
  anchorLng?: number | null
): PlaceSearchResult {
  const location =
    place.location && typeof place.location === "object"
      ? (place.location as Record<string, unknown>)
      : null;
  const lat =
    location && typeof location.latitude === "number"
      ? location.latitude
      : null;
  const lng =
    location && typeof location.longitude === "number"
      ? location.longitude
      : null;

  return {
    place_id: String(place.id ?? ""),
    name:
      place.displayName &&
      typeof place.displayName === "object" &&
      typeof (place.displayName as Record<string, unknown>).text === "string"
        ? ((place.displayName as Record<string, unknown>).text as string)
        : null,
    formatted_address:
      typeof place.formattedAddress === "string" ? place.formattedAddress : null,
    primary_type: typeof place.primaryType === "string" ? place.primaryType : null,
    types: Array.isArray(place.types)
      ? place.types.filter((entry): entry is string => typeof entry === "string")
      : [],
    price_level: normalizePriceLevel(place.priceLevel),
    distance_miles:
      anchorLat != null && anchorLng != null && lat != null && lng != null
        ? haversineMiles(anchorLat, anchorLng, lat, lng)
        : null,
  };
}

export function parseGoogleLocation(
  value: unknown
): { lat: number | null; lng: number | null } {
  const location =
    value && typeof value === "object" ? (value as Record<string, unknown>) : null;

  return {
    lat: location && typeof location.latitude === "number" ? location.latitude : null,
    lng: location && typeof location.longitude === "number" ? location.longitude : null,
  };
}

export function normalizeAreaAutocompleteSuggestion(
  value: Record<string, unknown>
): AreaAutocompleteSuggestion | null {
  const prediction =
    value.placePrediction && typeof value.placePrediction === "object"
      ? (value.placePrediction as Record<string, unknown>)
      : null;

  const placeId = typeof prediction?.placeId === "string" ? prediction.placeId.trim() : "";
  const text =
    prediction?.text && typeof prediction.text === "object"
      ? (prediction.text as Record<string, unknown>)
      : null;
  const label = typeof text?.text === "string" ? text.text.trim() : "";
  const types = Array.isArray(prediction?.types)
    ? prediction.types.filter((entry): entry is string => typeof entry === "string")
    : [];

  if (!placeId || !label) return null;

  return {
    place_id: placeId,
    label,
    types,
    source: "places",
  };
}

export function normalizeAreaPlaceFromGoogle(
  place: Record<string, unknown>
): AreaPlaceResult {
  const { lat, lng } = parseGoogleLocation(place.location);
  const displayName =
    place.displayName && typeof place.displayName === "object"
      ? (place.displayName as Record<string, unknown>)
      : null;
  const name = typeof displayName?.text === "string" ? displayName.text.trim() : "";
  const formattedAddress =
    typeof place.formattedAddress === "string" ? place.formattedAddress.trim() : null;

  return {
    label: formattedAddress || name,
    place_id: String(place.id ?? "").trim(),
    lat,
    lng,
    types: Array.isArray(place.types)
      ? place.types.filter((entry): entry is string => typeof entry === "string")
      : [],
    formatted_address: formattedAddress,
  };
}

const ACCEPTED_AREA_TYPES = new Set([
  "postal_code",
  "postal_town",
  "neighborhood",
  "sublocality",
  "sublocality_level_1",
  "sublocality_level_2",
  "sublocality_level_3",
  "sublocality_level_4",
  "sublocality_level_5",
  "locality",
  "administrative_area_level_1",
  "administrative_area_level_2",
  "administrative_area_level_3",
  "administrative_area_level_4",
  "administrative_area_level_5",
]);

const REJECTED_ADDRESS_TYPES = new Set([
  "street_address",
  "premise",
  "subpremise",
  "route",
  "intersection",
  "floor",
  "room",
  "establishment",
  "point_of_interest",
]);

export function isRecognizedDiningArea(types: string[]) {
  const normalized = types.map((entry) => entry.toLowerCase());

  if (normalized.some((entry) => REJECTED_ADDRESS_TYPES.has(entry))) {
    return false;
  }

  return normalized.some((entry) => ACCEPTED_AREA_TYPES.has(entry));
}

export function normalizeGeocodeAreaSuggestion(
  value: Record<string, unknown>
): AreaAutocompleteSuggestion | null {
  const placeId = typeof value.place_id === "string" ? value.place_id.trim() : "";
  const label =
    typeof value.formatted_address === "string"
      ? value.formatted_address.trim()
      : typeof value.address === "string"
        ? value.address.trim()
        : "";
  const types = Array.isArray(value.types)
    ? value.types.filter((entry): entry is string => typeof entry === "string")
    : [];

  if (!placeId || !label || !isRecognizedDiningArea(types)) return null;

  return {
    place_id: placeId,
    label,
    types,
    source: "geocode",
  };
}

export function buildTextQuery(query: string, cuisines: string[]) {
  const trimmedQuery = query.trim();
  const cuisineTerms = cuisines
    .map((value) => prettyCuisine(value))
    .filter((value): value is string => Boolean(value));

  const terms = [trimmedQuery, cuisineTerms.join(" ")].filter(Boolean);
  if (terms.length === 0) return "";

  const joined = terms.join(" ").trim();
  return /\brestaurant\b/i.test(joined) ? joined : `${joined} restaurant`;
}

export async function fetchPlaceDetailsFromGoogle(
  placeId: string,
  sessionToken?: string | null
) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GOOGLE_MAPS_API_KEY");
  }

  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
  const fullUrl = sessionToken
    ? `${url}?sessionToken=${encodeURIComponent(sessionToken)}`
    : url;

  const response = await fetch(fullUrl, {
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "id,displayName,formattedAddress,priceLevel,primaryType,types,priceRange,location",
    },
    cache: "no-store",
  });

  const data = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(
      ((data.error as Record<string, unknown> | undefined)?.message as string | undefined) ??
        "Place Details (New) error"
    );
  }

  const priceRange =
    data.priceRange && typeof data.priceRange === "object"
      ? (data.priceRange as Record<string, unknown>)
      : null;
  const startPrice =
    priceRange?.startPrice && typeof priceRange.startPrice === "object"
      ? (priceRange.startPrice as Record<string, unknown>)
      : null;
  const endPrice =
    priceRange?.endPrice && typeof priceRange.endPrice === "object"
      ? (priceRange.endPrice as Record<string, unknown>)
      : null;

  return {
    google_place_id: String(data.id ?? placeId),
    name:
      data.displayName &&
      typeof data.displayName === "object" &&
      typeof (data.displayName as Record<string, unknown>).text === "string"
        ? ((data.displayName as Record<string, unknown>).text as string)
        : null,
    address: typeof data.formattedAddress === "string" ? data.formattedAddress : null,
    primary_type: typeof data.primaryType === "string" ? data.primaryType : null,
    types: Array.isArray(data.types)
      ? data.types.filter((entry): entry is string => typeof entry === "string")
      : [],
    price_level: normalizePriceLevel(data.priceLevel),
    price_currency:
      typeof startPrice?.currencyCode === "string"
        ? startPrice.currencyCode
        : typeof endPrice?.currencyCode === "string"
          ? endPrice.currencyCode
          : null,
    price_range_start: parsePricePart(startPrice?.units, startPrice?.nanos),
    price_range_end: parsePricePart(endPrice?.units, endPrice?.nanos),
  };
}

function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMiles = 3958.7613;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusMiles * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
