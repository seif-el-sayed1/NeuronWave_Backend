const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");
const Analysis = require("../models/analysis.model");
const Appointment = require("../models/appointment.model");
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
    const hasVideo = analysis.media && analysis.media.length > 0;
    const infoBoxHeight = hasVideo ? 165 : 140;
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
    doc.font("Helvetica").text(normalText, valueX, infoBoxY + 90);

    if (hasVideo) {
        let videoUrl = analysis.media[0];
        if (!videoUrl.startsWith('http')) {
            const backendUrl = process.env.BACKEND_URL.endsWith('/') 
                ? process.env.BACKEND_URL.slice(0, -1) 
                : process.env.BACKEND_URL;
            const mediaPath = videoUrl.startsWith('/') ? videoUrl : `/${videoUrl}`;
            videoUrl = `${backendUrl}${mediaPath}`;
        }

        doc.font("Helvetica-Bold").fillColor("#111").text("Video:", labelX, infoBoxY + 115);
        
        const linkText = "Click here";
        
        doc.font("Helvetica")
            .fillColor(PRIMARY_COLOR)
            .text(linkText, valueX, infoBoxY + 115, {
                link: videoUrl,
                underline: true
            });
        
        doc.fillColor("#111");
    }

    doc.y = infoBoxY + infoBoxHeight + 30;

    /* ===== Result Box (for handAnalysis only) ===== */
    if (analysis.modelType === 'handAnalysis' && analysis.result && analysis.result.length > 0) {
        const resultData = analysis.result[0];
        const resultBoxY = doc.y;
        const padding = 20;
        
        const hands = ['leftHand', 'rightHand'];
        let handCount = 0;
        hands.forEach(hand => {
            if (resultData[hand]) {
                handCount++;
            }
        });
        
        // Title (30) + padding top (20) + padding bottom (20) + each hand (65px)
        const resultBoxHeight = 70 + (handCount * 65);

        doc.lineWidth(1.5)
            .roundedRect(boxX, resultBoxY, boxWidth, resultBoxHeight, 12)
            .stroke("#93c5fd");

        doc.fontSize(14)
            .fillColor(PRIMARY_COLOR)
            .font("Helvetica-Bold")
            .text("Analysis Result:", boxX + padding, resultBoxY + padding);

        const resultLabelX = boxX + padding;
        const resultValueX = boxX + 200;
        let currentY = resultBoxY + padding + 30;

        // Loop through hands
        hands.forEach(hand => {
            if (resultData[hand]) {
                const handData = resultData[hand];
                const handName = hand === 'leftHand' ? 'Left Hand' : 'Right Hand';
                
                // Hand Title
                doc.fontSize(12)
                    .fillColor("#111")
                    .font("Helvetica-Bold")
                    .text(`${handName}:`, resultLabelX, currentY);
                
                currentY += 20;

                // Prediction
                doc.fontSize(11)
                    .fillColor("#555")
                    .font("Helvetica-Bold")
                    .text("Prediction:", resultLabelX + 20, currentY);

                const predictionStatus = handData.prediction ? "Positive" : "Negative";
                const predictionColor = handData.prediction ? "#dc2626" : "#16a34a";

                doc.font("Helvetica")
                    .fillColor(predictionColor)
                    .text(predictionStatus, resultValueX, currentY);

                currentY += 20;

                // Probability
                doc.fillColor("#555")
                    .font("Helvetica-Bold")
                    .text("Probability:", resultLabelX + 20, currentY);

                const probability = (handData.probability * 100).toFixed(2);

                doc.font("Helvetica")
                    .fillColor(PRIMARY_COLOR)
                    .text(`${probability}%`, resultValueX, currentY);

                currentY += 25;
            }
        });

        doc.fillColor("#111");
        doc.y = resultBoxY + resultBoxHeight + 30;
    }

    /* ===== Consultation Box ===== */
    const consultationText = analysis.consultation || "No consultation provided.";
    const hasArabic = /[\u0600-\u06FF]/.test(consultationText);

    const startY = doc.y;

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

