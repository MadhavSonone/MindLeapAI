from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
import datetime

from db.database import engine, get_db, SessionLocal
from db import models
import schemas
from orchestrator import SignalService
from agents.performance_analyst import PerformanceAnalyst
from agents.strategy_agent import StrategyAgent
from agents.tutor_agent import TutorAgent
from agents.practice_agent import PracticeAgent
from agents.discipline_coach import DisciplineCoach
from fastapi.middleware.cors import CORSMiddleware

# Initialize DB Tables
models.Base.metadata.create_all(bind=engine)


app = FastAPI(title="MindLeapAI - Agentic Exam Prep")

# Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For development; restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Orchestration Helpers ---

def run_orchestrator(user_id: int, db: Session):
    """
    The 'Core Brain' loop. 
    It checks for pending signals and triggers appropriate agents.
    """
    signals = SignalService.get_pending_signals(db)
    for signal in signals:
        print(f"Orchestrator: Processing signal {signal.signal_type}...")
        
        if signal.signal_type == "WEAK_TOPIC_DETECTED":
            # Analyst detected a weakness -> Trigger Strategy to adjust plan
            import json
            payload = json.loads(signal.payload)
            strategy = StrategyAgent(db)
            strategy.respond_to_weakness(user_id, payload['chapter_id'], payload['accuracy'])
            
        elif signal.signal_type == "PLAN_UPDATED":
            # Just a log signal for now
            pass
            
        SignalService.mark_signal_processed(db, signal.id)

# --- Endpoints ---

@app.post("/progress")
def submit_progress(progress: schemas.UserProgressCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # 1. Save Progress
    db_progress = models.UserProgress(
        user_id=progress.user_id,
        question_id=progress.question_id,
        status=progress.status,
        timestamp=datetime.datetime.now().isoformat()
    )
    db.add(db_progress)
    db.commit()

    # 2. Trigger Analyst & Orchestrator in background
    def background_processing():
        from graphs.study_graph import study_graph
        try:
            # Get chapter_id for the question
            db_bg = SessionLocal()
            question = db_bg.query(models.Question).filter(models.Question.id == progress.question_id).first()
            if question and question.chapter_id:
                # Trigger the LangGraph
                study_graph.invoke({
                    "user_id": progress.user_id,
                    "chapter_id": question.chapter_id,
                    "latest_status": progress.status,
                    "signals": [],
                    "next_action": ""
                })
            db_bg.close()
        except Exception as e:
            print(f"Graph Error: {e}")

    background_tasks.add_task(background_processing)
    
    return {"status": "accepted", "message": "Progress recorded and agents triggered."}

# --- Agent Specialized Endpoints ---

@app.post("/agents/strategy/initialize")
def initialize_strategy(body: dict, db: Session = Depends(get_db)):
    user_id = body.get("user_id")
    goal_date = body.get("goalDate")
    daily_hours = body.get("dailyHours")
    target_exam = body.get("targetExam")
    
    # Ensure user preferences exist
    pref = db.query(models.UserPreferences).filter(models.UserPreferences.user_id == user_id).first()
    if not pref:
        # Create default pref if missing
        pref = models.UserPreferences(
            user_id=user_id, 
            goal_date=goal_date,
            daily_hours=daily_hours,
            target_exam=target_exam
        )
        db.add(pref)
        db.commit()
    
    strategy = StrategyAgent(db)
    strategy.generate_initial_plan(user_id)
    return {"status": "success", "message": "Initial study plan generated."}

@app.get("/agents/performance/heatmap", response_model=List[schemas.ChapterMastery])
def get_performance_heatmap(user_id: int, db: Session = Depends(get_db)):
    mastery = db.query(models.ChapterMastery).filter(models.ChapterMastery.user_id == user_id).all()
    return mastery

@app.get("/agents/tutor/explain/{question_id}")
def get_explanation(question_id: int, user_id: int, level: str = "beginner", db: Session = Depends(get_db)):
    tutor = TutorAgent(db)
    explanation = tutor.explain_question(question_id, user_id, level)
    return {"explanation": explanation}

@app.get("/agents/coach/nudge")
def get_daily_nudge(user_id: int, db: Session = Depends(get_db)):
    coach = DisciplineCoach(db)
    nudge = coach.generate_daily_nudge(user_id)
    return {"nudge": nudge}

@app.get("/agents/map")
def get_agent_map():
    from graphs.study_graph import study_graph
    # Generate mermaid diagram
    try:
        mermaid_graph = study_graph.get_graph().draw_mermaid()
        return {"mermaid": mermaid_graph}
    except Exception as e:
        return {"error": str(e)}

@app.get("/subjects")
def get_subjects(db: Session = Depends(get_db)):
    subjects = db.query(models.Subject.id, models.Subject.name).all()
    return [{"id": s[0], "name": s[1]} for s in subjects]

@app.get("/subjects/{selectedSubjectId}/chapters")
def get_chapters(selectedSubjectId: int, db: Session = Depends(get_db)):
    chapters = db.query(models.Chapter).filter(models.Chapter.subject_id == selectedSubjectId).all()
    print(f"Chapters: {chapters}")
    if not chapters:
        return []
    return chapters

@app.get("/subject/tasks/")
def get_tasks(user_id: int, db: Session = Depends(get_db)):
    tasks = db.query(models.StudyPlanTask).filter(models.StudyPlanTask.target_date == datetime.today().strftime('%Y-%m-%d'))
    if not tasks:
        return {"Tasks": None}
    return {"Tasks": tasks}

        