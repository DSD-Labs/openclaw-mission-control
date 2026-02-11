import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { AppRouter } from "./router";
import { Toaster } from "@/components/ui/toaster";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppRouter />
    <Toaster />
  </React.StrictMode>,
);
