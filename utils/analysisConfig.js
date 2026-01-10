// utils/analysisConfig.js
const path = require('path');

const ANALYSIS_CONFIG = {
    handAnalysis: {
        scriptRelativePath: 'handAnalysis/finger_tap_pipeline.py',
        allowedExtensions: ['.mp4', '.mov', '.avi'],
        requiredMediaCount: 1,
        tempExt: '.mp4',
        validation: (file) => {
        const ext = path.extname(file.originalname).toLowerCase();
        return ANALYSIS_CONFIG.hand.allowedExtensions.includes(ext);
        },
    },
};

module.exports = ANALYSIS_CONFIG;