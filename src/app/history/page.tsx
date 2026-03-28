"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Search, Trash2 } from "lucide-react";

type Row = {
  event_id: string;
  chosen_at: string;
  group_id: string;
  group_name: string;
  restaurant_id: string;
  restaurant_name: string;
  restaurant_address: string | null;
  diners: string | null;
};

function formatWhen(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function HistoryPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function load() {
    setErr(null);
    setLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      window.location.href = "/auth?next=%2Fhistory";
      return;
    }

    const { data, error } = await supabase.rpc("history_for_user");
    setLoading(false);

    if (error) {
      setErr(error.message);
      setRows([]);
      return;
    }

    setRows((data ?? []) as Row[]);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      return (
        r.group_name.toLowerCase().includes(s) ||
        r.restaurant_name.toLowerCase().includes(s) ||
        (r.restaurant_address ?? "").toLowerCase().includes(s) ||
        (r.diners ?? "").toLowerCase().includes(s)
      );
    });
  }, [q, rows]);

  async function onDelete(eventId: string) {
    const ok = window.confirm("Delete this dining event? This cannot be undone.");
    if (!ok) return;

    setDeleting(eventId);
    setErr(null);

    const { error } = await supabase.rpc("delete_event", { p_event_id: eventId });
    setDeleting(null);

    if (error) {
      setErr(error.message);
      return;
    }

    await load();
  }

  return (
    <main style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 12 }}>History</div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          border: "2px solid #c7d2fe",
          borderRadius: 14,
          padding: "10px 12px",
          marginBottom: 12,
          background: "white",
        }}
      >
        <Search color="#6b7280" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search group, restaurant, diners…"
          style={{
            border: "none",
            outline: "none",
            width: "100%",
            fontSize: 16,
            fontWeight: 700,
            color: "#111827",
          }}
        />
      </div>

      {err && <div style={{ color: "crimson", marginBottom: 10 }}>{err}</div>}
      {loading ? (
        <div style={{ opacity: 0.7 }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ opacity: 0.7 }}>No completed dining events yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((r) => (
            <div
              key={r.event_id}
              style={{
                borderRadius: 18,
                padding: 16,
                background: "white",
                boxShadow: "0 10px 24px rgba(17,24,39,0.06)",
                border: "1px solid #eef2ff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>{r.restaurant_name}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#1d4ed8" }}>
                      {formatWhen(r.chosen_at)}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#6b7280" }}>
                      {r.group_name}
                    </div>
                  </div>

                  {r.restaurant_address && (
                    <div style={{ marginTop: 6, fontSize: 14, color: "#9ca3af", fontWeight: 700 }}>
                      {r.restaurant_address}
                    </div>
                  )}

                  <div style={{ marginTop: 10, color: "#6b7280", fontWeight: 800 }}>
                    Diners: {r.diners ?? "—"}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onDelete(r.event_id)}
                  disabled={deleting !== null}
                  title="Delete"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    border: "1px solid #fee2e2",
                    background: "#fff1f2",
                    color: "#be123c",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: deleting ? "default" : "pointer",
                    opacity: deleting && deleting !== r.event_id ? 0.4 : 1,
                    flex: "0 0 auto",
                  }}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
