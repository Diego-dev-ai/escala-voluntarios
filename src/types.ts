export type ScheduleStatus = "open" | "closed";
export type Period = "morning" | "evening";

export type Volunteer = {
  id: string;
  name: string;
  active: boolean;
  sort_order: number;
  created_at?: string;
};

export type Schedule = {
  id: string;
  slug: string;
  year: number;
  month: number;
  status: ScheduleStatus;
  min_slots: number;
  created_at?: string;
};

export type Slot = {
  id: string;
  schedule_id: string;
  service_date: string;
  period: Period;
  created_at?: string;
};

export type Signup = {
  id: string;
  slot_id: string;
  volunteer_id: string;
  created_at?: string;
};

export type SignupWithNames = Signup & {
  volunteer?: Volunteer;
  slot?: Slot;
};
