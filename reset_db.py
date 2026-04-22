import os
import sys

# Add root to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from db.database import engine, Base
from db.models import UserPreferences, Chapter, Subject, Question, StudyPlanTask

def reset_db():
    print("Force resetting database schema...")
    db_path = "database.db"
    
    # Try to delete file if it exists
    if os.path.exists(db_path):
        try:
            os.remove(db_path)
            print(f"Deleted {db_path}")
        except Exception as e:
            print(f"Could not delete {db_path} (maybe it's locked?): {e}")
            print("Trying to drop tables instead...")
            Base.metadata.drop_all(bind=engine)
    
    # Create all
    Base.metadata.create_all(bind=engine)
    print("Database tables recreated with new schema.")

if __name__ == "__main__":
    reset_db()
    print("Now run 'python data/ingest.py' to re-populate data.")
