import sys
import os
import json
import re
from rapidfuzz import process, fuzz

# Add the project root to the python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from db.database import SessionLocal, engine, Base
from db.models import Subject, Chapter, Question, Option

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

# -------------------------
# 🔧 Helpers
# -------------------------

def clean_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    return text


def match_chapter(question_text, chapters, threshold=65):
    if not chapters:
        return None

    cleaned_q = clean_text(question_text)
    chapter_names = [clean_text(ch.name) for ch in chapters]

    match, score, idx = process.extractOne(
        cleaned_q,
        chapter_names,
        scorer=fuzz.partial_ratio
    )

    if score >= threshold:
        return chapters[idx]

    return None


# -------------------------
# 🚀 Main ingestion
# -------------------------

def ingest_data(subset_limit=50):
    db = SessionLocal()

    try:
        # 1. Seed Subjects + Chapters (+ Uncategorized)
        subject_objs = {}
        uncategorized_map = {}

        for sub_name, chapters in SYLLABUS.items():
            db_sub = db.query(Subject).filter(Subject.name == sub_name).first()
            if not db_sub:
                db_sub = Subject(name=sub_name)
                db.add(db_sub)
                db.commit()
                db.refresh(db_sub)

            subject_objs[sub_name] = db_sub

            # create chapters
            for ch_name in chapters:
                db_ch = db.query(Chapter).filter(
                    Chapter.name == ch_name,
                    Chapter.subject_id == db_sub.id
                ).first()

                if not db_ch:
                    db_ch = Chapter(name=ch_name, subject_id=db_sub.id)
                    db.add(db_ch)

            # add fallback chapter
            uncategorized = db.query(Chapter).filter(
                Chapter.name == "Uncategorized",
                Chapter.subject_id == db_sub.id
            ).first()

            if not uncategorized:
                uncategorized = Chapter(
                    name="Uncategorized",
                    subject_id=db_sub.id
                )
                db.add(uncategorized)

            db.commit()
            uncategorized_map[sub_name] = uncategorized

        # 2. Load dataset
        json_path = os.path.join("data", "jee.json")

        if not os.path.exists(json_path):
            print(f"Error: {json_path} not found.")
            return

        with open(json_path, "r") as f:
            data = json.load(f)

        # 3. Insert questions
        for sub_name in ["physics", "chemistry", "maths"]:
            if sub_name not in data:
                continue

            db_sub = subject_objs[sub_name]
            chapters = db.query(Chapter).filter(
                Chapter.subject_id == db_sub.id
            ).all()

            fallback_chapter = uncategorized_map[sub_name]

            questions = data[sub_name][:subset_limit]
            print(f"Loading {len(questions)} questions for {sub_name}...")

            for q_data in questions:
                content = q_data.get("question", "No question content")
                options_data = q_data.get("options", [])

                # 🔍 Fuzzy match
                chapter = match_chapter(content, chapters)

                if not chapter:
                    chapter = fallback_chapter

                # Create question
                db_q = Question(
                    content=content,
                    source="JEE Dataset",
                    chapter_id=chapter.id
                )

                db.add(db_q)
                db.flush()

                # Add options
                for opt_content in options_data:
                    if str(opt_content).lower() == "nan":
                        continue

                    db_opt = Option(
                        content=str(opt_content),
                        is_correct=False,
                        question_id=db_q.id
                    )
                    db.add(db_opt)

            db.commit()
            print(f"Finished loading {sub_name}")

    except Exception as e:
        print(f"An error occurred: {e}")
        db.rollback()

    finally:
        db.close()


if __name__ == "__main__":
    ingest_data(50)