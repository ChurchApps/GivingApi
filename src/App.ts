import dotenv from "dotenv";
import "reflect-metadata";
import { Container } from "inversify";
import { InversifyExpressServer } from "inversify-express-utils";
import { bindings } from "./inversify.config";
import express from "express";
import { CustomAuthProvider } from "@churchapps/apihelper";
import cors from "cors";

export const init = async () => {
    dotenv.config();
    const container = new Container();
    await container.loadAsync(bindings);
    const app = new InversifyExpressServer(container, null, null, null, CustomAuthProvider);

    const configFunction = (expApp: express.Application) => {
        // Configure CORS first
        expApp.use(cors({
            origin: true,
            credentials: true,
            methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
            allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"]
        }));

        // Handle preflight requests early
        expApp.options("*", (req, res) => {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
            res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin");
            res.sendStatus(200);
        });

        // Handle body parsing from @codegenie/serverless-express
        expApp.use((req, res, next) => {
            const contentType = req.headers["content-type"] || "";

            // Special handling for webhook endpoint - ensure body remains as Buffer
            if (req.path.startsWith("/donate/webhook")) {
                // Convert various body formats to Buffer for Stripe signature verification
                if (Buffer.isBuffer(req.body)) {
                    // Already a Buffer, keep as is
                    return next();
                } else if (req.body && req.body.type === "Buffer" && Array.isArray(req.body.data)) {
                    // Convert Buffer-like object to actual Buffer
                    req.body = Buffer.from(req.body.data);
                    return next();
                } else if (typeof req.body === "string") {
                    // Convert string to Buffer
                    req.body = Buffer.from(req.body, "utf8");
                    return next();
                } else if (req.body) {
                    // If body exists but is not a Buffer, try to convert to string then Buffer
                    try {
                        const bodyString = JSON.stringify(req.body);
                        req.body = Buffer.from(bodyString, "utf8");
                    } catch (_e) {
                        req.body = Buffer.alloc(0);
                    }
                    return next();
                }
                // If no body, create empty Buffer
                req.body = Buffer.alloc(0);
                return next();
            }

            // Handle Buffer instances (most common case with serverless-express)
            if (Buffer.isBuffer(req.body)) {
                try {
                    const bodyString = req.body.toString("utf8");
                    if (contentType.includes("application/json")) {
                        req.body = JSON.parse(bodyString);
                    } else {
                        req.body = bodyString;
                    }
                } catch (_e) {
                    req.body = {};
                }
            }
            // Handle Buffer-like objects
            else if (req.body && req.body.type === "Buffer" && Array.isArray(req.body.data)) {
                try {
                    const bodyString = Buffer.from(req.body.data).toString("utf8");
                    if (contentType.includes("application/json")) {
                        req.body = JSON.parse(bodyString);
                    } else {
                        req.body = bodyString;
                    }
                } catch (_e) {
                    req.body = {};
                }
            }
            // Handle string JSON bodies
            else if (typeof req.body === "string" && req.body.length > 0) {
                try {
                    if (contentType.includes("application/json")) {
                        req.body = JSON.parse(req.body);
                    }
                } catch (_e) {
                    // Failed to parse string body as JSON - continue with original body
                }
            }

            next();
        });
    };

    const server = app.setConfig(configFunction).build();
    return server;
};
