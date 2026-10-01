import { supabase } from "./supabase";
import type { Schedule, Signup, Slot, Volunteer } from "./types";

export async function loadSchedule(slug: string) {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { data: schedule, error } = await supabase
    .from("schedules").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!schedule) return null;

  const [{ data: volunteers, error: vError }, { data: slots, error: sError }, { data: signups, error: gError }] =
    await Promise.all([
      supabase.from("volunteers").select("*").eq("active", true).order("sort_order"),
      supabase.from("slots").select("*").eq("schedule_id", schedule.id).order("service_date").order("period"),
      supabase.from("signups").select("*"),
    ]);

  if (vError) throw vError;
  if (sError) throw sError;
  if (gError) throw gError;

  return {
    schedule: schedule as Schedule,
    volunteers: (volunteers ?? []) as Volunteer[],
    slots: (slots ?? []) as Slot[],
    signups: (signups ?? []) as Signup[],
  };
}

export async function upsertSignup(slotId: string, volunteerId: string, checked: boolean) {
  if (!supabase) throw new Error("Supabase não configurado.");
  if (checked) {
    const { error } = await supabase.from("signups").insert({
      slot_id: slotId,
      volunteer_id: volunteerId
    });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("signups")
      .delete()
      .eq("slot_id", slotId)
      .eq("volunteer_id", volunteerId);
    if (error) throw error;
  }
}

export async function createSchedule(year: number, month: number, minSlots = 2) {
  if (!supabase) throw new Error("Supabase não configurado.");
  const slug = `${year}-${String(month).padStart(2, "0")}`;
  const { data, error } = await supabase
    .from("schedules")
    .insert({ slug, year, month, status: "open", min_slots: minSlots })
    .select().single();
  if (error) throw error;

  const sundays = [];
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) {
    if (d.getDay() === 0) {
      sundays.push(`${year}-${String(month).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }
    d.setDate(d.getDate() + 1);
  }

  const slots = sundays.flatMap(service_date => [
    { schedule_id: data.id, service_date, period: "morning" },
    { schedule_id: data.id, service_date, period: "evening" }
  ]);

  const { error: slotError } = await supabase.from("slots").insert(slots);
  if (slotError) throw slotError;
  return data as Schedule;
}

export async function updateScheduleStatus(id: string, status: "open" | "closed") {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { error } = await supabase.from("schedules").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function saveVolunteer(id: string | null, name: string, active = true) {
  if (!supabase) throw new Error("Supabase não configurado.");
  if (id) {
    const { error } = await supabase.from("volunteers").update({ name, active }).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("volunteers").insert({ name, active });
    if (error) throw error;
  }
}

export async function deleteVolunteer(id: string) {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { error } = await supabase.from("volunteers").update({ active: false }).eq("id", id);
  if (error) throw error;
}
