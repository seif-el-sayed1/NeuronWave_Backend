const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");
const Analysis = require("../models/analysis.model");
const capitalizeFirstLetter = require("./capitalizeFirstLetter");

const ARABIC_FONT = path.join(__dirname, "../fonts/Amiri-Regular.ttf");
const LOGO_PATH = path.join(__dirname, "../uploads/images/logo.png");

const camelCaseToNormal = (text) => {
  return text
    .replace(/([A-Z])/g, ' $1')   
    .replace(/^./, c => c.toUpperCase());
};


const generateAnalysisPDF = async (analysisId) => {
    const analysis = await Analysis.findById(analysisId)
        .populate("patient", "fullName")
        .populate("doctor", "fullName")
        .lean();

    if (!analysis) {
        throw new Error("Analysis not found");
    }

    const doc = new PDFDocument({
        size: "A4",
        margin: 60,
        info: { Title: "Analysis Report" }
    });

    const buffers = [];
    doc.on("data", buffers.push.bind(buffers));

    if (fs.existsSync(ARABIC_FONT)) {
        doc.registerFont("ArabicFont", ARABIC_FONT);
    }

    const PRIMARY_COLOR = "#2563eb";

    /* ===== Page Border ===== */
    const drawBorder = () => {
        doc
            .lineWidth(2)
            .strokeColor("#cccccc")
            .rect(40, 40, doc.page.width - 80, doc.page.height - 80)
            .stroke();
    };
    drawBorder();
    doc.on("pageAdded", drawBorder);

    /* ===== Header (Logo) ===== */
    if (fs.existsSync(LOGO_PATH)) {
        const logoSize = 120;
        const logoX = doc.page.width / 2 - logoSize / 2;
        const logoY = 60;
        doc.image(LOGO_PATH, logoX, logoY, { width: logoSize });
    }

    doc.y = 60 + 120 + 10;

    /* ===== Info Box ===== */
    const boxX = 60;
    const boxWidth = 480;
    const infoBoxHeight = 140;
    const infoBoxY = doc.y;

    doc.lineWidth(2).roundedRect(boxX, infoBoxY, boxWidth, infoBoxHeight, 12).stroke("#93c5fd");

    const createdAt = new Date(analysis.createdAt).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });

    const labelX = boxX + 20;
    const valueX = boxX + 150;

    doc.fontSize(12).fillColor("#111").font("Helvetica-Bold").text("Date & Time:", labelX, infoBoxY + 15);
    doc.font("Helvetica").text(createdAt, valueX, infoBoxY + 15);

    doc.font("Helvetica-Bold").text("Doctor:", labelX, infoBoxY + 40);
    doc.font("Helvetica").text(analysis.doctor?.fullName || "N/A", valueX, infoBoxY + 40);

    doc.font("Helvetica-Bold").text("Patient:", labelX, infoBoxY + 65);
    doc.font("Helvetica").text(analysis.patient?.fullName || "N/A", valueX, infoBoxY + 65);

    doc.font("Helvetica-Bold").text("Analysis Type:", labelX, infoBoxY + 90);
    const normalText = camelCaseToNormal(analysis.modelType);
    doc.font("Helvetica")
      .text(normalText, valueX, infoBoxY + 90);

      /* ===== Consultation Box ===== */
    const consultationText = analysis.consultation || "No consultation provided.";
    const hasArabic = /[\u0600-\u06FF]/.test(consultationText);

    const startY = infoBoxY + infoBoxHeight + 30;

    const padding = 20;
    const textWidth = boxWidth - padding * 2;

    doc.font(hasArabic && fs.existsSync(ARABIC_FONT) ? "ArabicFont" : "Helvetica").fontSize(12);

    const consultationHeight = doc.heightOfString(consultationText, {
        width: textWidth,
        align: hasArabic ? "right" : "justify",
        lineGap: 6,
        features: hasArabic ? ["rlig", "calt"] : undefined 
    });

    const titleHeight = 30; 
    const consultBoxHeight = consultationHeight + titleHeight + padding * 2;

    const consultBoxY = startY;

    doc.lineWidth(1.5).roundedRect(boxX, consultBoxY, boxWidth, consultBoxHeight, 12)
        .stroke("#e5e7eb");

    doc.fontSize(14)
        .fillColor(PRIMARY_COLOR)
        .font("Helvetica-Bold")
        .text("Consultation:", boxX + padding, consultBoxY + padding);

    const textStartY = consultBoxY + padding + titleHeight;

    if (hasArabic && fs.existsSync(ARABIC_FONT)) {
        doc.font("ArabicFont")
            .fontSize(12)
            .fillColor("#333")
            .text(consultationText, boxX + padding, textStartY, {
                width: textWidth,
                align: "right",
                direction: "rtl",
                lineGap: 6
            });
    } else {
        doc.font("Helvetica")
            .fontSize(12)
            .fillColor("#333")
            .text(consultationText, boxX + padding, textStartY, {
                width: textWidth,
                align: "justify",
                lineGap: 6
            });
    }

    doc.y = consultBoxY + consultBoxHeight + 30;

    doc.end();

    return new Promise((resolve) => {
        doc.on("end", () => {
            resolve(Buffer.concat(buffers));
        });
    });
};

module.exports = {
    generateAnalysisPDF
};