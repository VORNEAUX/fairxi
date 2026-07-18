import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

export const fmtDate = (iso) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

export const teamColors = [
  { name: "Team 1", chip: "bg-[#CCFF00] text-black", ring: "border-[#CCFF00]" },
  { name: "Team 2", chip: "bg-white text-black", ring: "border-white" },
  { name: "Team 3", chip: "bg-[#FF7A00] text-black", ring: "border-[#FF7A00]" },
  { name: "Team 4", chip: "bg-[#00E5FF] text-black", ring: "border-[#00E5FF]" },
];
