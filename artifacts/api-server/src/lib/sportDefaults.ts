import type { SportField } from "@workspace/db/schema";

interface SportDef {
  icon: string;
  fields: SportField[];
}

export const DEFAULT_SPORT_CONFIGS: Record<string, SportDef> = {
  Cricket: {
    icon: "circle",
    fields: [
      { key: "runs", label: "Runs Scored", type: "int", section: "Batting", min: 0 },
      { key: "balls", label: "Balls Faced", type: "int", section: "Batting", min: 0 },
      { key: "fours", label: "Fours", type: "int", section: "Batting", min: 0 },
      { key: "sixes", label: "Sixes", type: "int", section: "Batting", min: 0 },
      { key: "strike_rate", label: "Strike Rate", type: "float", section: "Batting", auto: true },
      { key: "overs", label: "Overs Bowled", type: "float", section: "Bowling", min: 0 },
      { key: "maiden", label: "Maiden Overs", type: "int", section: "Bowling", min: 0 },
      { key: "runs_given", label: "Runs Given", type: "int", section: "Bowling", min: 0 },
      { key: "wickets", label: "Wickets", type: "int", section: "Bowling", min: 0 },
      { key: "economy_rate", label: "Economy Rate", type: "float", section: "Bowling", auto: true },
    ],
  },
  Basketball: {
    icon: "circle-dot",
    fields: [
      { key: "points", label: "Total Points", type: "int", min: 0 },
      { key: "two_points", label: "2-Pointers", type: "int", min: 0 },
      { key: "three_points", label: "3-Pointers", type: "int", min: 0 },
      { key: "assists", label: "Assists", type: "int", min: 0 },
      { key: "rebounds", label: "Rebounds", type: "int", min: 0 },
      { key: "fouls", label: "Fouls", type: "int", min: 0 },
    ],
  },
  Volleyball: {
    icon: "layers",
    fields: [
      { key: "attacks", label: "Attacks", type: "int", min: 0 },
      { key: "kills", label: "Kills", type: "int", min: 0 },
      { key: "errors", label: "Errors", type: "int", min: 0 },
      { key: "hitting_pct", label: "Hitting %", type: "float", auto: true },
    ],
  },
  Football: {
    icon: "zap",
    fields: [
      { key: "goals", label: "Goals", type: "int", min: 0 },
      { key: "shots", label: "Shots", type: "int", min: 0 },
      { key: "passes", label: "Passes", type: "int", min: 0 },
      { key: "tackles", label: "Tackles", type: "int", min: 0 },
      { key: "fouls", label: "Fouls", type: "int", min: 0 },
    ],
  },
  Swimming: {
    icon: "waves",
    fields: [
      { key: "event", label: "Event Name", type: "text", placeholder: "e.g. Freestyle, Butterfly" },
      { key: "distance", label: "Distance", type: "text", placeholder: "e.g. 100m, 200m" },
      { key: "swim_time", label: "Finish Time", type: "text", placeholder: "e.g. 1:05.23" },
      { key: "swim_rank", label: "Rank/Position", type: "int", min: 1 },
    ],
  },
  Athletics: {
    icon: "footprints",
    fields: [
      { key: "event", label: "Event", type: "text", placeholder: "e.g. 100m Sprint, Long Jump", section: "Event Details" },
      { key: "finish_time", label: "Finish Time", type: "text", placeholder: "e.g. 10.45s", section: "Track" },
      { key: "distance", label: "Distance (m)", type: "float", min: 0, section: "Field" },
      { key: "height", label: "Height (m)", type: "float", min: 0, section: "Field" },
      { key: "rank", label: "Final Rank", type: "int", min: 1, section: "Result" },
      { key: "personal_best", label: "Personal Best?", type: "text", placeholder: "Yes / No", section: "Result" },
    ],
  },
  Boxing: {
    icon: "shield",
    fields: [
      { key: "rounds", label: "Rounds Fought", type: "int", min: 1 },
      { key: "knockdowns", label: "Knockdowns", type: "int", min: 0 },
      { key: "punches_landed", label: "Punches Landed", type: "int", min: 0 },
      { key: "punches_thrown", label: "Punches Thrown", type: "int", min: 0 },
      { key: "accuracy_pct", label: "Accuracy %", type: "float", auto: true },
      { key: "result", label: "Match Result", type: "text", placeholder: "Win / Loss / Draw / KO" },
    ],
  },
  Badminton: {
    icon: "arrow-left-right",
    fields: [
      { key: "sets_won", label: "Sets Won", type: "int", min: 0 },
      { key: "sets_lost", label: "Sets Lost", type: "int", min: 0 },
      { key: "points_won", label: "Total Points Won", type: "int", min: 0 },
      { key: "smashes", label: "Smashes", type: "int", min: 0 },
      { key: "aces", label: "Aces", type: "int", min: 0 },
      { key: "result", label: "Match Result", type: "text", placeholder: "Win / Loss" },
    ],
  },
  Tennis: {
    icon: "circle",
    fields: [
      { key: "sets_won", label: "Sets Won", type: "int", min: 0 },
      { key: "sets_lost", label: "Sets Lost", type: "int", min: 0 },
      { key: "games_won", label: "Games Won", type: "int", min: 0 },
      { key: "aces", label: "Aces", type: "int", min: 0 },
      { key: "double_faults", label: "Double Faults", type: "int", min: 0 },
      { key: "winners", label: "Winners", type: "int", min: 0 },
      { key: "result", label: "Match Result", type: "text", placeholder: "Win / Loss" },
    ],
  },
  Kabaddi: {
    icon: "users",
    fields: [
      { key: "raid_points", label: "Raid Points", type: "int", min: 0 },
      { key: "tackle_points", label: "Tackle Points", type: "int", min: 0 },
      { key: "super_raids", label: "Super Raids", type: "int", min: 0 },
      { key: "super_tackles", label: "Super Tackles", type: "int", min: 0 },
      { key: "total_points", label: "Total Points", type: "int", auto: true },
    ],
  },
  Hockey: {
    icon: "minus",
    fields: [
      { key: "goals", label: "Goals", type: "int", min: 0 },
      { key: "assists", label: "Assists", type: "int", min: 0 },
      { key: "shots", label: "Shots on Goal", type: "int", min: 0 },
      { key: "tackles", label: "Tackles", type: "int", min: 0 },
      { key: "penalty_corners", label: "Penalty Corners", type: "int", min: 0 },
      { key: "yellow_cards", label: "Yellow Cards", type: "int", min: 0 },
    ],
  },
  Weightlifting: {
    icon: "dumbbell",
    fields: [
      { key: "snatch_weight", label: "Snatch (kg)", type: "float", min: 0 },
      { key: "clean_jerk_weight", label: "Clean & Jerk (kg)", type: "float", min: 0 },
      { key: "total_weight", label: "Total (kg)", type: "float", auto: true },
      { key: "rank", label: "Final Rank", type: "int", min: 1 },
    ],
  },
  Gymnastics: {
    icon: "star",
    fields: [
      { key: "floor_score", label: "Floor Score", type: "float", min: 0, section: "Events" },
      { key: "vault_score", label: "Vault Score", type: "float", min: 0, section: "Events" },
      { key: "bars_score", label: "Bars Score", type: "float", min: 0, section: "Events" },
      { key: "beam_score", label: "Beam Score", type: "float", min: 0, section: "Events" },
      { key: "total_score", label: "Total Score", type: "float", auto: true, section: "Result" },
      { key: "rank", label: "Final Rank", type: "int", min: 1, section: "Result" },
    ],
  },
  Archery: {
    icon: "target",
    fields: [
      { key: "round_name", label: "Round", type: "text", placeholder: "e.g. Qualification, Finals" },
      { key: "distance", label: "Distance (m)", type: "int", min: 0 },
      { key: "score", label: "Total Score", type: "int", min: 0 },
      { key: "x_count", label: "X Count (10X)", type: "int", min: 0 },
      { key: "rank", label: "Final Rank", type: "int", min: 1 },
    ],
  },
  Cycling: {
    icon: "bike",
    fields: [
      { key: "event", label: "Event", type: "text", placeholder: "e.g. Road Race, Sprint, TT" },
      { key: "distance_km", label: "Distance (km)", type: "float", min: 0 },
      { key: "time_seconds", label: "Time (seconds)", type: "float", min: 0 },
      { key: "speed_kmh", label: "Avg Speed (km/h)", type: "float", auto: true },
      { key: "rank", label: "Finish Position", type: "int", min: 1 },
    ],
  },
  Wrestling: {
    icon: "swords",
    fields: [
      { key: "result", label: "Match Result", type: "text", placeholder: "Win / Loss / Pin / Technical" },
      { key: "points", label: "Points Scored", type: "int", min: 0 },
      { key: "pins", label: "Pins", type: "int", min: 0 },
      { key: "takedowns", label: "Takedowns", type: "int", min: 0 },
      { key: "escapes", label: "Escapes", type: "int", min: 0 },
    ],
  },
};
