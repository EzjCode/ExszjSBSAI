import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const spielsTable = pgTable("spiels", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSpielSchema = createInsertSchema(spielsTable).omit({ id: true, createdAt: true });
export type InsertSpiel = z.infer<typeof insertSpielSchema>;
export type Spiel = typeof spielsTable.$inferSelect;
