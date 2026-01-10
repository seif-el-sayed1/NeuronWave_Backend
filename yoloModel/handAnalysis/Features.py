import os
import pandas as pd
import numpy as np
from scipy.signal import find_peaks
from scipy.stats import iqr, entropy as scipy_entropy
from scipy.fft import fft
from sklearn.linear_model import LinearRegression
import warnings

FRAME_RATE = 30
T_FRAME = 1 / FRAME_RATE

INPUT_FOLDERS = {
    'Normal': r'F:\Dataset_fingertapping - Mediapipe\Dataset__FT\Preprocessing\Normal\Cleaned',
    'Abnormal': r'F:\Dataset_fingertapping - Mediapipe\Dataset__FT\Preprocessing\Abnormal\Cleaned'
}
ANGLE_TYPES = [
    ('Angle_savgol', 'angle_savgol_features')
]

def calc_entropy(arr, bins=30):
    arr = arr[~np.isnan(arr)]
    if len(arr) < 2: return 0
    hist, _ = np.histogram(arr, bins=bins, density=True)
    hist = hist[hist > 0]
    return scipy_entropy(hist, base=2) if len(hist) else 0

def fft_entropy(arr):
    y = arr[~np.isnan(arr)]
    if len(y) < 2: return 0
    yf = np.abs(fft(y - np.mean(y)))
    power = np.square(yf[:len(yf)//2])
    norm_power = power / np.sum(power) if np.sum(power) > 0 else power
    norm_power = norm_power[norm_power > 0]
    return scipy_entropy(norm_power, base=2) if len(norm_power) else 0

def get_hand_label(filename):
    fname = filename.lower()
    if 'left' in fname:
        return 'left'
    elif 'right' in fname:
        return 'right'
    return 'unknown'

def analyze_tapping_rate_trend(periods):
    """
    Analyze if tapping rate becomes slower over time (important for PD detection)
    Returns trend analysis of tapping intervals
    """
    if len(periods) < 3 or np.isnan(periods).all():
        return np.nan, np.nan, np.nan, np.nan
    
    valid_periods = periods[~np.isnan(periods)]
    if len(valid_periods) < 3:
        return np.nan, np.nan, np.nan, np.nan
    
    # Calculate rate (1/period) for each tap
    rates = 1 / valid_periods
    
    # Split into first and second half
    mid_point = len(rates) // 2
    first_half = rates[:mid_point]
    second_half = rates[mid_point:]
    
    # Calculate rate change
    rate_change = np.mean(second_half) - np.mean(first_half)
    rate_change_percent = (rate_change / np.mean(first_half)) * 100 if np.mean(first_half) > 0 else np.nan
    
    # Linear regression on rates over time
    x = np.arange(len(rates)).reshape(-1, 1)
    lr = LinearRegression()
    lr.fit(x, rates)
    rate_slope = lr.coef_[0]
    rate_r2 = lr.score(x, rates)
    
    return rate_change, rate_change_percent, rate_slope, rate_r2

def analyze_amplitude_decline(peak_vals):
    """
    Analyze amplitude decline over time (bradykinesia indicator)
    Returns comprehensive amplitude decline analysis
    """
    if len(peak_vals) < 3 or np.isnan(peak_vals).all():
        return np.nan, np.nan, np.nan, np.nan, np.nan
    
    valid_amplitudes = peak_vals[~np.isnan(peak_vals)]
    if len(valid_amplitudes) < 3:
        return np.nan, np.nan, np.nan, np.nan, np.nan
    
    # Split into first and second half
    mid_point = len(valid_amplitudes) // 2
    first_half = valid_amplitudes[:mid_point]
    second_half = valid_amplitudes[mid_point:]
    
    # Calculate amplitude decline
    amp_decline = np.mean(second_half) - np.mean(first_half)
    amp_decline_percent = (amp_decline / np.mean(first_half)) * 100 if np.mean(first_half) > 0 else np.nan
    
    # Linear regression on amplitudes over time
    x = np.arange(len(valid_amplitudes)).reshape(-1, 1)
    lr = LinearRegression()
    lr.fit(x, valid_amplitudes)
    amp_slope = lr.coef_[0]
    amp_r2 = lr.score(x, valid_amplitudes)
    
    # Calculate coefficient of variation (consistency measure)
    amp_cv = np.std(valid_amplitudes) / np.mean(valid_amplitudes) if np.mean(valid_amplitudes) > 0 else np.nan
    
    return amp_decline, amp_decline_percent, amp_slope, amp_r2, amp_cv

def detect_bradykinesia(periods, amplitudes, speed):
    """
    Detect bradykinesia (slowness of movement) indicators
    Returns bradykinesia severity score and indicators
    """
    if len(periods) < 2 or np.isnan(periods).all():
        return np.nan, np.nan, np.nan, np.nan
    
    valid_periods = periods[~np.isnan(periods)]
    valid_amplitudes = amplitudes[~np.isnan(amplitudes)]
    valid_speed = speed[~np.isnan(speed)]
    
    # Normal thresholds (can be adjusted based on your data)
    slow_period_threshold = 0.5  # seconds
    low_amplitude_threshold = 0.3  # relative to max
    slow_speed_threshold = 50  # units per second
    
    # Calculate bradykinesia indicators
    slow_periods_ratio = np.sum(valid_periods > slow_period_threshold) / len(valid_periods) if len(valid_periods) > 0 else np.nan
    
    if len(valid_amplitudes) > 0:
        max_amp = np.max(valid_amplitudes)
        low_amplitude_ratio = np.sum(valid_amplitudes < (max_amp * low_amplitude_threshold)) / len(valid_amplitudes) if max_amp > 0 else np.nan
    else:
        low_amplitude_ratio = np.nan
    
    slow_speed_ratio = np.sum(valid_speed < slow_speed_threshold) / len(valid_speed) if len(valid_speed) > 0 else np.nan
    
    # Combined bradykinesia score (0-1, higher = more severe)
    bradykinesia_score = np.nanmean([slow_periods_ratio, low_amplitude_ratio, slow_speed_ratio])
    
    return bradykinesia_score, slow_periods_ratio, low_amplitude_ratio, slow_speed_ratio

def interruptions_and_freezing(speed, threshold=50, intv_frames=1, freeze_frames=2):
    below = np.where(speed < threshold)[0]
    if len(below) == 0:
        return 0, 0, 0
    breaks = np.split(below, np.where(np.diff(below) != 1)[0] + 1)
    interruptions = sum(len(b) >= intv_frames for b in breaks)
    freezing = [b for b in breaks if len(b) >= freeze_frames]
    num_freezing = len(freezing)
    max_freeze = max((len(b)*T_FRAME for b in freezing), default=0)
    return interruptions, num_freezing, max_freeze

def period_linearity(periods):
    if len(periods) < 2 or np.isnan(periods).all(): return 0, 0
    x = np.arange(len(periods)).reshape(-1,1)
    lr = LinearRegression()
    lr.fit(x, periods)
    r2 = lr.score(x, periods)
    slope = lr.coef_[0]
    return r2, slope

def period_poly_complexity(periods, target_r2=0.9, max_deg=10):
    if len(periods) < 2 or np.isnan(periods).all(): return 1
    x = np.arange(len(periods)).reshape(-1,1)
    from sklearn.preprocessing import PolynomialFeatures
    for deg in range(1, max_deg+1):
        poly = PolynomialFeatures(degree=deg)
        X_poly = poly.fit_transform(x)
        model = LinearRegression().fit(X_poly, periods)
        r2 = model.score(X_poly, periods)
        if r2 >= target_r2:
            return deg
    return max_deg

def amplitude_decrement(amplitudes):
    if len(amplitudes) < 2 or np.isnan(amplitudes).all(): return 0, 0, 0
    amplitudes = amplitudes[~np.isnan(amplitudes)]
    start = amplitudes[0]
    end = amplitudes[-1]
    mean_amp = np.mean(amplitudes)
    x = np.arange(len(amplitudes)).reshape(-1,1)
    lr = LinearRegression()
    lr.fit(x, amplitudes)
    slope = lr.coef_[0]
    return end - mean_amp, end - start, slope

def extract_features(df, angle_col, filename):
    res = {}
    if angle_col not in df.columns:
        print(f"WARNING: column '{angle_col}' missing in file {filename}. Skipping.")
        return None
    arr = df[angle_col].values
    n = len(arr)
    # Per-frame speed & accel
    speed = np.abs(np.diff(arr)) / T_FRAME
    speed = np.insert(speed, 0, np.nan)
    accel = np.abs(np.diff(speed)) / T_FRAME
    accel = np.insert(accel, 0, np.nan)
    # Remove wrist movement from features
    peaks, _ = find_peaks(arr, distance=5)
    peak_vals = arr[peaks] if len(peaks) else np.array([np.nan])
    periods = np.diff(peaks) * T_FRAME if len(peaks) > 1 else np.array([np.nan])
    freqs = 1/periods if len(periods) > 0 and not np.isnan(periods).all() else np.array([np.nan])
    
    # ULTRA-REDUCED FEATURES: Keep only essential features
    # Basic stats for angle only (most important)
    valid_angle = arr[~np.isnan(arr)]
    res['angle_mean'] = np.mean(valid_angle) if valid_angle.size else np.nan
    res['angle_std'] = np.std(valid_angle) if valid_angle.size else np.nan
    res['angle_entropy'] = calc_entropy(valid_angle) if valid_angle.size else np.nan
    
    # Speed features (important for movement assessment)
    valid_speed = speed[~np.isnan(speed)]
    res['speed_mean'] = np.mean(valid_speed) if valid_speed.size else np.nan
    res['speed_std'] = np.std(valid_speed) if valid_speed.size else np.nan
    
    # Acceleration features (important for movement dynamics)
    valid_accel = accel[~np.isnan(accel)]
    res['accel_mean'] = np.mean(valid_accel) if valid_accel.size else np.nan
    res['accel_std'] = np.std(valid_accel) if valid_accel.size else np.nan
    
    # FFT entropy for angle only
    res['angle_fft_entropy'] = fft_entropy(arr)
    
    # Key peak-based features
    valid_period = periods[~np.isnan(periods)]
    res['period_mean'] = np.mean(valid_period) if valid_period.size else np.nan
    res['period_std'] = np.std(valid_period) if valid_period.size else np.nan
    
    valid_amplitude = peak_vals[~np.isnan(peak_vals)]
    res['amplitude_mean'] = np.mean(valid_amplitude) if valid_amplitude.size else np.nan
    res['amplitude_std'] = np.std(valid_amplitude) if valid_amplitude.size else np.nan
    
    # Movement quality features (most important for PD detection)
    interruptions, num_freeze, max_freeze = interruptions_and_freezing(speed)
    res['interruptions'] = interruptions
    res['num_freezing'] = num_freeze
    res['longest_freeze'] = max_freeze
    
    # Period linearity (important for rhythm assessment)
    r2, slope = period_linearity(periods)
    res['period_r2'] = r2
    res['period_slope'] = slope
    
    # Amplitude decrement (important for fatigue detection)
    dec1, dec2, dec_slope = amplitude_decrement(peak_vals)
    res['amp_end_minus_start'] = dec2
    
    # NEW: Tapping rate trend analysis (slower tapping over time)
    rate_change, rate_change_percent, rate_slope, rate_r2 = analyze_tapping_rate_trend(periods)
    res['rate_change'] = rate_change
    res['rate_change_percent'] = rate_change_percent
    res['rate_slope'] = rate_slope
    res['rate_r2'] = rate_r2
    
    # NEW: Amplitude decline analysis (decreasing amplitude over time)
    amp_decline, amp_decline_percent, amp_slope, amp_r2, amp_cv = analyze_amplitude_decline(peak_vals)
    res['amp_decline'] = amp_decline
    res['amp_decline_percent'] = amp_decline_percent
    res['amp_slope'] = amp_slope
    res['amp_r2'] = amp_r2
    res['amp_cv'] = amp_cv
    
    # NEW: Bradykinesia detection (slowness of movement)
    bradykinesia_score, slow_periods_ratio, low_amp_ratio, slow_speed_ratio = detect_bradykinesia(periods, peak_vals, speed)
    res['bradykinesia_score'] = bradykinesia_score
    res['slow_periods_ratio'] = slow_periods_ratio
    res['low_amplitude_ratio'] = low_amp_ratio
    res['slow_speed_ratio'] = slow_speed_ratio
    
    res['hand_label'] = get_hand_label(filename)
    return res
