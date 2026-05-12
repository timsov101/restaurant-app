"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CalendarDays, Check, Search, X } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import HistoryCuisine from "./HistoryCuisine";

type ManualAddStep = "restaurant" | "date" | "diners";

type SavedRestaurant = {
  id: string;
  name: string;
  address: string | null;
  primary_type: string | null;
};

type SavedRestaurantForGroupRow = {
  restaurant_id: string;
  name: string;
  address: string | null;
  primary_type: string | null;
};

type GroupMember = {
  user_id: string;
  role: string;
  display_name: string | null;
};

type ManualAddHistoryEventModalProps = {
  open: boolean;
  groupId: string;
  userId: string | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

function todayDateValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeSavedRestaurant(row: SavedRestaurantForGroupRow): SavedRestaurant {
  return {
    id: row.restaurant_id,
    name: row.name,
    address: row.address ?? null,
    primary_type: row.primary_type ?? null,
  };
}

function memberChipStyle(selected: boolean): React.CSSProperties {
  return {
    minHeight: 32,
    padding: "6px 14px",
    borderRadius: 999,
    border: selected ? "1px solid transparent" : "1px solid #93c5fd",
    background: selected ? "linear-gradient(90deg, #1d4ed8 0%, #2b58d0 100%)" : "white",
    color: selected ? "white" : "#1d4ed8",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxShadow: "0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.1)",
  };
}

function RestaurantOption({
  restaurant,
  selected,
  onSelect,
}: {
  restaurant: SavedRestaurant;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        width: "100%",
        borderRadius: 14,
        border: selected ? "2px solid #1d4ed8" : "1px solid #e5e7eb",
        background: "white",
        padding: 14,
        textAlign: "left",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        cursor: "pointer",
        boxShadow: selected
          ? "0 4px 12px rgba(29,78,216,0.14)"
          : "0 2px 8px rgba(17,24,39,0.06)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            lineHeight: "20px",
            color: "#111827",
            marginBottom: 4,
          }}
        >
          {restaurant.name}
        </div>
        <HistoryCuisine primaryType={restaurant.primary_type} />
        {restaurant.address ? (
          <div
            style={{
              marginTop: 4,
              fontSize: 12,
              lineHeight: "16px",
              color: "#6a7282",
            }}
          >
            {restaurant.address}
          </div>
        ) : null}
      </div>

      <span
        aria-hidden="true"
        style={{
          width: 24,
          height: 24,
          borderRadius: 999,
          border: selected ? "none" : "1px solid #d1d5dc",
          background: selected ? "#1d4ed8" : "white",
          color: "white",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "0 0 auto",
        }}
      >
        {selected ? <Check size={15} /> : null}
      </span>
    </button>
  );
}

