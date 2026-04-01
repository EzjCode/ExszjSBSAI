import { Router, type IRouter } from "express";
import healthRouter from "./health";
import openaiRouter from "./openai";
import spielsRouter from "./spiels";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/openai", openaiRouter);
router.use(spielsRouter);

export default router;
