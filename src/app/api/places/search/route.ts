import { NextResponse } from "next/server";

import {
  buildTextQuery,
  normalizePlaceFromGoogle,
  requireGroupMembership,
} from "../_lib";

type AddSortBy = "name" | "cost" | "distance";

function parseNumber(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function compareNullableNumbersAsc(a: number | null, b: number | null) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const groupId = (searchParams.get("groupId") ?? "").trim();
  const query = (searchParams.get("q") ?? "").trim();
  const cuisines = searchParams
    .getAll("cuisines")
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);
  const maxPriceLevel = parseNumber(searchParams.get("maxPriceLevel"));
  const maxDistanceMiles = parseNumber(searchParams.get("maxDistanceMiles"));
  const anchorLat = parseNumber(searchParams.get("anchorLat"));
  const anchorLng = parseNumber(searchParams.get("anchorLng"));
  const sortBy = ((searchParams.get("sortBy") ?? "name").trim() ||
    "name") as AddSortBy;

  if (!groupId) {
    return NextResponse.json({ error: "Missing groupId" }, { status: 400 });
  }

  const membership = await requireGroupMembership(request, groupId);
  if ("error" in membership) {
    return NextResponse.json({ error: membership.error }, { status: membership.status });
  }

  const hasAddFilters =
    cuisines.length > 0 || maxPriceLevel != null || maxDistanceMiles != null || sortBy !== "name";

  const textQuery = buildTextQuery(query, cuisines);
  if (!textQuery && !hasAddFilters) {
    return NextResponse.json({ results: [] });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing GOOGLE_MAPS_API_KEY" }, { status: 500 });
  }

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.primaryType,places.types,places.priceLevel,places.location",
    },
    body: JSON.stringify({
      textQuery: textQuery || "restaurant",
      includedType: "restaurant",
      pageSize: 20,
      regionCode: "US",
    }),
    cache: "no-store",
  });

  const payload = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    return NextResponse.json(
      {
        error:
          ((payload.error as Record<string, unknown> | undefined)?.message as string | undefined) ??
          "Places Text Search (New) error",
      },
      { status: response.status }
    );
  }

  const rawPlaces = Array.isArray(payload.places)
    ? (payload.places as Record<string, unknown>[])
    : [];

  const collator = new Intl.Collator(undefined, {
    sensitivity: "base",
    numeric: true,
  });

  let results = rawPlaces
    .map((place) => normalizePlaceFromGoogle(place, anchorLat, anchorLng))
    .filter((place) => place.place_id)
    .filter((place) =>
      cuisines.length > 0 ? Boolean(place.primary_type && cuisines.includes(place.primary_type)) : true
    )
    .filter((place) =>
      maxPriceLevel != null
        ? place.price_level == null || place.price_level <= maxPriceLevel
        : true
    )
    .filter((place) =>
      maxDistanceMiles != null && anchorLat != null && anchorLng != null
        ? place.distance_miles != null && place.distance_miles <= maxDistanceMiles
        : true
    );

  const placeIds = results.map((place) => place.place_id);
  const { data: restaurants, error: restaurantError } = placeIds.length
    ? await membership.supabase
      .from("restaurants")
      .select("id, google_place_id")
      .in("google_place_id", placeIds)
    : { data: [], error: null };

  if (restaurantError) {
    return NextResponse.json({ error: restaurantError.message }, { status: 500 });
  }

  const restaurantIdByPlaceId = new Map<string, string>();
  ((restaurants ?? []) as Array<{ id: string; google_place_id: string | null }>).forEach((row) => {
    if (row.google_place_id) {
      restaurantIdByPlaceId.set(row.google_place_id, row.id);
    }
  });

  const matchedRestaurantIds = Array.from(restaurantIdByPlaceId.values());
  const { data: savedRows, error: savedError } = matchedRestaurantIds.length
    ? await membership.supabase
      .from("group_restaurants")
      .select("restaurant_id")
      .eq("group_id", groupId)
      .in("restaurant_id", matchedRestaurantIds)
    : { data: [], error: null };

  if (savedError) {
    return NextResponse.json({ error: savedError.message }, { status: 500 });
  }

  const savedRestaurantIds = new Set(
    ((savedRows ?? []) as Array<{ restaurant_id: string }>).map((row) => row.restaurant_id)
  );

  results = results
    .map((place) => {
      const restaurantId = restaurantIdByPlaceId.get(place.place_id) ?? null;
      return {
        ...place,
        restaurant_id: restaurantId,
        is_saved_to_active_group: restaurantId ? savedRestaurantIds.has(restaurantId) : false,
      };
    })
    .sort((a, b) => {
      if (sortBy === "cost") {
        const diff = compareNullableNumbersAsc(a.price_level, b.price_level);
        return diff !== 0 ? diff : collator.compare(a.name ?? "", b.name ?? "");
      }

      if (sortBy === "distance") {
        const diff = compareNullableNumbersAsc(a.distance_miles, b.distance_miles);
        return diff !== 0 ? diff : collator.compare(a.name ?? "", b.name ?? "");
      }

      if (query) {
        return 0;
      }

      return collator.compare(a.name ?? "", b.name ?? "");
    });

  return NextResponse.json({ results });
}
