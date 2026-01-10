const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const ANALYSIS_CONFIG = require('./analysisConfig');

async function runPythonAnalysis(modelType, filePath, originalName, isVideo = false) {
    const config = ANALYSIS_CONFIG[modelType];
  
    if (!config) {
        throw new Error(`Analysis type not supported: ${modelType}`);
    }

    const ext = path.extname(originalName || filePath).toLowerCase();
    if (!config.allowedExtensions.includes(ext)) {
        throw new Error(`File type not supported for ${modelType}. Allowed: ${config.allowedExtensions.join(', ')}`);
    }

    let scriptRelativePath = config.scriptRelativePath;
    if (typeof scriptRelativePath === 'function') {
        scriptRelativePath = scriptRelativePath(isVideo ? 'video' : 'image');
    }

    const pythonScriptPath = path.join(__dirname, '..', 'yoloModel', scriptRelativePath);

    console.log("Running Python script: ".green + pythonScriptPath.yellow.bold);
    if (!await fs.access(pythonScriptPath).then(() => true).catch(() => false)) {
        throw new Error(`Script not found: ${pythonScriptPath}`);
    }

    const command = `python -B "${pythonScriptPath}" "${filePath}"`; 

    return new Promise((resolve, reject) => {
        exec(command, { maxBuffer: 1024 * 1024 * 10 }, async (error, stdout, stderr) => {
            try {
                await fs.unlink(filePath).catch(() => {});
            } catch (e) {
                console.warn('Failed to delete temporary file:', e.message);
            }


            if (error) {
                return reject(new Error(`Failed to run analysis: ${stderr || error.message}`));
            }

            try {
                const firstBrace = stdout.indexOf('{');
                const lastBrace = stdout.lastIndexOf('}');
                if (firstBrace === -1 || lastBrace === -1) {
                    throw new Error('No JSON found in Python output.');
                }

                const jsonString = stdout.slice(firstBrace, lastBrace + 1);
                const result = JSON.parse(jsonString);
                resolve(result);
            } catch (parseError) {
                reject(new Error(`Failed to parse Python output (invalid JSON):\n${stdout}\n${parseError.message}`));
            }
        });
    });
}

module.exports = runPythonAnalysis;
