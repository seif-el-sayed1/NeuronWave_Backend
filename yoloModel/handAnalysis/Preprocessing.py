import os
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from scipy.signal import savgol_filter, find_peaks

# --------- CONFIG ---------
BASE_DIR = "F:/Dataset_fingertapping - Mediapipe/Dataset__FT"
INPUT_DIRS = ['Normal/Cleaned', 'Abnormal/Cleaned']
OUTPUT_DIR = 'Preprocessing'
ANGLE_COL = 'Angle'
SMOOTHED_SG = 'Angle_savgol'

# Savitzky-Golay filter params
WINDOW_LENGTH = 11
POLYORDER = 3
PEAK_DIST = 5

def savitzky_golay_filter(signal, window_length=WINDOW_LENGTH, polyorder=POLYORDER):
    """
    Apply Savitzky-Golay filter to smooth the signal while preserving peak characteristics.
    
    Args:
        signal: Input signal array
        window_length: Length of the filter window (must be odd)
        polyorder: Order of the polynomial used to fit the samples
    
    Returns:
        Smoothed signal
    """
    # Ensure window_length is odd
    if window_length % 2 == 0:
        window_length += 1
    
    return savgol_filter(signal, window_length, polyorder)

def process_file(filepath, outpath, show_plot=False):
    df = pd.read_csv(filepath)
    df.columns = df.columns.str.strip()

    print(f"\nProcessing {filepath}")

    if ANGLE_COL not in df.columns:
        print(f"ERROR: Column '{ANGLE_COL}' not found in {filepath}. Skipping.")
        return

    # Ensure Timestamp exists and is numeric
    if 'Timestamp' not in df.columns:
        print(f"WARNING: 'Timestamp' not found. Using DataFrame index as x-axis.")
        df['Timestamp'] = df.index
    else:
        df['Timestamp'] = pd.to_numeric(df['Timestamp'], errors='coerce')
        if df['Timestamp'].isnull().all() or df['Timestamp'].std() == 0:
            df['Timestamp'] = df.index

    # Smoothing with Savitzky-Golay filter
    df[SMOOTHED_SG] = savitzky_golay_filter(df[ANGLE_COL].fillna(0).values)
    
    # Use Savitzky-Golay smoothed signal for peak detection
    peaks_sg, _ = find_peaks(df[SMOOTHED_SG], distance=PEAK_DIST)

    # Trimming (use Savitzky-Golay peaks)
    if len(peaks_sg) >= 2:
        first, last = peaks_sg[0], peaks_sg[-1]
        df_trimmed = df.iloc[first:last+1].copy()
    else:
        df_trimmed = df.copy()

    # Save
    os.makedirs(os.path.dirname(outpath), exist_ok=True)
    df_trimmed.to_csv(outpath, index=False)
    print(f"Saved: {outpath}")

def process_all():
    # Track plotted examples for each class and hand
    plotted_examples = {
        'Normal': {'left': 0, 'right': 0},
        'Abnormal': {'left': 0, 'right': 0}
    }
    
    for indir in INPUT_DIRS:
        class_name = indir.split('/')[0]
        infolder = os.path.join(BASE_DIR, indir)
        outfolder = os.path.join(BASE_DIR, OUTPUT_DIR, indir)
        
        for fname in sorted(os.listdir(infolder)):
            if fname.endswith('.csv'):
                inpath = os.path.join(infolder, fname)
                outpath = os.path.join(outfolder, fname)
                
                # Determine hand type from filename
                hand_type = 'left' if 'left' in fname.lower() else 'right'
                
                # Show plot if we haven't shown 2 examples for this class and hand
                show_plot = plotted_examples[class_name][hand_type] < 2
                
                process_file(inpath, outpath, show_plot=show_plot)
                
                if show_plot:
                    plotted_examples[class_name][hand_type] += 1

if __name__ == '__main__':
    process_all()
