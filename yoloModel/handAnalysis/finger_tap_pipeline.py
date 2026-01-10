import os
import sys
import pandas as pd
import subprocess
import tempfile
import json
from Features import extract_features
import joblib

# ---- CONFIG ----
LEFT_MODEL_PATH = os.path.join(os.path.dirname(__file__), "best_model_left_hand.pkl")
RIGHT_MODEL_PATH = os.path.join(os.path.dirname(__file__), "best_model_right_hand.pkl")

selected_features = [
    "accel_std",
    "angle_fft_entropy",
    "interruptions",
    "longest_freeze",
    "period_r2",
    "bradykinesia_score",
    "slow_speed_ratio"
]

def run_hand_analysis(video_path, output_dir):
    subprocess.run([
        sys.executable, os.path.join(os.path.dirname(__file__), "hand_analysis.py"), video_path, output_dir
    ], check=True)

def extract_selected_features(csv_path, selected_features):
    df = pd.read_csv(csv_path)
    features = extract_features(df, "Angle", csv_path)
    available_features = [f for f in selected_features if f in features]
    if not available_features:
        raise ValueError("No valid features available for prediction.")
    X = pd.DataFrame([features])[available_features]
    return X

def predict_with_model(X, model_path):
    X = X.fillna(X.mean()).fillna(0)
    loaded = joblib.load(model_path)
    
    if isinstance(loaded, dict):
        model = loaded.get('model')
        scaler = loaded.get('scaler')
    else:
        model = loaded
        scaler = None

    if hasattr(model, "feature_names_in_"):
        X = pd.DataFrame(X.values, columns=model.feature_names_in_)

    if scaler is not None and hasattr(scaler, "transform"):
        X = scaler.transform(X)

    if hasattr(model, "predict_proba"):
        prob = model.predict_proba(X)[0, 1]
    else:
        prob = model.predict(X)[0]
    
    return float(prob)

def main(video_path):
    result = {
        "leftHand": {},
        "rightHand": {}
    }

    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            output_dir = os.path.join(temp_dir, "output")
            os.makedirs(output_dir, exist_ok=True)
            
            run_hand_analysis(video_path, output_dir)
            
            video_name = os.path.splitext(os.path.basename(video_path))[0]
            left_csv = os.path.join(output_dir, f"{video_name}_left.csv")
            right_csv = os.path.join(output_dir, f"{video_name}_right.csv")

            # --- Left Hand ---
            if os.path.exists(left_csv) and os.path.getsize(left_csv) > 0:
                try:
                    df_temp = pd.read_csv(left_csv)
                    if len(df_temp) > 10:
                        left_X = extract_selected_features(left_csv, selected_features)
                        left_prob = predict_with_model(left_X, LEFT_MODEL_PATH)
                        result["leftHand"]["probability"] = left_prob
                        result["leftHand"]["prediction"] = bool(left_prob > 0.3)
                    else:
                        result["leftHand"]["message"] = "Left hand detected but data is too sparse for prediction."
                except pd.errors.EmptyDataError:
                    result["leftHand"]["message"] = "No left hand detected in the video."
            else:
                result["leftHand"]["message"] = "No left hand detected in the video."

            # --- Right Hand ---
            if os.path.exists(right_csv) and os.path.getsize(right_csv) > 0:
                try:
                    df_temp = pd.read_csv(right_csv)
                    if len(df_temp) > 10:
                        right_X = extract_selected_features(right_csv, selected_features)
                        right_prob = predict_with_model(right_X, RIGHT_MODEL_PATH)
                        result["rightHand"]["probability"] = right_prob
                        result["rightHand"]["prediction"] = bool(right_prob > 0.3)
                    else:
                        result["rightHand"]["message"] = "Right hand detected but data is too sparse for prediction."
                except pd.errors.EmptyDataError:
                    result["rightHand"]["message"] = "No right hand detected in the video."
            else:
                result["rightHand"]["message"] = "No right hand detected in the video."

    except Exception as e:
        result = {
            "error": str(e)
        }

    print(json.dumps(result, indent=4, ensure_ascii=False))

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Finger Tapping Full Pipeline")
    parser.add_argument("video_path", help="Path to video file")
    args = parser.parse_args()
    main(args.video_path)

