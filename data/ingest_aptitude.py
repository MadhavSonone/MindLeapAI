import sys
import os

# Add the project root to the python path
sys.path.append(os.getcwd())

import csv
import json
from db.database import SessionLocal, engine, Base
from db import models


# Initialize DB
print("Connecting to database...")
try:
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully.")
except Exception as e:
    print(f"Error creating database tables: {e}")
    sys.exit(1)

APTITUDE_SYLLABUS = {
    "Quantitative Aptitude": [
        "Speed and Distance", "Geometry", "Trigonometry", "Algebra", 
        "Multiplication", "Area Calculations", "Volume Problems", 
        "Simple Interest", "Speed in still water", "Ratio", "Logarithms", 
        "Stock Market Pricing"
    ],
    "Logical Reasoning": [
        "Data Structures", "Time-Based Reasoning", "Number Patterns", 
        "Number Series", "Relative Motion", "Time Complexity", 
        "Probability", "Age-Related Reasoning"
    ],
    "Data Interpretation": ["Data Interpretation"]
}

def ingest_aptitude():
    db = SessionLocal()
    try:
        # 1. Ensure Exam exists
        exam_name = "Aptitude Test"
        db_exam = db.query(models.Exam).filter(models.Exam.name == exam_name).first()
        if not db_exam:
            db_exam = models.Exam(name=exam_name)
            db.add(db_exam)
            db.commit()
            db.refresh(db_exam)
            print(f"Created Exam: {exam_name}")

        # 2. Seed Subjects + Chapters
        subject_map = {}
        chapter_map = {}
        
        for sub_name, chapters in APTITUDE_SYLLABUS.items():
            db_sub = db.query(models.Subject).filter(models.Subject.name == sub_name, models.Subject.exam_id == db_exam.id).first()
            if not db_sub:
                db_sub = models.Subject(name=sub_name, exam_id=db_exam.id)
                db.add(db_sub)
                db.commit()
                db.refresh(db_sub)
            subject_map[sub_name] = db_sub
            
            for ch_name in chapters:
                db_ch = db.query(models.Chapter).filter(models.Chapter.name == ch_name, models.Chapter.subject_id == db_sub.id).first()
                if not db_ch:
                    db_ch = models.Chapter(name=ch_name, subject_id=db_sub.id, weightage=5) # Default weightage
                    db.add(db_ch)
                    db.commit()
                    db.refresh(db_ch)
                chapter_map[ch_name] = db_ch

        # 3. Parse CSV
        csv_path = "data/aptitude_dataset.csv"
        with open(csv_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            count = 0
            for row in reader:
                q_text = row['question'].strip()
                if not q_text: continue
                
                topic = row['topic'].strip()
                # Find chapter
                db_ch = chapter_map.get(topic)
                if not db_ch:
                    # Fallback to Uncategorized under Logical Reasoning
                    db_ch = db.query(models.Chapter).filter(models.Chapter.name == "Uncategorized", models.Chapter.subject_id == subject_map["Logical Reasoning"].id).first()
                    if not db_ch:
                        db_ch = models.Chapter(name="Uncategorized", subject_id=subject_map["Logical Reasoning"].id)
                        db.add(db_ch)
                        db.commit()
                        db.refresh(db_ch)

                options = [row['option_a'], row['option_b'], row['option_c'], row['option_d']]
                correct_map = {"A": 0, "B": 1, "C": 2, "D": 3}
                correct_idx = correct_map.get(row['answer'].strip().upper(), 0)
                correct_text = options[correct_idx]
                
                # Create Question
                db_q = models.Question(
                    content=q_text,
                    chapter_id=db_ch.id,
                    options_json=json.dumps(options),
                    correct_answer=correct_text
                )
                db.add(db_q)
                count += 1
            db.commit()
            print(f"Successfully ingested {count} questions for Aptitude Test.")

    except Exception as e:
        print(f"Error during ingestion: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    ingest_aptitude()
