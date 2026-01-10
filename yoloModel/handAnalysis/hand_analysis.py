import cv2
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg') # FIX: Prevents empty images and backend errors
import matplotlib.pyplot as plt
from datetime import datetime
import os
from ultralytics import YOLO
import math
import mediapipe as mp

class HandAnalysis:
    def __init__(self, video_path, output_dir):
        self.video_path = video_path
        self.output_dir = os.path.abspath(output_dir) # Ensure absolute path
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=2,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.5
        )
        self.yolo_model = YOLO('yolov8n.pt')
        self.left_hand_data = []
        self.right_hand_data = []
        self.tracked_frames = {'Left': 0, 'Right': 0}
        self.total_frames = 0
        self.current_frame = 0

    def calculate_distance(self, p1, p2):
        return np.linalg.norm(np.array(p1) - np.array(p2))

    def detect_hands_yolo(self, frame):
        # Note: yolov8n detects 'person' (class 0). 
        # For better results, use a hand-specific YOLO model or just MediaPipe.
        results = self.yolo_model(frame, verbose=False)
        hand_boxes = []
        for r in results:
            for box in r.boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                hand_boxes.append((x1, y1, x2, y2))
        return hand_boxes

    def analyze_frame(self, frame):
        # If YOLO finds nothing, we still try MediaPipe on whole frame as fallback
        hand_boxes = self.detect_hands_yolo(frame)
        
        # Optimization: If YOLO found no boxes, process full frame once
        process_regions = hand_boxes if hand_boxes else [(0, 0, frame.shape[1], frame.shape[0])]

        for box in process_regions:
            x1, y1, x2, y2 = box
            hand_img = frame[y1:y2, x1:x2]
            if hand_img.size == 0: continue
            
            hand_img_rgb = cv2.cvtColor(hand_img, cv2.COLOR_BGR2RGB)
            results = self.hands.process(hand_img_rgb)
            
            if results.multi_hand_landmarks:
                for hand_idx, hand_landmarks in enumerate(results.multi_hand_landmarks):
                    handedness = results.multi_handedness[hand_idx].classification[0]
                    # Direct label use (remove the swap if detection is backwards)
                    hand_label = handedness.label 
                    
                    if handedness.score < 0.8: continue
                    
                    h_crop, w_crop, _ = hand_img.shape
                    mapped_landmarks = []
                    for lm in hand_landmarks.landmark:
                        cx = int(lm.x * w_crop) + x1
                        cy = int(lm.y * h_crop) + y1
                        mapped_landmarks.append((cx, cy))
                    
                    # Points for Tapping Analysis (0, 4, 8)
                    wrist = mapped_landmarks[0]
                    thumb_tip = mapped_landmarks[4]
                    index_tip = mapped_landmarks[8]
                    
                    # Math for Angle
                    wt = np.array(thumb_tip) - np.array(wrist)
                    wi = np.array(index_tip) - np.array(wrist)
                    norm_wt, norm_wi = np.linalg.norm(wt), np.linalg.norm(wi)
                    
                    if norm_wt > 0 and norm_wi > 0:
                        angle = math.degrees(math.acos(np.clip(np.dot(wt, wi)/(norm_wt*norm_wi), -1.0, 1.0)))
                        
                        data = {
                            'Frame': self.current_frame,
                            'Angle': angle,
                            'Distance': self.calculate_distance(index_tip, thumb_tip)
                        }
                        
                        if hand_label == "Left": self.left_hand_data.append(data)
                        else: self.right_hand_data.append(data)

    def run_analysis(self):
        cap = cv2.VideoCapture(self.video_path)
        self.total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret: break
            self.analyze_frame(frame)
            self.current_frame += 1
            if self.current_frame % 50 == 0:
                print(f"Processing... {self.current_frame}/{self.total_frames}")
        cap.release()
        self.save_results()
        self.save_hand_figures()

    def save_results(self):
        os.makedirs(self.output_dir, exist_ok=True)
        v_name = os.path.splitext(os.path.basename(self.video_path))[0]
        pd.DataFrame(self.left_hand_data).to_csv(os.path.join(self.output_dir, f"{v_name}_left.csv"), index=False)
        pd.DataFrame(self.right_hand_data).to_csv(os.path.join(self.output_dir, f"{v_name}_right.csv"), index=False)

    def save_hand_figures(self):
        v_name = os.path.splitext(os.path.basename(self.video_path))[0]
        for label, data in [('Left', self.left_hand_data), ('Right', self.right_hand_data)]:
            if not data:
                print(f"No data detected for {label} hand. Skipping image.")
                continue
            
            df = pd.DataFrame(data)
            plt.figure(figsize=(10, 5))
            plt.plot(df['Frame'], df['Angle'], color='blue' if label == 'Left' else 'green')
            plt.title(f'{label} Hand Tapping Analysis')
            plt.xlabel('Frame')
            plt.ylabel('Angle (degrees)')
            plt.grid(True)
            
            img_path = os.path.join(self.output_dir, f"{v_name}_{label.lower()}.png")
            plt.savefig(img_path, bbox_inches='tight', dpi=150)
            plt.close() # CRITICAL: Free memory
            print(f"Successfully saved image: {img_path}")

if __name__ == "__main__":
    
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("video_path")
    parser.add_argument("output_dir")
    args = parser.parse_args()
    
    analyzer = HandAnalysis(args.video_path, args.output_dir)
    analyzer.run_analysis()