export default function ManualAddHistoryEventModal({
  open,
  groupId,
  userId,
  onClose,
  onSaved,
}: ManualAddHistoryEventModalProps) {
  const [step, setStep] = useState<ManualAddStep>("restaurant");
  const [restaurants, setRestaurants] = useState<SavedRestaurant[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayDateValue());
  const [selectedMembers, setSelectedMembers] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const maxDate = todayDateValue();

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !groupId) return;

    let active = true;

    async function loadModalData() {
      setStep("restaurant");
      setSelectedRestaurantId(null);
      setSelectedDate(todayDateValue());
      setSelectedMembers({});
      setQuery("");
      setError(null);
      setLoading(true);

      const [restaurantResult, memberResult] = await Promise.all([
        supabase.rpc("saved_restaurants_for_group", { p_group_id: groupId }),
        supabase.rpc("members_for_group", { p_group_id: groupId }),
      ]);

      if (!active) return;

      setLoading(false);

      if (restaurantResult.error) {
        setError(restaurantResult.error.message);
        setRestaurants([]);
      } else {
        setRestaurants(
          ((restaurantResult.data ?? []) as SavedRestaurantForGroupRow[]).map(normalizeSavedRestaurant)
        );
      }

      if (memberResult.error) {
        setError(memberResult.error.message);
        setMembers([]);
        setSelectedMembers({});
      } else {
        const nextMembers = (memberResult.data ?? []) as GroupMember[];
        setMembers(nextMembers);
        setSelectedMembers(
          Object.fromEntries(nextMembers.map((member) => [member.user_id, true]))
        );
      }
    }

    void loadModalData();

    return () => {
      active = false;
    };
  }, [groupId, open]);

  const filteredRestaurants = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return restaurants;

    return restaurants.filter((restaurant) => {
      return (
        restaurant.name.toLowerCase().includes(normalizedQuery) ||
        (restaurant.address ?? "").toLowerCase().includes(normalizedQuery) ||
        (restaurant.primary_type ?? "").toLowerCase().includes(normalizedQuery)
      );
    });
  }, [query, restaurants]);

  const selectedMemberIds = useMemo(() => {
    return Object.entries(selectedMembers)
      .filter(([, selected]) => selected)
      .map(([memberId]) => memberId);
  }, [selectedMembers]);

  function goNext() {
    setError(null);

    if (step === "restaurant") {
      if (!selectedRestaurantId) {
        setError("Choose a restaurant before continuing.");
        return;
      }

      setStep("date");
      return;
    }

    if (step === "date") {
      if (!selectedDate || selectedDate > maxDate) {
        setError("Select today or a past date.");
        return;
      }

      setStep("diners");
    }
  }

  function goBack() {
    setError(null);

    if (step === "diners") {
      setStep("date");
      return;
    }

    if (step === "date") {
      setStep("restaurant");
    }
  }

  async function saveEvent() {
    if (!userId) {
      setError("Not signed in.");
      return;
    }

    if (!selectedRestaurantId) {
      setStep("restaurant");
      setError("Choose a restaurant before continuing.");
      return;
    }

    if (!selectedDate || selectedDate > maxDate) {
      setStep("date");
      setError("Select today or a past date.");
      return;
    }

    if (selectedMemberIds.length === 0) {
      setError("Select at least one diner.");
      return;
    }

    setSaving(true);
    setError(null);

    const { error: eventError } = await supabase.rpc("log_manual_dining_event", {
      p_group_id: groupId,
      p_restaurant_id: selectedRestaurantId,
      p_user_ids: selectedMemberIds,
      p_visited_on: selectedDate,
    });

    if (eventError) {
      setSaving(false);
      setError(eventError.message);
      return;
    }

    setSaving(false);
    await onSaved();
    onClose();
  }

  if (!open) return null;

  const title =
    step === "restaurant"
      ? "Which restaurant did you visit?"
      : step === "date"
        ? "When did you go?"
        : "Who was there?";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-history-title"
      onClick={() => {
        if (!saving) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 120,
        background: "rgba(17,24,39,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(430px, 100%)",
          maxHeight: "min(760px, calc(100vh - 24px))",
          background: "#fafafa",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.08)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            padding: "12px 12px 10px",
            background: "white",
            borderBottom: "1px solid rgba(0,0,0,0.08)",
            flex: "0 0 auto",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              marginBottom: 8,
            }}
          >
            <button
              type="button"
              onClick={goBack}
              disabled={step === "restaurant" || saving}
              aria-label="Back"
              title="Back"
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                border: "none",
                background: "transparent",
                color: step === "restaurant" ? "#d1d5dc" : "#4a5565",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: step === "restaurant" || saving ? "default" : "pointer",
              }}
            >
              <ArrowLeft size={20} />
            </button>

            <div style={{ display: "flex", gap: 6 }}>
              {(["restaurant", "date", "diners"] as ManualAddStep[]).map((stepName) => (
                <span
                  key={stepName}
                  aria-hidden="true"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: step === stepName ? "#1d4ed8" : "#d1d5dc",
                  }}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              aria-label="Close"
              title="Close"
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                border: "none",
                background: "transparent",
                color: "#4a5565",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: saving ? "default" : "pointer",
              }}
            >
              <X size={20} />
            </button>
          </div>

          <h2
            id="manual-history-title"
            style={{
              margin: 0,
              color: "#111827",
              fontSize: 20,
              lineHeight: "26px",
              fontWeight: 800,
              letterSpacing: 0,
              textAlign: "center",
            }}
          >
            {title}
          </h2>
        </header>

        <div
          style={{
            flex: "1 1 auto",
            overflowY: "auto",
            padding: "16px 20px 20px",
          }}
        >
          {step === "restaurant" ? (
            <>
              <p style={{ margin: "0 0 6px", fontSize: 14, lineHeight: "20px", color: "#4a5565" }}>
                Choose from restaurants saved for this group.
              </p>
              <p style={{ margin: "0 0 14px", fontSize: 12, lineHeight: "18px", color: "#6a7282" }}>
                Need a new restaurant? Add and rate it from the Restaurants tab first.
              </p>

              <div style={{ position: "relative", marginBottom: 12 }}>
                <Search
                  size={16}
                  color="#9ca3af"
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                  }}
                />
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search restaurants..."
                  style={{
                    width: "100%",
                    height: 40,
                    borderRadius: 10,
                    border: "1px solid transparent",
                    background: "#f3f4f6",
                    padding: query ? "0 44px 0 40px" : "0 12px 0 40px",
                    fontSize: 16,
                    color: "#111827",
                    outline: "none",
                  }}
                />
                {query ? (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => {
                      setQuery("");
                      searchInputRef.current?.focus();
                    }}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 28,
                      height: 28,
                      border: "none",
                      borderRadius: 999,
                      background: "transparent",
                      color: "#9ca3af",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </div>

              {loading ? (
                <div style={{ padding: 24, textAlign: "center", color: "#6a7282", fontSize: 14 }}>
                  Loading restaurants...
                </div>
              ) : filteredRestaurants.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "#6a7282", fontSize: 14 }}>
                  No saved restaurants found for this group.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {filteredRestaurants.map((restaurant) => (
                    <RestaurantOption
                      key={restaurant.id}
                      restaurant={restaurant}
                      selected={selectedRestaurantId === restaurant.id}
                      onSelect={() => {
                        setSelectedRestaurantId(restaurant.id);
                        setError(null);
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          ) : null}

          {step === "date" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  color: "#111827",
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                Visit date
                <span style={{ position: "relative" }}>
                  <CalendarDays
                    size={18}
                    color="#6a7282"
                    style={{
                      position: "absolute",
                      left: 14,
                      top: "50%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                    }}
                  />
                  <input
                    type="date"
                    value={selectedDate}
                    max={maxDate}
                    onChange={(event) => {
                      setSelectedDate(event.target.value);
                      setError(null);
                    }}
                    style={{
                      width: "100%",
                      height: 44,
                      borderRadius: 12,
                      border: "1px solid #d1d5dc",
                      background: "white",
                      padding: "0 12px 0 42px",
                      color: "#111827",
                      fontSize: 16,
                      outline: "none",
                    }}
                  />
                </span>
              </label>
            </div>
          ) : null}

          {step === "diners" ? (
            <>
              <p style={{ margin: "0 0 14px", fontSize: 14, lineHeight: "20px", color: "#4a5565" }}>
                Tap diners to mark them as not attending.
              </p>

              {members.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "#6a7282", fontSize: 14 }}>
                  No diners found for this group.
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {members.map((member) => {
                    const selected = Boolean(selectedMembers[member.user_id]);
                    return (
                      <button
                        key={member.user_id}
                        type="button"
                        onClick={() => {
                          setSelectedMembers((current) => ({
                            ...current,
                            [member.user_id]: !selected,
                          }));
                          setError(null);
                        }}
                        style={memberChipStyle(selected)}
                      >
                        {member.display_name ?? "Unknown"}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : null}
        </div>

        <footer
          style={{
            flex: "0 0 auto",
            padding: 16,
            background: "white",
            borderTop: "1px solid rgba(0,0,0,0.08)",
          }}
        >
          {error ? (
            <div style={{ marginBottom: 10, color: "#be123c", fontSize: 13, lineHeight: "18px" }}>
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={step === "diners" ? saveEvent : goNext}
            disabled={saving || loading}
            style={{
              width: "100%",
              minHeight: 44,
              borderRadius: 12,
              border: "none",
              background: "#1d4ed8",
              color: "white",
              fontSize: 15,
              fontWeight: 700,
              cursor: saving || loading ? "default" : "pointer",
              opacity: saving || loading ? 0.7 : 1,
            }}
          >
            {step === "diners" ? (saving ? "Saving..." : "Save event") : "Next"}
          </button>
        </footer>
      </div>
    </div>
  );
}
