import { NextResponse } from "next/server";

import {
  fetchPlaceDetailsFromGoogle,
  requireGroupMembership,
} from "../_lib";

type SaveRequestBody = {
  groupId?: string;
  placeId?: string;
  sessionToken?: string | null;
  rating?: {
    overall?: number | null;
    nutrition?: number | null;
  } | null;
  costLevel?: number | null;
};

export async function POST(request: Request) {
  let body: SaveRequestBody;

  try {
    body = (await request.json()) as SaveRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const groupId = (body.groupId ?? "").trim();
  const placeId = (body.placeId ?? "").trim();
  const sessionToken = (body.sessionToken ?? "").trim() || null;
  const overall =
    typeof body.rating?.overall === "number" ? body.rating.overall : body.rating?.overall ?? null;
  const nutrition =
    typeof body.rating?.nutrition === "number"
      ? body.rating.nutrition
      : body.rating?.nutrition ?? null;
  const costLevel =
    typeof body.costLevel === "number" && Number.isFinite(body.costLevel)
      ? Math.round(body.costLevel)
      : null;

  if (!groupId || !placeId) {
    return NextResponse.json(
      { error: "Missing groupId or placeId" },
      { status: 400 }
    );
  }

  if (costLevel != null && (costLevel < 1 || costLevel > 4)) {
    return NextResponse.json(
      { error: "Cost level must be between 1 and 4" },
      { status: 400 }
    );
  }

  const membership = await requireGroupMembership(request, groupId);
  if ("error" in membership) {
    return NextResponse.json({ error: membership.error }, { status: membership.status });
  }

  let restaurantId: string | null = null;

  const { data: existingRestaurant, error: existingError } = await membership.supabase
    .from("restaurants")
    .select("id")
    .eq("google_place_id", placeId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existingRestaurant?.id) {
    restaurantId = existingRestaurant.id;
  } else {
    let details;

    try {
      details = await fetchPlaceDetailsFromGoogle(placeId, sessionToken);
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Unable to fetch place details",
        },
        { status: 500 }
      );
    }

    const { data: insertedRestaurant, error: insertError } = await membership.supabase
      .from("restaurants")
      .insert(details)
      .select("id")
      .single();

    if (insertError) {
      const { data: racedRestaurant, error: racedError } = await membership.supabase
        .from("restaurants")
        .select("id")
        .eq("google_place_id", placeId)
        .maybeSingle();

      if (racedError || !racedRestaurant?.id) {
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 }
        );
      }

      restaurantId = racedRestaurant.id;
    } else {
      restaurantId = insertedRestaurant.id;
    }
  }

  const { data: existingSaved, error: existingSavedError } = await membership.supabase
    .from("group_restaurants")
    .select("restaurant_id")
    .eq("group_id", groupId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (existingSavedError) {
    return NextResponse.json({ error: existingSavedError.message }, { status: 500 });
  }

  if (!existingSaved) {
    const { error: attachError } = await membership.supabase
      .from("group_restaurants")
      .insert({
        group_id: groupId,
        restaurant_id: restaurantId,
      });

    if (attachError) {
      const { data: racedSaved, error: racedSavedError } = await membership.supabase
        .from("group_restaurants")
        .select("restaurant_id")
        .eq("group_id", groupId)
        .eq("restaurant_id", restaurantId)
        .maybeSingle();

      if (racedSavedError || !racedSaved) {
        return NextResponse.json({ error: attachError.message }, { status: 500 });
      }
    }
  }

  if (overall != null || nutrition != null) {
    const { error: ratingError } = await membership.supabase
      .from("restaurant_ratings")
      .upsert({
        restaurant_id: restaurantId,
        user_id: membership.userId,
        overall,
        nutrition,
      });

    if (ratingError) {
      return NextResponse.json({ error: ratingError.message }, { status: 500 });
    }
  }

  if (costLevel != null) {
    const { error: costError } = await membership.supabase.rpc(
      "set_group_restaurant_cost_override",
      {
        p_group_id: groupId,
        p_restaurant_id: restaurantId,
        p_cost_level: costLevel,
      }
    );

    if (costError) {
      return NextResponse.json({ error: costError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    saved: true,
    restaurant_id: restaurantId,
    place_id: placeId,
  });
}
