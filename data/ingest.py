import sys
import os
import json
import re
from rapidfuzz import process, fuzz

# Add the project root to the python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from db.database import SessionLocal, engine, Base
from db.models import Subject, Chapter, Question, Exam

# Initialize DB
print("Connecting to database...")
try:
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully.")
except Exception as e:
    print(f"Error creating database tables: {e}")
    sys.exit(1)

SYLLABUS = {
    "physics": [
        "Physics and Measurement", "Kinematics", "Laws of Motion", "Work, Energy, and Power",
        "Rotational Motion", "Gravitation", "Properties of Solids and Liquids", "Thermodynamics",
        "Kinetic Theory of Gases", "Oscillations and Waves", "Electrostatics", "Current Electricity",
        "Magnetic Effects of Current and Magnetism", "Electromagnetic Induction and Alternating Currents",
        "Electromagnetic Waves", "Optics", "Dual Nature of Matter and Radiation", "Atoms and Nuclei",
        "Electronic Devices", "Experimental Skills"
    ],
    "chemistry": [
        "Some Basic Concepts in Chemistry", "Atomic Structure", "Chemical Bonding and Molecular Structure",
        "Chemical Thermodynamics", "Solutions", "Equilibrium", "Redox Reactions and Electrochemistry",
        "Chemical Kinetics", "Classification of Elements and Periodicity in Properties", "P-Block Elements",
        "d- and f-Block Elements", "Coordination Compounds", "Purification and Characterization of Organic Compounds",
        "Some Basic Principles of Organic Chemistry", "Hydrocarbons", "Organic Compounds Containing Halogens",
        "Organic Compounds Containing Oxygen", "Organic Compounds Containing Nitrogen", "Biomolecules"
    ],
    "maths": [
        "Sets, Relations, and Functions", "Complex Numbers and Quadratic Equations", "Matrices and Determinants",
        "Permutations and Combinations", "Binomial Theorem and Its Simple Applications", "Sequence and Series",
        "Limit, Continuity, and Differentiability", "Integral Calculus", "Differential Equations",
        "Co-ordinate Geometry", "Three-Dimensional Geometry", "Vector Algebra", "Statistics and Probability",
        "Trigonometry"
    ]
}

def clean_text(text: str) -> str:
    text = str(text).lower()
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    return text

def match_chapter(question_text, chapters, threshold=65):
    if not chapters:
        return None
    cleaned_q = clean_text(question_text)
    chapter_names = [clean_text(ch.name) for ch in chapters]
    match, score, idx = process.extractOne(cleaned_q, chapter_names, scorer=fuzz.partial_ratio)
    if score >= threshold:
        return chapters[idx]
    return None

def ingest_data(subset_limit=50):
    db = SessionLocal()
    try:
        # 1. Ensure Exam exists
        exam_name = "JEE Main"
        db_exam = db.query(Exam).filter(Exam.name == exam_name).first()
        if not db_exam:
            db_exam = Exam(name=exam_name)
            db.add(db_exam)
            db.commit()
            db.refresh(db_exam)
        
        # 2. Seed Subjects + Chapters linked to this Exam
        subject_objs = {}
        uncategorized_map = {}
        for sub_name, ch_names in SYLLABUS.items():
            db_sub = db.query(Subject).filter(Subject.name == sub_name, Subject.exam_id == db_exam.id).first()
            if not db_sub:
                db_sub = Subject(name=sub_name, exam_id=db_exam.id)
                db.add(db_sub)
                db.commit()
                db.refresh(db_sub)
            subject_objs[sub_name] = db_sub
            for ch_name in ch_names:
                db_ch = db.query(Chapter).filter(Chapter.name == ch_name, Chapter.subject_id == db_sub.id).first()
                if not db_ch:
                    db_ch = Chapter(name=ch_name, subject_id=db_sub.id)
                    db.add(db_ch)
            uncategorized = db.query(Chapter).filter(Chapter.name == "Uncategorized", Chapter.subject_id == db_sub.id).first()
            if not uncategorized:
                uncategorized = Chapter(name="Uncategorized", subject_id=db_sub.id)
                db.add(uncategorized)
            db.commit()
            uncategorized_map[sub_name] = uncategorized

        # Load dataset
        json_path = os.path.join("data", "jee.json")
        if not os.path.exists(json_path):
            print(f"Error: {json_path} not found.")
            return
        with open(json_path, "r") as f:
            data = json.load(f)

        for sub_name in ["physics", "chemistry", "maths"]:
            if sub_name not in data: continue
            db_sub = subject_objs[sub_name]
            chapters = db.query(Chapter).filter(Chapter.subject_id == db_sub.id).all()
            fallback_chapter = uncategorized_map[sub_name]
            questions = data[sub_name][:subset_limit]
            print(f"Loading {len(questions)} questions for {sub_name}...")
            for q_data in questions:
                content = q_data.get("question", "No question content")
                options = [str(o) for o in q_data.get("options", []) if str(o).lower() != "nan"]
                if not options: continue
                
                chapter = match_chapter(content, chapters) or fallback_chapter
                db_q = Question(
                    content=content,
                    source="JEE Dataset",
                    chapter_id=chapter.id,
                    options_json=json.dumps(options),
                    correct_answer=options[0] # Defaulting to first option as correct for demo
                )
                db.add(db_q)
            db.commit()
            print(f"Finished loading {sub_name}")
    except Exception as e:
        print(f"An error occurred: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    ingest_data(100)