const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");
const Analysis = require("../models/analysis.model");
const Appointment = require("../models/appointment.model");

const ARABIC_FONT = path.join(__dirname, "../fonts/Amiri-Regular.ttf");
const LOGO_PATH = path.join(__dirname, "../uploads/images/logo.png");

const camelCaseToNormal = (text) => {
  return text
    .replace(/([A-Z])/g, ' $1')   
    .replace(/^./, c => c.toUpperCase());
};
// Helper function to process Arabic text for PDF (same logic as fixArabic)
const processArabicText = (text) => {
  const hasArabic = /[\u0600-\u06FF]/.test(text);
  if (!hasArabic) {
    return text;
  }
  
  // Simply reverse word order, don't reverse characters
  return text.split(" ").reverse().join(" ");
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
        margin: 50,
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
            .lineWidth(1.5)
            .strokeColor("#cccccc")
            .rect(30, 30, doc.page.width - 60, doc.page.height - 60)
            .stroke();
    };
    drawBorder();
    doc.on("pageAdded", drawBorder);

    /* ===== Header (Logo) ===== */
    if (fs.existsSync(LOGO_PATH)) {
        const logoSize = 80;
        const logoX = doc.page.width / 2 - logoSize / 2;
        const logoY = 45;
        doc.image(LOGO_PATH, logoX, logoY, { width: logoSize });
    }

    doc.y = 45 + 80 + 10;

    /* ===== Info Box ===== */
    const boxX = 50;
    const boxWidth = doc.page.width - 100;
    const hasVideo = analysis.media && analysis.media.length > 0;
    const infoBoxHeight = hasVideo ? 140 : 120;
    const infoBoxY = doc.y;

    doc.lineWidth(1.5).roundedRect(boxX, infoBoxY, boxWidth, infoBoxHeight, 10).stroke("#93c5fd");

    const createdAt = new Date(analysis.createdAt).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });

    const labelX = boxX + 15;
    const valueX = boxX + 130;

    doc.fontSize(10).fillColor("#111").font("Helvetica-Bold").text("Date & Time:", labelX, infoBoxY + 12);
    doc.font("Helvetica").text(createdAt, valueX, infoBoxY + 12);

    doc.font("Helvetica-Bold").text("Doctor:", labelX, infoBoxY + 32);
    doc.font("Helvetica").text(analysis.doctor?.fullName || "N/A", valueX, infoBoxY + 32);

    doc.font("Helvetica-Bold").text("Patient:", labelX, infoBoxY + 52);
    doc.font("Helvetica").text(analysis.patient?.fullName || "N/A", valueX, infoBoxY + 52);

    doc.font("Helvetica-Bold").text("Analysis Type:", labelX, infoBoxY + 72);
    const normalText = camelCaseToNormal(analysis.modelType);
    doc.font("Helvetica").text(normalText, valueX, infoBoxY + 72);

    if (hasVideo) {
        let videoUrl = analysis.media[0];
        if (!videoUrl.startsWith('http')) {
            const backendUrl = process.env.BACKEND_URL.endsWith('/') 
                ? process.env.BACKEND_URL.slice(0, -1) 
                : process.env.BACKEND_URL;
            const mediaPath = videoUrl.startsWith('/') ? videoUrl : `/${videoUrl}`;
            videoUrl = `${backendUrl}${mediaPath}`;
        }

        doc.font("Helvetica-Bold").fillColor("#111").text("Video:", labelX, infoBoxY + 92);
        
        const linkText = "Click here";
        
        doc.font("Helvetica")
            .fillColor(PRIMARY_COLOR)
            .text(linkText, valueX, infoBoxY + 92, {
                link: videoUrl,
                underline: true
            });
        
        doc.fillColor("#111");
    }

    doc.y = infoBoxY + infoBoxHeight + 15;

    /* ===== Result Box (for handAnalysis only) ===== */
    if (analysis.modelType === 'handAnalysis' && analysis.result && analysis.result.length > 0) {
        const resultData = analysis.result[0];
        const resultBoxY = doc.y;
        const padding = 15;
        
        const hands = ['leftHand', 'rightHand'];
        let handCount = 0;
        hands.forEach(hand => {
            if (resultData[hand]) {
                handCount++;
            }
        });
        
        const resultBoxHeight = 55 + (handCount * 50);

        doc.lineWidth(1.5)
            .roundedRect(boxX, resultBoxY, boxWidth, resultBoxHeight, 10)
            .stroke("#93c5fd");

        doc.fontSize(12)
            .fillColor(PRIMARY_COLOR)
            .font("Helvetica-Bold")
            .text("Analysis Result:", boxX + padding, resultBoxY + padding);

        const resultLabelX = boxX + padding;
        const resultValueX = boxX + 180;
        let currentY = resultBoxY + padding + 25;

        hands.forEach(hand => {
            if (resultData[hand]) {
                const handData = resultData[hand];
                const handName = hand === 'leftHand' ? 'Left Hand' : 'Right Hand';
                
                doc.fontSize(10)
                    .fillColor("#111")
                    .font("Helvetica-Bold")
                    .text(`${handName}:`, resultLabelX, currentY);
                
                currentY += 16;

                doc.fontSize(9)
                    .fillColor("#555")
                    .font("Helvetica-Bold")
                    .text("Prediction:", resultLabelX + 15, currentY);

                const predictionStatus = handData.prediction ? "Positive" : "Negative";
                const predictionColor = handData.prediction ? "#dc2626" : "#16a34a";

                doc.font("Helvetica")
                    .fillColor(predictionColor)
                    .text(predictionStatus, resultValueX, currentY);

                currentY += 16;

                doc.fillColor("#555")
                    .font("Helvetica-Bold")
                    .text("Probability:", resultLabelX + 15, currentY);

                const probability = (handData.probability * 100).toFixed(2);

                doc.font("Helvetica")
                    .fillColor(PRIMARY_COLOR)
                    .text(`${probability}%`, resultValueX, currentY);

                currentY += 18;
            }
        });

        doc.fillColor("#111");
        doc.y = resultBoxY + resultBoxHeight + 15;
    }

    /* ===== Consultation Box ===== */
    const consultationText = analysis.consultation || "No consultation provided.";
    const hasArabic = /[\u0600-\u06FF]/.test(consultationText);

    const startY = doc.y;

    const padding = 15;
    const textWidth = boxWidth - padding * 2;

    // Process Arabic text for proper RTL display
    const processedText = hasArabic ? processArabicText(consultationText) : consultationText;

    doc.font(hasArabic && fs.existsSync(ARABIC_FONT) ? "ArabicFont" : "Helvetica").fontSize(10);

    const consultationHeight = doc.heightOfString(processedText, {
        width: textWidth,
        align: hasArabic ? "right" : "justify",
        lineGap: 4
    });

    const titleHeight = 25; 
    const consultBoxHeight = consultationHeight + titleHeight + padding * 2;

    const consultBoxY = startY;

    doc.lineWidth(1.5).roundedRect(boxX, consultBoxY, boxWidth, consultBoxHeight, 10)
        .stroke("#e5e7eb");

    doc.fontSize(12)
        .fillColor(PRIMARY_COLOR)
        .font("Helvetica-Bold")
        .text("Consultation:", boxX + padding, consultBoxY + padding);

    const textStartY = consultBoxY + padding + titleHeight;

    if (hasArabic && fs.existsSync(ARABIC_FONT)) {
        doc.font("ArabicFont")
            .fontSize(10)
            .fillColor("#333")
            .text(processedText, boxX + padding, textStartY, {
                width: textWidth,
                align: "right",
                lineGap: 4
            });
    } else {
        doc.font("Helvetica")
            .fontSize(10)
            .fillColor("#333")
            .text(processedText, boxX + padding, textStartY, {
                width: textWidth,
                align: "justify",
                lineGap: 4
            });
    }

    doc.y = consultBoxY + consultBoxHeight + 15;

    /* ===== Signatures Section ===== */
    const signatureWidth = 180;
    const doctorSignX = boxX;
    const patientSignX = doc.page.width - 50 - signatureWidth;
    const signatureLineY = doc.y;

    // Doctor Signature
    doc.fontSize(9)
        .fillColor("#111")
        .font("Helvetica-Bold")
        .text("Doctor Signature", doctorSignX, signatureLineY, { width: signatureWidth, align: "center" });

    doc.fontSize(10)
        .fillColor("#666")
        .font("Helvetica")
        .text("_".repeat(26), doctorSignX, signatureLineY + 16, { width: signatureWidth, align: "center" });

    // Patient Signature
    doc.fontSize(9)
        .fillColor("#111")
        .font("Helvetica-Bold")
        .text("Patient Signature", patientSignX, signatureLineY, { width: signatureWidth, align: "center" });

    doc.fontSize(10)
        .fillColor("#666")
        .font("Helvetica")
        .text("_".repeat(26), patientSignX, signatureLineY + 16, { width: signatureWidth, align: "center" });

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

    doc.y = infoBoxY + infoBoxHeight + 30;

    /* ===== Notes Box (if exists) ===== */
    if (appointment.notes) {
        const notesBoxY = doc.y;
        const padding = 20;
        const textWidth = boxWidth - padding * 2;

        const hasArabic = /[\u0600-\u06FF]/.test(appointment.notes);
        
        // Process Arabic text for proper RTL display
        const processedNotes = hasArabic ? processArabicText(appointment.notes) : appointment.notes;

        doc.font(hasArabic && fs.existsSync(ARABIC_FONT) ? "ArabicFont" : "Helvetica").fontSize(12);

        const notesHeight = doc.heightOfString(processedNotes, {
            width: textWidth,
            align: hasArabic ? "right" : "justify",
            lineGap: 6
        });

        const titleHeight = 30;
        const notesBoxHeight = notesHeight + titleHeight + padding * 2;

        doc.lineWidth(1.5)
            .roundedRect(boxX, notesBoxY, boxWidth, notesBoxHeight, 12)
            .stroke("#93c5fd");

        doc.fontSize(14)
            .fillColor(PRIMARY_COLOR)
            .font("Helvetica-Bold")
            .text("Notes:", boxX + padding, notesBoxY + padding);

        const textStartY = notesBoxY + padding + titleHeight;

        if (hasArabic && fs.existsSync(ARABIC_FONT)) {
            doc.font("ArabicFont")
                .fontSize(12)
                .fillColor("#333")
                .text(processedNotes, boxX + padding, textStartY, {
                    width: textWidth,
                    align: "right",
                    lineGap: 6
                });
        } else {
            doc.font("Helvetica")
                .fontSize(12)
                .fillColor("#333")
                .text(processedNotes, boxX + padding, textStartY, {
                    width: textWidth,
                    align: "justify",
                    lineGap: 6
                });
        }

        doc.y = notesBoxY + notesBoxHeight + 30;
    }

    /* ===== Rejection Reason Box (if exists) ===== */
    if (appointment.rejectionReason) {
        const reasonBoxY = doc.y;
        const padding = 20;
        const textWidth = boxWidth - padding * 2;

        const hasArabic = /[\u0600-\u06FF]/.test(appointment.rejectionReason);
        
        // Process Arabic text for proper RTL display
        const processedReason = hasArabic ? processArabicText(appointment.rejectionReason) : appointment.rejectionReason;

        doc.font(hasArabic && fs.existsSync(ARABIC_FONT) ? "ArabicFont" : "Helvetica").fontSize(12);

        const reasonHeight = doc.heightOfString(processedReason, {
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
                .text(processedReason, boxX + padding, textStartY, {
                    width: textWidth,
                    align: "right",
                    lineGap: 6
                });
        } else {
            doc.font("Helvetica")
                .fontSize(12)
                .fillColor("#333")
                .text(processedReason, boxX + padding, textStartY, {
                    width: textWidth,
                    align: "justify",
                    lineGap: 6
                });
        }

        doc.y = reasonBoxY + reasonBoxHeight + 30;
    }

    /* ===== Signatures Section ===== */
    const pageBottom = doc.page.height - 60;
    const signaturesY = Math.max(doc.y + 40, pageBottom - 100);

    // Check if we need a new page for signatures
    if (signaturesY + 80 > pageBottom) {
        doc.addPage();
        doc.y = 80;
    } else {
        doc.y = signaturesY;
    }

    const signatureWidth = 200;
    const doctorSignX = boxX;
    const patientSignX = doc.page.width - 60 - signatureWidth;
    const signatureLineY = doc.y;

    // Doctor Signature
    doc.fontSize(10)
        .fillColor("#111")
        .font("Helvetica-Bold")
        .text("Doctor Signature", doctorSignX, signatureLineY, { width: signatureWidth, align: "center" });

    doc.fontSize(11)
        .fillColor("#666")
        .font("Helvetica")
        .text("_".repeat(30), doctorSignX, signatureLineY + 20, { width: signatureWidth, align: "center" });

    // Patient Signature
    doc.fontSize(10)
        .fillColor("#111")
        .font("Helvetica-Bold")
        .text("Patient Signature", patientSignX, signatureLineY, { width: signatureWidth, align: "center" });

    doc.fontSize(11)
        .fillColor("#666")
        .font("Helvetica")
        .text("_".repeat(30), patientSignX, signatureLineY + 20, { width: signatureWidth, align: "center" });

    doc.end();

    return new Promise((resolve) => {
        doc.on("end", () => {
            resolve(Buffer.concat(buffers));
        });
    });
};

module.exports = { generateAnalysisPDF, generateAppointmentPDF };