from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import cast, String, Date
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
import json
from jose import JWTError, jwt
from passlib.context import CryptContext
import hashlib

# Auth Setup
SECRET_KEY = "mindleap_secret_key_change_me"
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

def get_password_hash(password):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=7)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

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

# --- Auth Endpoints ---

@app.post("/auth/register")
def register(body: dict, db: Session = Depends(get_db)):
    email = body.get("email")
    password = body.get("password")
    
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = models.User(
        email=email,
        hashed_password=get_password_hash(password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    token = create_access_token({"sub": str(user.id)})
    return {"token": token, "user_id": user.id, "email": user.email, "is_onboarded": False}

@app.post("/auth/login")
def login(body: dict, db: Session = Depends(get_db)):
    email = body.get("email")
    password = body.get("password")
    
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    
    user_prefs = db.query(models.UserPreferences).filter(models.UserPreferences.user_id == user.id).first()
    is_onboarded = user_prefs is not None
    
    token = create_access_token({"sub": str(user.id)})
    return {"token": token, "user_id": user.id, "email": user.email, "is_onboarded": is_onboarded}

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
    completed_chapters = body.get("completedChapters", []) # List of chapter IDs
    
    # Ensure user preferences exist
    pref = db.query(models.UserPreferences).filter(models.UserPreferences.user_id == user_id).first()
    if not pref:
        pref = models.UserPreferences(
            user_id=user_id, 
            goal_date=goal_date,
            daily_availability_hours=daily_hours,
            target_exam=target_exam,
            completed_chapters=json.dumps(completed_chapters)
        )
        db.add(pref)
    else:
        pref.goal_date = goal_date
        pref.daily_availability_hours = daily_hours
        pref.target_exam = target_exam
        pref.completed_chapters = json.dumps(completed_chapters)
    
    db.commit()
    
    strategy = StrategyAgent(db)
    strategy.generate_initial_plan(user_id)
    return {"status": "success", "message": "Initial study plan generated."}

@app.post("/agents/strategy/recalibrate")
def recalibrate_strategy(body: dict, db: Session = Depends(get_db)):
    user_id = body.get("user_id")
    strategy = StrategyAgent(db)
    # This will re-generate the 7-day plan based on current mastery and prefs
    strategy.generate_initial_plan(user_id)
    return {"status": "success", "message": "Strategy recalibrated."}

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

@app.get("/subjects/{subjectId}/chapters")
def get_chapters(subjectId: int, db: Session = Depends(get_db)):
    chapters = db.query(models.Chapter).filter(models.Chapter.subject_id == subjectId).all()
    if not chapters:
        return []
    return chapters

@app.get("/chapters/{chapterId}/questions")
def get_questions(chapterId: int, db: Session = Depends(get_db)):
    questions = db.query(models.Question).filter(models.Question.chapter_id == chapterId).all()
    if not questions:
        return []
    return questions

@app.get("/stats/progress/{user_id}")
def get_chapter_progress(user_id: int, db: Session = Depends(get_db)):
    # Calculate solved vs total questions per chapter
    from sqlalchemy import func
    
    results = db.query(
        models.Chapter.id,
        models.Chapter.name,
        func.count(models.Question.id).label("total_questions"),
        func.count(models.UserProgress.id).label("solved_questions")
    ).outerjoin(models.Question, models.Chapter.id == models.Question.chapter_id)\
     .outerjoin(models.UserProgress, (models.Question.id == models.UserProgress.question_id) & (models.UserProgress.user_id == user_id))\
     .group_by(models.Chapter.id).all()
    
    return [
        {
            "chapter_id": r[0],
            "name": r[1],
            "total": r[2],
            "solved": r[3]
        } for r in results
    ]

@app.get("/dashboard/weekly/{user_id}")
def get_weekly_plan(user_id: int, db: Session = Depends(get_db)):
    today = datetime.date.today()
    week_later = today + datetime.timedelta(days=7)
    
    tasks = db.query(models.StudyPlanTask).filter(
        models.StudyPlanTask.user_id == user_id,
        models.StudyPlanTask.target_date >= today.isoformat(),
        models.StudyPlanTask.target_date <= week_later.isoformat()
    ).order_by(models.StudyPlanTask.target_date, models.StudyPlanTask.priority.desc()).all()
    
    return tasks

@app.post("/agents/practice/schedule-mock")
def schedule_mock(body: dict, db: Session = Depends(get_db)):
    user_id = body.get("user_id")
    chapter_id = body.get("chapter_id")
    
    # Schedule for tomorrow
    tomorrow = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()
    
    new_task = models.StudyPlanTask(
        user_id=user_id,
        chapter_id=chapter_id,
        task_type="MOCK",
        target_date=tomorrow,
        priority=3, # High priority for mocks
        is_completed=False
    )
    db.add(new_task)
    db.commit()
    return {"status": "success", "message": f"Unit mock scheduled for {tomorrow}"}
@app.get("/stats/streak/{user_id}")
def get_user_streak(user_id: int, db: Session = Depends(get_db)):
    # Calculate streak based on consecutive days in UserProgress
    
    # Get all distinct dates user has progress
    dates = db.query(
        cast(models.UserProgress.timestamp, String) # Assuming timestamp is ISO format
    ).filter(models.UserProgress.user_id == user_id).distinct().all()
    
    # Simple logic: extract date part and count consecutive
    active_dates = sorted(list(set([d[0].split('T')[0] for d in dates])), reverse=True)
    
    if not active_dates:
        return {"streak": 0}
        
    streak = 0
    current_check = datetime.date.today()
    
    # If today is not active, check if yesterday was (to allow for today's ongoing streak)
    if active_dates[0] != current_check.isoformat():
        current_check -= datetime.timedelta(days=1)
        if active_dates[0] != current_check.isoformat():
            return {"streak": 0}

    for date_str in active_dates:
        if date_str == current_check.isoformat():
            streak += 1
            current_check -= datetime.timedelta(days=1)
        else:
            break
            
    return {"streak": streak}

@app.get("/mock/generate")
def generate_mock_test(db: Session = Depends(get_db)):
    # Balanced Full Mock: Try to get 10 questions per subject if possible
    import random
    subjects = db.query(models.Subject).all()
    mock_questions = []
    
    for sub in subjects:
        sub_questions = db.query(models.Question).join(models.Chapter).filter(models.Chapter.subject_id == sub.id).all()
        if len(sub_questions) >= 10:
            mock_questions.extend(random.sample(sub_questions, 10))
        else:
            mock_questions.extend(sub_questions)
            
    # Fallback if too few questions
    if len(mock_questions) < 15:
        all_q = db.query(models.Question).all()
        return random.sample(all_q, min(len(all_q), 15))
        
    random.shuffle(mock_questions)
    return mock_questions

@app.get("/mock/generate/unit/{chapter_id}")
def generate_unit_test(chapter_id: int, db: Session = Depends(get_db)):
    # Focused Practice: 15 questions from a single chapter
    import random
    questions = db.query(models.Question).filter(models.Question.chapter_id == chapter_id).all()
    if len(questions) < 15:
        return questions
    return random.sample(questions, 15)

@app.post("/mock/submit")
def submit_mock_test(body: dict, db: Session = Depends(get_db)):
    user_id = body.get("user_id")
    answers = body.get("answers") # { question_id: answer_content }
    
    score = 0
    total = len(answers)
    report = {} # { chapter_name: { correct: 0, total: 0 } }
    
    for q_id, user_ans in answers.items():
        question = db.query(models.Question).filter(models.Question.id == int(q_id)).first()
        if not question: continue
        
        chapter_name = question.chapter.name if question.chapter else "General"
        if chapter_name not in report:
            report[chapter_name] = {"correct": 0, "total": 0}
        
        report[chapter_name]["total"] += 1
        
        # Check correctness using the new correct_answer field
        if question.correct_answer and question.correct_answer == user_ans:
            score += 1
            report[chapter_name]["correct"] += 1

    # Format report for DB
    final_report = {k: (v["correct"] / v["total"]) * 100 for k, v in report.items()}
    
    import json
    attempt = models.MockAttempt(
        user_id=user_id,
        score=score,
        total_questions=total,
        report_json=json.dumps(final_report),
        answers_json=json.dumps(answers),
        timestamp=datetime.datetime.now().isoformat()
    )
    db.add(attempt)
    db.commit()
    
    return {"status": "success", "attempt_id": attempt.id, "score": score, "total": total}

@app.get("/mock/history/{user_id}")
def get_mock_history(user_id: int, db: Session = Depends(get_db)):
    attempts = db.query(models.MockAttempt).filter(models.MockAttempt.user_id == user_id).order_by(models.MockAttempt.timestamp.desc()).all()
    return attempts

@app.get("/mock/report/{attempt_id}")
def get_mock_report(attempt_id: int, db: Session = Depends(get_db)):
    attempt = db.query(models.MockAttempt).filter(models.MockAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    
    import json
    return {
        "score": attempt.score,
        "total": attempt.total_questions,
        "timestamp": attempt.timestamp,
        "report": json.loads(attempt.report_json)
    }
        