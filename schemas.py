from pydantic import BaseModel
from typing import List, Optional

class OptionBase(BaseModel):
    content: str
    is_correct: bool = False

class OptionCreate(OptionBase):
    pass

class Option(OptionBase):
    id: int
    question_id: int

    class Config:
        from_attributes = True

class QuestionBase(BaseModel):
    content: str
    source: Optional[str] = None
    chapter_id: Optional[int] = None

class QuestionCreate(QuestionBase):
    options: List[OptionCreate]

class Question(QuestionBase):
    id: int
    options: List[Option]

    class Config:
        from_attributes = True

class ChapterBase(BaseModel):
    name: str
    subject_id: int

class ChapterCreate(ChapterBase):
    pass

class Chapter(ChapterBase):
    id: int
    questions: List[Question] = []

    class Config:
        from_attributes = True

class SubjectBase(BaseModel):
    name: str

class SubjectCreate(SubjectBase):
    pass

class Subject(SubjectBase):
    id: int
    chapters: List[Chapter] = []

    class Config:
        orm_mode = True

class UserProgressCreate(BaseModel):
    user_id: int
    question_id: int
    status: str

# --- Agent Schemas ---

class UserPreferencesBase(BaseModel):
    user_id: int
    target_exam: str
    goal_date: str
    daily_availability_hours: int

class UserPreferences(UserPreferencesBase):
    id: int
    strengths_summary: Optional[str] = None
    class Config:
        from_attributes = True

class ChapterMasteryBase(BaseModel):
    user_id: int
    chapter_id: int
    mastery_score: int
    recent_accuracy: int

class ChapterMastery(ChapterMasteryBase):
    id: int
    last_attempted_at: Optional[str] = None
    class Config:
        from_attributes = True

class AgentSignalBase(BaseModel):
    user_id: int
    signal_type: str
    source_agent: str
    payload: str
    created_at: str

class AgentSignal(AgentSignalBase):
    id: int
    status: str
    class Config:
        from_attributes = True

class StudyPlanTaskBase(BaseModel):
    user_id: int
    chapter_id: int
    task_type: str
    target_date: str
    estimated_minutes: int = 60
    concepts: Optional[str] = None
    priority: int = 1

class StudyPlanTask(StudyPlanTaskBase):
    id: int
    is_completed: bool
    class Config:
        from_attributes = True

# --- Agent Output Models (for Structured Output) ---

class StudyTaskOutput(BaseModel):
    date: str
    chapter: str
    type: str # LEARN, PRACTICE, REVISE, MOCK
    estimated_minutes: int
    concepts: str # Key concepts to focus on
    priority: int

class StudyPlanOutput(BaseModel):
    tasks: List[StudyTaskOutput]

class SolvedQuestionOutput(BaseModel):
    correct_option_index: int
    steps: List[str]
    core_concept: str
    explanation_summary: str
