import express, { Request, Response } from "express";
import morgan from "morgan";
import cors from "cors";
import { config } from "./config/config.js";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use(
  cors({
    origin: config.CORS_ORIGIN,
    credentials: true,
  }),
);

app.get("/", (req: Request, res: Response) => {
  res.send("Hello from server");
});

import authRoutes from "./modules/auth/auth.routes.js";
import documentRoutes from "./modules/documents/document.routes.js";
import chatRoutes from "./modules/chat/chat.routes.js";

app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/chat", chatRoutes);

export default app;