const generateAppointmentPDF = async (appointmentId) => {
    const appointment = await Appointment.findById(appointmentId)
        .populate("patient", "fullName")
        .populate("doctor", "fullName")
        .lean();

    if (!appointment) {
        throw new Error("Appointment not found");
    }

    const doc = new PDFDocument({
        size: "A4",
        margin: 60,
        info: { Title: "Appointment Report" }
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

    /* ===== Title ===== */
    doc.fontSize(18)
        .fillColor(PRIMARY_COLOR)
        .font("Helvetica-Bold")
        .text("Appointment Details", 60, doc.y, { align: "center" });

    doc.y += 30;

    /* ===== Info Box ===== */
    const boxX = 60;
    const boxWidth = 480;
    const infoBoxHeight = 165;
    const infoBoxY = doc.y;

    doc.lineWidth(2).roundedRect(boxX, infoBoxY, boxWidth, infoBoxHeight, 12).stroke("#93c5fd");

    const appointmentDate = appointment.date 
        ? new Date(appointment.date).toLocaleString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric"
          })
        : "N/A";

    const labelX = boxX + 20;
    const valueX = boxX + 150;

    doc.fontSize(12).fillColor("#111").font("Helvetica-Bold").text("Doctor:", labelX, infoBoxY + 15);
    doc.font("Helvetica").text(appointment.doctor?.fullName || "N/A", valueX, infoBoxY + 15);

    doc.font("Helvetica-Bold").text("Patient:", labelX, infoBoxY + 40);
    doc.font("Helvetica").text(appointment.patient?.fullName || "N/A", valueX, infoBoxY + 40);

    doc.font("Helvetica-Bold").text("Date:", labelX, infoBoxY + 65);
    doc.font("Helvetica").text(appointmentDate, valueX, infoBoxY + 65);

    doc.font("Helvetica-Bold").text("Time:", labelX, infoBoxY + 90);
    doc.font("Helvetica").text(appointment.time || "N/A", valueX, infoBoxY + 90);

    doc.font("Helvetica-Bold").text("Type:", labelX, infoBoxY + 115);
    const typeText = camelCaseToNormal(appointment.type);
    doc.font("Helvetica").text(typeText, valueX, infoBoxY + 115);

    /* ===== Rejection Reason Box (if exists) ===== */
    if (appointment.rejectionReason) {
        const reasonBoxY = infoBoxY + infoBoxHeight + 30;
        const padding = 20;
        const textWidth = boxWidth - padding * 2;

        const hasArabic = /[\u0600-\u06FF]/.test(appointment.rejectionReason);

        doc.font(hasArabic && fs.existsSync(ARABIC_FONT) ? "ArabicFont" : "Helvetica").fontSize(12);

        const reasonHeight = doc.heightOfString(appointment.rejectionReason, {
            width: textWidth,
            align: hasArabic ? "right" : "justify",
            lineGap: 6
        });

        const titleHeight = 30;
        const reasonBoxHeight = reasonHeight + titleHeight + padding * 2;

        doc.lineWidth(1.5)
            .roundedRect(boxX, reasonBoxY, boxWidth, reasonBoxHeight, 12)
            .stroke("#fca5a5");

        doc.fontSize(14)
            .fillColor("#dc2626")
            .font("Helvetica-Bold")
            .text("Rejection Reason:", boxX + padding, reasonBoxY + padding);

        const textStartY = reasonBoxY + padding + titleHeight;

        if (hasArabic && fs.existsSync(ARABIC_FONT)) {
            doc.font("ArabicFont")
                .fontSize(12)
                .fillColor("#333")
                .text(appointment.rejectionReason, boxX + padding, textStartY, {
                    width: textWidth,
                    align: "right",
                    direction: "rtl",
                    lineGap: 6
                });
        } else {
            doc.font("Helvetica")
                .fontSize(12)
                .fillColor("#333")
                .text(appointment.rejectionReason, boxX + padding, textStartY, {
                    width: textWidth,
                    align: "justify",
                    lineGap: 6
                });
        }

        doc.y = reasonBoxY + reasonBoxHeight + 30;
    }

    doc.end();

    return new Promise((resolve) => {
        doc.on("end", () => {
            resolve(Buffer.concat(buffers));
        });
    });
};

module.exports = {
    generateAnalysisPDF,
    generateAppointmentPDF 
};