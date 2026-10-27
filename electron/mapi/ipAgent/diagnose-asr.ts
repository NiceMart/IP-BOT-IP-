/**
 * ASR诊断脚本
 * 用于诊断为什么语音识别失败
 */

import { Log } from "../log/main";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { getPythonPath } from "../../lib/python-util";
import { getPythonScriptPath } from "../../lib/resource-path";

export async function diagnoseASR(): Promise<{
    funasrHttpApiAvailable: boolean;
    pythonAvailable: boolean;
    pythonPath: string;
    pythonVersion: string | null;
    funasrPyLibAvailable: boolean;
    speechRecognitionAvailable: boolean;
    recommendedSolution: string;
    fullDiagnosis: any;
}> {
    const diagnosis: any = {};

    // 1. 检查FUNASR HTTP API
    try {
        Log.info("diagnose.checkFunasrHttpApi");
        const response = await fetch('http://localhost:10095/api/v1/recognize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                audio: '',
                language: 'zh'
            })
        });
        diagnosis.funasrHttpApiAvailable = true;
    } catch (e) {
        diagnosis.funasrHttpApiAvailable = false;
        diagnosis.funasrHttpApiError = (e as any)?.message || String(e);
    }

    // 2. 检查Python
    const pythonPath = getPythonPath();
    diagnosis.pythonPath = pythonPath;

    try {
        const pythonVersion = await new Promise<string>((resolve, reject) => {
            const proc = spawn(pythonPath, ['-V']);
            let output = '';
            proc.stdout?.on('data', (data) => {
                output += data.toString();
            });
            proc.stderr?.on('data', (data) => {
                output += data.toString();
            });
            proc.on('close', (code) => {
                if (code === 0) {
                    resolve(output.trim());
                } else {
                    reject(new Error(`Python exit code: ${code}`));
                }
            });
            proc.on('error', (err) => {
                reject(err);
            });
        });
        diagnosis.pythonAvailable = true;
        diagnosis.pythonVersion = pythonVersion;
    } catch (e) {
        diagnosis.pythonAvailable = false;
        diagnosis.pythonError = (e as any)?.message || String(e);
    }

    // 3. 检查Python库
    if (diagnosis.pythonAvailable) {
        try {
            const output = await new Promise<string>((resolve, reject) => {
                const proc = spawn(pythonPath, ['-m', 'pip', 'show', 'funasr']);
                let stdout = '';
                let stderr = '';
                proc.stdout?.on('data', (data) => {
                    stdout += data.toString();
                });
                proc.stderr?.on('data', (data) => {
                    stderr += data.toString();
                });
                proc.on('close', (code) => {
                    if (code === 0 && stdout.includes('Name: funasr')) {
                        resolve('available');
                    } else {
                        reject(new Error('not available'));
                    }
                });
            });
            diagnosis.funasrPyLibAvailable = true;
        } catch (e) {
            diagnosis.funasrPyLibAvailable = false;
        }

        try {
            await new Promise<string>((resolve, reject) => {
                const proc = spawn(pythonPath, ['-m', 'pip', 'show', 'SpeechRecognition']);
                let stdout = '';
                proc.stdout?.on('data', (data) => {
                    stdout += data.toString();
                });
                proc.on('close', (code) => {
                    if (code === 0 && stdout.includes('Name: SpeechRecognition')) {
                        resolve('available');
                    } else {
                        reject(new Error('not available'));
                    }
                });
            });
            diagnosis.speechRecognitionAvailable = true;
        } catch (e) {
            diagnosis.speechRecognitionAvailable = false;
        }
    }

    // 4. 检查Python脚本是否存在
    const pythonScriptPath = getPythonScriptPath('funasr_recognize.py');
    diagnosis.pythonScriptExists = fs.existsSync(pythonScriptPath);
    diagnosis.pythonScriptPath = pythonScriptPath;

    // 5. 生成建议
    let recommendedSolution = '';
    if (diagnosis.funasrHttpApiAvailable) {
        recommendedSolution = 'FUNASR HTTP API is running on localhost:10095. Retest the application.';
    } else if (diagnosis.funasrPyLibAvailable || diagnosis.speechRecognitionAvailable) {
        recommendedSolution = 'Python libraries are available. The system should work now.';
    } else if (diagnosis.pythonAvailable) {
        recommendedSolution = 'Python is available but missing FUNASR/SpeechRecognition libraries. Run: pip install funasr torch torchaudio (or pip install SpeechRecognition)';
    } else {
        recommendedSolution = 'Python is not available. Install Python 3.8+ first.';
    }

    Log.info("diagnose.asr.result", diagnosis);

    return {
        funasrHttpApiAvailable: diagnosis.funasrHttpApiAvailable || false,
        pythonAvailable: diagnosis.pythonAvailable || false,
        pythonPath,
        pythonVersion: diagnosis.pythonVersion || null,
        funasrPyLibAvailable: diagnosis.funasrPyLibAvailable || false,
        speechRecognitionAvailable: diagnosis.speechRecognitionAvailable || false,
        recommendedSolution,
        fullDiagnosis: diagnosis
    };
}
