from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base
import datetime

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    created_at = Column(String, default=lambda: datetime.datetime.now().isoformat())

class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)

    chapters = relationship("Chapter", back_populates="subject")

class Chapter(Base):
    __tablename__ = "chapters"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"))

    subject = relationship("Subject", back_populates="chapters")
    questions = relationship("Question", back_populates="chapter")

class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(String)
    source = Column(String, nullable=True) # e.g. Year, Paper
    chapter_id = Column(Integer, ForeignKey("chapters.id"), nullable=True)
    options_json = Column(String, nullable=True) # JSON list: ["Option 1", "Option 2", ...]
    correct_answer = Column(String, nullable=True) # The exact content of the correct option

    chapter = relationship("Chapter", back_populates="questions")

class UserProgress(Base):
    __tablename__ = "user_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"))
    status = Column(String) # correct, incorrect, skipped
    timestamp = Column(String) # simple string timestamp for now

# --- Shared State (Agent Tracks) ---

class UserPreferences(Base):
    __tablename__ = "user_preferences"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, unique=True, index=True)
    target_exam = Column(String, default="JEE Main")
    goal_date = Column(String) # YYYY-MM-DD
    daily_availability_hours = Column(Integer, default=4)
    completed_chapters = Column(String, nullable=True) # JSON list of chapter IDs
    strengths_summary = Column(String, nullable=True) # JSON or summary text

class ChapterMastery(Base):
    __tablename__ = "chapter_mastery"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id"))
    mastery_score = Column(Integer, default=0) # 0 to 100
    recent_accuracy = Column(Integer, default=0)
    last_attempted_at = Column(String, nullable=True)

class AgentSignal(Base):
    __tablename__ = "agent_signals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    signal_type = Column(String) # e.g., WEAKNESS_DETECTED, PLAN_UPDATED, NUDGE
    source_agent = Column(String) # Analyst, Strategy, Coach, etc.
    payload = Column(String) # JSON detailed insight
    status = Column(String, default="PENDING") # PENDING, PROCESSED
    created_at = Column(String)

class StudyPlanTask(Base):
    __tablename__ = "study_plan_tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id"))
    task_type = Column(String) # LEARN, PRACTICE, REVISE, MOCK
    target_date = Column(String) # YYYY-MM-DD
    is_completed = Column(Boolean, default=False)
    priority = Column(Integer, default=1)

class AgentInteraction(Base):
    __tablename__ = "agent_interactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    agent_role = Column(String) # Tutor, Coach
    input_query = Column(String)
    output_response = Column(String)
    timestamp = Column(String)

class MockAttempt(Base):
    __tablename__ = "mock_attempts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    score = Column(Integer)
    total_questions = Column(Integer)
    report_json = Column(String) # JSON blob: { "chapter_name": accuracy, ... }
    answers_json = Column(String) # JSON blob: { "question_id": "answer", ... }
    timestamp = Column(String)
