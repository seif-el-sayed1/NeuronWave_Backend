const path = require("path");
const cors = require("cors");
const express = require("express");
const compression = require("compression");
const expressWinston = require("express-winston");
const { transports, format } = require("winston");
const AppRoutes = require("../routes/index.routes");
const globalError = require("../middlewares/error.middleware");
const passport = require("../config/passport.config");

module.exports = (app) => {
  // Middlewares
  app.use(cors());
  app.use(compression());
  
  app.use(express.json({ limit: "25kb" }));
  app.use(express.urlencoded({ extended: true, limit: "25kb" }));
  
  // Initialize Passport
  app.use(passport.initialize());
  
  app.use(
    "/uploads",
    express.static(path.join(process.cwd(), "uploads"))
  );

  // ✅ Enhanced Logging Middleware
  app.use((req, res, next) => {
    const method = req.method.toLowerCase();
    const path = req.path;
    
    // Log all requests
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📨 ${method.toUpperCase()} ${path}`);
    console.log(`${"=".repeat(60)}`);
    
    // Log headers for POST requests (important for callback!)
    if (method === "post" || method === "patch" || method === "delete") {
      console.log("📋 Headers:", JSON.stringify(req.headers, null, 2));
      
      if (req.files) {
        console.log("📎 Files:", req.files);
      }
      
      console.log("📦 Body:", JSON.stringify(req.body, null, 2));
    } else if (method === "get") {
      console.log("🔍 Query:", JSON.stringify(req.query, null, 2));
    }
    
    console.log(`${"=".repeat(60)}\n`);
    next();
  });

  // ✅ Special logging for payment callback (optional but helpful)
  app.use("/api/v1/payments/callback", (req, res, next) => {
    console.log("\n🔔 ===== PAYMENT CALLBACK INTERCEPTED =====");
    console.log("Full Request Details:");
    console.log("- Method:", req.method);
    console.log("- Path:", req.path);
    console.log("- Headers:", JSON.stringify(req.headers, null, 2));
    console.log("- Body:", JSON.stringify(req.body, null, 2));
    console.log("==========================================\n");
    next();
  });

  // All App Routes
  app.use(AppRoutes);

  const myLogFormat = format.printf(({ level, meta, timestamps }) => {
    return `${timestamps} ${level}: ${meta.message}`;
  });

  if (process.env.NODE_ENV !== "production") {
    app.use(
      expressWinston.errorLogger({
        transports: [
          new transports.File({
            filename: "1. logs/internalErrorLogs.log"
          })
        ],
        format: format.combine(
          format.errors({ stack: true }),
          format.json(),
          format.timestamp(),
          myLogFormat
        )
      })
    );
  } else {
    app.use(
      expressWinston.errorLogger({
        transports: [
          new transports.Console(),
          new transports.File({
            filename: path.join(__dirname, "1. logs", "app.log")
          })
        ],
        format: format.combine(
          format.errors({ stack: true }),
          format.json(),
          format.timestamp(),
          myLogFormat
        )
      })
    );
  }

  // Global Error Handler
  app.use(globalError);
};