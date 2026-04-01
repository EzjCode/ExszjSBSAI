import { Router, type IRouter } from "express";
import { db, spielsTable } from "@workspace/db";
import { CreateSpielBody, UpdateSpielBody, UpdateSpielParams, DeleteSpielParams } from "@workspace/api-zod";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/spiels", async (req, res) => {
  try {
    const spiels = await db.select().from(spielsTable).orderBy(spielsTable.createdAt);
    res.json(spiels);
  } catch (err) {
    req.log.error({ err }, "Failed to list spiels");
    res.status(500).json({ error: "Failed to list spiels" });
  }
});

router.post("/spiels", async (req, res) => {
  try {
    const body = CreateSpielBody.parse(req.body);
    const [created] = await db.insert(spielsTable).values(body).returning();
    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "Failed to create spiel");
    res.status(400).json({ error: "Failed to create spiel" });
  }
});

router.put("/spiels/:id", async (req, res) => {
  try {
    const { id } = UpdateSpielParams.parse({ id: Number(req.params.id) });
    const body = UpdateSpielBody.parse(req.body);
    const updateData: Partial<typeof spielsTable.$inferInsert> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.content !== undefined) updateData.content = body.content;
    const [updated] = await db.update(spielsTable).set(updateData).where(eq(spielsTable.id, id)).returning();
    if (!updated) {
      return res.status(404).json({ error: "Spiel not found" });
    }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update spiel");
    res.status(400).json({ error: "Failed to update spiel" });
  }
});

router.delete("/spiels/:id", async (req, res) => {
  try {
    const { id } = DeleteSpielParams.parse({ id: Number(req.params.id) });
    const deleted = await db.delete(spielsTable).where(eq(spielsTable.id, id)).returning();
    if (!deleted.length) {
      return res.status(404).json({ error: "Spiel not found" });
    }
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete spiel");
    res.status(500).json({ error: "Failed to delete spiel" });
  }
});

export default router;
