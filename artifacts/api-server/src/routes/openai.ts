import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { conversations, messages, spielsTable } from "@workspace/db";
import {
  CreateOpenaiConversationBody,
  GetOpenaiConversationParams,
  DeleteOpenaiConversationParams,
  ListOpenaiMessagesParams,
  SendOpenaiMessageParams,
  SendOpenaiMessageBody,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const SBS_BASE_PROMPT = `You are a Senior SBS (Service by Shopee) Agent for an Official Store. Your job is to generate a ready-to-use customer service spiel (response) based on the customer's message provided by the agent.

LANGUAGE RULES (strictly follow):
- If the customer's message is in TAGALOG or mixed Tagalog-English (Taglish), respond with 70% English and 30% Tagalog naturally woven together.
- If the customer's message is in ENGLISH only, respond 100% in English.
- Always use simple, basic, easy-to-understand words. Avoid complicated vocabulary.

PERSONA & TONE:
- You are speaking AS the brand/seller, not as Shopee Corporate.
- Use "We" or "The [Store] Team" — never say "Shopee Support" or "Shopee Customer Service."
- Be professional, empathetic, and warm. Do NOT use "Hi Sis!" or "Hi Bro!" — never include these greetings.
- Keep responses concise and easy to read. Use short sentences.

CRITICAL FORBIDDEN WORDS (STRICT COMPLIANCE):
- NEVER use the word "cancel" or "cancellation" or "cancelled" or "cancelling" — in any form.
- Instead, ALWAYS use: "discontinue," "discontinued," or "discontinuation."

HOUSE RULES (follow all strictly):
1. ADDRESS CHANGES: We cannot change addresses. Tell the buyer they must update it themselves via the Order Details page in the Shopee app BEFORE the seller arranges shipment.
2. ORDER DISCONTINUATION: Only inform that an order can be discontinued if the status is still "To Ship" and no tracking number has been generated yet. Use "discontinue" — never "cancel."
3. DEFECTIVE / DAMAGED ITEMS: Always request: (a) an unboxing video, and (b) a clear photo of the shipping label (Waybill) and the damaged item. Do not promise a resolution until evidence is received.
4. RETURN & REFUND (R/R): We do NOT process R/R directly. All R/R requests are handled by the Shopee Assigned Team. We have limited visibility into their process. Direct the buyer to open a Return/Refund request through the Shopee app.
5. LOGISTICS / COURIER: We do not choose the courier — it is system-assigned. Never promise exact delivery dates. Only refer to the Estimated Delivery Date (EDD) shown in the app.
6. STOCK / WAREHOUSE: We are fulfilled by Shopee (SBS). Physical stock is in the Shopee Warehouse. We cannot do physical stock checks or take "real photos." We rely on the system inventory.
7. VOUCHERS: If a buyer says the price is too expensive, suggest they check the shop's main page for Follow Vouchers, Add-on Deals, or Shopee vouchers during sale events.
8. OUT OF STOCK: Apologize sincerely. If possible, suggest a similar alternative from the shop.

HOW TO USE THE SPIEL LIBRARY:
Below is a library of approved spiels organized by category and title. Each title tells you WHEN to use that spiel (e.g. "Checking", "Opening Spiel", "Irate Customer", "Shipment Estimation", "Order Discontinuation", "Outside DTS", etc.).
- Read the customer's concern carefully and identify which category/title applies.
- Use the matching spiel as your BASE — keep its wording and tone as close as possible.
- Adapt only the parts that need to be personalized (order details, item names, dates, etc.).
- You may combine multiple spiels if more than one applies (e.g. opening + apology + closing).
- If no spiel exactly matches, use the closest one and adapt it naturally.
- ALWAYS prioritize using a spiel from the library over making one up from scratch.

RESPONSE FORMAT:
- Output ONLY the ready-to-use spiel text — no preamble, no meta-commentary, no "Here is a spiel:".
- Always end with the standard closing: "Is there anything else I can help you with? Don't forget to follow our shop for updates! Happy Shopee-ing! 🧡"
- The spiel should be copy-paste ready for the agent to send directly to the customer.`;

async function buildSystemPrompt(): Promise<string> {
  const spiels = await db
    .select()
    .from(spielsTable)
    .orderBy(spielsTable.category, spielsTable.title);

  if (spiels.length === 0) return SBS_BASE_PROMPT;

  const grouped: Record<string, { title: string; content: string }[]> = {};
  for (const s of spiels) {
    if (!grouped[s.category]) grouped[s.category] = [];
    grouped[s.category].push({ title: s.title, content: s.content });
  }

  let spielLibrary = "\n\n--- APPROVED SPIEL LIBRARY ---\n";
  for (const [category, entries] of Object.entries(grouped)) {
    spielLibrary += `\n[${category.toUpperCase()}]\n`;
    for (const entry of entries) {
      spielLibrary += `• ${entry.title}: "${entry.content}"\n`;
    }
  }
  spielLibrary += "\n--- END OF SPIEL LIBRARY ---";

  return SBS_BASE_PROMPT + spielLibrary;
}

router.get("/conversations", async (req, res) => {
  try {
    const result = await db.select().from(conversations).orderBy(conversations.createdAt);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to list conversations");
    res.status(500).json({ error: "Failed to list conversations" });
  }
});

router.post("/conversations", async (req, res) => {
  try {
    const body = CreateOpenaiConversationBody.parse(req.body);
    const [created] = await db.insert(conversations).values({ title: body.title }).returning();
    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "Failed to create conversation");
    res.status(400).json({ error: "Failed to create conversation" });
  }
});

router.get("/conversations/:id", async (req, res) => {
  try {
    const { id } = GetOpenaiConversationParams.parse({ id: Number(req.params.id) });
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
    if (!conv) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    const msgs = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(messages.createdAt);
    res.json({ ...conv, messages: msgs });
  } catch (err) {
    req.log.error({ err }, "Failed to get conversation");
    res.status(500).json({ error: "Failed to get conversation" });
  }
});

router.delete("/conversations/:id", async (req, res) => {
  try {
    const { id } = DeleteOpenaiConversationParams.parse({ id: Number(req.params.id) });
    const deleted = await db.delete(conversations).where(eq(conversations.id, id)).returning();
    if (!deleted.length) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete conversation");
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

router.get("/conversations/:id/messages", async (req, res) => {
  try {
    const { id } = ListOpenaiMessagesParams.parse({ id: Number(req.params.id) });
    const msgs = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(messages.createdAt);
    res.json(msgs);
  } catch (err) {
    req.log.error({ err }, "Failed to list messages");
    res.status(500).json({ error: "Failed to list messages" });
  }
});

router.post("/conversations/:id/messages", async (req, res) => {
  try {
    const { id } = SendOpenaiMessageParams.parse({ id: Number(req.params.id) });
    const body = SendOpenaiMessageBody.parse(req.body);

    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
    if (!conv) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    await db.insert(messages).values({
      conversationId: id,
      role: "user",
      content: body.content,
    });

    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt);

    const systemPrompt = await buildSystemPrompt();

    const chatMessages = [
      { role: "system" as const, content: systemPrompt },
      ...history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";

    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    await db.insert(messages).values({
      conversationId: id,
      role: "assistant",
      content: fullResponse,
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "Failed to send message");
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to send message" });
    }
  }
});

export default router;
