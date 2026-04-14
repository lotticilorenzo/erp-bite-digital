import { useContext } from "react";
import { StudioContext } from "@/context/StudioContext";

export function useStudio() {
  const context = useContext(StudioContext);
  if (context === undefined) {
    throw new Error("useStudio must be used within a StudioProvider");
  }
  return context;
}
