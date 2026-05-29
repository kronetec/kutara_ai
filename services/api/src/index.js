import "dotenv/config"; import express from "express"; import cors from "cors"; import helmet from "helmet"; import { createRouter } from "./routes/index.js"; import { errorHandler } from "./middleware/errorHandler.js";
const app=express(); app.use(helmet()); app.use(cors({origin:["https://kutara.org","https://app.kutara.org"],credentials:true})); app.use(express.json({limit:"25mb"})); app.use("/api",createRouter()); app.use(errorHandler);
const PORT=process.env.API_PORT||8080; app.listen(PORT,"0.0.0.0",()=>{console.log(`Kutara AI API v2 on port ${PORT}`);});
