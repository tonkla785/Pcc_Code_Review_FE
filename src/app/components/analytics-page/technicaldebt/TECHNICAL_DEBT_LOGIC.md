# Technical Debt Calculation Logic / หลักการคำนวณ Technical Debt

This document explains the logic used to calculate "Debt by Category" and determining the severity of "Top Debt Projects".
เอกสารนี้อธิบายหลักการที่ใช้ในการคำนวณ "Debt by Category" (หนี้แบ่งตามหมวดหมู่) และการกำหนดระดับความรุนแรงของ "Top Debt Projects" (โปรเจกต์ที่มีหนี้สูงสุด)

---

## 1. Debt by Category / หนี้ทางเทคนิคแบ่งตามหมวดหมู่

The system calculates a "Score" for each category based on metrics from the latest scan of all projects, calculates the Total Key Score, and then distributes it as a percentage.
ระบบจะคำนวณ "คะแนน (Score)" ของแต่ละหมวดหมู่โดยอิงจาก Metrics ที่ได้จากการสแกนล่าสุดของทุกโปรเจกต์ นำมารวมเป็นคะแนนรวม (Total Score) แล้วคิดเป็นเปอร์เซ็นต์สัดส่วน

### Formula Details / รายละเอียดสูตรคำนวณ

Each category accumulates points as follows:
แต่ละหมวดหมู่จะสะสมคะแนนดังนี้:

#### 1. Security (ความปลอดภัย)
*   **Source Metrics**: `Vulnerabilities`, `Security Hotspots`
*   **Formula**:
    ```math
    Score = (Vulnerabilities × 10) + (Security Hotspots × 3)
    ```
    *   10 points per Vulnerability (10 คะแนนต่อช่องโหว่)
    *   3 points per Security Hotspot (3 คะแนนต่อจุดเสี่ยง)

#### 2. Code Quality (คุณภาพโค้ด)
*   **Source Metrics**: `Bugs`, `Code Smells`
*   **Formula**:
    ```math
    Score = (Bugs × 5) + (Code Smells × 1)
    ```
    *   5 points per Bug (5 คะแนนต่อบั๊ก)
    *   1 point per Code Smell (1 คะแนนต่อ Code Smell)

#### 3. Test Coverage (ความครอบคลุมของการทดสอบ)
*   **Source Metrics**: `Coverage %`
*   **Formula**:
    Calculated from the "Gap" ensuring 100% coverage.
    คำนวณจาก "ช่องว่าง" ที่ขาดไปจาก 100%
    ```math
    Gap = 100 - Coverage
    Score = Gap × 5
    ```
    *   5 points for every 1% missing coverage (5 คะแนนต่อทุกๆ 1% ที่ขาดหายไป)

#### 4. Architecture (สถาปัตยกรรม)
*   **Source Metrics**: `Duplicated Lines Density %`
*   **Formula**:
    ```math
    Score = Duplicated Lines Density × 5
    ```
    *   5 points per 1% of duplication (5 คะแนนต่อทุกๆ 1% ของโค้ดที่ซ้ำซ้อน)

#### 5. Documentation (เอกสาร)
*   **Source Metrics**: Number of Projects (จำนวนโปรเจกต์)
*   **Formula**:
    ```math
    Score = Total Projects × 10
    ```
    *   Baseline debt of 10 points per project (สมมติว่าเป็นหนี้พื้นฐาน 10 คะแนนต่อโปรเจกต์)

### Percentage Calculation / การคำนวณเปอร์เซ็นต์
The percentage for each category is calculated by:
เปอร์เซ็นต์ของแต่ละหมวดหมู่คำนวณจาก:
```math
Category % = (Category Score / Total Score) × 100
```

---

## 2. Top Debt Projects Severity / ความรุนแรงของโปรเจกต์ที่มีหนี้สะสม

The severity level (High, Medium, Low) is determined by a calculated **Score** derived from the technical debt time (in days) and the financial cost.
ระดับความรุนแรง (สูง, กลาง, ต่ำ) ถูกกำหนดโดย **Score (คะแนน)** ที่คำนวณจากเวลาที่เป็นหนี้ (หน่วยวัน) และต้นทุนทางการเงิน

### step 1: Convert Time to Days / แปลงเวลาเป็นวัน
Code assumes 1 working day = 8 hours (480 minutes).
ระบบกำหนดให้ 1 วันทำงาน = 8 ชั่วโมง (480 นาที)
```math
Days = Technical Debt Minutes / 480
```

### Step 2: Calculate Severity Score / คำนวณคะแนนความรุนแรง
The score creates a weighted value balancing time debt and monetary cost.
คะแนนนี้เป็นการถ่วงน้ำหนักระหว่างเวลาที่เป็นหนี้กับต้นทุนที่เป็นตัวเงิน
```math
Score = (Days × 2) + (Cost / 50,000)
```
*   **Days × 2**: Time debt is weighted by a factor of 2 (ให้ความสำคัญกับเวลาเป็น 2 เท่า)
*   **Cost / 50,000**: Every 50,000 units of cost adds 1 point (ทุกๆ 50,000 หน่วยของต้นทุน เพิ่ม 1 คะแนน)

### Step 3: Determine Severity Level / กำหนดระดับความรุนแรง

| Score Range (ช่วงคะแนน) | Severity (ความรุนแรง) | Color (สี) |
| :--- | :--- | :--- |
| **Score >= 10** | **High (สูง)** | Red (แดง) |
| **5 <= Score < 10** | **Med (กลาง)** | Orange (ส้ม) |
| **Score < 5** | **Low (ต่ำ)** | Green (เขียว) |
